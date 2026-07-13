import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../signals/signals.service';

const DAY = 86_400_000;
const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const PRIORITY_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

/** Un alert "desiderato" calcolato dai segnali del cliente. */
interface DesiredAlert {
  type: string;
  group: 'corpo_misure' | 'aderenza_vita' | 'gusto_mente' | 'agenda_op';
  priority: 'high' | 'med' | 'low';
  title: string;
  detail?: string;
  dueDate?: Date | null;
}

const ACTIVE_STATUSES = ['open', 'handled', 'escalated'];

interface MeasRow {
  date: Date;
  weightKg: number;
}
interface ActiveAlert {
  id: string;
  type: string;
}

/** Riga alert come letta dal DB (il client Prisma nello schema è tipizzato a runtime). */
interface AlertRow {
  id: string;
  clientId: string;
  coachId: string | null;
  group: string;
  type: string;
  priority: string;
  title: string;
  detail: string | null;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert engine (Metabole_Backend_Operazioni §5): genera e sincronizza la coda di
 * avvisi per la coach a partire dai segnali reali del cliente. È idempotente:
 * `recompute` crea gli alert mancanti e mette a `resolved` quelli la cui condizione
 * non vale più. Soglie in config_param (mai hardcodate).
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly menu: MenuService,
  ) {}

  /** Ricalcola gli alert di un cliente e sincronizza la tabella. */
  async recompute(clientId: string): Promise<{ desired: number; resolved: number }> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, character: true, planStartDate: true },
    });
    const coachId = profile?.assignedCoachId ?? null;
    const desired = await this.computeDesired(clientId, profile);
    return this.sync(clientId, coachId, desired);
  }

  /** Ricalcola per tutti i clienti attivi (chiamato dal cron giornaliero). */
  async recomputeAllBatch(): Promise<{ clients: number; errors: number }> {
    const clients = await this.prisma.clientProfile.findMany({
      where: { onboardingCompletedAt: { not: null }, user: { status: 'active', deletedAt: null } },
      select: { userId: true },
    });
    const summary = { clients: clients.length, errors: 0 };
    for (const c of clients as { userId: string }[]) {
      try {
        await this.recompute(c.userId);
      } catch (err) {
        summary.errors++;
        this.logger.error(`Alert recompute fallito per ${c.userId}`, err instanceof Error ? err.stack : String(err));
      }
    }
    return summary;
  }

  // ---------- Calcolo degli alert desiderati ----------

  private async computeDesired(
    clientId: string,
    profile: { character: string | null; planStartDate: Date | null } | null,
  ): Promise<DesiredAlert[]> {
    const [
      inactiveDays,
      waterLowDays,
      lowRatingsCount,
      eventIncomingDays,
      weightGainDays,
      stallDays,
      noCheckinDays,
      lowRatingStars,
      waterGoal,
    ] = await Promise.all([
      this.configParams.getNumber('alert_inactive_days', 3),
      this.configParams.getNumber('alert_water_low_days', 3),
      this.configParams.getNumber('alert_low_ratings_count', 3),
      this.configParams.getNumber('alert_event_incoming_days', 3),
      this.configParams.getNumber('alert_weight_gain_days', 7),
      this.configParams.getNumber('stall_days_before_coach_alert', 6),
      this.configParams.getNumber('no_checkin_days_before_alert', 4),
      this.configParams.getNumber('low_rating_threshold_stars', 2),
      this.configParams.getNumber('water_goal_glasses', 8),
    ]);

    const today = toDateOnly();
    const since = (days: number) => new Date(today.getTime() - days * DAY);

    const [gate, measures, checkins, ratings, waterLogs, upcomingEvent, escalation, milestone, lastEvent] =
      await Promise.all([
        this.menu.measurementGate(clientId),
        this.prisma.measurement.findMany({
          where: { clientId, date: { gte: since(30) } },
          orderBy: { date: 'asc' },
          select: { date: true, weightKg: true },
        }),
        this.prisma.dailyCheckin.findMany({
          where: { clientId },
          orderBy: { date: 'desc' },
          take: 7,
          select: { date: true, mood: true },
        }),
        this.prisma.recipeRating.findMany({
          where: { clientId, date: { gte: since(14) } },
          select: { stars: true },
        }),
        this.prisma.waterLog.findMany({
          where: { clientId, date: { gte: since(waterLowDays) } },
          select: { glasses: true, goal: true },
        }),
        this.prisma.event.findFirst({
          where: { clientId, startDate: { gte: today, lte: since(-eventIncomingDays) } },
          orderBy: { startDate: 'asc' },
          select: { label: true, type: true, startDate: true },
        }),
        this.prisma.escalation.findFirst({
          where: { clientId, status: 'open' },
          select: { id: true },
        }),
        this.prisma.milestone.findFirst({
          where: { clientId, achievedAt: { gte: since(1) } },
          orderBy: { achievedAt: 'desc' },
          select: { label: true },
        }),
        this.prisma.analyticsEvent.findFirst({
          where: { userId: clientId },
          orderBy: { receivedAt: 'desc' },
          select: { receivedAt: true },
        }),
      ]);

    const desired: DesiredAlert[] = [];

    // 1. Corpo & misure — misure mancanti (dal gate, Fase 2).
    if (gate.blocking) {
      desired.push({
        type: 'missing_measurements',
        group: 'corpo_misure',
        priority: 'high',
        title: 'Misure mancanti',
        detail: 'Le misure del ciclo non sono ancora state inserite: il menu successivo è in attesa.',
        dueDate: gate.cycleDate ? toDateOnly(gate.cycleDate) : null,
      });
    }

    // 2/3. Corpo & misure — aumento peso / plateau.
    const gainWindow = measures.filter((m: MeasRow) => m.date.getTime() >= since(weightGainDays).getTime());
    const stallWindow = measures.filter((m: MeasRow) => m.date.getTime() >= since(stallDays).getTime());
    if (gainWindow.length >= 2 && gainWindow[gainWindow.length - 1].weightKg > gainWindow[0].weightKg + 0.05) {
      const delta = Math.round((gainWindow[gainWindow.length - 1].weightKg - gainWindow[0].weightKg) * 10) / 10;
      desired.push({
        type: 'weight_gain',
        group: 'corpo_misure',
        priority: 'med',
        title: 'Peso in aumento',
        detail: `+${delta} kg negli ultimi ${weightGainDays} giorni.`,
      });
    } else if (stallWindow.length >= 2 && stallWindow[stallWindow.length - 1].weightKg >= stallWindow[0].weightKg - 0.05) {
      desired.push({
        type: 'plateau',
        group: 'corpo_misure',
        priority: 'med',
        title: 'Nessun calo',
        detail: `Peso fermo da ${stallDays} giorni.`,
      });
    }

    // 4. Aderenza & vita — inattività (segnale più forte: se attiva, salta checkin/acqua).
    const activityTimes: number[] = [];
    if (lastEvent) activityTimes.push(lastEvent.receivedAt.getTime());
    if (checkins[0]) activityTimes.push(checkins[0].date.getTime());
    if (measures.length) activityTimes.push(measures[measures.length - 1].date.getTime());
    const lastActivity = activityTimes.length ? Math.max(...activityTimes) : null;
    const daysInactive = lastActivity != null ? Math.floor((today.getTime() - lastActivity) / DAY) : null;
    const isInactive = daysInactive != null && daysInactive >= inactiveDays;

    if (isInactive) {
      desired.push({
        type: 'inactive',
        group: 'aderenza_vita',
        priority: 'high',
        title: 'Cliente inattiva',
        detail: `Non usa l'app da ${daysInactive} giorni.`,
      });
    } else {
      // 5. Check-in saltato.
      if (checkins[0]) {
        const daysNoCheckin = Math.floor((today.getTime() - checkins[0].date.getTime()) / DAY);
        if (daysNoCheckin >= noCheckinDays) {
          desired.push({
            type: 'checkin_skipped',
            group: 'aderenza_vita',
            priority: 'med',
            title: 'Check-in saltati',
            detail: `Nessun check-in da ${daysNoCheckin} giorni.`,
          });
        }
      }
      // 6. Acqua sotto obiettivo.
      if (waterLogs.length >= 1 && waterLogs.every((w: { glasses: number; goal: number }) => w.glasses < (w.goal || waterGoal))) {
        desired.push({
          type: 'water_low',
          group: 'aderenza_vita',
          priority: 'low',
          title: 'Poca acqua',
          detail: `Sotto l'obiettivo da ${waterLowDays} giorni.`,
        });
      }
    }

    // 7. Gusto & Mente — troppe valutazioni basse.
    const lowRatings = ratings.filter((r: { stars: number }) => r.stars <= lowRatingStars).length;
    if (lowRatings >= lowRatingsCount) {
      desired.push({
        type: 'low_ratings',
        group: 'gusto_mente',
        priority: 'med',
        title: 'Menu poco graditi',
        detail: `${lowRatings} valutazioni basse di recente.`,
      });
    }

    // 8. Gusto & Mente — rischio abbandono (umore basso + carattere "molla").
    const lowMood = checkins.filter((c: { mood: string }) => c.mood === 'hard' || c.mood === 'stressed').length;
    if (profile?.character === 'quits' && lowMood >= 2) {
      desired.push({
        type: 'dropout_risk',
        group: 'gusto_mente',
        priority: 'high',
        title: 'Rischio abbandono',
        detail: 'Umore basso ripetuto e profilo a rischio: serve un contatto.',
      });
    }

    // 9. Agenda/Op. — evento in arrivo.
    if (upcomingEvent) {
      desired.push({
        type: 'event_incoming',
        group: 'agenda_op',
        priority: 'med',
        title: 'Evento in arrivo',
        detail: `${upcomingEvent.label ?? upcomingEvent.type} il ${upcomingEvent.startDate.toISOString().slice(0, 10)}.`,
        dueDate: toDateOnly(upcomingEvent.startDate.toISOString()),
      });
    }

    // 10. Agenda/Op. — escalation clinica aperta (la coach vede solo lo stato).
    if (escalation) {
      desired.push({
        type: 'escalation_open',
        group: 'agenda_op',
        priority: 'med',
        title: 'In gestione col nutrizionista',
        detail: 'Un tema è stato inoltrato al nutrizionista.',
      });
    }

    // 11. Agenda/Op. — traguardo raggiunto (positivo).
    if (milestone) {
      desired.push({
        type: 'milestone',
        group: 'agenda_op',
        priority: 'low',
        title: 'Traguardo raggiunto',
        detail: milestone.label,
      });
    }

    return desired;
  }

  // ---------- Sincronizzazione con la tabella ----------

  private async sync(
    clientId: string,
    coachId: string | null,
    desired: DesiredAlert[],
  ): Promise<{ desired: number; resolved: number }> {
    const active = await this.prisma.alert.findMany({
      where: { clientId, status: { in: ACTIVE_STATUSES } },
      select: { id: true, type: true },
    });
    const activeByType = new Map((active as ActiveAlert[]).map((a) => [a.type, a.id] as const));
    const desiredTypes = new Set(desired.map((d) => d.type));

    // Crea gli alert desiderati non ancora presenti.
    const toCreate = desired.filter((d) => !activeByType.has(d.type));
    if (toCreate.length) {
      await this.prisma.alert.createMany({
        data: toCreate.map((d) => ({
          clientId,
          coachId,
          group: d.group,
          type: d.type,
          priority: d.priority,
          title: d.title,
          detail: d.detail ?? null,
          dueDate: d.dueDate ?? null,
        })),
      });
    }

    // Risolvi gli alert attivi la cui condizione non vale più.
    const toResolve = (active as ActiveAlert[]).filter((a) => !desiredTypes.has(a.type)).map((a) => a.id);
    if (toResolve.length) {
      await this.prisma.alert.updateMany({
        where: { id: { in: toResolve } },
        data: { status: 'resolved' },
      });
    }

    return { desired: desired.length, resolved: toResolve.length };
  }

  // ---------- Coda coach (lettura + azioni) ----------

  /** Alert attivi per la coach (o tutti, per i ruoli manager). Ricalcolo lazy per la coach. */
  async listForCoach(
    user: AuthUser,
    opts: { group?: string; priority?: string } = {},
  ): Promise<{ alerts: unknown[] }> {
    const scopeAll = MANAGER_ROLES.includes(user.role);
    let coachStaffId: string | null = null;

    if (!scopeAll) {
      const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
      coachStaffId = staff?.id ?? null;
      if (!coachStaffId) return { alerts: [] };
      // Ricalcolo lazy solo per le clienti della coach (aggiornamento immediato alla lettura).
      const clients = await this.prisma.clientProfile.findMany({
        where: { assignedCoachId: coachStaffId },
        select: { userId: true },
      });
      for (const c of clients as { userId: string }[]) {
        try {
          await this.recompute(c.userId);
        } catch {
          /* un cliente non deve rompere la lista */
        }
      }
    }

    const where: Record<string, unknown> = { status: { in: ACTIVE_STATUSES } };
    if (!scopeAll) where.coachId = coachStaffId;
    if (opts.group) where.group = opts.group;
    if (opts.priority) where.priority = opts.priority;

    const alerts = (await this.prisma.alert.findMany({ where: where as never })) as AlertRow[];
    // Ordina per priorità (high→med→low) poi per data (più recenti prima).
    alerts.sort((a: AlertRow, b: AlertRow) => {
      const pr = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      return pr !== 0 ? pr : b.createdAt.getTime() - a.createdAt.getTime();
    });

    const ids = [...new Set(alerts.map((a: AlertRow) => a.clientId))];
    const profiles = (await this.prisma.clientProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, name: true },
    })) as { userId: string; name: string | null }[];
    const nameOf = new Map(profiles.map((p) => [p.userId, p.name]));
    return { alerts: alerts.map((a: AlertRow) => ({ ...a, clientName: nameOf.get(a.clientId) ?? null })) };
  }

  /** La coach (o un manager) segna un alert come gestito/inoltrato/riaperto. */
  async updateStatus(alertId: string, user: AuthUser, status: 'handled' | 'escalated' | 'open') {
    const alert = await this.prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert non trovato');

    if (!MANAGER_ROLES.includes(user.role)) {
      const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
      if (!staff || alert.coachId !== staff.id) {
        throw new ForbiddenException('Non puoi gestire questo alert');
      }
    }
    return this.prisma.alert.update({ where: { id: alertId }, data: { status } });
  }
}
