import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

export type SegmentFilters = {
  stages?: string[];
  tags?: string[];
  listIds?: string[];
  hasClient?: boolean | null;
  historicalPaid?: boolean;
  city?: string;
  coachId?: string;
  /** Classificazione persona: cliente attivo, cliente storico (pre-Metabole) o lead. */
  segment?: 'client' | 'historical' | 'lead';
};

type Recipient = { id: string; name: string | null; email: string | null; clientId: string | null };

/**
 * Modulo Marketing: segmentazione dinamica delle schede (CrmRecord) con filtri
 * combinabili, invio di un modello email alla lista (via Brevo, rispettando gli
 * opt-out) e storico campagne con destinatari CONGELATI al momento dell'invio.
 */
@Injectable()
export class MarketingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketingService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  /** Il ticker controlla ogni minuto le campagne programmate e i lotti dovuti. */
  private static readonly TICK_MS = 60 * 1000;
  /** Tetto di destinatari processati per singolo giro del ticker (prudenza). */
  private static readonly MAX_PER_TICK = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // Scheduler interno leggero (come LifecycleService): nessuna dipendenza esterna.
    // Primo giro dopo 30s (dà tempo al boot), poi ogni minuto.
    this.timer = setInterval(() => void this.processDueCampaigns(), MarketingService.TICK_MS);
    this.timer.unref?.();
    setTimeout(() => void this.processDueCampaigns(), 30 * 1000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private conditions(f: SegmentFilters): Prisma.CrmRecordWhereInput[] {
    const c: Prisma.CrmRecordWhereInput[] = [];
    if (f.stages?.length) c.push({ stage: { in: f.stages } });
    if (f.tags?.length) c.push({ tags: { hasSome: f.tags } });
    if (f.listIds?.length) c.push({ listMemberships: { some: { listId: { in: f.listIds } } } });
    if (f.hasClient === true) c.push({ clientId: { not: null } });
    if (f.hasClient === false) c.push({ clientId: null });
    if (f.historicalPaid) c.push({ historicalPaidCents: { gt: 0 } });
    // Classificazione persona (cliente / storico / lead), coerente con il badge CRM.
    if (f.segment === 'client') c.push({ stage: 'paid' });
    if (f.segment === 'historical') c.push({ historicalPaidCents: { gt: 0 }, stage: { not: 'paid' } });
    if (f.segment === 'lead')
      c.push({ stage: { not: 'paid' }, OR: [{ historicalPaidCents: null }, { historicalPaidCents: { lte: 0 } }] });
    if (f.city && f.city.trim()) c.push({ address: { contains: f.city.trim(), mode: 'insensitive' } });
    if (f.coachId) c.push({ assignedCoachId: f.coachId });
    return c;
  }

  private whereWithEmail(f: SegmentFilters): Prisma.CrmRecordWhereInput {
    return { AND: [...this.conditions(f), { email: { not: null } }, { email: { not: '' } }] };
  }

  private merge(html: string, vars: Record<string, string>): string {
    return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');
  }

  async options() {
    const [lists, stageRows, tagRows, templates] = await Promise.all([
      this.prisma.crmList.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } }),
      this.prisma.crmRecord.findMany({ distinct: ['stage'], select: { stage: true } }),
      this.prisma.crmRecord.findMany({ where: { tags: { isEmpty: false } }, select: { tags: true }, take: 5000 }),
      this.prisma.emailTemplate.findMany({ where: { active: true }, select: { key: true, name: true, subject: true }, orderBy: { name: 'asc' } }),
    ]);
    const stages = [...new Set(stageRows.map((r) => r.stage))].sort();
    const tags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
    return { lists, stages, tags, templates };
  }

  async previewSegment(f: SegmentFilters) {
    const where = this.whereWithEmail(f);
    const total = await this.prisma.crmRecord.count({ where });
    const sample = await this.prisma.crmRecord.findMany({
      where, select: { id: true, name: true, email: true, stage: true, tags: true }, take: 12, orderBy: { createdAt: 'desc' },
    });
    return { total, sample };
  }

  private async filterConsent(records: Recipient[]): Promise<Recipient[]> {
    // 1) opt-out per email (dal webhook Brevo: disiscrizioni/spam/bounce)
    const optRows = await this.prisma.marketingOptOut.findMany({ select: { email: true } });
    const optSet = new Set(optRows.map((o) => o.email.toLowerCase()));
    let list = records.filter((r) => !r.email || !optSet.has(r.email.toLowerCase()));
    // 2) opt-out dei clienti via notificationPrefs
    const clientIds = list.map((r) => r.clientId).filter((x): x is string => !!x);
    if (!clientIds.length) return list;
    const profiles = await this.prisma.clientProfile.findMany({ where: { userId: { in: clientIds } }, select: { userId: true, notificationPrefs: true } });
    const optedOut = new Set(
      profiles
        .filter((p) => { const n = p.notificationPrefs as Record<string, unknown> | null; return !!n && (n.marketing === false || n.marketingOptOut === true); })
        .map((p) => p.userId),
    );
    return list.filter((r) => !r.clientId || !optedOut.has(r.clientId));
  }

  async sendTest(templateKey: string, testEmail: string) {
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!tpl) throw new BadRequestException('Modello email non trovato.');
    const html = this.merge(tpl.bodyHtml, { name: 'Nome' });
    const ok = await this.mail.send({ to: testEmail, subject: `[PROVA] ${tpl.subject}`, html, templateKey: `campaign_test:${tpl.key}` });
    if (!ok) throw new BadRequestException('Invio di prova non riuscito (verifica BREVO_API_KEY su Render).');
    return { test: true, to: testEmail };
  }

  /**
   * Crea una campagna e la avvia: subito ("invia ora") oppure a una data/ora
   * futura ("programma"). In entrambi i casi l'invio può essere diluito a lotti
   * (throttle): invia `batchSize` e-mail, poi fa una pausa di `pauseMinutes`
   * minuti prima del lotto successivo. `batchSize` 0 = tutte insieme.
   *
   * "Invia ora" manda subito il PRIMO lotto (feedback immediato) e lascia i
   * successivi al ticker. "Programma" congela i destinatari ora e li invia dal
   * momento scelto in poi.
   */
  async sendCampaign(
    input: {
      title: string;
      templateKey: string;
      filters: SegmentFilters;
      scheduledFor?: string | null;
      batchSize?: number;
      pauseMinutes?: number;
    },
    actorId: string,
  ) {
    if (!input.title?.trim()) throw new BadRequestException('Dai un titolo alla campagna.');
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key: input.templateKey } });
    if (!tpl) throw new BadRequestException('Modello email non trovato.');

    const batchSize = Math.max(0, Math.min(5000, Math.floor(input.batchSize ?? 0)));
    const pauseMinutes = Math.max(0, Math.min(1440, Math.floor(input.pauseMinutes ?? 0)));

    let scheduledFor: Date | null = null;
    if (input.scheduledFor) {
      const d = new Date(input.scheduledFor);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data di invio non valida.');
      // Tolleranza di 1 minuto: una data appena passata vale "adesso".
      if (d.getTime() < Date.now() - 60_000) throw new BadRequestException('La data di invio è nel passato.');
      scheduledFor = d;
    }

    const records = await this.prisma.crmRecord.findMany({ where: this.whereWithEmail(input.filters), select: { id: true, name: true, email: true, clientId: true } });
    const recipients = await this.filterConsent(records);
    if (recipients.length === 0) throw new BadRequestException('Nessun destinatario con email valida (dopo gli opt-out).');

    // Crea la campagna PRIMA dell'invio, per taggare le email con il suo id (stats Brevo).
    const campaign = await this.prisma.marketingCampaign.create({
      data: {
        title: input.title.trim(),
        templateKey: tpl.key,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        segment: input.filters as never,
        recipients: recipients.map((r) => ({ email: r.email, name: r.name, recordId: r.id })) as never,
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        cursor: 0,
        batchSize,
        pauseMinutes,
        scheduledFor,
        status: scheduledFor ? 'scheduled' : 'sending',
        nextBatchAt: scheduledFor ?? new Date(),
        createdById: actorId,
      } as never,
    });

    await this.audit.log({
      action: scheduledFor ? 'marketing.campaign.schedule' : 'marketing.campaign.send',
      actorId,
      entityType: 'marketing_campaign',
      entityId: campaign.id,
      metadata: { recipients: recipients.length, batchSize, pauseMinutes, scheduledFor: scheduledFor?.toISOString() ?? null },
    });

    // Programmata → il ticker la farà partire al momento giusto.
    if (scheduledFor) {
      return { id: campaign.id, recipientCount: recipients.length, scheduled: true, scheduledFor: scheduledFor.toISOString() };
    }

    // Invio ora → manda subito il primo lotto (o tutto, se senza throttle).
    const res = await this.runBatch(campaign.id);
    return { id: campaign.id, recipientCount: recipients.length, scheduled: false, sent: res.sent, failed: res.failed, done: res.done };
  }

  /** Annulla una campagna programmata o in corso (i lotti non ancora inviati non partono). */
  async cancelCampaign(id: string, actorId: string) {
    const c = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campagna non trovata.');
    if (c.status !== 'scheduled' && c.status !== 'sending') {
      throw new BadRequestException('Questa campagna è già conclusa o annullata.');
    }
    await this.prisma.marketingCampaign.update({ where: { id }, data: { status: 'canceled', nextBatchAt: null } });
    await this.audit.log({ action: 'marketing.campaign.cancel', actorId, entityType: 'marketing_campaign', entityId: id });
    return { id, status: 'canceled' as const };
  }

  /**
   * Invia UN lotto della campagna: da `cursor` per `batchSize` destinatari
   * (o tutti i rimanenti se batchSize=0). Aggiorna contatori e stato; se restano
   * destinatari, programma il prossimo lotto tra `pauseMinutes` minuti.
   */
  private async runBatch(campaignId: string): Promise<{ sent: number; failed: number; done: boolean }> {
    const now = new Date();
    // Claim atomico: sposto nextBatchAt su un "lease" a 10 minuti e vinco la corsa solo
    // se ero effettivamente dovuto. Evita doppi invii tra "invia ora" inline e il ticker
    // (o tra più istanze). Se il processo muore a metà, il lease scade e il lotto si ritenta.
    const lease = new Date(now.getTime() + 10 * 60_000);
    const claim = await this.prisma.marketingCampaign.updateMany({
      where: { id: campaignId, status: { in: ['scheduled', 'sending'] }, nextBatchAt: { lte: now } },
      data: { status: 'sending', nextBatchAt: lease },
    });
    if (claim.count === 0) return { sent: 0, failed: 0, done: true };

    const c = await this.prisma.marketingCampaign.findUnique({ where: { id: campaignId } });
    if (!c) return { sent: 0, failed: 0, done: true };

    const recipients = (c.recipients as Array<{ email: string | null; name: string | null; recordId: string }>) ?? [];
    const start = c.cursor ?? 0;
    const size = c.batchSize && c.batchSize > 0 ? c.batchSize : recipients.length;
    const slice = recipients.slice(start, start + size);
    const tag = `campaign:${c.id}`;

    let sent = 0;
    let failed = 0;
    for (const r of slice) {
      if (!r.email) { failed++; continue; }
      const html = this.merge(c.bodyHtml, { name: r.name ?? '' });
      const ok = await this.mail.send({ to: r.email, subject: c.subject, html, templateKey: `campaign:${c.templateKey}`, tags: [tag] });
      if (ok) sent++; else failed++;
    }

    const newCursor = start + slice.length;
    const done = newCursor >= recipients.length;
    // updateMany con guardia status!=canceled: se la campagna è stata annullata durante
    // il lotto, l'aggiornamento è un no-op e resta "canceled" (i lotti futuri non partono).
    await this.prisma.marketingCampaign.updateMany({
      where: { id: c.id, status: { not: 'canceled' } },
      data: {
        sentCount: (c.sentCount ?? 0) + sent,
        failedCount: (c.failedCount ?? 0) + failed,
        cursor: newCursor,
        status: done ? 'sent' : 'sending',
        nextBatchAt: done ? null : new Date(Date.now() + (c.pauseMinutes ?? 0) * 60_000),
      },
    });
    return { sent, failed, done };
  }

  /**
   * Ticker interno (ogni minuto): fa partire le campagne programmate arrivate a
   * scadenza e manda il lotto successivo di quelle in corso, rispettando la pausa.
   */
  async processDueCampaigns(): Promise<{ processed: number }> {
    if (this.ticking) return { processed: 0 };
    this.ticking = true;
    let processed = 0;
    try {
      const now = new Date();
      const due = await this.prisma.marketingCampaign.findMany({
        where: { status: { in: ['scheduled', 'sending'] }, nextBatchAt: { lte: now } },
        orderBy: { nextBatchAt: 'asc' },
        select: { id: true },
        take: 50,
      });
      for (const d of due) {
        if (processed >= MarketingService.MAX_PER_TICK) break;
        try {
          const res = await this.runBatch(d.id);
          processed += res.sent + res.failed;
        } catch (e) {
          this.logger.warn(`Lotto campagna ${d.id} fallito: ${e instanceof Error ? e.message : e}`);
        }
      }
    } finally {
      this.ticking = false;
    }
    return { processed };
  }

  listCampaigns() {
    return this.prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: {
        id: true, title: true, templateKey: true, subject: true, recipientCount: true,
        sentCount: true, failedCount: true, status: true, scheduledFor: true, nextBatchAt: true,
        batchSize: true, pauseMinutes: true, cursor: true, createdAt: true,
      },
    });
  }

  getCampaign(id: string) {
    return this.prisma.marketingCampaign.findUnique({ where: { id } });
  }

  /** Statistiche di lettura della campagna da Brevo (consegne, bounce, aperture, click, disiscrizioni). */
  async campaignStats(id: string) {
    const raw = await this.mail.aggregatedStats(`campaign:${id}`);
    if (!raw) return { available: false as const };
    const n = (k: string) => Number(raw[k] ?? 0);
    return {
      available: true as const,
      requests: n('requests'),
      delivered: n('delivered'),
      hardBounces: n('hardBounces'),
      softBounces: n('softBounces'),
      opens: n('opens'),
      uniqueOpens: n('uniqueOpens'),
      clicks: n('clicks'),
      uniqueClicks: n('uniqueClicks'),
      unsubscribed: n('unsubscribed'),
      spamReports: n('spamReports'),
      blocked: n('blocked'),
    };
  }

  /** Webhook Brevo: su disiscrizione/spam/bounce segna l'email come opt-out marketing. */
  async handleBrevoWebhook(token: string | undefined, body: unknown) {
    const secret = this.config.get<string>('BREVO_WEBHOOK_SECRET');
    if (!secret || token !== secret) throw new UnauthorizedException('Token webhook non valido.');
    const events = Array.isArray(body) ? body : [body];
    const OPT_OUT = new Set(['unsubscribed', 'spam', 'hard_bounce', 'blocked', 'blacklisted', 'complaint']);
    let optedOut = 0;
    for (const ev of events) {
      const e = (ev ?? {}) as Record<string, unknown>;
      const event = String(e.event ?? '').toLowerCase();
      const email = String(e.email ?? '').trim().toLowerCase();
      if (!email || !OPT_OUT.has(event)) continue;
      await this.prisma.marketingOptOut.upsert({ where: { email }, create: { email, reason: event, source: 'brevo' }, update: { reason: event } });
      optedOut++;
    }
    return { ok: true, processed: events.length, optedOut };
  }
}
