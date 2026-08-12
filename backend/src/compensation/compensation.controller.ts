import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CATEGORIE_COMPENSO, tettoAttivoCents } from '../common/tetto-compensi';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compensi staff: aggrega dal registro contabile (LedgerEntry) quanto spetta a ciascuno,
 * distinguendo provvigioni vendita e compensi visite. Solo admin.
 *
 * Da §16.8 la riga porta anche il TETTO mensile della persona e se lo ha raggiunto: è la pagina
 * dove un mese «strano» si guarda, ed è il posto in cui la risposta «ha toccato il tetto» deve
 * essere leggibile senza aprire il registro contabile riga per riga.
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
        category: { in: CATEGORIE_COMPENSO },
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
      select: { id: true, displayName: true, earningsCapCents: true, user: { select: { role: true } } },
    })) as { id: string; displayName: string; earningsCapCents: number | null; user: { role: string } | null }[];
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    // Il tetto è MENSILE: «raggiunto» ha senso solo mentre si sta guardando un mese. Con il
    // filtro su «Tutto» il totale è di più mesi insieme e confrontarlo col tetto direbbe una
    // bugia — quindi lì non si dice niente.
    const unMeseSolo = !!period && /^\d{4}-\d{2}$/.test(period);

    return Array.from(agg.entries())
      .map(([staffId, v]) => {
        const capCents = tettoAttivoCents(staffMap.get(staffId)?.earningsCapCents);
        return {
          staffId,
          displayName: staffMap.get(staffId)?.displayName ?? '—',
          role: staffMap.get(staffId)?.user?.role ?? '—',
          commissionCents: v.commission,
          compensationCents: v.compensation,
          totalCents: v.total,
          capCents,
          capReached: capCents !== null && unMeseSolo ? v.total >= capCents : null,
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
