import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { randomUUID } from 'crypto';
import { DiscountsService } from '../commerce/discounts.service';
import { deriveSegment, prefsToken } from '../common/funnel-segment';
import { ConfigParamsService } from '../config-params/config-params.service';

export type LifecycleKind = 'event' | 'scheduled';

export interface TriggerDef {
  key: string; // = chiave del modello email (emailTemplate.key)
  label: string;
  when: string; // descrizione dell'innesco
  kind: LifecycleKind;
  implemented: boolean; // true = lo scan lo sa già inviare dai dati esistenti
}

/**
 * Catalogo degli inneschi del ciclo di vita. Gli `implemented: true` sono già
 * agganciati ai dati reali e vengono inviati dallo scan; gli altri sono in
 * roadmap (richiedono dati non ancora tracciati: stato carrello, rinnovi,
 * eventi peso/misure, data di nascita) e restano visibili come promemoria.
 */
export const LIFECYCLE_CATALOG: TriggerDef[] = [
  { key: 'welcome', label: 'Benvenuto', when: 'Email verificata (ultimi 14 giorni)', kind: 'event', implemented: true },
  { key: 'profilo_pronto', label: 'Il tuo profilo è pronto', when: 'Onboarding completato (ultimi 14 giorni)', kind: 'event', implemented: true },
  { key: 'profilo_incompleto', label: 'Profilo incompleto', when: 'Registrata 1–14 giorni fa, onboarding non completato', kind: 'scheduled', implemented: true },
  { key: 'piano_domani', label: 'Il piano inizia domani', when: 'Inizio piano = domani', kind: 'scheduled', implemented: true },
  { key: 'onb_g1', label: 'Onboarding giorno 1', when: 'Inizio piano = 1 giorno fa', kind: 'scheduled', implemented: true },
  { key: 'onb_g4', label: 'Onboarding giorno 4', when: 'Inizio piano = 4 giorni fa', kind: 'scheduled', implemented: true },
  { key: 'onb_g7', label: 'Onboarding giorno 7', when: 'Inizio piano = 7 giorni fa', kind: 'scheduled', implemented: true },
  // SPENTO DI DEFAULT (decisione 17/07 sera: per ora codici ad hoc dalle coach, non automatici):
  // si attiva SOLO accendendo esplicitamente l'interruttore in Marketing → Automazione.
  { key: 'trial_g6_offer', label: 'Prova G6 — offerta con codice personale (spento di default)', when: 'Prova gratuita attiva iniziata 6 giorni fa (codice 48h)', kind: 'scheduled', implemented: true },
  // --- In roadmap: richiedono dati non ancora tracciati ---
  { key: 'onb_g2', label: 'Onboarding giorno 2', when: 'Inizio piano = 2 giorni fa', kind: 'scheduled', implemented: false },
  { key: 'cart_1h', label: 'Carrello +1h', when: 'Checkout iniziato da 1h senza acquisto', kind: 'scheduled', implemented: true },
  { key: 'cart_24h', label: 'Carrello +24h', when: 'Checkout iniziato da 24h senza acquisto', kind: 'scheduled', implemented: true },
  { key: 'cart_72h', label: 'Carrello +72h', when: 'Checkout iniziato da 72h senza acquisto', kind: 'scheduled', implemented: true },
  { key: 'nurture_1', label: 'Nurture 1', when: 'Sequenza nurture lead', kind: 'scheduled', implemented: false },
  { key: 'nurture_2', label: 'Nurture 2', when: 'Sequenza nurture lead', kind: 'scheduled', implemented: false },
  { key: 'nurture_3', label: 'Nurture 3', when: 'Sequenza nurture lead', kind: 'scheduled', implemented: false },
  { key: 'nurture_4', label: 'Nurture 4', when: 'Sequenza nurture lead', kind: 'scheduled', implemented: false },
  { key: 'obiezione_prezzo', label: 'Obiezione prezzo', when: 'Sequenza nurture (prezzo)', kind: 'scheduled', implemented: false },
  { key: 'feedback_ricette', label: 'Feedback ricette', when: 'Dopo N giorni di menu', kind: 'scheduled', implemented: false },
  { key: 'valore_settimanale', label: 'Valore settimanale', when: 'Riepilogo settimanale', kind: 'scheduled', implemented: false },
  { key: 'riattiva_dropout', label: 'Riattiva dropout', when: 'Cliente inattiva', kind: 'scheduled', implemented: false },
  { key: 'referral', label: 'Porta un’amica', when: 'Evento referral', kind: 'event', implemented: false },
  { key: 'ev_peso_ok', label: 'Evento: peso ok', when: 'Traguardo peso', kind: 'event', implemented: false },
  { key: 'ev_primo', label: 'Evento: primo traguardo', when: 'Primo check-in positivo', kind: 'event', implemented: false },
  { key: 'ev_meta', label: 'Evento: meta raggiunta', when: 'Obiettivo raggiunto', kind: 'event', implemented: false },
  { key: 'ev_costanza', label: 'Evento: costanza', when: 'Streak check-in', kind: 'event', implemented: false },
  { key: 'ev_plateau', label: 'Evento: plateau', when: 'Peso fermo', kind: 'event', implemented: false },
  { key: 'ev_morale', label: 'Evento: morale', when: 'Segnale morale basso', kind: 'event', implemented: false },
  { key: 'ev_misure', label: 'Evento: misure', when: 'Nuove misure', kind: 'event', implemented: false },
  { key: 'ev_rientro', label: 'Evento: rientro vacanza', when: 'Rientro da modalità viaggio (ultimi 7 giorni)', kind: 'event', implemented: true },
  { key: 'ev_compleanno', label: 'Evento: compleanno', when: 'Compleanno (da data di nascita)', kind: 'scheduled', implemented: true },
  { key: 'ev_anniversario', label: 'Evento: anniversario', when: 'Anniversario inizio piano', kind: 'scheduled', implemented: true },
  { key: 'ev_pre_evento', label: 'Evento: pre-evento', when: 'Evento personale in arrivo', kind: 'scheduled', implemented: false },
  { key: 'ev_mantenimento', label: 'Evento: mantenimento', when: 'Mantenimento attivato (ultimi 7 giorni)', kind: 'event', implemented: true },
  { key: 'rin_t7', label: 'Rinnovo T-7', when: 'Piano a pagamento in scadenza tra 7 giorni', kind: 'scheduled', implemented: true },
  { key: 'rin_t3', label: 'Rinnovo T-3', when: 'Piano a pagamento in scadenza tra 3 giorni', kind: 'scheduled', implemented: true },
  { key: 'rin_t1', label: 'Rinnovo T-1', when: 'Piano a pagamento in scadenza domani', kind: 'scheduled', implemented: true },
  { key: 'upsell', label: 'Upsell', when: 'Opportunità upsell', kind: 'scheduled', implemented: false },
  { key: 'wb_t3', label: 'Winback T+3', when: 'Piano scaduto da 3 giorni senza rinnovo', kind: 'scheduled', implemented: true },
  { key: 'wb_t7', label: 'Winback T+7', when: 'Piano scaduto da 7 giorni senza rinnovo', kind: 'scheduled', implemented: true },
  { key: 'wb_survey', label: 'Winback sondaggio', when: 'Dopo la disdetta', kind: 'scheduled', implemented: false },
  { key: 'wb_stagionale', label: 'Winback stagionale', when: 'Campagna stagionale', kind: 'scheduled', implemented: false },
  { key: 'tx_rinnovo_ok', label: 'TX rinnovo ok', when: 'Rinnovo pagato', kind: 'event', implemented: false },
  { key: 'tx_dunning', label: 'TX dunning', when: 'Pagamento fallito', kind: 'event', implemented: false },
  { key: 'tx_appuntamento', label: 'TX appuntamento', when: 'Promemoria appuntamento', kind: 'scheduled', implemented: false },
  { key: 'repermission', label: 'Re-permission', when: 'Riconferma consenso', kind: 'scheduled', implemented: false },
  { key: 'preferenze', label: 'Preferenze', when: 'Gestione preferenze', kind: 'event', implemented: false },
];

const DIET_LABEL: Record<string, string> = {
  mediterranean: 'Mediterranea',
  protein: 'Proteica',
  low_carb: 'Low carb',
  flexible: 'Flessibile',
  keto: 'Chetogenica',
};

type SendOutcome = 'sent' | 'skipped' | 'duplicate' | 'failed';

/**
 * Motore di automazione email del ciclo di vita. Riusa l'infrastruttura del
 * modulo marketing (invio via Brevo attraverso MailService, rispetto degli
 * opt-out, modelli dal DB). Uno scheduler leggero interno (setInterval, nessuna
 * dipendenza esterna) esegue lo scan a intervalli regolari SOLO se l'interruttore
 * master è acceso su DB. Ogni innesco è accendibile/spegnibile dal backoffice e
 * ogni invio è deduplicato (una volta per utente) tramite lifecycle_email.
 */
@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private static readonly INTERVAL_MS = 60 * 60 * 1000; // ogni ora
  private static readonly BATCH = 500; // limite prudente di destinatari per innesco per giro

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly discounts: DiscountsService,
    private readonly configParams: ConfigParamsService,
  ) {}

  onModuleInit(): void {
    // Scheduler interno: primo giro dopo 2 minuti (dà tempo al boot), poi ogni ora.
    // Il giro è un no-op se l'interruttore master è spento su DB.
    this.timer = setInterval(() => void this.tick('cron'), LifecycleService.INTERVAL_MS);
    setTimeout(() => void this.tick('cron'), 2 * 60 * 1000).unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private merge(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');
  }

  /** Link preferenze PERSONALE (token firmato) se la persona ha una scheda CRM. */
  private async prefsLinkFor(userId: string): Promise<string> {
    return (await this.unsubUrlsFor(userId)).prefsLink;
  }

  /**
   * Link preferenze + URL di disiscrizione one-click (header List-Unsubscribe) per una
   * cliente con scheda CRM. Usati insieme nelle email lifecycle (marketing) per la
   * deliverability Gmail/Yahoo/Microsoft.
   */
  private async unsubUrlsFor(userId: string): Promise<{ prefsLink: string; oneClickUrl: string | null }> {
    const secret = this.config.get<string>('PREFS_TOKEN_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('PREFS_TOKEN_SECRET/JWT_ACCESS_SECRET mancante: configurare un secret.');
    const rec = await this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { id: true } }).catch(() => null);
    if (!rec) return { prefsLink: `${this.appUrl()}/preferenze`, oneClickUrl: null };
    const token = prefsToken(rec.id, secret);
    return {
      prefsLink: `${this.appUrl()}/preferenze?t=${token}`,
      oneClickUrl: `${this.apiUrl()}/public/marketing/unsubscribe?t=${token}`,
    };
  }

  private appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
  }

  private apiUrl(): string {
    return this.config.get<string>('PUBLIC_API_URL') ?? 'https://metabole-backend.onrender.com';
  }

  private dayRange(offsetDays: number): { gte: Date; lt: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offsetDays);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { gte: start, lt: end };
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  // ---------- Impostazioni ----------

  async getSettings(): Promise<{ enabled: boolean; triggers: Record<string, boolean>; lastRunAt: Date | null }> {
    const row = (await this.prisma.lifecycleSettings.findUnique({ where: { id: 'singleton' } })) as
      | { enabled: boolean; triggers: unknown; lastRunAt: Date | null }
      | null;
    const triggers = (row?.triggers as Record<string, boolean> | null) ?? {};
    return { enabled: row?.enabled ?? false, triggers, lastRunAt: row?.lastRunAt ?? null };
  }

  /** Inneschi che partono SOLO se accesi esplicitamente (opt-in, non opt-out). */
  private static readonly DEFAULT_OFF = new Set(['trial_g6_offer']);

  /** Un innesco è attivo se il master è ON e il suo flag non è esplicitamente false
   *  (eccezione: gli inneschi DEFAULT_OFF richiedono un sì esplicito). */
  private isTriggerOn(key: string, triggers: Record<string, boolean>): boolean {
    if (LifecycleService.DEFAULT_OFF.has(key)) return triggers[key] === true;
    return triggers[key] !== false;
  }

  async updateSettings(
    input: { enabled?: boolean; triggers?: Record<string, boolean> },
    actorId: string,
  ): Promise<{ enabled: boolean; triggers: Record<string, boolean> }> {
    const current = await this.getSettings();
    const enabled = input.enabled ?? current.enabled;
    const triggers = { ...current.triggers, ...(input.triggers ?? {}) };
    await this.prisma.lifecycleSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', enabled, triggers: triggers as never, updatedById: actorId },
      update: { enabled, triggers: triggers as never, updatedById: actorId },
    });
    await this.audit.log({ action: 'marketing.lifecycle.settings', actorId, entityType: 'lifecycle_settings', entityId: 'singleton', metadata: { enabled } });
    return { enabled, triggers };
  }

  /** Catalogo + impostazioni + conteggi inviati per chiave (per la UI). */
  async overview() {
    const settings = await this.getSettings();
    const grouped = await this.prisma.lifecycleEmail.groupBy({ by: ['templateKey'], _count: { _all: true } });
    const sentByKey: Record<string, number> = {};
    for (const g of grouped) sentByKey[g.templateKey] = g._count._all;
    return {
      enabled: settings.enabled,
      lastRunAt: settings.lastRunAt,
      catalog: LIFECYCLE_CATALOG.map((t) => ({
        ...t,
        on: this.isTriggerOn(t.key, settings.triggers),
        sent: sentByKey[t.key] ?? 0,
      })),
    };
  }

  // ---------- Invio singolo (dedup + consenso) ----------

  private async isOptedOut(email: string, clientUserId: string): Promise<boolean> {
    const o = await this.prisma.marketingOptOut.findUnique({ where: { email: email.toLowerCase() } });
    if (o) return true;
    const prof = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId }, select: { notificationPrefs: true } });
    const n = prof?.notificationPrefs as Record<string, unknown> | null;
    return !!n && (n.marketing === false || n.marketingOptOut === true);
  }

  async sendLifecycle(params: {
    userId: string;
    email: string | null;
    key: string;
    dedupeKey: string;
    vars: Record<string, string>;
  }): Promise<SendOutcome> {
    const { userId, email, key, dedupeKey, vars } = params;
    const already = await this.prisma.lifecycleEmail.findUnique({ where: { userId_dedupeKey: { userId, dedupeKey } } });
    if (already) return 'duplicate';
    if (!email) return 'skipped';
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key } });
    if (!tpl || !tpl.active) return 'skipped';
    if (await this.isOptedOut(email, userId)) return 'skipped';

    const { prefsLink, oneClickUrl } = await this.unsubUrlsFor(userId);
    const fullVars = { link_preferenze: prefsLink, ...vars };
    const html = this.merge(tpl.bodyHtml, fullVars);
    const subject = this.merge(tpl.subject, fullVars);
    const ok = await this.mail.send({
      to: email, subject, html,
      templateKey: `lifecycle:${key}`,
      tags: [`lifecycle:${key}`],
      ...(oneClickUrl ? { listUnsubscribeUrl: oneClickUrl } : {}),
    });
    if (!ok) return 'failed';
    try {
      await this.prisma.lifecycleEmail.create({ data: { userId, templateKey: key, dedupeKey } });
    } catch {
      /* corsa fra istanze: un'altra ha già registrato l'invio */
    }
    return 'sent';
  }

  // ---------- Scan ----------

  /** Esegue un giro. `manual` = lanciato a mano dall'admin (ignora il master OFF? no: rispetta comunque). */
  async tick(source: 'cron' | 'manual', actorId?: string): Promise<{ ran: boolean; counts: Record<string, number> }> {
    if (this.running) return { ran: false, counts: {} };
    this.running = true;
    try {
      const settings = await this.getSettings();
      // Il cron rispetta l'interruttore master; l'esecuzione manuale dell'admin
      // parte comunque (azione esplicita), ma rispetta sempre i flag per-innesco.
      if (source === 'cron' && !settings.enabled) return { ran: false, counts: {} };
      const counts = await this.runScan(settings.triggers);
      await this.prisma.lifecycleSettings.update({ where: { id: 'singleton' }, data: { lastRunAt: new Date() } }).catch(() => undefined);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total > 0 || source === 'manual') {
        this.logger.log(`Lifecycle scan (${source}): ${total} email inviate ${JSON.stringify(counts)}`);
        if (actorId) await this.audit.log({ action: 'marketing.lifecycle.run', actorId, metadata: { source, counts } });
      }
      return { ran: true, counts };
    } catch (e) {
      this.logger.error(`Lifecycle scan fallito: ${e instanceof Error ? e.message : e}`);
      return { ran: false, counts: {} };
    } finally {
      this.running = false;
    }
  }

  private async runScan(triggers: Record<string, boolean>): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    const app = this.appUrl();
    const bump = (key: string, r: SendOutcome) => {
      if (r === 'sent') counts[key] = (counts[key] ?? 0) + 1;
    };
    const on = (key: string) => this.isTriggerOn(key, triggers);

    // 1) welcome — email verificata negli ultimi 14 giorni
    if (on('welcome')) {
      const users = await this.prisma.user.findMany({
        where: { role: 'client', deletedAt: null, emailVerifiedAt: { gte: this.daysAgo(14) } },
        select: { id: true, email: true, firstName: true },
        take: LifecycleService.BATCH,
      });
      for (const u of users) {
        const r = await this.sendLifecycle({ userId: u.id, email: u.email, key: 'welcome', dedupeKey: 'welcome', vars: { nome: u.firstName ?? '', link: `${app}/` } });
        bump('welcome', r);
      }
    }

    // 2) profilo_pronto — onboarding completato negli ultimi 14 giorni
    if (on('profilo_pronto')) {
      const profs = await this.prisma.clientProfile.findMany({
        where: { onboardingCompletedAt: { gte: this.daysAgo(14) } },
        select: {
          userId: true,
          name: true,
          dietStyle: true,
          regime: true,
          user: { select: { email: true, firstName: true } },
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
        },
        take: LifecycleService.BATCH,
      });
      for (const p of profs) {
        const piano = p.dietStyle ? DIET_LABEL[p.dietStyle] ?? String(p.dietStyle) : String(p.regime ?? 'personalizzato');
        const r = await this.sendLifecycle({
          userId: p.userId,
          email: p.user?.email ?? null,
          key: 'profilo_pronto',
          dedupeKey: 'profilo_pronto',
          vars: {
            nome: p.user?.firstName ?? p.name ?? '',
            piano,
            coach: p.assignedCoach?.displayName ?? 'la tua coach',
            nutrizionista: p.assignedNutritionist?.displayName ?? 'il tuo nutrizionista',
            link: `${app}/`,
          },
        });
        bump('profilo_pronto', r);
      }
    }

    // 3) profilo_incompleto — registrata 1–14 giorni fa, email verificata, onboarding non completato
    if (on('profilo_incompleto')) {
      const users = await this.prisma.user.findMany({
        where: {
          role: 'client',
          deletedAt: null,
          emailVerifiedAt: { not: null },
          createdAt: { gte: this.daysAgo(14), lte: this.daysAgo(1) },
          clientProfile: { is: { onboardingCompletedAt: null } },
        },
        select: { id: true, email: true, firstName: true },
        take: LifecycleService.BATCH,
      });
      for (const u of users) {
        const r = await this.sendLifecycle({ userId: u.id, email: u.email, key: 'profilo_incompleto', dedupeKey: 'profilo_incompleto', vars: { nome: u.firstName ?? '', link: `${app}/` } });
        bump('profilo_incompleto', r);
      }
    }

    // 4) piano_domani + onboarding g1/g4/g7 — in base a plan_start_date
    const dayTriggers: { key: string; offset: number }[] = [
      { key: 'piano_domani', offset: 1 },
      { key: 'onb_g1', offset: -1 },
      { key: 'onb_g4', offset: -4 },
      { key: 'onb_g7', offset: -7 },
    ];
    for (const dt of dayTriggers) {
      if (!on(dt.key)) continue;
      const range = this.dayRange(dt.offset);
      const profs = await this.prisma.clientProfile.findMany({
        where: { planStartDate: { gte: range.gte, lt: range.lt } },
        select: {
          userId: true,
          name: true,
          dietStyle: true,
          regime: true,
          user: { select: { email: true, firstName: true } },
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
        },
        take: LifecycleService.BATCH,
      });
      for (const p of profs) {
        const piano = p.dietStyle ? DIET_LABEL[p.dietStyle] ?? String(p.dietStyle) : String(p.regime ?? 'personalizzato');
        const r = await this.sendLifecycle({
          userId: p.userId,
          email: p.user?.email ?? null,
          key: dt.key,
          dedupeKey: dt.key,
          vars: {
            nome: p.user?.firstName ?? p.name ?? '',
            piano,
            coach: p.assignedCoach?.displayName ?? 'la tua coach',
            nutrizionista: p.assignedNutritionist?.displayName ?? 'il tuo nutrizionista',
            link: `${app}/`,
          },
        });
        bump(dt.key, r);
      }
    }

    // 4-bis) trial_g6_offer — prova gratuita al GIORNO 6: codice sconto personale
    //        con scadenza 48h (handoff lancio, punto 5). Il codice è idempotente
    //        (stessa scadenza a ogni ritentativo) e l'email è deduplicata per
    //        abbonamento; all'invio si traccia il funnel `trial_day6_offer_sent`.
    if (on('trial_g6_offer')) {
      const range6 = this.dayRange(-6);
      const trials = (await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          plan: { priceCents: 0 },
          startDate: { gte: range6.gte, lt: range6.lt },
        } as never,
        select: {
          id: true,
          clientId: true,
          client: { select: { email: true, firstName: true, clientProfile: { select: { name: true } } } },
        },
        take: LifecycleService.BATCH,
      })) as { id: string; clientId: string; client: { email: string; firstName: string | null; clientProfile: { name: string | null } | null } | null }[];
      if (trials.length > 0) {
        const [codeHours, discType, discValue, target1m, target3m] = await Promise.all([
          this.configParams.getNumber('trial_offer_code_hours', 48),
          this.configParams.getString('trial_offer_discount_type', 'percent'),
          this.configParams.getNumber('trial_offer_discount_value', 10),
          // Opzione B (decisione 17/07): il codice porta i piani a prezzi TARGET esatti.
          this.configParams.getNumber('trial_offer_target_1m', 9900), // 1 mese €130 → €99
          this.configParams.getNumber('trial_offer_target_3m', 24900), // 3 mesi €299 → €249
        ]);
        // Piano proposto nell'email: il percorso principale (3 mesi se esiste).
        const plans = (await this.prisma.plan.findMany({
          where: { active: true, priceCents: { gt: 0 } },
          orderBy: { priceCents: 'desc' },
          select: { id: true, name: true, priceCents: true, listPriceCents: true, promoEndsAt: true, period: true },
        })) as { id: string; name: string; priceCents: number; listPriceCents: number | null; promoEndsAt: Date | null; period: string }[];
        const offerPlan = plans.find((pl) => pl.period === '3m') ?? plans[0] ?? null;
        // Target per piano: solo dove il target è sotto il prezzo pieno (altrimenti niente sconto).
        const planTargets: Record<string, number> = {};
        for (const pl of plans) {
          const target = pl.period === '3m' ? target3m : pl.period === '1m' ? target1m : null;
          if (target != null && target > 0 && target < pl.priceCents) planTargets[pl.id] = target;
        }
        const hasTargets = Object.keys(planTargets).length > 0;
        for (const t of trials) {
          if (!t.client?.email) continue;
          const personal = await this.discounts.ensurePersonalTrialCode(t.clientId, {
            type: discType === 'fixed' ? 'fixed' : 'percent',
            value: discValue,
            validHours: codeHours,
            // Opzione B: target esatti per piano (fallback percent/fixed se i piani non sono allineati).
            planTargets: hasTargets ? planTargets : null,
          });
          const scad = personal.expiresAt
            ? personal.expiresAt.toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
            : '48 ore';
          // Prezzo nell'email (Opzione B): pieno barrato → prezzo col codice (target).
          const offerTarget = offerPlan ? planTargets[offerPlan.id] : undefined;
          const promoOn = offerPlan?.listPriceCents != null && offerPlan.listPriceCents > offerPlan.priceCents
            && (offerPlan.promoEndsAt == null || offerPlan.promoEndsAt.getTime() > Date.now());
          const shown = offerPlan ? (offerTarget ?? (promoOn ? offerPlan.priceCents : offerPlan.priceCents)) : null;
          const struck = offerPlan
            ? (offerTarget != null ? offerPlan.priceCents : (promoOn ? offerPlan.listPriceCents : null))
            : null;
          const r = await this.sendLifecycle({
            userId: t.clientId,
            email: t.client.email,
            key: 'trial_g6_offer',
            dedupeKey: `trial_g6_offer:${t.id}`,
            vars: {
              nome: t.client.firstName ?? t.client.clientProfile?.name ?? '',
              codice: personal.code,
              scadenza: scad,
              piano: offerPlan?.name ?? 'Percorso 3 mesi',
              prezzo: shown != null ? `€ ${Math.round(shown / 100)}` : '',
              prezzo_listino: struck != null && struck > (shown ?? 0) ? `€ ${Math.round(struck / 100)}` : '',
              link: `${app}/negozio`,
            },
          });
          bump('trial_g6_offer', r);
          if (r === 'sent') {
            // Stato funnel richiesto dall'handoff: trial_day6_offer_sent (+ segmento/canale, punto 6).
            const rec = (await this.prisma.crmRecord.findUnique({
              where: { clientId: t.clientId },
              select: { segment: true, channel: true, previousStatus: true, historicalPaidCents: true, stage: true } as never,
            }).catch(() => null)) as { segment: string | null; channel: string | null; previousStatus: string | null; historicalPaidCents: number | null; stage: string } | null;
            await this.prisma.analyticsEvent.create({
              data: {
                eventId: randomUUID(),
                name: 'trial_day6_offer_sent',
                userId: t.clientId,
                phase: 'funnel',
                data: {
                  subscriptionId: t.id, code: personal.code, expiresAt: personal.expiresAt,
                  ...(rec ? { segment: deriveSegment(rec), ...(rec.channel ? { channel: rec.channel } : {}) } : {}),
                } as never,
              } as never,
            }).catch(() => undefined);
          }
        }
      }
    }

    // 4-bis2) CARRELLO ABBANDONATO — evento `checkout_started` dell'app (tracking
    //         punto 6) SENZA acquisto successivo. Si guarda l'EPISODIO più recente
    //         per cliente e si manda solo lo scalino raggiunto (+1h → +24h → +72h),
    //         una volta ciascuno per episodio; se riapre il checkout, la scala riparte.
    if (on('cart_1h') || on('cart_24h') || on('cart_72h')) {
      const cartEvents = (await this.prisma.analyticsEvent.findMany({
        where: { name: 'checkout_started', userId: { not: null }, receivedAt: { gte: this.daysAgo(10) } },
        select: { id: true, userId: true, receivedAt: true, data: true },
        orderBy: { receivedAt: 'desc' },
        take: LifecycleService.BATCH,
      })) as { id: string; userId: string | null; receivedAt: Date; data: unknown }[];
      // Ultimo episodio per cliente (gli eventi arrivano già dal più recente).
      const latestByUser = new Map<string, { id: string; receivedAt: Date; data: unknown }>();
      for (const ev of cartEvents) {
        if (ev.userId && !latestByUser.has(ev.userId)) latestByUser.set(ev.userId, ev);
      }
      const cartUserIds = [...latestByUser.keys()];
      type CUser = { id: string; email: string; firstName: string | null; deletedAt: Date | null; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionist: { displayName: string } | null } | null };
      const cartUsers = (cartUserIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: cartUserIds }, role: 'client', deletedAt: null },
            select: { id: true, email: true, firstName: true, deletedAt: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } }, assignedNutritionist: { select: { displayName: true } } } } },
          })
        : []) as CUser[];
      const cartById = new Map(cartUsers.map((u) => [u.id, u]));
      const now = Date.now();
      for (const [uid, ev] of latestByUser) {
        const u = cartById.get(uid);
        if (!u) continue;
        // Ha comprato dopo? (abbonamento in corso, oppure pagamento approvato dopo l'evento)
        const bought = await this.prisma.subscription.findFirst({
          where: { clientId: uid, status: { in: ['active', 'pending'] as never }, createdAt: { gte: ev.receivedAt } },
          select: { id: true },
        });
        if (bought) continue;
        const paid = await this.prisma.payment.findFirst({
          where: { clientId: uid, status: 'approved', createdAt: { gte: ev.receivedAt } } as never,
          select: { id: true },
        });
        if (paid) continue;
        const ageH = (now - ev.receivedAt.getTime()) / 3_600_000;
        const key = ageH >= 72 ? 'cart_72h' : ageH >= 24 ? 'cart_24h' : ageH >= 1 ? 'cart_1h' : null;
        if (!key || !on(key)) continue;
        // Nome del piano nel carrello (se c'era) per il merge {{piano}}.
        const planId = (ev.data as { planId?: string | null } | null)?.planId ?? null;
        let pianoName = 'il tuo percorso';
        if (planId) {
          const pl = await this.prisma.plan.findUnique({ where: { id: planId }, select: { name: true } }).catch(() => null);
          if (pl?.name) pianoName = pl.name;
        }
        const r = await this.sendLifecycle({
          userId: uid,
          email: u.email,
          key,
          dedupeKey: `${key}:${ev.id}`,
          vars: {
            nome: u.firstName ?? u.clientProfile?.name ?? '',
            piano: pianoName,
            coach: u.clientProfile?.assignedCoach?.displayName ?? 'la tua coach',
            nutrizionista: u.clientProfile?.assignedNutritionist?.displayName ?? 'il tuo nutrizionista',
            link: `${app}/checkout`,
          },
        });
        bump(key, r);
      }
    }

    // 4-ter) RINNOVI (handoff: rinnovo T-7/T-3/T-1) — piani A PAGAMENTO attivi in
    //        scadenza; dedup per abbonamento, così un rinnovo nuovo riparte pulito.
    const renewalTriggers: { key: string; offset: number }[] = [
      { key: 'rin_t7', offset: 7 },
      { key: 'rin_t3', offset: 3 },
      { key: 'rin_t1', offset: 1 },
    ];
    for (const rt of renewalTriggers) {
      if (!on(rt.key)) continue;
      const range = this.dayRange(rt.offset);
      const subs = (await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          plan: { priceCents: { gt: 0 } },
          endDate: { gte: range.gte, lt: range.lt },
        } as never,
        select: {
          id: true,
          clientId: true,
          plan: { select: { name: true } },
          client: { select: { email: true, firstName: true, deletedAt: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } }, assignedNutritionist: { select: { displayName: true } } } } } },
        },
        take: LifecycleService.BATCH,
      })) as { id: string; clientId: string; plan: { name: string }; client: { email: string; firstName: string | null; deletedAt: Date | null; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionist: { displayName: string } | null } | null } | null }[];
      for (const sub of subs) {
        if (!sub.client || sub.client.deletedAt) continue;
        const r = await this.sendLifecycle({
          userId: sub.clientId,
          email: sub.client.email,
          key: rt.key,
          dedupeKey: `${rt.key}:${sub.id}`,
          vars: {
            nome: sub.client.firstName ?? sub.client.clientProfile?.name ?? '',
            piano: sub.plan.name,
            coach: sub.client.clientProfile?.assignedCoach?.displayName ?? 'la tua coach',
            nutrizionista: sub.client.clientProfile?.assignedNutritionist?.displayName ?? 'il tuo nutrizionista',
            link: `${app}/negozio`,
          },
        });
        bump(rt.key, r);
      }
    }

    // 4-quater) WIN-BACK T+3 / T+7 — piano a pagamento scaduto da 3/7 giorni e
    //           NESSUN abbonamento attivo/in attesa oggi (non ha rinnovato).
    const winbackTriggers: { key: string; offset: number }[] = [
      { key: 'wb_t3', offset: -3 },
      { key: 'wb_t7', offset: -7 },
    ];
    for (const wt of winbackTriggers) {
      if (!on(wt.key)) continue;
      const range = this.dayRange(wt.offset);
      const subs = (await this.prisma.subscription.findMany({
        where: {
          status: 'expired',
          plan: { priceCents: { gt: 0 } },
          endDate: { gte: range.gte, lt: range.lt },
        } as never,
        select: { id: true, clientId: true, client: { select: { email: true, firstName: true, deletedAt: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } } } } } } },
        take: LifecycleService.BATCH,
      })) as { id: string; clientId: string; client: { email: string; firstName: string | null; deletedAt: Date | null; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null } | null } | null }[];
      for (const sub of subs) {
        if (!sub.client || sub.client.deletedAt) continue;
        const stillOut = await this.prisma.subscription.findFirst({
          where: { clientId: sub.clientId, status: { in: ['active', 'pending'] as never } },
          select: { id: true },
        });
        if (stillOut) continue; // ha già rinnovato o sta pagando: niente win-back
        const r = await this.sendLifecycle({
          userId: sub.clientId,
          email: sub.client.email,
          key: wt.key,
          dedupeKey: `${wt.key}:${sub.id}`,
          vars: {
            nome: sub.client.firstName ?? sub.client.clientProfile?.name ?? '',
            coach: sub.client.clientProfile?.assignedCoach?.displayName ?? 'la tua coach',
            link: `${app}/negozio`,
          },
        });
        bump(wt.key, r);
      }
    }

    // 4-quinquies) ev_mantenimento — mantenimento attivato negli ultimi 7 giorni
    //              (dal funnel `maintenance_started`); dedup per evento.
    if (on('ev_mantenimento')) {
      const events = (await this.prisma.analyticsEvent.findMany({
        where: { name: 'maintenance_started', userId: { not: null }, receivedAt: { gte: this.daysAgo(7) } },
        select: { id: true, userId: true },
        orderBy: { receivedAt: 'desc' },
        take: LifecycleService.BATCH,
      })) as { id: string; userId: string | null }[];
      const mIds = [...new Set(events.map((e) => e.userId).filter((x): x is string => !!x))];
      type MUser = { id: string; email: string; firstName: string | null; clientProfile: { assignedCoach: { displayName: string } | null } | null };
      const mUsers = (mIds.length
        ? await this.prisma.user.findMany({ where: { id: { in: mIds }, role: 'client', deletedAt: null }, select: { id: true, email: true, firstName: true, clientProfile: { select: { assignedCoach: { select: { displayName: true } } } } } })
        : []) as MUser[];
      const mById = new Map(mUsers.map((u) => [u.id, u]));
      for (const ev of events) {
        const uu = ev.userId ? mById.get(ev.userId) : undefined;
        if (!uu) continue;
        const r = await this.sendLifecycle({
          userId: uu.id,
          email: uu.email,
          key: 'ev_mantenimento',
          dedupeKey: `ev_mantenimento:${ev.id}`,
          vars: {
            nome: uu.firstName ?? '',
            piano: 'Mantenimento',
            coach: uu.clientProfile?.assignedCoach?.displayName ?? 'la tua coach',
            link: `${app}/`,
          },
        });
        bump('ev_mantenimento', r);
      }
    }

    // 5) ev_compleanno — clienti che compiono gli anni oggi (dedup per anno)
    if (on('ev_compleanno')) {
      const today = new Date();
      const tM = today.getUTCMonth();
      const tD = today.getUTCDate();
      const year = today.getUTCFullYear();
      const users = await this.prisma.user.findMany({
        where: { role: 'client', deletedAt: null, birthDate: { not: null } },
        select: { id: true, email: true, firstName: true, birthDate: true },
        take: LifecycleService.BATCH,
      });
      for (const u of users) {
        const b = u.birthDate as Date | null;
        if (!b || b.getUTCMonth() !== tM || b.getUTCDate() !== tD) continue;
        const r = await this.sendLifecycle({
          userId: u.id,
          email: u.email,
          key: 'ev_compleanno',
          dedupeKey: `ev_compleanno:${year}`,
          vars: { nome: u.firstName ?? '', link: `${app}/` },
        });
        bump('ev_compleanno', r);
      }
    }

    // 6) ev_rientro — clienti rientrati dalla vacanza negli ultimi 7 giorni
    //    (evento travel_return); dedup per singolo evento di rientro.
    if (on('ev_rientro')) {
      const events = await this.prisma.analyticsEvent.findMany({
        where: { name: 'travel_return', userId: { not: null }, receivedAt: { gte: this.daysAgo(7) } },
        select: { id: true, userId: true },
        orderBy: { receivedAt: 'desc' },
        take: LifecycleService.BATCH,
      });
      const ids = [...new Set(events.map((e) => e.userId).filter((x): x is string => !!x))];
      const users = ids.length
        ? await this.prisma.user.findMany({ where: { id: { in: ids }, role: 'client', deletedAt: null }, select: { id: true, email: true, firstName: true } })
        : [];
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const ev of events) {
        const u = ev.userId ? byId.get(ev.userId) : undefined;
        if (!u) continue;
        const r = await this.sendLifecycle({
          userId: u.id,
          email: u.email,
          key: 'ev_rientro',
          dedupeKey: `ev_rientro:${ev.id}`,
          vars: { nome: u.firstName ?? '', link: `${app}/` },
        });
        bump('ev_rientro', r);
      }
    }

    // 7) ev_anniversario — anniversario dell'inizio piano (stesso giorno/mese,
    //    anni successivi al primo); dedup per anno.
    if (on('ev_anniversario')) {
      const today = new Date();
      const aM = today.getUTCMonth();
      const aD = today.getUTCDate();
      const aY = today.getUTCFullYear();
      const profs = await this.prisma.clientProfile.findMany({
        where: { planStartDate: { not: null } },
        select: { userId: true, name: true, planStartDate: true, user: { select: { email: true, firstName: true } } },
        take: LifecycleService.BATCH,
      });
      for (const p of profs) {
        const ps = p.planStartDate as Date | null;
        if (!ps) continue;
        const anni = aY - ps.getUTCFullYear();
        if (anni < 1 || ps.getUTCMonth() !== aM || ps.getUTCDate() !== aD) continue;
        const r = await this.sendLifecycle({
          userId: p.userId,
          email: p.user?.email ?? null,
          key: 'ev_anniversario',
          dedupeKey: `ev_anniversario:${aY}`,
          vars: { nome: p.user?.firstName ?? p.name ?? '', anni: String(anni), link: `${app}/` },
        });
        bump('ev_anniversario', r);
      }
    }

    return counts;
  }
}
