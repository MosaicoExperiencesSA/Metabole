import { BadRequestException, Injectable } from '@nestjs/common';
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
};

type Recipient = { id: string; name: string | null; email: string | null; clientId: string | null };

/**
 * Modulo Marketing: segmentazione dinamica delle schede (CrmRecord) con filtri
 * combinabili, invio di un modello email alla lista (via Brevo, rispettando gli
 * opt-out) e storico campagne con destinatari CONGELATI al momento dell'invio.
 */
@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  private conditions(f: SegmentFilters): Prisma.CrmRecordWhereInput[] {
    const c: Prisma.CrmRecordWhereInput[] = [];
    if (f.stages?.length) c.push({ stage: { in: f.stages } });
    if (f.tags?.length) c.push({ tags: { hasSome: f.tags } });
    if (f.listIds?.length) c.push({ listMemberships: { some: { listId: { in: f.listIds } } } });
    if (f.hasClient === true) c.push({ clientId: { not: null } });
    if (f.hasClient === false) c.push({ clientId: null });
    if (f.historicalPaid) c.push({ historicalPaidCents: { gt: 0 } });
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
    const clientIds = records.map((r) => r.clientId).filter((x): x is string => !!x);
    if (!clientIds.length) return records;
    const profiles = await this.prisma.clientProfile.findMany({ where: { userId: { in: clientIds } }, select: { userId: true, notificationPrefs: true } });
    const optedOut = new Set(
      profiles
        .filter((p) => { const n = p.notificationPrefs as Record<string, unknown> | null; return !!n && (n.marketing === false || n.marketingOptOut === true); })
        .map((p) => p.userId),
    );
    return records.filter((r) => !r.clientId || !optedOut.has(r.clientId));
  }

  async sendTest(templateKey: string, testEmail: string) {
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!tpl) throw new BadRequestException('Modello email non trovato.');
    const html = this.merge(tpl.bodyHtml, { name: 'Nome' });
    const ok = await this.mail.send({ to: testEmail, subject: `[PROVA] ${tpl.subject}`, html, templateKey: `campaign_test:${tpl.key}` });
    if (!ok) throw new BadRequestException('Invio di prova non riuscito (verifica BREVO_API_KEY su Render).');
    return { test: true, to: testEmail };
  }

  async sendCampaign(input: { title: string; templateKey: string; filters: SegmentFilters }, actorId: string) {
    if (!input.title?.trim()) throw new BadRequestException('Dai un titolo alla campagna.');
    const tpl = await this.prisma.emailTemplate.findUnique({ where: { key: input.templateKey } });
    if (!tpl) throw new BadRequestException('Modello email non trovato.');
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
        status: 'sending',
        createdById: actorId,
      } as never,
    });
    const tag = `campaign:${campaign.id}`;

    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      if (!r.email) { failed++; continue; }
      const html = this.merge(tpl.bodyHtml, { name: r.name ?? '' });
      const ok = await this.mail.send({ to: r.email, subject: tpl.subject, html, templateKey: `campaign:${tpl.key}`, tags: [tag] });
      if (ok) sent++; else failed++;
    }

    await this.prisma.marketingCampaign.update({ where: { id: campaign.id }, data: { sentCount: sent, failedCount: failed, status: 'sent' } });
    await this.audit.log({ action: 'marketing.campaign.send', actorId, entityType: 'marketing_campaign', entityId: campaign.id, metadata: { recipients: recipients.length, sent, failed } });
    return { id: campaign.id, recipientCount: recipients.length, sent, failed };
  }

  listCampaigns() {
    return this.prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, title: true, templateKey: true, subject: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true },
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
}
