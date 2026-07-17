import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compensi staff: aggrega dal registro contabile (LedgerEntry) quanto spetta a ciascuno,
 * distinguendo provvigioni vendita e compensi visite. Con un mese selezionato si può
 * marcare il compenso del periodo come PAGATO (saldo provvigioni in contabilità). Solo admin.
 */
@Controller('admin/compensation')
@Roles('admin')
export class CompensationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('period') period?: string) {
    const byPeriod = !!(period && /^\d{4}-\d{2}$/.test(period));
    let dateFilter: Record<string, unknown> = {};
    if (byPeriod && period) {
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

    const staffIds = Array.from(agg.keys());
    const [staff, comps] = await Promise.all([
      this.prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, displayName: true, user: { select: { role: true } } },
      }) as Promise<{ id: string; displayName: string; user: { role: string } | null }[]>,
      // Con un mese selezionato: righe di accantonamento del periodo, per il toggle "pagato".
      byPeriod && staffIds.length
        ? (this.prisma.staffCompensation.findMany({
            where: { period: period as string, staffId: { in: staffIds } },
            select: { id: true, staffId: true, settledAt: true },
          }) as Promise<{ id: string; staffId: string; settledAt: Date | null }[]>)
        : Promise.resolve([] as { id: string; staffId: string; settledAt: Date | null }[]),
    ]);
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    const compMap = new Map(comps.map((c) => [c.staffId, c]));

    return Array.from(agg.entries())
      .map(([staffId, v]) => ({
        staffId,
        displayName: staffMap.get(staffId)?.displayName ?? '—',
        role: staffMap.get(staffId)?.user?.role ?? '—',
        commissionCents: v.commission,
        compensationCents: v.compensation,
        totalCents: v.total,
        // Solo in vista mensile: id del compenso del periodo + stato pagamento.
        compensationId: compMap.get(staffId)?.id ?? null,
        settledAt: compMap.get(staffId)?.settledAt ?? null,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  /** Segna il compenso del periodo (persona + mese) come pagato / da pagare. */
  @Patch(':id/paid')
  async markPaid(@Param('id') id: string, @Body() body: { paid?: boolean }, @CurrentUser() actor: AuthUser) {
    if (typeof body?.paid !== 'boolean') throw new BadRequestException('Indica paid: true o false.');
    const comp = (await this.prisma.staffCompensation.findUnique({
      where: { id },
      select: { id: true, staffId: true, period: true, amountCents: true },
    })) as { id: string; staffId: string; period: string; amountCents: number } | null;
    if (!comp) throw new NotFoundException('Compenso non trovato.');
    const settledAt = body.paid ? new Date() : null;
    await this.prisma.staffCompensation.update({ where: { id }, data: { settledAt } as never });
    await this.audit.log({
      action: body.paid ? 'compensation.paid' : 'compensation.unpaid',
      actorId: actor.sub,
      entityType: 'staff_compensation',
      entityId: id,
      metadata: { staffId: comp.staffId, period: comp.period, amountCents: comp.amountCents },
    });
    return { id, settledAt };
  }
}
