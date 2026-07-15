import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MailboxService } from '../mailbox/mailbox.service';

const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const FINANCE_ROLES = ['admin', 'sales'];
type Row = { a: string; b?: string; sub?: string };

/**
 * Mini-anteprime per i moduli della dashboard: gli ultimi dati di ciascuna
 * pagina. Ogni sezione è isolata in try/catch (un errore non blocca le altre)
 * e rispetta lo scope per ruolo dove necessario.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly mailbox: MailboxService) {}

  async previews(user: AuthUser): Promise<Record<string, Row[]>> {
    const out: Record<string, Row[]> = {};
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
    const scopeAll = MANAGER_ROLES.includes(user.role);
    const clientWhere: Record<string, unknown> = { role: 'client', deletedAt: null };
    if (!scopeAll) {
      if (user.role === 'coach' && staff) clientWhere.clientProfile = { assignedCoachId: staff.id };
      else if (user.role === 'nutritionist' && staff) clientWhere.clientProfile = { assignedNutritionistId: staff.id };
      else clientWhere.id = '__none__';
    }
    const dmy = (d: Date) => new Date(d).toLocaleDateString('it-IT');
    const euro = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

    // Clienti recenti
    try {
      const rows = (await this.prisma.user.findMany({
        where: clientWhere as never, orderBy: { createdAt: 'desc' }, take: 5,
        select: { createdAt: true, email: true, clientProfile: { select: { name: true } } },
      })) as { createdAt: Date; email: string; clientProfile: { name: string | null } | null }[];
      out.clients = rows.map((r) => ({ a: r.clientProfile?.name ?? r.email, b: dmy(r.createdAt) }));
    } catch { /* skip */ }

    // CRM: lead recenti (con coach e nutrizionista assegnati)
    try {
      const rows = (await this.prisma.crmRecord.findMany({
        orderBy: { updatedAt: 'desc' }, take: 5,
        select: {
          name: true, email: true, stage: true,
          assignedCoach: { select: { displayName: true } },
          client: { select: { email: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } }, assignedNutritionist: { select: { displayName: true } } } } } },
        },
      })) as {
        name: string | null; email: string | null; stage: string;
        assignedCoach: { displayName: string } | null;
        client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionist: { displayName: string } | null } | null } | null;
      }[];
      out.crm_leads = rows.map((r) => {
        const coach = r.assignedCoach?.displayName ?? r.client?.clientProfile?.assignedCoach?.displayName ?? null;
        const nutri = r.client?.clientProfile?.assignedNutritionist?.displayName ?? null;
        const sub = `Coach: ${coach ?? '—'} · Nutr.: ${nutri ?? '—'}`;
        return { a: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome', b: r.stage, sub };
      });
    } catch { /* skip */ }

    // Lead da accettare: assegnati in attesa (assignmentStatus pending), scope per coach
    try {
      const whereAccept: Record<string, unknown> = { assignmentStatus: 'pending' };
      if (!scopeAll) {
        if (user.role === 'coach' && staff) whereAccept.assignedCoachId = staff.id;
        else whereAccept.id = '__none__';
      }
      const rows = (await this.prisma.crmRecord.findMany({
        where: whereAccept as never, orderBy: { assignedAt: 'desc' }, take: 5,
        select: {
          name: true, email: true, assignedAt: true,
          assignedCoach: { select: { displayName: true } },
          client: { select: { email: true, clientProfile: { select: { name: true } } } },
        },
      })) as {
        name: string | null; email: string | null; assignedAt: Date | null;
        assignedCoach: { displayName: string } | null;
        client: { email: string; clientProfile: { name: string | null } | null } | null;
      }[];
      out.lead_accept = rows.map((r) => ({
        a: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome',
        b: r.assignedAt ? dmy(r.assignedAt) : 'da accettare',
        sub: scopeAll && r.assignedCoach ? `Coach: ${r.assignedCoach.displayName}` : undefined,
      }));
    } catch { /* skip */ }

    // Grafici: numeri chiave (scope per ruolo)
    try {
      const ids = ((await this.prisma.user.findMany({ where: clientWhere as never, select: { id: true } })) as { id: string }[]).map((c) => c.id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = ids.length ? await this.prisma.user.count({ where: { id: { in: ids }, createdAt: { gte: monthStart } } }) : 0;
      const activeSubs = ids.length ? await this.prisma.subscription.count({ where: { clientId: { in: ids }, status: 'active' as never } }) : 0;
      out.charts = [
        { a: 'Clienti', b: String(ids.length) },
        { a: 'Nuovi questo mese', b: String(newThisMonth) },
        { a: 'Abbonamenti attivi', b: String(activeSubs) },
      ];
    } catch { /* skip */ }

    // Chat: ultime conversazioni (scope: coach/nutrizionista vedono i propri clienti)
    try {
      const threadWhere: Record<string, unknown> = { lastMessageAt: { not: null } };
      if (user.role === 'coach') threadWhere.counterpart = 'coach';
      else if (user.role === 'nutritionist') threadWhere.counterpart = 'nutritionist';
      if (!scopeAll) threadWhere.client = { is: clientWhere };
      const rows = (await this.prisma.chatThread.findMany({
        where: threadWhere as never, orderBy: { lastMessageAt: 'desc' }, take: 5,
        select: {
          counterpart: true, lastMessageAt: true,
          client: { select: { email: true, clientProfile: { select: { name: true } } } },
          messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } },
        },
      })) as {
        counterpart: string; lastMessageAt: Date | null;
        client: { email: string; clientProfile: { name: string | null } | null };
        messages: { body: string }[];
      }[];
      out.chat = rows.map((r) => ({
        a: r.client.clientProfile?.name ?? r.client.email,
        b: r.lastMessageAt ? dmy(r.lastMessageAt) : undefined,
        sub: r.messages[0]?.body?.slice(0, 80),
      }));
    } catch { /* skip */ }

    // Posta: ultimi messaggi ricevuti nella casella @metabole.eu (IMAP, con timeout per non bloccare la dashboard)
    try {
      const inbox = (await Promise.race([
        this.mailbox.listInbox(user.sub, 5),
        new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ])) as Array<{ from: string; fromName: string; subject: string; date: Date | string | null }>;
      out.posta = inbox.slice(0, 5).map((m) => ({
        a: m.subject || '(nessun oggetto)',
        b: m.date ? dmy(new Date(m.date)) : undefined,
        sub: m.fromName || m.from,
      }));
    } catch { /* casella non configurata o IMAP non disponibile: nessuna anteprima */ }

    // Testimonianze: le ultime inserite (marketing/admin)
    if (['marketing', 'head_marketing', 'admin'].includes(user.role)) {
      try {
        const rows = (await this.prisma.testimonial.findMany({
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { name: true, published: true, createdAt: true },
        })) as { name: string; published: boolean; createdAt: Date }[];
        out.testimonials = rows.map((r) => ({ a: r.name, b: r.published ? 'pubblicata' : 'bozza', sub: dmy(r.createdAt) }));
      } catch { /* skip */ }
    }

    // Dati finanziari solo per admin/commerciale
    if (FINANCE_ROLES.includes(user.role)) {
      // Bonifici da verificare
      try {
        const rows = (await this.prisma.payment.findMany({
          where: { status: 'receipt_uploaded' as never }, orderBy: { createdAt: 'asc' }, take: 5,
          select: { amountCents: true, description: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } },
        })) as { amountCents: number; description: string; client: { email: string; clientProfile: { name: string | null } | null } | null }[];
        out.accounting = rows.map((r) => ({ a: r.client?.clientProfile?.name ?? r.client?.email ?? r.description, b: euro(r.amountCents) }));
      } catch { /* skip */ }
      // Acquisti recenti (approvati) — con nickname del cliente
      try {
        const rows = (await this.prisma.payment.findMany({
          where: { status: 'approved' as never }, orderBy: { approvedAt: 'desc' }, take: 5,
          select: { amountCents: true, description: true, approvedAt: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } },
        })) as { amountCents: number; description: string; approvedAt: Date | null; client: { email: string; clientProfile: { name: string | null } | null } | null }[];
        out.purchases = rows.map((r) => ({
          a: r.description,
          b: euro(r.amountCents),
          sub: r.client?.clientProfile?.name ?? r.client?.email ?? undefined,
        }));
      } catch { /* skip */ }
    }

    // Sezioni amministrative (solo admin, come le rispettive pagine)
    if (user.role === 'admin') {
      // Negozio: piani e prodotti attivi
      try {
        const [plans, products] = await Promise.all([
          this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' }, take: 3, select: { name: true, priceCents: true } }),
          this.prisma.product.findMany({ where: { active: true }, orderBy: { updatedAt: 'desc' }, take: 2, select: { name: true, priceCents: true } }),
        ]);
        out.shop = [
          ...(plans as { name: string; priceCents: number }[]).map((p) => ({ a: p.name, b: euro(p.priceCents), sub: 'Piano' })),
          ...(products as { name: string; priceCents: number }[]).map((p) => ({ a: p.name, b: euro(p.priceCents), sub: 'Prodotto' })),
        ];
      } catch { /* skip */ }
      // Buoni sconto attivi
      try {
        const rows = (await this.prisma.discountCode.findMany({
          where: { active: true }, orderBy: { createdAt: 'desc' }, take: 5,
          select: { code: true, type: true, value: true, usedCount: true, maxTotalUses: true },
        })) as { code: string; type: string; value: number; usedCount: number; maxTotalUses: number | null }[];
        out.discounts = rows.map((r) => ({
          a: r.code,
          b: r.type === 'percent' ? `-${r.value}%` : '-' + euro(r.value),
          sub: `Usato ${r.usedCount}${r.maxTotalUses ? `/${r.maxTotalUses}` : ''} volte`,
        }));
      } catch { /* skip */ }
      // Contabilità: ultimi movimenti
      try {
        const rows = (await this.prisma.ledgerEntry.findMany({
          orderBy: { date: 'desc' }, take: 5,
          select: { type: true, amountCents: true, category: true, date: true },
        })) as { type: string; amountCents: number; category: string; date: Date }[];
        out.accounting_costs = rows.map((r) => ({
          a: r.category,
          b: (r.type === 'expense' ? '-' : '+') + euro(r.amountCents),
          sub: dmy(r.date),
        }));
      } catch { /* skip */ }
      // Provvigioni in sospeso
      try {
        const rows = (await this.prisma.pendingCommission.findMany({
          where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 5,
          select: { role: true, amountCents: true, createdAt: true },
        })) as { role: string; amountCents: number; createdAt: Date }[];
        out.commissions = rows.map((r) => ({ a: r.role, b: euro(r.amountCents), sub: dmy(r.createdAt) }));
      } catch { /* skip */ }
      // Richieste di prelievo da evadere
      try {
        const rows = (await this.prisma.commissionWithdrawal.findMany({
          where: { status: 'requested' }, orderBy: { requestedAt: 'asc' }, take: 5,
          select: { amountCents: true, requestedAt: true, staff: { select: { displayName: true } } },
        })) as { amountCents: number; requestedAt: Date; staff: { displayName: string } }[];
        out.withdrawals = rows.map((r) => ({ a: r.staff.displayName, b: euro(r.amountCents), sub: dmy(r.requestedAt) }));
      } catch { /* skip */ }
    }

    return out;
  }
}
