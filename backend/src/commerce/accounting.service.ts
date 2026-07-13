import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export const COST_CATEGORIES = ['salaries', 'infrastructure', 'marketing', 'payment_fees', 'ai', 'taxes', 'other'] as const;
export const CADENCES = ['once', 'monthly', 'yearly'] as const;

export interface MonthBucket {
  key: string; // 'YYYY-MM'
  start: Date; // inizio mese (UTC, incluso)
  endExcl: Date; // inizio mese successivo (UTC, escluso)
}
export interface LedgerRow {
  type: string; // income | expense
  category: string;
  amountCents: number;
  date: Date;
}
export interface CostRow {
  category: string;
  amountCents: number;
  recurring: boolean;
  cadence: string; // once | monthly | yearly
  date: Date; // una tantum: data · ricorrente: inizio
  endDate: Date | null;
}

const monthStartUTC = (y: number, m: number) => new Date(Date.UTC(y, m, 1));

/** Elenco dei mesi (UTC) coperti dall'intervallo [from, to], inclusi gli estremi. */
export function monthsBetween(from: Date, to: Date): MonthBucket[] {
  const out: MonthBucket[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth();
  // guardia: intervallo invertito → nessun mese
  while (y < endY || (y === endY && m <= endM)) {
    const start = monthStartUTC(y, m);
    const endExcl = monthStartUTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1);
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, start, endExcl });
    if (m === 11) { y++; m = 0; } else m++;
    if (out.length > 240) break; // guardia anti-loop (20 anni)
  }
  return out;
}

/**
 * Contributo (in centesimi) di una voce di costo a un dato mese.
 * - una tantum: l'intero importo nel mese della sua data;
 * - ricorrente mensile: l'intero importo in ogni mese attivo;
 * - ricorrente annuale: l'importo AMMORTIZZATO su 12 (importo/12) in ogni mese attivo,
 *   per un conto economico mensile più liscio.
 * "Attivo" = iniziato entro il mese e non ancora terminato.
 */
export function costInMonth(cost: CostRow, m: MonthBucket): number {
  const startedByMonth = cost.date.getTime() < m.endExcl.getTime();
  const notEnded = !cost.endDate || cost.endDate.getTime() >= m.start.getTime();
  if (!cost.recurring) {
    const inMonth = cost.date.getTime() >= m.start.getTime() && cost.date.getTime() < m.endExcl.getTime();
    return inMonth ? cost.amountCents : 0;
  }
  if (!startedByMonth || !notEnded) return 0;
  if (cost.cadence === 'yearly') return Math.round(cost.amountCents / 12);
  return cost.amountCents; // monthly (default per ricorrente)
}

export interface AccountingReport {
  from: string;
  to: string;
  incomeCents: number;
  costsCents: number;
  profitCents: number;
  marginPct: number | null;
  byCategory: { category: string; amountCents: number; source: 'ledger' | 'manual' }[];
  series: { month: string; incomeCents: number; costsCents: number }[];
}

/** Aggregazione pura (nessun DB): conto economico mensile + totali + costi per categoria. */
export function buildReport(
  from: string,
  to: string,
  months: MonthBucket[],
  ledgerRows: LedgerRow[],
  costs: CostRow[],
): AccountingReport {
  const incomeByMonth = new Map<string, number>();
  const costByMonth = new Map<string, number>();
  const catTotals = new Map<string, { amountCents: number; source: 'ledger' | 'manual' }>();

  const monthKeyOf = (d: Date): string | null => {
    const b = months.find((mm) => d.getTime() >= mm.start.getTime() && d.getTime() < mm.endExcl.getTime());
    return b ? b.key : null;
  };

  for (const r of ledgerRows) {
    const key = monthKeyOf(r.date);
    if (!key) continue;
    if (r.type === 'income') {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + r.amountCents);
    } else {
      costByMonth.set(key, (costByMonth.get(key) ?? 0) + r.amountCents);
      const cat = `ledger:${r.category}`;
      const prev = catTotals.get(cat) ?? { amountCents: 0, source: 'ledger' as const };
      catTotals.set(cat, { amountCents: prev.amountCents + r.amountCents, source: 'ledger' });
    }
  }

  for (const c of costs) {
    for (const m of months) {
      const contrib = costInMonth(c, m);
      if (!contrib) continue;
      costByMonth.set(m.key, (costByMonth.get(m.key) ?? 0) + contrib);
      const cat = `manual:${c.category}`;
      const prev = catTotals.get(cat) ?? { amountCents: 0, source: 'manual' as const };
      catTotals.set(cat, { amountCents: prev.amountCents + contrib, source: 'manual' });
    }
  }

  const series = months.map((m) => ({
    month: m.key,
    incomeCents: incomeByMonth.get(m.key) ?? 0,
    costsCents: costByMonth.get(m.key) ?? 0,
  }));
  const incomeCents = series.reduce((a, s) => a + s.incomeCents, 0);
  const costsCents = series.reduce((a, s) => a + s.costsCents, 0);
  const profitCents = incomeCents - costsCents;
  const byCategory = [...catTotals.entries()]
    .map(([k, v]) => ({ category: k.split(':')[1], amountCents: v.amountCents, source: v.source }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    from,
    to,
    incomeCents,
    costsCents,
    profitCents,
    marginPct: incomeCents > 0 ? Math.round((profitCents / incomeCents) * 1000) / 10 : null,
    byCategory,
    series,
  };
}

interface CostInput {
  label: string;
  category: string;
  amountCents: number;
  recurring?: boolean;
  cadence?: string;
  date: string;
  endDate?: string | null;
  vendor?: string | null;
  note?: string | null;
}

/**
 * Contabilità (backlog #6): registrazione costi (ricorrenti + una tantum) e conto
 * economico per periodo (incassi vs costi, per categoria, serie mensile, KPI: margine,
 * utile, CAC, ARPU). Gli incassi e i costi già a ledger (provvigioni/compensi) vengono
 * dal `LedgerEntry`; i costi aziendali (infrastruttura, marketing, stipendi…) da `CostEntry`.
 */
@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDate(iso: string, endOfDay = false): Date {
    const d = new Date(iso.slice(0, 10) + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida');
    return d;
  }

  private validateCost(input: CostInput): void {
    if (!input.label || input.label.trim().length < 2) throw new BadRequestException('Etichetta troppo corta');
    if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) throw new BadRequestException('Importo non valido');
    if (!COST_CATEGORIES.includes(input.category as (typeof COST_CATEGORIES)[number])) throw new BadRequestException('Categoria non valida');
    const cadence = input.cadence ?? 'once';
    if (!CADENCES.includes(cadence as (typeof CADENCES)[number])) throw new BadRequestException('Cadenza non valida');
    if (input.recurring && cadence === 'once') throw new BadRequestException('Un costo ricorrente richiede cadenza mensile o annuale');
  }

  async registerCost(input: CostInput, actorId: string) {
    this.validateCost(input);
    const recurring = !!input.recurring;
    const created = await this.prisma.costEntry.create({
      data: {
        label: input.label.trim(),
        category: input.category,
        amountCents: Math.round(input.amountCents),
        recurring,
        cadence: recurring ? (input.cadence ?? 'monthly') : 'once',
        date: this.toDate(input.date),
        endDate: input.endDate ? this.toDate(input.endDate) : null,
        vendor: input.vendor?.trim() || null,
        note: input.note?.trim() || null,
        createdById: actorId,
      },
    });
    await this.audit.log({ action: 'accounting.cost.create', actorId, entityType: 'cost_entry', entityId: created.id, metadata: { amountCents: created.amountCents, category: created.category } });
    return created;
  }

  async listCosts() {
    return this.prisma.costEntry.findMany({ orderBy: [{ recurring: 'desc' }, { date: 'desc' }] });
  }

  async updateCost(id: string, input: Partial<CostInput>, actorId: string) {
    const existing = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Costo non trovato');
    const merged: CostInput = {
      label: input.label ?? existing.label,
      category: input.category ?? existing.category,
      amountCents: input.amountCents ?? existing.amountCents,
      recurring: input.recurring ?? existing.recurring,
      cadence: input.cadence ?? existing.cadence,
      date: input.date ?? existing.date.toISOString(),
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate?.toISOString() ?? null,
      vendor: input.vendor !== undefined ? input.vendor : existing.vendor,
      note: input.note !== undefined ? input.note : existing.note,
    };
    this.validateCost(merged);
    const updated = await this.prisma.costEntry.update({
      where: { id },
      data: {
        label: merged.label.trim(),
        category: merged.category,
        amountCents: Math.round(merged.amountCents),
        recurring: !!merged.recurring,
        cadence: merged.recurring ? (merged.cadence ?? 'monthly') : 'once',
        date: this.toDate(merged.date),
        endDate: merged.endDate ? this.toDate(merged.endDate) : null,
        vendor: merged.vendor?.trim() || null,
        note: merged.note?.trim() || null,
      },
    });
    await this.audit.log({ action: 'accounting.cost.update', actorId, entityType: 'cost_entry', entityId: id });
    return updated;
  }

  async deleteCost(id: string, actorId: string) {
    const existing = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Costo non trovato');
    await this.prisma.costEntry.delete({ where: { id } });
    await this.audit.log({ action: 'accounting.cost.delete', actorId, entityType: 'cost_entry', entityId: id });
    return { deleted: true };
  }

  /** Conto economico del periodo + KPI. `from`/`to` = 'YYYY-MM-DD' (inclusi). */
  async report(from: string, to: string): Promise<AccountingReport & {
    kpi: { newClients: number; payingClients: number; marketingCostCents: number; cacCents: number | null; arpuCents: number | null };
  }> {
    const fromD = this.toDate(from);
    const toD = this.toDate(to, true);
    if (fromD.getTime() > toD.getTime()) throw new BadRequestException('Intervallo di date invertito');
    const months = monthsBetween(fromD, toD);

    const [ledger, costs, newClients, payingRows] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { date: { gte: fromD, lte: toD } },
        select: { type: true, category: true, amountCents: true, date: true },
      }) as Promise<LedgerRow[]>,
      this.prisma.costEntry.findMany({
        where: {
          OR: [
            { recurring: false, date: { gte: fromD, lte: toD } },
            { recurring: true, date: { lte: toD }, OR: [{ endDate: null }, { endDate: { gte: fromD } }] },
          ],
        },
        select: { category: true, amountCents: true, recurring: true, cadence: true, date: true, endDate: true },
      }) as Promise<CostRow[]>,
      this.prisma.clientProfile.count({ where: { createdAt: { gte: fromD, lte: toD } } }),
      this.prisma.ledgerEntry.findMany({
        where: { type: 'income' as never, clientId: { not: null }, date: { gte: fromD, lte: toD } },
        distinct: ['clientId'],
        select: { clientId: true },
      }) as Promise<{ clientId: string | null }[]>,
    ]);

    const report = buildReport(from, to, months, ledger, costs);
    const payingClients = payingRows.length;
    const marketingCostCents = report.byCategory.filter((c) => c.category === 'marketing').reduce((a, c) => a + c.amountCents, 0);
    const cacCents = newClients > 0 ? Math.round(marketingCostCents / newClients) : null;
    const arpuCents = payingClients > 0 ? Math.round(report.incomeCents / payingClients) : null;

    return { ...report, kpi: { newClients, payingClients, marketingCostCents, cacCents, arpuCents } };
  }
}
