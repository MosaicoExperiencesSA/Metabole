import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compensi staff: aggrega dal registro contabile (LedgerEntry) quanto spetta a ciascuno,
 * distinguendo provvigioni vendita e compensi visite. Solo admin.
 */
@Controller('admin/compensation')
@Roles('admin')
export class CompensationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('period') period?: string) {
    let dateFilter: Record<string, unknown> = {};
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-').map(Number);
      dateFilter = { date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } };
    }

    const entries = (await this.prisma.ledgerEntry.findMany({
      where: {
        type: 'expense' as never,
        category: { in: ['sales_commission', 'visit_compensation'] },
        staffId: { not: null },
        ...dateFilter,
      },
      select: { staffId: true, amountCents: true, category: true },
    })) as { staffId: string; amountCents: number; category: string }[];

    const agg = new Map<string, { commission: number; compensation: number; total: number }>();
    for (const e of entries) {
      const row = agg.get(e.staffId) ?? { commission: 0, compensation: 0, total: 0 };
      if (e.category === 'sales_commission') row.commission += e.amountCents;
      else row.compensation += e.amountCents;
      row.total += e.amountCents;
      agg.set(e.staffId, row);
    }

    const staff = (await this.prisma.staff.findMany({
      where: { id: { in: Array.from(agg.keys()) } },
      select: { id: true, displayName: true, user: { select: { role: true } } },
    })) as { id: string; displayName: string; user: { role: string } | null }[];
    const staffMap = new Map(staff.map((s) => [s.id, s]));

    return Array.from(agg.entries())
      .map(([staffId, v]) => ({
        staffId,
        displayName: staffMap.get(staffId)?.displayName ?? '—',
        role: staffMap.get(staffId)?.user?.role ?? '—',
        commissionCents: v.commission,
        compensationCents: v.compensation,
        totalCents: v.total,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
