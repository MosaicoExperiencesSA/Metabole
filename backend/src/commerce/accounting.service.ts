import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { PrismaService } from '../prisma/prisma.service';

export const COST_CATEGORIES = ['salaries', 'infrastructure', 'marketing', 'payment_fees', 'ai', 'taxes', 'other'] as const;
export const CADENCES = ['once', 'monthly', 'yearly'] as const;

/**
 * «CON COSA HAI PAGATO»: le voci della tendina stanno in configurazione, una per riga.
 *
 * Richiesta di Simone dell'11/8, e la parte importante della richiesta è **«le voci che inserisco io
 * dai Parametri»**: il modo di pagare un fornitore cambia (una carta nuova, un conto chiuso) e non
 * deve servire un rilascio per aggiungerne uno.
 *
 * ## Perché NON c'è un elenco di ripiego nel codice
 *
 * La prima versione ne aveva uno — cinque voci plausibili usate quando il parametro era vuoto — con
 * la buona intenzione di non far trovare una tendina vuota al primo avvio. Simone l'ha visto e ha
 * detto: «avevo detto che dovevo decidere io le voci da parametri». Aveva ragione, e non era una
 * questione di gusto: con un ripiego nel codice, **svuotare** il parametro non svuota la tendina —
 * ricompaiono cinque voci che nessuno ha scelto, e l'unico modo di togliere «PayPal» diventa
 * scrivere qualcos'altro al suo posto. Un'impostazione che non si può azzerare non è un'impostazione.
 *
 * Elenco vuoto = tendina con la sola voce «non indicato», e la pagina che dice dove si aggiungono.
 * Meno comodo il primo giorno, vero tutti gli altri.
 */

/** Le voci configurate, da un testo con una voce per riga. Vuote e duplicati si scartano. */
export function metodiDaTesto(testo: string | null | undefined): string[] {
  const voci = (testo ?? '')
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  return [...new Set(voci)];
}

/** Fattura allegata a un costo: gli stessi limiti delle contabili dei pagamenti. */
const FATTURA_MAX_BYTES = 5 * 1024 * 1024;
const FATTURA_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

/**
 * Campi del costo che si possono mostrare in elenco. ⚠️ `invoiceData` NON c'è, ed è deliberato:
 * sono megabyte per riga e l'elenco li manderebbe TUTTI al browser a ogni apertura della pagina.
 * Che una fattura ci sia si sa da `invoiceName`; il file si scarica solo quando lo si chiede.
 */
const COSTO_SELECT = {
  id: true, label: true, category: true, amountCents: true, recurring: true, cadence: true,
  date: true, endDate: true, vendor: true, note: true, paidWith: true, createdById: true, createdAt: true,
  updatedAt: true, invoiceMime: true, invoiceName: true,
} as const;

// Etichette italiane delle categorie (costi manuali + voci a ledger) per i report.
const CATEGORY_LABEL: Record<string, string> = {
  salaries: 'Stipendi',
  infrastructure: 'Infrastruttura',
  marketing: 'Marketing',
  payment_fees: 'Commissioni pagamenti',
  ai: 'AI',
  taxes: 'Tasse',
  other: 'Altro',
  subscription: 'Abbonamenti',
  order: 'Ordini',
  commission: 'Provvigioni',
  compensation: 'Compensi staff',
};
const catLabel = (c: string) => CATEGORY_LABEL[c] ?? c;
const eur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

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
  /** Con cosa è stato pagato: una delle voci di `cost_payment_methods`. */
  paidWith?: string | null;
}

/**
 * Contabilità (backlog #6): registrazione costi (ricorrenti + una tantum) e conto
 * economico per periodo (incassi vs costi, per categoria, serie mensile, KPI: margine,
 * utile, CAC, ARPU). Gli incassi e i costi già a ledger (provvigioni/compensi) vengono
 * dal `LedgerEntry`; i costi aziendali (infrastruttura, marketing, stipendi…) da `CostEntry`.
 */
@Injectable()
export class AccountingService {
  private readonly fatturaKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly configParams: ConfigParamsService,
  ) {
    // Fail-closed come per le contabili: senza chiave non si parte, invece di cifrare con un
    // ripiego che equivale a non cifrare. Su Render è generata automaticamente.
    const fileKey = this.config.get<string>('FILE_ENCRYPTION_KEY');
    if (!fileKey) throw new Error('FILE_ENCRYPTION_KEY mancante: configurarla nelle variabili d\'ambiente');
    this.fatturaKey = deriveKey(fileKey);
  }

  private toDate(iso: string, endOfDay = false): Date {
    const d = new Date(iso.slice(0, 10) + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida');
    return d;
  }

  /** Le voci della tendina «con cosa hai pagato», come le ha scritte Simone nei Parametri. */
  async metodiPagamento(): Promise<string[]> {
    const testo = await this.configParams.getString('cost_payment_methods', '').catch(() => '');
    return metodiDaTesto(testo);
  }

  /**
   * Il metodo dev'essere una delle voci configurate.
   *
   * Senza questo controllo un refuso dall'API creerebbe una voce fantasma, e la colonna della
   * tabella si riempirebbe di «Carta azindale» accanto a «Carta aziendale» — con un filtro a tendina
   * che le offre entrambe come se fossero due conti diversi. Si valida solo in SCRITTURA: le righe
   * già registrate con un nome poi rinominato nei Parametri restano valide, perché raccontano come
   * si chiamava quel conto allora.
   */
  private async validatePaidWith(paidWith: string | null | undefined): Promise<string | null> {
    const v = paidWith?.trim();
    if (!v) return null;
    const ammessi = await this.metodiPagamento();
    if (!ammessi.includes(v)) {
      throw new BadRequestException(
        ammessi.length === 0
          ? 'Non c\'è ancora nessun modo di pagamento configurato: le voci si scrivono in Parametri → «Con cosa si paga», una per riga.'
          : `«${v}» non è fra i modi di pagamento configurati. Le voci si aggiungono in Parametri → «Con cosa si paga».`,
      );
    }
    return v;
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
    const paidWith = await this.validatePaidWith(input.paidWith);
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
        paidWith,
        createdById: actorId,
      },
    });
    await this.audit.log({ action: 'accounting.cost.create', actorId, entityType: 'cost_entry', entityId: created.id, metadata: { amountCents: created.amountCents, category: created.category } });
    return created;
  }

  async listCosts() {
    const righe = await this.prisma.costEntry.findMany({
      orderBy: [{ recurring: 'desc' }, { date: 'desc' }],
      select: COSTO_SELECT as never,
    });
    // `fattura` invece del file: la pagina deve sapere SE c'è e come si chiama, non averla addosso.
    return (righe as never as (Record<string, unknown> & { invoiceName: string | null; invoiceMime: string | null })[]).map(
      ({ invoiceName, invoiceMime, ...resto }) => ({
        ...resto,
        fattura: invoiceName ? { nome: invoiceName, mime: invoiceMime } : null,
      }),
    );
  }

  // ---------- Fattura allegata al costo (richiesta di Simone, 8/8) ----------

  /**
   * Allega (o sostituisce) la fattura di un costo. Un file per costo: la scelta è di Simone,
   * «la fattura», al singolare. Se ne serviranno due servirà una tabella, non una seconda colonna.
   *
   * Il file arriva in base64 e viene salvato **cifrato**: una fattura è un dato di un fornitore, con
   * dentro partita IVA, indirizzi e importi, e non c'è motivo di tenerla in chiaro nel database.
   */
  async allegaFattura(
    id: string,
    input: { fileName: string; mimeType: string; contentBase64: string },
    actorId: string,
  ) {
    const costo = await this.prisma.costEntry.findUnique({ where: { id }, select: { id: true, label: true } });
    if (!costo) throw new NotFoundException('Costo non trovato');
    if (!FATTURA_MIME.includes(input.mimeType)) {
      throw new BadRequestException('Formato non supportato: serve un PDF o una foto (JPG, PNG, HEIC).');
    }
    const plain = Buffer.from(input.contentBase64, 'base64');
    if (plain.length === 0) throw new BadRequestException('Il file è vuoto.');
    if (plain.length > FATTURA_MAX_BYTES) {
      throw new BadRequestException('La fattura supera i 5 MB: allega un PDF più leggero o una foto meno grande.');
    }
    // Un nome c'è sempre: è quello che in elenco dice «qui la fattura c'è».
    const nome = (input.fileName ?? '').trim().slice(0, 200) || 'fattura';
    await this.prisma.costEntry.update({
      where: { id },
      data: {
        invoiceData: new Uint8Array(encryptBuffer(plain, this.fatturaKey)),
        invoiceMime: input.mimeType,
        invoiceName: nome,
      } as never,
    });
    await this.audit.log({
      action: 'accounting.cost_invoice_uploaded',
      actorId,
      entityType: 'cost_entry',
      entityId: id,
      metadata: { fileName: nome, mimeType: input.mimeType, bytes: plain.length },
    });
    return { ok: true, fattura: { nome, mime: input.mimeType } };
  }

  /** La fattura in base64, da aprire o scaricare. */
  async scaricaFattura(id: string, actorId: string) {
    const costo = (await this.prisma.costEntry.findUnique({
      where: { id },
      select: { invoiceData: true, invoiceMime: true, invoiceName: true } as never,
    })) as never as { invoiceData: Uint8Array | null; invoiceMime: string | null; invoiceName: string | null } | null;
    if (!costo) throw new NotFoundException('Costo non trovato');
    if (!costo.invoiceData) throw new NotFoundException('Questo costo non ha una fattura allegata.');
    // Anche la LETTURA si traccia: è un documento fiscale di un fornitore, e sapere chi l'ha
    // aperto costa una riga.
    await this.audit
      .log({ action: 'accounting.cost_invoice_downloaded', actorId, entityType: 'cost_entry', entityId: id })
      .catch(() => undefined);
    return {
      fileName: costo.invoiceName ?? 'fattura',
      mimeType: costo.invoiceMime ?? 'application/pdf',
      contentBase64: decryptBuffer(Buffer.from(costo.invoiceData), this.fatturaKey).toString('base64'),
    };
  }

  /** Toglie la fattura senza toccare il costo: l'importo resta, cambia solo l'allegato. */
  async rimuoviFattura(id: string, actorId: string) {
    const costo = await this.prisma.costEntry.findUnique({ where: { id }, select: { id: true } });
    if (!costo) throw new NotFoundException('Costo non trovato');
    await this.prisma.costEntry.update({
      where: { id },
      data: { invoiceData: null, invoiceMime: null, invoiceName: null } as never,
    });
    await this.audit.log({
      action: 'accounting.cost_invoice_removed',
      actorId,
      entityType: 'cost_entry',
      entityId: id,
    });
    return { ok: true };
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
      // `undefined` = non toccare, stringa vuota = svuota: è la differenza che permette di correggere
      // un costo senza dover ridire con cosa era stato pagato.
      paidWith: input.paidWith !== undefined ? input.paidWith : (existing as { paidWith?: string | null }).paidWith ?? null,
    };
    this.validateCost(merged);
    // Si rivalida solo se il campo è arrivato nella richiesta: un valore già in tabella che nel
    // frattempo è stato rinominato nei Parametri non deve bloccare la correzione dell'importo.
    const paidWith = input.paidWith !== undefined ? await this.validatePaidWith(input.paidWith) : merged.paidWith ?? null;
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
        paidWith,
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
    commissions: { accruedPeriodCents: number; paidPeriodCents: number; accruedTotalCents: number; paidTotalCents: number; reserveCents: number; requestedCents: number; pendingCents: number };
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

    // Provvigioni (incl. compensi visite, stesso fondo del portafoglio staff):
    // maturate = uscite a ledger; pagate = PRELIEVI confermati (flusso richiesta → conferma
    // admin, CommissionWithdrawal); accantonamento = maturate totali − prelievi pagati totali
    // (quanto è ancora "nel fondo" da versare allo staff, come il Saldo nei portafogli).
    const COMM_CATS = ['sales_commission', 'visit_compensation'];
    const accruedPeriodCents = ledger
      .filter((r) => r.type === 'expense' && COMM_CATS.includes(r.category))
      .reduce((a, r) => a + r.amountCents, 0);
    const [accruedTotalAgg, paidPeriodAgg, paidTotalAgg, requestedAgg, pendingAgg] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({ where: { type: 'expense' as never, category: { in: COMM_CATS } }, _sum: { amountCents: true } }),
      this.prisma.commissionWithdrawal.aggregate({ where: { status: 'paid', paidAt: { gte: fromD, lte: toD } }, _sum: { amountCents: true } }),
      this.prisma.commissionWithdrawal.aggregate({ where: { status: 'paid' }, _sum: { amountCents: true } }),
      // Richieste di prelievo in attesa di conferma (da pagare a breve).
      this.prisma.commissionWithdrawal.aggregate({ where: { status: 'requested' }, _sum: { amountCents: true } }),
      // Provvigioni maturate ma in attesa di assegnazione (coach/nutrizionista non ancora assegnati).
      this.prisma.pendingCommission.aggregate({ where: { status: 'pending' }, _sum: { amountCents: true } }),
    ]);
    const accruedTotalCents = accruedTotalAgg._sum.amountCents ?? 0;
    const paidPeriodCents = paidPeriodAgg._sum.amountCents ?? 0;
    const paidTotalCents = paidTotalAgg._sum.amountCents ?? 0;
    const commissions = {
      accruedPeriodCents,
      paidPeriodCents,
      accruedTotalCents,
      paidTotalCents,
      reserveCents: accruedTotalCents - paidTotalCents,
      requestedCents: requestedAgg._sum.amountCents ?? 0,
      pendingCents: pendingAgg._sum.amountCents ?? 0,
    };

    return { ...report, kpi: { newClients, payingClients, marketingCostCents, cacCents, arpuCents }, commissions };
  }

  /** Etichetta leggibile del periodo (es. "luglio 2026" per un mese intero, altrimenti "dal … al …"). */
  private periodLabel(from: string, to: string): string {
    const f = from.slice(0, 10);
    const t = to.slice(0, 10);
    const [fy, fm, fd] = f.split('-');
    const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const lastDay = new Date(Date.UTC(Number(fy), Number(fm), 0)).getUTCDate();
    if (fd === '01' && t === `${fy}-${fm}-${String(lastDay).padStart(2, '0')}`) {
      return `${monthNames[Number(fm) - 1]} ${fy}`;
    }
    return `dal ${f.split('-').reverse().join('/')} al ${t.split('-').reverse().join('/')}`;
  }

  /** Report contabile del periodo in CSV (separatore ';', decimale virgola: compatibile Excel IT). */
  async reportCsv(from: string, to: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const r = await this.report(from, to);
    const lines: string[] = [];
    const row = (...cells: (string | number)[]) => lines.push(cells.map((c) => String(c)).join(';'));
    row('Metabole — Contabilità', this.periodLabel(from, to));
    row('Periodo', `${from.slice(0, 10)}`, `${to.slice(0, 10)}`);
    row('');
    row('Voce', 'Importo (€)');
    row('Incassi', eur(r.incomeCents));
    row('Costi', eur(r.costsCents));
    row('Utile', eur(r.profitCents));
    row('Margine %', r.marginPct != null ? String(r.marginPct).replace('.', ',') : '—');
    row('');
    row('KPI', 'Valore');
    row('Nuovi clienti', r.kpi.newClients);
    row('Clienti paganti', r.kpi.payingClients);
    row('Spesa marketing (€)', eur(r.kpi.marketingCostCents));
    row('CAC (€)', r.kpi.cacCents != null ? eur(r.kpi.cacCents) : '—');
    row('ARPU (€)', r.kpi.arpuCents != null ? eur(r.kpi.arpuCents) : '—');
    row('');
    row('Provvigioni', 'Importo (€)');
    row('Maturate nel periodo', eur(r.commissions.accruedPeriodCents));
    row('Prelievi pagati nel periodo', eur(r.commissions.paidPeriodCents));
    row('Accantonamento (maturate tot. − prelevate tot.)', eur(r.commissions.reserveCents));
    if (r.commissions.requestedCents > 0) row('Richieste di prelievo in attesa', eur(r.commissions.requestedCents));
    if (r.commissions.pendingCents > 0) row('In attesa di assegnazione', eur(r.commissions.pendingCents));
    row('');
    row('Costi per categoria', 'Importo (€)', 'Origine');
    for (const c of r.byCategory) row(catLabel(c.category), eur(c.amountCents), c.source === 'ledger' ? 'automatico' : 'manuale');
    row('');
    row('Mese', 'Incassi (€)', 'Costi (€)', 'Utile (€)');
    for (const s of r.series) row(s.month, eur(s.incomeCents), eur(s.costsCents), eur(s.incomeCents - s.costsCents));
    const csv = '﻿' + lines.join('\r\n'); // BOM per Excel
    return {
      fileName: `contabilita-${from.slice(0, 10)}_${to.slice(0, 10)}.csv`,
      mimeType: 'text/csv',
      contentBase64: Buffer.from(csv, 'utf8').toString('base64'),
    };
  }

  /** Report contabile del periodo in PDF. */
  async reportPdf(from: string, to: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const r = await this.report(from, to);
    const label = this.periodLabel(from, to);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#10403a').fontSize(24).text('Metabole');
      doc.fillColor('#7c8c88').fontSize(12).text(`Contabilità — ${label}`);
      doc.moveDown(1);

      const line = (label: string, value: string, bold = false) => {
        doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(12)
          .text(label, { continued: true }).font('Helvetica').fillColor('#333').text('   ' + value);
        doc.moveDown(0.4);
      };
      doc.fillColor('#10403a').font('Helvetica-Bold').fontSize(14).text('Riepilogo'); doc.moveDown(0.4);
      line('Incassi:', `€ ${eur(r.incomeCents)}`);
      line('Costi:', `€ ${eur(r.costsCents)}`);
      line('Utile:', `€ ${eur(r.profitCents)}`, true);
      line('Margine:', r.marginPct != null ? `${String(r.marginPct).replace('.', ',')}%` : '—');

      doc.moveDown(0.6);
      doc.fillColor('#10403a').font('Helvetica-Bold').fontSize(14).text('Indicatori'); doc.moveDown(0.4);
      line('Nuovi clienti:', String(r.kpi.newClients));
      line('Clienti paganti:', String(r.kpi.payingClients));
      line('Spesa marketing:', `€ ${eur(r.kpi.marketingCostCents)}`);
      line('CAC:', r.kpi.cacCents != null ? `€ ${eur(r.kpi.cacCents)}` : '—');
      line('ARPU:', r.kpi.arpuCents != null ? `€ ${eur(r.kpi.arpuCents)}` : '—');

      doc.moveDown(0.6);
      doc.fillColor('#10403a').font('Helvetica-Bold').fontSize(14).text('Provvigioni'); doc.moveDown(0.4);
      line('Maturate nel periodo:', `€ ${eur(r.commissions.accruedPeriodCents)}`);
      line('Prelievi pagati nel periodo:', `€ ${eur(r.commissions.paidPeriodCents)}`);
      line('Accantonamento:', `€ ${eur(r.commissions.reserveCents)}`, true);
      if (r.commissions.requestedCents > 0) line('Richieste di prelievo in attesa:', `€ ${eur(r.commissions.requestedCents)}`);
      if (r.commissions.pendingCents > 0) line('In attesa di assegnazione:', `€ ${eur(r.commissions.pendingCents)}`);

      if (r.byCategory.length) {
        doc.moveDown(0.6);
        doc.fillColor('#10403a').font('Helvetica-Bold').fontSize(14).text('Costi per categoria'); doc.moveDown(0.4);
        for (const c of r.byCategory) line(`${catLabel(c.category)}:`, `€ ${eur(c.amountCents)}${c.source === 'ledger' ? ' (automatico)' : ''}`);
      }

      doc.moveDown(0.8);
      doc.fillColor('#a9a29a').fontSize(9).text(`Generato da Metabole · periodo ${from.slice(0, 10)} → ${to.slice(0, 10)}`);
      doc.end();
    });
    return {
      fileName: `contabilita-${from.slice(0, 10)}_${to.slice(0, 10)}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: buffer.toString('base64'),
    };
  }
}
