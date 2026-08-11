import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { eUnicoPasto, pastoPrincipaleDigiuno } from '../menu/finestre-digiuno';
import { giornoLocale, toDateOnly } from '../common/date-only';
import { MessageComposerService, MessageTone } from './message-composer.service';
import { notificaUtente, staffDisabledTypes } from './notifica-utente';
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
  /** Testo approvato parola per parola: niente riformulazione AI. */
  verbatim?: boolean;
  /** Testi espliciti (retrocompatibilità / contenuti dinamici). */
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  /** Se impostato, il dedup usa una FINESTRA MOBILE di N ms invece di "una volta al giorno"
   *  (es. chat: una notifica per risposta, ma non a raffica se arrivano più messaggi). */
  dedupeWindowMs?: number;
  /**
   * Campi del `payload` da includere nel confronto del dedup (11/8).
   *
   * Senza questo, il dedup guarda solo **destinatario + tipo**: per una coach con quaranta clienti
   * voleva dire che la prima che scriveva generava la notifica e le altre trentanove no. La coda
   * della chat si riempiva in silenzio, che è esattamente il difetto che stiamo togliendo altrove.
   *
   * Con `{ clientId }` il dedup diventa per **cliente**: una notifica per ogni cliente che scrive,
   * con l'anti-raffica che vale su quella cliente e non su tutte.
   */
  dedupeSuPayload?: Record<string, string>;
}

export interface NotificationPrefs {
  disabledTypes?: string[];
  emailEnabled?: boolean;
}

/** Tipi che, se l'utente attiva l'email nelle preferenze, arrivano anche via Brevo. */
const EMAILABLE_TYPES = new Set(['visit_reminder', 'payment_approved', 'payment_rejected', 'pre_event']);

/** Chiavi di tutti i tipi noti dello staff (per validare l'opt-out). */
const STAFF_TYPE_KEYS = new Set(STAFF_NOTIFICATION_TYPES.map((t) => t.key));

// `staffDisabledTypes` sta in `notifica-utente.ts` (una definizione sola: la legge anche l'helper).

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

  /**
   * Crea la notifica solo se oggi non ne esiste già una dello stesso tipo.
   *
   * ## Perché non si confronta più una data con un istante
   *
   * `scheduledFor` è un **istante** pieno; `toDateOnly()`, da quando il giorno è quello italiano,
   * restituisce la mezzanotte **romana** espressa in UTC. Fra le 22:00 e le 24:00 UTC quella
   * mezzanotte è già quella di domani, cioè **nel futuro**: la finestra `gte: oggi` non trovava
   * le notifiche appena scritte e la coach ne riceveva due o tre di fila.
   *
   * Il confronto giusto è fra grandezze omogenee: si prende l'ultima notifica di quel tipo e si
   * guarda se **il suo giorno** (romano) è oggi. La finestra mobile (`dedupeWindowMs`) resta un
   * confronto fra istanti, che era già corretto.
   */
  async notifyOncePerDay(input: NotifyInput): Promise<boolean> {
    const adesso = new Date();
    /**
     * I filtri sul payload (es. la cliente di cui si parla): rendono il dedup «per cliente» invece
     * che «per tipo». Vedi `dedupeSuPayload`.
     */
    const perPayload = Object.entries(input.dedupeSuPayload ?? {}).map(([chiave, valore]) => ({
      payload: { path: [chiave], equals: valore },
    })) as never[];
    if (input.dedupeWindowMs) {
      const recente = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          scheduledFor: { gte: new Date(adesso.getTime() - input.dedupeWindowMs) },
          ...(perPayload.length ? { AND: perPayload } : {}),
        },
        select: { id: true },
      });
      if (recente) return false;
    } else {
      const ultima = (await this.prisma.notification.findFirst({
        where: { userId: input.userId, type: input.type, ...(perPayload.length ? { AND: perPayload } : {}) },
        orderBy: { scheduledFor: 'desc' },
        select: { scheduledFor: true },
      })) as { scheduledFor: Date } | null;
      if (ultima && giornoLocale(ultima.scheduledFor) === giornoLocale(adesso)) return false;
    }

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
        verbatim: input.verbatim,
        seed: `${input.userId}:${giornoLocale(adesso)}`,
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

  /**
   * Notifica diretta (eventi, es. assegnazione lead): niente dedup giornaliero.
   *
   * Il corpo vive in `notifica-utente.ts` dall'11/8, e questo metodo lo chiama: serviva anche a
   * `MenuService`, che non può dipendere da questo servizio (`NotificationsModule` importa
   * `MenuModule`, quindi la freccia opposta chiuderebbe un cerchio). Delegare invece di copiare è la
   * differenza fra una regola e due regole che un giorno divergono — e quando divergono, quella che
   * smette di avvisare non lo dice a nessuno.
   */
  async notify(input: { userId: string; type: string; title: string; body: string; payload?: Record<string, unknown> }): Promise<void> {
    await notificaUtente(this.prisma, this.push, input);
  }

  /** La campanella mostra solo ciò che non è stato archiviato. */
  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, archivedAt: null, ...(unreadOnly ? { readAt: null } : {}) },
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

  /**
   * Archivia una singola notifica. Non è una cancellazione: la riga resta, con `archivedAt`
   * valorizzato, e sparisce solo dalla campanella. Archiviare implica anche "letta": una
   * notifica tolta dalla vista non può continuare a contare nel badge dei non letti.
   */
  async archive(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notifica non trovata');
    const now = new Date();
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { archivedAt: notification.archivedAt ?? now, readAt: notification.readAt ?? now },
    });
  }

  /**
   * "Svuota le lette": archivia in blocco ciò che la cliente ha già visto.
   * Deliberatamente NON tocca le non lette — svuotare la campanella non deve poter
   * far sparire un messaggio mai aperto (un promemoria misure, una risposta della coach).
   */
  async archiveRead(userId: string): Promise<{ archived: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, archivedAt: null, readAt: { not: null } },
      data: { archivedAt: new Date() },
    });
    return { archived: res.count };
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

    // Piano attivo? Il messaggio quotidiano "il tuo piano di oggi" NON va inviato a chi ha il
    // piano SCADUTO (endDate passata) o senza abbonamento attivo: altrimenti la cliente riceve
    // "piano confermato, continua col ritmo" e il link la riporta a un piano finito (bug).
    const activeSub = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      select: { endDate: true },
    });
    const hasActivePlan = !!activeSub && (!activeSub.endDate || activeSub.endDate.getTime() >= today.getTime());

    // 0-bis. DIGIUNO INTERMITTENTE — suggerimento settimanale della giornata 20-4 (voce #7 del 5/8).
    // Una volta a settimana si propone di stringere la finestra a un solo pasto. È un
    // SUGGERIMENTO, non un menu diverso: la cliente decide, e la spiegazione viaggia col
    // messaggio perché "20-4" da solo non dice niente a nessuno.
    // Non si manda a chi è in pausa: in vacanza non si propongono stringimenti.
    if (
      hasActivePlan &&
      !activePause &&
      (profile as { pathType?: string | null }).pathType === 'intermittent_fasting'
    ) {
      const finestra = (profile as { fastingWindow?: string | null }).fastingWindow ?? null;
      // Chi è già a un pasto solo la 20-4 la sta già facendo. Le due domande — «è già a un pasto
      // solo?» e «quale pasto resta?» — vengono dalla tabella delle finestre: erano due `if` in due
      // file diversi, e nessuno dei due sapeva delle voci aggiunte l'11/8.
      if (!eUnicoPasto(finestra)) {
        const quale = `il ${pastoPrincipaleDigiuno(finestra)}`.replace('il colazione', 'la colazione').replace('il cena', 'la cena');
        const fatta = await this.notifyOncePerDay({
          userId: clientId,
          type: 'fasting_204_tip',
          title: 'Una giornata 20-4, se te la senti',
          body: `Una volta a settimana puoi provare la 20-4: venti ore senza mangiare e un'unica finestra di quattro ore in cui fai un solo pasto completo — per te ${quale}. Non è un digiuno più duro, è lo stesso digiuno concentrato: si beve normalmente (acqua, tè, caffè senza zucchero) e il pasto resta completo, non ridotto. Se ti senti storta, salti e riprovi un'altra settimana. Nel dubbio parlane con la tua nutrizionista.`,
          dedupeWindowMs: 7 * 86_400_000,
        });
        if (fatta) created.push('fasting_204_tip');
      }
    }

    // 0. Messaggio quotidiano del motore: TONO e contenuto decisi dalle regole (spec 7.2).
    // Solo a piano attivo (vedi sopra).
    if (todayDecision && hasActivePlan) {
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

    // 2. Promemoria misure: allineato al GATE del ciclo (Tracciamento_Dati §5), non a un
    // "ogni 2 giorni" scollegato. La misura è DOVUTA solo dal 2° giorno di ogni ciclo:
    // es. primo menu il 20 → ciclo [20,21] → misura chiesta il 21, MAI il 20. Uso il gate
    // come unica fonte di verità così il promemoria non anticipa il 1° giorno del ciclo
    // (prima, senza misure precedenti, daysSinceMeasure=Infinity faceva scattare già il 20).
    const measureGate = await this.menu.measurementGate(clientId);
    if (measureGate.required) {
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
      // L'`||` da solo faceva scattare i complimenti («le tue misure sono migliorate») anche a
      // chi era AUMENTATA di peso ma aveva perso un centimetro di vita, e viceversa. È il
      // messaggio che una cliente ha descritto come «quasi una presa in giro», e aveva ragione:
      // se una delle due misure è peggiorata in modo significativo, il messaggio è falso.
      // Soglie di peggioramento speculari a quelle di miglioramento, così la zona neutra
      // (oscillazioni di bilancia) non conta né come progresso né come regresso.
      const improved = weightDrop >= 0.3 || waistDrop >= 1;
      const worsened = weightDrop <= -0.3 || waistDrop <= -1;
      // Il peso è SALITO in modo non riconducibile all'oscillazione della bilancia.
      const gained = weightDrop <= -0.3;
      if (improved && !worsened) {
        if (await this.notifyOncePerDay({
          userId: clientId,
          type: 'progress_cheer',
          messageKey: 'progress_cheer',
          tone: 'celebratory',
          payload: { weightDropKg: Math.round(weightDrop * 10) / 10 },
        })) created.push('progress_cheer');
      } else if (gained) {
        // Chi è aumentata riceveva SILENZIO: nessun messaggio esiste per lei. È la metà
        // della segnalazione che era rimasta aperta (REGISTRO_Feedback_Clienti.md §3), e
        // il silenzio dopo un dato faticoso da inserire è esattamente ciò che pesa.
        // Il testo è motivazionale ma NON è un complimento — vedi le regole scritte sopra
        // le voci `progress_support*` in `i18n/messages.ts`. `verbatim` impedisce che il
        // riformulatore AI cambi il registro di un testo scelto parola per parola.
        // Due chiavi perché il caso "peso su, vita giù" è un'altra situazione e va detta
        // per quello che è, invece di ridurla al solo numero peggiorato.
        const gainKg = Math.round(-weightDrop * 10) / 10;
        const waistLossCm = Math.round(waistDrop * 10) / 10;
        const waistDown = waistDrop >= 1;
        if (await this.notifyOncePerDay({
          userId: clientId,
          type: 'progress_support',
          messageKey: waistDown ? 'progress_support_waist' : 'progress_support',
          tone: 'gentle',
          verbatim: true,
          params: { gainKg, waistCm: waistLossCm },
          payload: { weightGainKg: gainKg, ...(waistDown ? { waistDropCm: waistLossCm } : {}) },
        })) created.push('progress_support');
      }
      // NOTA: chi cala di peso ma cresce di vita non riceve nulla, come prima. Non è il caso
      // segnalato, i centimetri da soli oscillano molto (postura, misurazione, gonfiore) e un
      // messaggio su quel dato sarebbe rumore.
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

      // Menu non seguito: la cliente ha segnato "non seguita" su un menu recente (ultimi 2
      // giorni) → avviso alla coach (una volta al giorno finché continua). Il tag arriva dal
      // popup "Com'è andata ieri?" (MenuReviewPopup → /me/ratings con tag non_seguita).
      const notFollowed = await this.prisma.recipeRating.findFirst({
        where: {
          clientId,
          tags: { has: 'non_seguita' },
          date: { gte: new Date(today.getTime() - 2 * 86_400_000) },
        } as never,
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (notFollowed) {
        if (await this.notifyOncePerDay({
          userId: profile.assignedCoach.userId,
          type: 'menu_not_followed_coach_alert',
          messageKey: 'menu_not_followed_coach_alert',
          params: { clientName: profile.name ?? profile.user.email },
          payload: { clientId, date: (notFollowed as { date: Date }).date.toISOString().slice(0, 10) },
        })) created.push('menu_not_followed_coach_alert');
      }
    }

    return created;
  }

  /** Batch giornaliero per tutte le clienti attive (chiamato dal cron). */
  /**
   * SOLLECITO MISURE ogni due ore (voce #6 del 5/8, punti b e c).
   *
   * Gira più volte al giorno, non una: la richiesta era «push ogni 2 ore» finché la misura non
   * arriva. La cadenza non è scritta qui ma nella finestra di deduplica delle notifiche, così
   * cambiarla è un parametro e non un deploy.
   *
   * Due cose insieme:
   *  - alla cliente un sollecito, con un tono che cambia quando l'app si è bloccata;
   *  - alla coach un avviso UNA volta per ciclo, così sa di chi si tratta prima che diventi un
   *    problema. Non serve tempestarla: il task resta lì finché non lo chiude.
   *
   * Nessun sollecito di notte: fra le 22 e le 8 non si suona il campanello a nessuno.
   */
  async measuresNudgeTick(): Promise<{ controllate: number; sollecitate: number; coachAvvisate: number }> {
    const ora = new Date().getHours();
    const [inizio, fine, oreSollecito] = await Promise.all([
      this.configParams.getNumber('measures_nudge_start_hour', 8),
      this.configParams.getNumber('measures_nudge_end_hour', 22),
      this.configParams.getNumber('measures_nudge_hours', 2),
    ]);
    if (ora < inizio || ora >= fine) return { controllate: 0, sollecitate: 0, coachAvvisate: 0 };

    // Solo chi ha un piano attivo: a piano scaduto le misure non servono a nulla.
    const attivi = (await this.prisma.subscription.findMany({
      where: { status: 'active' },
      select: { clientId: true },
      distinct: ['clientId'],
    })) as { clientId: string }[];

    let sollecitate = 0;
    let coachAvvisate = 0;
    for (const { clientId } of attivi) {
      try {
        const gate = await this.menu.measurementGate(clientId);
        if (!gate.blocking) continue;

        const bloccata = gate.level === 'locked';
        const fatta = await this.notifyOncePerDay({
          userId: clientId,
          type: 'measures_nudge',
          title: bloccata ? 'App in pausa: servono le tue misure' : 'Mancano le misure ⚖️',
          body: bloccata
            ? 'Per ripartire servono le misure di questo ciclo. Se non riesci a inserirle, scrivi alla tua coach: le basta un messaggio per riaprirti l\'app.'
            : 'Un attimo sulla bilancia e il metro: senza le misure non riesco a prepararti il menu giusto per i prossimi giorni.',
          dedupeWindowMs: oreSollecito * 3_600_000,
        });
        if (fatta) sollecitate++;

        // Avviso alla coach: una volta per ciclo (refId = data del ciclo).
        const rif = gate.cycleDate ?? 'iniziali';
        const esiste = await this.prisma.coachTask.findUnique({
          where: { clientId_kind_refId: { clientId, kind: 'measures_missing', refId: rif } } as never,
          select: { id: true },
        });
        if (!esiste) {
          const oggi = new Date();
          oggi.setHours(0, 0, 0, 0);
          await this.prisma.coachTask
            .create({
              data: {
                clientId,
                kind: 'measures_missing',
                refId: rif,
                title: 'Misure non inserite: il menu è fermo',
                description:
                  'Senza le misure di questo ciclo il menu non parte. Sentila per capire il motivo: se serve, puoi sbloccarle l\'app dalla sua scheda.',
                dueDate: oggi,
              },
            })
            .catch(() => undefined);
          coachAvvisate++;
        }
      } catch {
        /* una cliente che va storta non ferma le altre */
      }
    }
    return { controllate: attivi.length, sollecitate, coachAvvisate };
  }

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
