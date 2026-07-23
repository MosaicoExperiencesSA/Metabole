import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../common/date-only';
import { MessageComposerService, MessageTone } from './message-composer.service';
import { PushService } from './push.service';
import { Role } from '../common/roles';
import { STAFF_NOTIFICATION_TYPES, staffTypesForRole } from './staff-notifications';

interface NotifyInput {
  userId: string;
  type: string;
  /** Chiave nel catalogo i18n: il testo viene composto nella lingua dell'utente. */
  messageKey?: string;
  params?: Record<string, string | number | null | undefined>;
  /** Tono deciso dal motore (spec 7.2): influenza solo il testo, mai la decisione. */
  tone?: MessageTone;
  /** Testi espliciti (retrocompatibilità / contenuti dinamici). */
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  /** Se impostato, il dedup usa una FINESTRA MOBILE di N ms invece di "una volta al giorno"
   *  (es. chat: una notifica per risposta, ma non a raffica se arrivano più messaggi). */
  dedupeWindowMs?: number;
}

export interface NotificationPrefs {
  disabledTypes?: string[];
  emailEnabled?: boolean;
}

/** Tipi che, se l'utente attiva l'email nelle preferenze, arrivano anche via Brevo. */
const EMAILABLE_TYPES = new Set(['visit_reminder', 'payment_approved', 'payment_rejected', 'pre_event']);

/** Chiavi di tutti i tipi noti dello staff (per validare l'opt-out). */
const STAFF_TYPE_KEYS = new Set(STAFF_NOTIFICATION_TYPES.map((t) => t.key));

/** Legge i tipi disattivati dello staff da User.prefs.notificationsDisabled. */
function staffDisabledTypes(prefs: unknown): string[] {
  const p = (prefs as Record<string, unknown> | null) ?? {};
  const raw = p['notificationsDisabled'];
  return Array.isArray(raw) ? (raw as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Notifiche personalizzate (spec sez. 9): contenuto, tono e orario decisi dai
 * segnali; canali in-app + email opzionale (push col frontend); preferenze e
 * consensi rispettati; mai ripetitive (una per tipo al giorno + varianti di testo).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly composer: MessageComposerService,
    private readonly mail: MailService,
    private readonly menu: MenuService,
    private readonly push: PushService,
  ) {}

  /** Crea la notifica solo se oggi non ne esiste già una dello stesso tipo. */
  async notifyOncePerDay(input: NotifyInput): Promise<boolean> {
    const today = toDateOnly();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    // Dedup: finestra mobile (se dedupeWindowMs) oppure "una volta al giorno" (default).
    const scheduledFor = input.dedupeWindowMs
      ? { gte: new Date(Date.now() - input.dedupeWindowMs) }
      : { gte: today, lt: tomorrow };
    const existing = await this.prisma.notification.findFirst({
      where: { userId: input.userId, type: input.type, scheduledFor },
    });
    if (existing) return false;

    // Destinataria: lingua + preferenze (le preferenze esistono solo per le clienti).
    const recipient = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, locale: true, clientProfile: { select: { notificationPrefs: true } } },
    });
    if (!recipient) return false;
    const prefs = (recipient.clientProfile?.notificationPrefs ?? {}) as NotificationPrefs;
    if (prefs.disabledTypes?.includes(input.type)) return false; // opt-out rispettato

    let title = input.title ?? input.type;
    let body = input.body ?? '';
    let composer: string | undefined;
    if (input.messageKey) {
      const composed = await this.composer.compose({
        locale: recipient.locale,
        key: input.messageKey,
        params: input.params,
        tone: input.tone,
        seed: `${input.userId}:${today.toISOString().slice(0, 10)}`,
      });
      title = composed.title;
      body = composed.body;
      composer = composed.composer;
    }

    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: {
          title,
          body,
          ...(input.tone ? { tone: input.tone } : {}),
          ...(composer ? { composer, messageKey: input.messageKey } : {}),
          ...(input.payload ?? {}),
        } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(), // in-app: disponibile subito
      },
    });

    // Email opzionale: solo se la cliente l'ha attivata e il tipo lo prevede.
    if (prefs.emailEnabled && EMAILABLE_TYPES.has(input.type)) {
      await this.mail.sendNotificationEmail(recipient.email, recipient.locale, title, body);
    }
    // Push sul telefono (no-op se non configurato). L'opt-out per tipo è già rispettato sopra.
    await this.push.sendToUser(input.userId, title, body, { type: input.type });
    return true;
  }

  /** Notifica diretta (eventi, es. assegnazione lead): niente dedup giornaliero. */
  async notify(input: { userId: string; type: string; title: string; body: string; payload?: Record<string, unknown> }): Promise<void> {
    const recipient = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, prefs: true } });
    if (!recipient) return;
    // Opt-out per tipo dello staff (tabella nel profilo). Le clienti non usano questo path.
    if (staffDisabledTypes(recipient.prefs).includes(input.type)) return;
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: { title: input.title, body: input.body, ...(input.payload ?? {}) } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });
    await this.push.sendToUser(input.userId, input.title, input.body, { type: input.type });
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

  // ---------- Preferenze (opt-out per tipo + email) ----------

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { notificationPrefs: true },
    });
    if (!profile) throw new NotFoundException('Profilo non ancora creato: completa prima il questionario.');
    const prefs = (profile.notificationPrefs ?? {}) as NotificationPrefs;
    return { disabledTypes: prefs.disabledTypes ?? [], emailEnabled: prefs.emailEnabled ?? false };
  }

  async updatePrefs(userId: string, input: NotificationPrefs): Promise<NotificationPrefs> {
    const current = await this.getPrefs(userId);
    const next: NotificationPrefs = {
      disabledTypes: input.disabledTypes ?? current.disabledTypes,
      emailEnabled: input.emailEnabled ?? current.emailEnabled,
    };
    await this.prisma.clientProfile.update({
      where: { userId },
      data: { notificationPrefs: next as never },
    });
    return next;
  }

  // ---------- Preferenze staff (opt-out per singolo alert) ----------

  /** Catalogo alert + stato disattivato per il ruolo dell'utente (tabella profilo). */
  async getStaffPrefs(userId: string, role: Role): Promise<{ types: { key: string; label: string; description: string }[]; disabled: string[] }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } });
    const disabled = staffDisabledTypes(u?.prefs ?? null);
    const types = staffTypesForRole(role).map((t) => ({ key: t.key, label: t.label, description: t.description }));
    return { types, disabled };
  }

  /** Salva l'elenco degli alert disattivati (solo chiavi note) in User.prefs. */
  async setStaffPrefs(userId: string, disabled: string[]): Promise<{ disabled: string[] }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } });
    const prefs = { ...((u?.prefs as Record<string, unknown> | null) ?? {}) };
    const clean = Array.from(new Set((disabled ?? []).filter((k) => STAFF_TYPE_KEYS.has(k))));
    prefs['notificationsDisabled'] = clean;
    await this.prisma.user.update({ where: { id: userId }, data: { prefs: prefs as never } });
    return { disabled: clean };
  }

  // ---------- Generazione giornaliera (chiamata dal cron) ----------

  async generateDailyForClient(clientId: string): Promise<string[]> {
    const created: string[] = [];
    const today = toDateOnly();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      include: {
        assignedCoach: { select: { userId: true, displayName: true } },
        user: { select: { email: true } },
      },
    });
    if (!profile?.onboardingCompletedAt) return created;

    const [checkinToday, lastMeasurements, activePause, upcomingEvents, todayDecision, visitsTomorrow] =
      await Promise.all([
        this.prisma.dailyCheckin.findUnique({
          where: { clientId_date: { clientId, date: today } },
        }),
        this.prisma.measurement.findMany({ where: { clientId }, orderBy: { date: 'desc' }, take: 2 }),
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
        this.prisma.engineDecision.findFirst({ where: { clientId, date: today } }),
        this.prisma.visit.findMany({
          where: {
            clientId,
            status: 'scheduled',
            datetime: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86_400_000) },
          },
        }),
      ]);
    const lastMeasurement = lastMeasurements[0] ?? null;

    // 0. Messaggio quotidiano del motore: TONO e contenuto decisi dalle regole (spec 7.2).
    if (todayDecision) {
      const action = todayDecision.action as { tone?: MessageTone; timing?: string; menu?: string } | null;
      const tone: MessageTone = action?.tone ?? 'neutral';
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'engine_daily',
        messageKey: `engine_daily_${tone}`,
        tone,
        payload: { timing: action?.timing ?? 'morning', menu: action?.menu ?? 'keep', decisionId: todayDecision.id },
      })) created.push('engine_daily');
    }

    // 1. Promemoria check-in (sempre, anche in pausa: il monitoraggio continua).
    if (!checkinToday) {
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'checkin_reminder',
        messageKey: 'checkin_reminder',
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
        messageKey: 'measurement_reminder',
      })) created.push('measurement_reminder');
    }

    // 2b. Misure migliorate → incoraggiamento (solo quando arriva una misura nuova).
    if (
      lastMeasurements.length === 2 &&
      lastMeasurement &&
      lastMeasurement.date.getTime() === today.getTime()
    ) {
      const previous = lastMeasurements[1];
      const weightDrop = previous.weightKg - lastMeasurement.weightKg;
      const waistDrop =
        previous.waistCm && lastMeasurement.waistCm ? previous.waistCm - lastMeasurement.waistCm : 0;
      if (weightDrop >= 0.3 || waistDrop >= 1) {
        if (await this.notifyOncePerDay({
          userId: clientId,
          type: 'progress_cheer',
          messageKey: 'progress_cheer',
          tone: 'celebratory',
          payload: { weightDropKg: Math.round(weightDrop * 10) / 10 },
        })) created.push('progress_cheer');
      }
    }

    // 2c. Ricette da valutare (spec: richiesta post-pasto; qui il richiamo giornaliero).
    try {
      const pending = await this.menu.pendingRatings(clientId);
      if (pending.length > 0) {
        if (await this.notifyOncePerDay({
          userId: clientId,
          type: 'rating_request',
          messageKey: 'rating_request',
          params: { count: pending.length },
          payload: { pendingCount: pending.length },
        })) created.push('rating_request');
      }
    } catch {
      /* nessun menu: nessuna richiesta */
    }

    // 2d. Visita domani: promemoria a cliente e nutrizionista.
    for (const visit of visitsTomorrow as { id: string; datetime: Date; nutritionistId: string }[]) {
      const when = formatWhen(visit.datetime);
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'visit_reminder',
        messageKey: 'visit_reminder',
        params: { when },
        payload: { visitId: visit.id },
      })) created.push('visit_reminder');
      const staff = await this.prisma.staff.findUnique({
        where: { id: visit.nutritionistId },
        select: { userId: true },
      });
      if (staff?.userId) {
        if (await this.notifyOncePerDay({
          userId: staff.userId,
          type: 'visit_reminder_staff',
          messageKey: 'visit_reminder_staff',
          params: { when, clientName: profile.name ?? profile.user.email },
          payload: { visitId: visit.id, clientId },
        })) created.push('visit_reminder_staff');
      }
    }

    // 3. Countdown pre-evento (spec: anticipare, non punire).
    for (const event of upcomingEvents as { label: string | null; type: string; startDate: Date }[]) {
      const days = Math.round((event.startDate.getTime() - today.getTime()) / 86_400_000);
      if (await this.notifyOncePerDay({
        userId: clientId,
        type: 'pre_event',
        messageKey: days === 0 ? 'pre_event_today' : 'pre_event_upcoming',
        params: { days, eventLabel: event.label ?? event.type },
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
          messageKey: 'mini_plan',
          tone: 'gentle',
          params: { deviationKg: Math.round(deviation * 10) / 10 },
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
      // Se non ha MAI fatto un check-in, conto i giorni dall'onboarding (mai Infinity/null:
      // altrimenti il messaggio mostrerebbe il segnaposto {days} al posto del numero).
      const referenceDate = lastCheckin?.date ?? profile.onboardingCompletedAt;
      const daysSinceCheckin = Math.max(
        0,
        Math.floor((today.getTime() - referenceDate.getTime()) / 86_400_000),
      );
      if (daysSinceCheckin >= noCheckinThreshold) {
        if (await this.notifyOncePerDay({
          userId: profile.assignedCoach.userId,
          type: 'no_checkin_coach_alert',
          messageKey: 'no_checkin_coach_alert',
          params: {
            clientName: profile.name ?? profile.user.email,
            days: `${daysSinceCheckin}`,
          },
          payload: { clientId, daysSinceCheckin },
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
          messageKey: 'stall_coach_alert',
          params: { clientName: profile.name ?? profile.user.email, stallDays },
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

/** "10/07, 15:30" — compatto e leggibile in entrambe le lingue. */
function formatWhen(datetime: Date): string {
  const d = datetime;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
