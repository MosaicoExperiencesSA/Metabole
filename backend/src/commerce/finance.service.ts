import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

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
   * Provvigioni all'approvazione di un pagamento (percentuali da config).
   * La catena: una quota alla coach + una alla sua responsabile (manager coach),
   * una quota alla nutrizionista + una al suo capo (capo nutrizionista).
   * Il "responsabile" di ogni membro è Staff.managerId (impostato dall'admin).
   */
  async generateCommissions(payment: { id: string; clientId: string; amountCents: number }) {
    const [coachPct, managerCoachPct, nutriPct, headNutriPct, profile] = await Promise.all([
      this.configParams.getNumber('commission_coach_percent', 10),
      this.configParams.getNumber('commission_manager_coach_percent', 0),
      this.configParams.getNumber('commission_nutritionist_percent', 15),
      this.configParams.getNumber('commission_head_nutritionist_percent', 0),
      this.prisma.clientProfile.findUnique({
        where: { userId: payment.clientId },
        select: {
          assignedCoachId: true,
          assignedNutritionistId: true,
          assignedCoach: { select: { managerId: true } },
          assignedNutritionist: { select: { managerId: true } },
        },
      }),
    ]);
    if (!profile) return;

    const jobs: Promise<unknown>[] = [];
    const pay = (staffId: string | null | undefined, pct: number | null | undefined) => {
      if (!staffId || !pct || pct <= 0) return;
      jobs.push(
        this.creditStaff({
          staffId,
          amountCents: Math.round((payment.amountCents * pct) / 100),
          kind: 'sales_commission',
          ref: payment.id,
          clientId: payment.clientId,
        }),
      );
    };

    pay(profile.assignedCoachId, coachPct);
    pay(profile.assignedCoach?.managerId, managerCoachPct);
    pay(profile.assignedNutritionistId, nutriPct);
    pay(profile.assignedNutritionist?.managerId, headNutriPct);
    await Promise.all(jobs);
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
}
