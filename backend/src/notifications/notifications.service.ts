import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../signals/signals.service';

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

/**
 * Notifiche personalizzate (spec sez. 9): promemoria e alert non ripetitivi.
 * Canale in-app (l'email/push arriveranno con preferenze e consensi dedicati).
 * Regola d'oro: MAI due notifiche dello stesso tipo nello stesso giorno.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Crea la notifica solo se oggi non ne esiste già una dello stesso tipo. */
  async notifyOncePerDay(input: NotifyInput): Promise<boolean> {
    const today = toDateOnly();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        scheduledFor: { gte: today, lt: tomorrow },
      },
    });
    if (existing) return false;
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: { title: input.title, body: input.body, ...(input.payload ?? {}) } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(), // in-app: disponibile subito
      },
    });
    return true;
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { scheduledFor: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notifica non trovata');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  // ---------- Generazione giornaliera (chiamata dal cron) ----------

  async generateDailyForClient(clientId: string): Promise<string[]> {
    const created: string[] = [];
    const today = toDateOnly();
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      include: {
        assignedCoach: { select: { userId: true, displayName: true } },
        user: { select: { email: true } },
      },
    });
    if (!profile?.onboardingCompletedAt) return created;

    const [checkinToday, lastMeasurement, activePause, upcomingEvents] = await Promise.all([
      this.prisma.dailyCheckin.findUnique({
        where: { clientId_date: { clientId, date: today } },
      }),
      this.prisma.measurement.findFirst({ where: { clientId }, orderBy: { date: 'desc' } }),
      this.prisma.event.findFirst({
        where: { clientId, mode: 'pause_period', startDate: { lte: today }, endDate: { gte: today } },
      }),
      this.prisma.event.findMany({
        where: {
          clientId,
          mode: 'single_event',
          startDate: { gte: today, lte: new Date(today.getTime() + 3 * 86_400_000) },
        },
      }),
    ]);

    // 1. Promemoria check-in (sempre, anche in pausa: il monitoraggio continua).
    if (!checkinToday) {
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'checkin_reminder',
        title: 'Come va oggi?',
        body: 'Trenta secondi per il check-in: umore ed energia guidano il tuo piano.',
      })) created.push('checkin_reminder');
    }

    // 2. Promemoria misure (~ogni 2 giorni).
    const daysSinceMeasure = lastMeasurement
      ? Math.floor((today.getTime() - lastMeasurement.date.getTime()) / 86_400_000)
      : Infinity;
    if (daysSinceMeasure >= 2) {
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'measurement_reminder',
        title: 'Giorno di misure',
        body: 'Peso e centimetri di oggi: bastano due minuti, contano le tendenze.',
      })) created.push('measurement_reminder');
    }

    // 3. Countdown pre-evento (spec: anticipare, non punire).
    for (const event of upcomingEvents as { label: string | null; type: string; startDate: Date }[]) {
      const days = Math.round((event.startDate.getTime() - today.getTime()) / 86_400_000);
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'pre_event',
        title: days === 0 ? 'Oggi ti godi l\'evento!' : `Evento tra ${days} giorni`,
        body:
          days === 0
            ? 'Nessun menu oggi: libertà senza sensi di colpa. Domani si riparte insieme.'
            : 'Nei giorni prima alleggeriamo il piano, così arrivi serena.',
        payload: { eventLabel: event.label ?? event.type, daysToEvent: days },
      })) created.push('pre_event');
    }

    // 4. Mini-piano in pausa: scostamento oltre soglia rispetto all'inizio pausa.
    if (activePause?.startWeightKg && lastMeasurement) {
      const trigger = await this.configParams.getNumber('pause_deviation_trigger', 1.5);
      const deviation = lastMeasurement.weightKg - activePause.startWeightKg;
      if (deviation >= trigger) {
        const sent = await this.notifyOncePerDay({
          userId: clientId,
          type: 'mini_plan',
          title: 'Un piccolo aiuto per restare in equilibrio',
          body: `Il peso è salito di ${Math.round(deviation * 10) / 10} kg da inizio pausa: ecco un mini-piano leggero per i prossimi giorni, poi si riprende normalmente.`,
          payload: { deviationKg: Math.round(deviation * 10) / 10 },
        });
        if (sent) {
          created.push('mini_plan');
          await this.prisma.event.update({
            where: { id: activePause.id },
            data: { planPhaseState: 'mini_plan_active' },
          });
        }
      }
    }

    // 5. Alert alla coach: stallo o assenza di check-in oltre soglia (config).
    if (profile.assignedCoach?.userId) {
      const [stallThreshold, noCheckinThreshold] = await Promise.all([
        this.configParams.getNumber('stall_days_before_coach_alert', 6),
        this.configParams.getNumber('no_checkin_days_before_alert', 4),
      ]);
      const lastCheckin = await this.prisma.dailyCheckin.findFirst({
        where: { clientId },
        orderBy: { date: 'desc' },
      });
      const daysSinceCheckin = lastCheckin
        ? Math.floor((today.getTime() - lastCheckin.date.getTime()) / 86_400_000)
        : Infinity;
      if (daysSinceCheckin >= noCheckinThreshold) {
        if (await this.notifyOncePerDay({
          userId: profile.assignedCoach.userId,
          type: 'no_checkin_coach_alert',
          title: 'Cliente silenziosa',
          body: `${profile.name ?? profile.user.email}: nessun check-in da ${daysSinceCheckin === Infinity ? 'sempre' : daysSinceCheckin + ' giorni'}. Un messaggio può riaccendere il percorso.`,
          payload: { clientId, daysSinceCheckin: daysSinceCheckin === Infinity ? null : daysSinceCheckin },
        })) created.push('no_checkin_coach_alert');
      }

      // Stallo: media mobile ferma oltre soglia (riusa il flag già calcolato dal motore, se c'è).
      const lastDecision = await this.prisma.engineDecision.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      });
      const stallDays = (lastDecision?.inputs as { signals?: { stallDays?: number } } | null)?.signals?.stallDays ?? 0;
      if (stallDays >= stallThreshold && !activePause) {
        if (await this.notifyOncePerDay({
          userId: profile.assignedCoach.userId,
          type: 'stall_coach_alert',
          title: 'Peso in stallo',
          body: `${profile.name ?? profile.user.email}: media mobile ferma da ${stallDays} giorni. Il motore ha già adattato il piano: può servire anche la tua voce.`,
          payload: { clientId, stallDays },
        })) created.push('stall_coach_alert');
      }
    }

    return created;
  }

  /** Batch giornaliero per tutte le clienti attive (chiamato dal cron). */
  async generateDailyBatch() {
    const clients = await this.prisma.clientProfile.findMany({
      where: { onboardingCompletedAt: { not: null }, user: { status: 'active', deletedAt: null } },
      select: { userId: true },
    });
    const summary = { clients: clients.length, notifications: 0, errors: 0 };
    for (const c of clients as { userId: string }[]) {
      try {
        const created = await this.generateDailyForClient(c.userId);
        summary.notifications += created.length;
      } catch (err) {
        summary.errors++;
        this.logger.error(`Notifiche fallite per ${c.userId}`, err instanceof Error ? err.stack : String(err));
      }
    }
    return summary;
  }
}
