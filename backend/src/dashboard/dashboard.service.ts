import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const FINANCE_ROLES = ['admin', 'sales'];
type Row = { a: string; b?: string };

/**
 * Mini-anteprime per i moduli della dashboard: gli ultimi dati di ciascuna
 * pagina. Ogni sezione è isolata in try/catch (un errore non blocca le altre)
 * e rispetta lo scope per ruolo dove necessario.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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

    // CRM: lead recenti
    try {
      const rows = (await this.prisma.crmRecord.findMany({
        orderBy: { updatedAt: 'desc' }, take: 5,
        select: { name: true, email: true, stage: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } },
      })) as { name: string | null; email: string | null; stage: string; client: { email: string; clientProfile: { name: string | null } | null } | null }[];
      out.crm_leads = rows.map((r) => ({ a: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome', b: r.stage }));
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
      // Acquisti recenti (approvati)
      try {
        const rows = (await this.prisma.payment.findMany({
          where: { status: 'approved' as never }, orderBy: { approvedAt: 'desc' }, take: 5,
          select: { amountCents: true, description: true, approvedAt: true },
        })) as { amountCents: number; description: string; approvedAt: Date | null }[];
        out.purchases = rows.map((r) => ({ a: r.description, b: euro(r.amountCents) }));
      } catch { /* skip */ }
    }

    return out;
  }
}
