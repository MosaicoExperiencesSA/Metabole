import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Client di transazione: tipo canonico di Prisma (evita implicit any in sandbox).
type PrismaTx = Prisma.TransactionClient;

/**
 * Eventi economici automatici (spec sez. 8): niente doppio inserimento.
 * - pagamento approvato → LedgerEntry income + provvigioni (coach/nutrizionista)
 * - visita completata → compenso nutrizionista + LedgerEntry expense
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  private period(date = new Date()): string {
    return date.toISOString().slice(0, 7); // YYYY-MM
  }

  async recordIncome(input: {
    amountCents: number;
    category: string;
    ref: string;
    clientId?: string;
    note?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: { type: 'income', ...input },
    });
  }

  /** Provvigione/compenso: aggrega su staff_compensation e scrive l'uscita nel ledger. */
  async creditStaff(input: {
    staffId: string;
    amountCents: number;
    kind: string; // sales_commission | visit_compensation
    ref: string;
    clientId?: string;
  }) {
    if (input.amountCents <= 0) return;
    const period = this.period();
    const existing = await this.prisma.staffCompensation.findUnique({
      where: { staffId_period: { staffId: input.staffId, period } },
    });
    const items = [
      ...((existing?.items as unknown[]) ?? []),
      { at: new Date().toISOString(), kind: input.kind, amountCents: input.amountCents, ref: input.ref },
    ];
    await this.prisma.staffCompensation.upsert({
      where: { staffId_period: { staffId: input.staffId, period } },
      create: { staffId: input.staffId, period, amountCents: input.amountCents, items: items as never },
      update: { amountCents: { increment: input.amountCents }, items: items as never },
    });
    await this.prisma.ledgerEntry.create({
      data: {
        type: 'expense',
        amountCents: input.amountCents,
        category: input.kind,
        ref: input.ref,
        clientId: input.clientId,
        staffId: input.staffId,
      },
    });
  }

  /**
   * Provvigioni all'approvazione di un pagamento. Gli importi sono FISSI (in €) e
   * definiti su ogni PRODOTTO/PIANO del negozio (4 quote: coach, manager coach,
   * nutrizionista, capo nutrizionista), non più percentuali globali.
   * La catena: la quota base va allo staff assegnato + una quota al suo responsabile
   * (Staff.managerId). In caso di sconto, gli importi sono riscalati sull'importo
   * effettivamente pagato (paid/gross).
   */
  async generateCommissions(payment: { id: string; clientId: string; amountCents: number }) {
    const [profile, full] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: payment.clientId },
        select: {
          assignedCoachId: true,
          assignedNutritionistId: true,
          assignedCoach: { select: { managerId: true } },
          assignedNutritionist: { select: { managerId: true } },
        },
      }),
      this.prisma.payment.findUnique({
        where: { id: payment.id },
        select: {
          subscription: {
            select: {
              plan: {
                select: {
                  priceCents: true,
                  commissionCoachCents: true,
                  commissionManagerCoachCents: true,
                  commissionNutritionistCents: true,
                  commissionHeadNutritionistCents: true,
                },
              },
            },
          },
          order: { select: { items: true } },
        },
      }),
    ]);
    if (!profile) return;

    const q = await this.commissionAmounts(payment.amountCents, full);

    await this.settleSide(payment, 'coach', profile.assignedCoachId, profile.assignedCoach?.managerId, q.coach, q.managerCoach);
    await this.settleSide(payment, 'nutritionist', profile.assignedNutritionistId, profile.assignedNutritionist?.managerId, q.nutritionist, q.headNutritionist);
  }

  /**
   * Somma le 4 quote provvigionali (in centesimi) dovute da questo acquisto:
   * dal piano dell'abbonamento e/o da ciascun prodotto dell'ordine (× quantità).
   * Il totale è riscalato sull'importo effettivamente pagato (per gli sconti).
   */
  private async commissionAmounts(
    paidCents: number,
    full: {
      subscription?: {
        plan?: {
          priceCents: number;
          commissionCoachCents: number;
          commissionManagerCoachCents: number;
          commissionNutritionistCents: number;
          commissionHeadNutritionistCents: number;
        } | null;
      } | null;
      order?: { items: unknown } | null;
    } | null,
  ): Promise<{ coach: number; managerCoach: number; nutritionist: number; headNutritionist: number }> {
    let coach = 0, managerCoach = 0, nutritionist = 0, headNutritionist = 0, gross = 0;

    const plan = full?.subscription?.plan;
    if (plan) {
      coach += plan.commissionCoachCents;
      managerCoach += plan.commissionManagerCoachCents;
      nutritionist += plan.commissionNutritionistCents;
      headNutritionist += plan.commissionHeadNutritionistCents;
      gross += plan.priceCents;
    }

    const items = Array.isArray(full?.order?.items)
      ? (full!.order!.items as unknown as { productId: string; priceCents: number; qty: number }[])
      : [];
    if (items.length > 0) {
      const products = (await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: {
          id: true,
          commissionCoachCents: true,
          commissionManagerCoachCents: true,
          commissionNutritionistCents: true,
          commissionHeadNutritionistCents: true,
        },
      })) as {
        id: string;
        commissionCoachCents: number;
        commissionManagerCoachCents: number;
        commissionNutritionistCents: number;
        commissionHeadNutritionistCents: number;
      }[];
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of items) {
        const qty = it.qty ?? 1;
        gross += (it.priceCents ?? 0) * qty;
        const prod = byId.get(it.productId);
        if (!prod) continue;
        coach += prod.commissionCoachCents * qty;
        managerCoach += prod.commissionManagerCoachCents * qty;
        nutritionist += prod.commissionNutritionistCents * qty;
        headNutritionist += prod.commissionHeadNutritionistCents * qty;
      }
    }

    // Sconto: riscala le quote sull'importo pagato (paid/gross). Senza sconto scale=1.
    const scale = gross > 0 ? Math.min(1, paidCents / gross) : 1;
    return {
      coach: Math.round(coach * scale),
      managerCoach: Math.round(managerCoach * scale),
      nutritionist: Math.round(nutritionist * scale),
      headNutritionist: Math.round(headNutritionist * scale),
    };
  }

  /**
   * Regola una "metà" della catena (coaching o nutrizione):
   * - se lo staff è assegnato → paga subito la quota (e quella del responsabile se c'è);
   * - se NON è assegnato → accantona le quote, pagate poi all'assegnazione.
   */
  private async settleSide(
    payment: { id: string; clientId: string; amountCents: number },
    group: 'coach' | 'nutritionist',
    primaryStaffId: string | null | undefined,
    managerStaffId: string | null | undefined,
    primaryAmountCents: number,
    managerAmountCents: number,
  ) {
    const [primaryRole, managerRole] = group === 'coach' ? ['coach', 'manager_coach'] : ['nutritionist', 'head_nutritionist'];

    if (primaryStaffId) {
      // Assegnato: paga subito la quota base e (se presente il responsabile) la sua.
      if (primaryAmountCents > 0) {
        await this.creditStaff({ staffId: primaryStaffId, amountCents: primaryAmountCents, kind: 'sales_commission', ref: payment.id, clientId: payment.clientId });
      }
      if (managerStaffId && managerAmountCents > 0) {
        await this.creditStaff({ staffId: managerStaffId, amountCents: managerAmountCents, kind: 'sales_commission', ref: payment.id, clientId: payment.clientId });
      }
      return;
    }

    // Non assegnato: accantona (pagheremo all'assegnazione dal backoffice).
    const pendings: { paymentId: string; clientId: string; role: string; amountCents: number }[] = [];
    if (primaryAmountCents > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: primaryRole, amountCents: primaryAmountCents });
    if (managerAmountCents > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: managerRole, amountCents: managerAmountCents });
    for (const data of pendings) {
      await this.prisma.pendingCommission.create({ data });
    }
  }

  /**
   * Assegnato coach/nutrizionista → paga le provvigioni accantonate del cliente:
   * la quota base va allo staff appena assegnato, la quota "responsabile" al suo
   * manager (se impostato), altrimenti quella quota viene annullata.
   */
  async resolvePendingForAssignment(clientId: string, group: 'coach' | 'nutritionist', staffId: string) {
    const [primaryRole, managerRole] = group === 'coach' ? ['coach', 'manager_coach'] : ['nutritionist', 'head_nutritionist'];
    const pendings = await this.prisma.pendingCommission.findMany({
      where: { clientId, status: 'pending', role: { in: [primaryRole, managerRole] } },
    });
    if (!pendings.length) return;
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { managerId: true } });
    for (const p of pendings as { id: string; role: string; amountCents: number; paymentId: string }[]) {
      const target = p.role === primaryRole ? staffId : staff?.managerId ?? null;
      if (target && p.amountCents > 0) {
        await this.creditStaff({ staffId: target, amountCents: p.amountCents, kind: 'sales_commission', ref: p.paymentId, clientId });
        await this.prisma.pendingCommission.update({ where: { id: p.id }, data: { status: 'paid', resolvedStaffId: target, resolvedAt: new Date() } });
      } else {
        await this.prisma.pendingCommission.update({ where: { id: p.id }, data: { status: 'cancelled', resolvedAt: new Date() } });
      }
    }
  }

  /** Compenso visita (chiamato al complete della visita). */
  async creditVisitCompensation(visit: { id: string; clientId: string; nutritionistId: string }) {
    const amountCents = await this.configParams.getNumber('visit_compensation_amount_cents', 4000);
    await this.creditStaff({
      staffId: visit.nutritionistId,
      amountCents,
      kind: 'visit_compensation',
      ref: visit.id,
      clientId: visit.clientId,
    });
  }

  // ---------- Dashboard e ledger ----------

  async ledger(filter: { from?: string; to?: string; type?: string; category?: string }) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        ...(filter.type ? { type: filter.type as never } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.from || filter.to
          ? { date: { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }

  async accountingDashboard() {
    const entries = await this.prisma.ledgerEntry.groupBy({
      by: ['type', 'category'],
      _sum: { amountCents: true },
    });
    type Row = { type: string; category: string; _sum: { amountCents: number | null } };
    const income = (entries as Row[]).filter((e) => e.type === 'income');
    const expense = (entries as Row[]).filter((e) => e.type === 'expense');
    const sum = (rows: Row[]) => rows.reduce((a, r) => a + (r._sum.amountCents ?? 0), 0);
    return {
      totalIncomeCents: sum(income),
      totalExpenseCents: sum(expense),
      netCents: sum(income) - sum(expense),
      byCategory: (entries as Row[]).map((e) => ({
        type: e.type,
        category: e.category,
        amountCents: e._sum.amountCents ?? 0,
      })),
    };
  }

  async compensationDashboard(period?: string) {
    return this.prisma.staffCompensation.findMany({
      where: period ? { period } : {},
      orderBy: [{ period: 'desc' }, { amountCents: 'desc' }],
      include: { staff: { select: { displayName: true, user: { select: { role: true } } } } },
      take: 200,
    });
  }

  /**
   * Elenco delle provvigioni pagate (ledger, categoria sales_commission),
   * con destinatario, cliente e prodotto risolti. I filtri fini (cliente,
   * prodotto, ricevente, importo) li applica il frontend sull'elenco.
   */
  async listCommissions() {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { type: 'expense' as never, category: 'sales_commission' },
      orderBy: { date: 'desc' },
      take: 1000,
    });
    type Entry = { id: string; date: Date; amountCents: number; ref: string | null; clientId: string | null; staffId: string | null };
    const list = entries as Entry[];
    const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => Boolean(x))));

    const [staff, clients, payments] = await Promise.all([
      this.prisma.staff.findMany({ where: { id: { in: uniq(list.map((e) => e.staffId)) } }, select: { id: true, displayName: true } }),
      this.prisma.user.findMany({ where: { id: { in: uniq(list.map((e) => e.clientId)) } }, select: { id: true, email: true, clientProfile: { select: { name: true } } } }),
      this.prisma.payment.findMany({ where: { id: { in: uniq(list.map((e) => e.ref)) } }, select: { id: true, description: true } }),
    ]);
    const staffMap = new Map((staff as { id: string; displayName: string }[]).map((s) => [s.id, s.displayName]));
    const clientMap = new Map((clients as { id: string; email: string; clientProfile: { name: string | null } | null }[]).map((c) => [c.id, c.clientProfile?.name ?? c.email]));
    const payMap = new Map((payments as { id: string; description: string }[]).map((p) => [p.id, p.description]));

    return list.map((e) => ({
      id: e.id,
      date: e.date,
      amountCents: e.amountCents,
      recipientId: e.staffId,
      recipient: (e.staffId && staffMap.get(e.staffId)) || '—',
      clientId: e.clientId,
      client: (e.clientId && clientMap.get(e.clientId)) || '—',
      product: (e.ref && payMap.get(e.ref)) || '—',
    }));
  }

  /**
   * Elimina una singola provvigione: rimuove la voce di ledger E scala il
   * compenso aggregato dello staff nel periodo (coerenza contabile).
   */
  async deleteCommission(ledgerId: string, actorId: string) {
    const entry = (await this.prisma.ledgerEntry.findUnique({ where: { id: ledgerId } })) as
      | { id: string; category: string; amountCents: number; staffId: string | null; ref: string | null; date: Date }
      | null;
    if (!entry || entry.category !== 'sales_commission') {
      throw new NotFoundException('Provvigione non trovata.');
    }
    const period = entry.date.toISOString().slice(0, 7);

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.ledgerEntry.delete({ where: { id: ledgerId } });
      if (entry.staffId) {
        const comp = (await tx.staffCompensation.findUnique({
          where: { staffId_period: { staffId: entry.staffId, period } },
        })) as { amountCents: number; items: unknown } | null;
        if (comp) {
          const items = (Array.isArray(comp.items) ? comp.items : []) as { kind?: string; amountCents?: number; ref?: string }[];
          const idx = items.findIndex((it) => it.kind === 'sales_commission' && it.amountCents === entry.amountCents && it.ref === entry.ref);
          if (idx >= 0) items.splice(idx, 1);
          await tx.staffCompensation.update({
            where: { staffId_period: { staffId: entry.staffId, period } },
            data: { amountCents: Math.max(0, comp.amountCents - entry.amountCents), items: items as never },
          });
        }
      }
    });

    await this.audit.log({ action: 'finance.commission.delete', actorId, entityType: 'ledger_entry', entityId: ledgerId });
    return { removed: ledgerId };
  }
}
