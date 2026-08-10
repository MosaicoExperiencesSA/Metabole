import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService, buildReport, costInMonth, monthsBetween, type CostRow, METODI_PAGAMENTO_DEFAULT } from './accounting.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

describe('monthsBetween', () => {
  it('elenca i mesi inclusi negli estremi', () => {
    const ms = monthsBetween(D('2026-01-15'), D('2026-03-02'));
    expect(ms.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
  it('intervallo nello stesso mese → un mese', () => {
    expect(monthsBetween(D('2026-05-03'), D('2026-05-20')).map((m) => m.key)).toEqual(['2026-05']);
  });
  it('a cavallo d\'anno', () => {
    expect(monthsBetween(D('2025-12-10'), D('2026-01-05')).map((m) => m.key)).toEqual(['2025-12', '2026-01']);
  });
});

describe('costInMonth', () => {
  const feb: ReturnType<typeof monthsBetween>[number] = monthsBetween(D('2026-02-01'), D('2026-02-10'))[0];
  it('una tantum: conta solo nel mese della sua data', () => {
    const cost: CostRow = { category: 'other', amountCents: 5000, recurring: false, cadence: 'once', date: D('2026-02-15'), endDate: null };
    expect(costInMonth(cost, feb)).toBe(5000);
    const jan = monthsBetween(D('2026-01-01'), D('2026-01-10'))[0];
    expect(costInMonth(cost, jan)).toBe(0);
  });
  it('ricorrente mensile: intero importo in ogni mese attivo', () => {
    const cost: CostRow = { category: 'infrastructure', amountCents: 2000, recurring: true, cadence: 'monthly', date: D('2026-01-01'), endDate: null };
    expect(costInMonth(cost, feb)).toBe(2000);
  });
  it('ricorrente mensile: 0 prima dell\'inizio o dopo la fine', () => {
    const notYet: CostRow = { category: 'infrastructure', amountCents: 2000, recurring: true, cadence: 'monthly', date: D('2026-03-01'), endDate: null };
    expect(costInMonth(notYet, feb)).toBe(0);
    const ended: CostRow = { category: 'infrastructure', amountCents: 2000, recurring: true, cadence: 'monthly', date: D('2025-01-01'), endDate: D('2026-01-31') };
    expect(costInMonth(ended, feb)).toBe(0);
  });
  it('ricorrente annuale: importo ammortizzato /12 nei mesi attivi', () => {
    const cost: CostRow = { category: 'taxes', amountCents: 12000, recurring: true, cadence: 'yearly', date: D('2026-01-01'), endDate: null };
    expect(costInMonth(cost, feb)).toBe(1000);
  });
});

describe('buildReport', () => {
  it('compone incassi, costi (ledger + manuali), totali e serie', () => {
    const months = monthsBetween(D('2026-01-01'), D('2026-02-28'));
    const ledger = [
      { type: 'income', category: 'subscription', amountCents: 10000, date: D('2026-01-10') },
      { type: 'income', category: 'subscription', amountCents: 20000, date: D('2026-02-05') },
      { type: 'expense', category: 'sales_commission', amountCents: 1500, date: D('2026-02-06') },
    ];
    const costs: CostRow[] = [
      { category: 'infrastructure', amountCents: 3000, recurring: true, cadence: 'monthly', date: D('2026-01-01'), endDate: null },
      { category: 'marketing', amountCents: 5000, recurring: false, cadence: 'once', date: D('2026-02-12'), endDate: null },
    ];
    const r = buildReport('2026-01-01', '2026-02-28', months, ledger, costs);
    // incassi: 30000
    expect(r.incomeCents).toBe(30000);
    // costi: infra 3000×2 mesi + commissione 1500 + marketing 5000 = 12500
    expect(r.costsCents).toBe(12500);
    expect(r.profitCents).toBe(17500);
    expect(r.marginPct).toBeCloseTo(58.3, 1);
    // serie mensile
    expect(r.series).toEqual([
      { month: '2026-01', incomeCents: 10000, costsCents: 3000 },
      { month: '2026-02', incomeCents: 20000, costsCents: 9500 },
    ]);
    // categorie: marketing 5000 (manual), infra 6000 (manual), commissione 1500 (ledger)
    const marketing = r.byCategory.find((c) => c.category === 'marketing');
    expect(marketing).toEqual({ category: 'marketing', amountCents: 5000, source: 'manual' });
    const comm = r.byCategory.find((c) => c.category === 'sales_commission');
    expect(comm?.source).toBe('ledger');
  });
});


/**
 * `AccountingService` ora cifra le fatture allegate ai costi, quindi vuole la chiave in
 * costruzione (fail-closed: senza chiave non parte). Questi test non toccano le fatture: basta una
 * chiave finta perché il costruttore non si fermi.
 */
const configFinta = { get: () => 'chiave-di-prova-per-i-test' } as unknown as ConfigService;

/**
 * I parametri di configurazione. Dall'11/8 il servizio ne legge uno: `cost_payment_methods`, le voci
 * della tendina «con cosa hai pagato». Stringa vuota = si usano quelle di default, che è lo stato in
 * cui si trova un'installazione appena seminata.
 */
const parametriFinti = { getString: jest.fn(async (_k: string, def?: string) => def ?? '') } as unknown as ConfigParamsService;

describe('AccountingService.report (KPI)', () => {
  const audit = { log: jest.fn() } as unknown as AuditService;
  it('calcola CAC e ARPU dal report + conteggi clienti', async () => {
    const prisma = {
      ledgerEntry: {
        findMany: jest
          .fn()
          // 1a: righe ledger del report
          .mockResolvedValueOnce([{ type: 'income', category: 'subscription', amountCents: 30000, date: D('2026-01-10') }])
          // 2a: clienti paganti (distinct)
          .mockResolvedValueOnce([{ clientId: 'a' }, { clientId: 'b' }, { clientId: 'c' }]),
        // Il report ora AGGREGA (somma) invece di sommare a mano riga per riga.
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
      },
      // Il report somma anche i prelievi provvigioni (pagati, richiesti, in attesa).
      commissionWithdrawal: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
      // Provvigioni maturate ma non ancora assegnate (coach/nutrizionista mancanti).
      pendingCommission: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
      costEntry: {
        findMany: jest.fn().mockResolvedValue([
          { category: 'marketing', amountCents: 6000, recurring: false, cadence: 'once', date: D('2026-01-05'), endDate: null },
        ]),
      },
      clientProfile: { count: jest.fn().mockResolvedValue(2) }, // 2 nuovi clienti
    };
    const svc = new AccountingService(prisma as unknown as PrismaService, audit, configFinta, parametriFinti);
    const res = await svc.report('2026-01-01', '2026-01-31');
    expect(res.incomeCents).toBe(30000);
    expect(res.costsCents).toBe(6000);
    expect(res.kpi.newClients).toBe(2);
    expect(res.kpi.payingClients).toBe(3);
    expect(res.kpi.marketingCostCents).toBe(6000);
    expect(res.kpi.cacCents).toBe(3000); // 6000 / 2 nuovi
    expect(res.kpi.arpuCents).toBe(10000); // 30000 / 3 paganti
  });

  it('intervallo invertito → errore', async () => {
    const svc = new AccountingService({} as unknown as PrismaService, audit, configFinta, parametriFinti);
    await expect(svc.report('2026-03-01', '2026-01-01')).rejects.toThrow('invertito');
  });
});

describe('AccountingService.registerCost (validazione)', () => {
  const audit = { log: jest.fn() } as unknown as AuditService;
  const svc = (create = jest.fn().mockResolvedValue({ id: 'c1', amountCents: 1000, category: 'marketing' })) =>
    new AccountingService({ costEntry: { create } } as unknown as PrismaService, audit, configFinta, parametriFinti);

  it('categoria non valida → errore', async () => {
    await expect(svc().registerCost({ label: 'Costo X', category: 'bogus', amountCents: 100, date: '2026-01-01' }, 'u1')).rejects.toThrow('Categoria');
  });
  it('ricorrente senza cadenza valida → errore', async () => {
    await expect(svc().registerCost({ label: 'Neon', category: 'infrastructure', amountCents: 100, date: '2026-01-01', recurring: true, cadence: 'once' }, 'u1')).rejects.toThrow('ricorrente');
  });
  it('costo valido → crea e logga', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'c1', amountCents: 2000, category: 'ai' });
    await svc(create).registerCost({ label: 'Anthropic', category: 'ai', amountCents: 2000, date: '2026-01-01' }, 'u1');
    expect(create).toHaveBeenCalled();
    expect((audit.log as jest.Mock)).toHaveBeenCalled();
  });
});

/**
 * «CON COSA HAI PAGATO» (11/8). Le voci le decide Simone nei Parametri, una per riga: il rischio da
 * fissare non è il campo, è che una voce fuori elenco entri in tabella e la colonna finisca per
 * offrire «Carta azindale» accanto a «Carta aziendale» come se fossero due conti diversi.
 */
describe('AccountingService — con cosa è stato pagato', () => {
  const audit = { log: jest.fn() } as unknown as AuditService;
  const conVoci = (testo: string) =>
    ({ getString: jest.fn(async () => testo) } as unknown as ConfigParamsService);

  const svc = (params: ConfigParamsService, create = jest.fn().mockResolvedValue({ id: 'c1', amountCents: 1000, category: 'ai' })) =>
    ({
      servizio: new AccountingService({ costEntry: { create } } as unknown as PrismaService, audit, configFinta, params),
      create,
    });

  it('legge le voci dal parametro, una per riga, senza vuote né duplicati', async () => {
    const s = new AccountingService({} as unknown as PrismaService, audit, configFinta, conVoci('Carta rossa\n\n  Conto BCC  \nCarta rossa\n'));
    expect(await s.metodiPagamento()).toEqual(['Carta rossa', 'Conto BCC']);
  });

  it('parametro vuoto → le voci di default, così la tendina non è mai inutilizzabile', async () => {
    const s = new AccountingService({} as unknown as PrismaService, audit, configFinta, conVoci(''));
    expect((await s.metodiPagamento()).length).toBeGreaterThan(0);
    expect(await s.metodiPagamento()).toEqual(METODI_PAGAMENTO_DEFAULT);
  });

  it('una voce configurata si registra', async () => {
    const { servizio, create } = svc(conVoci('Carta rossa\nConto BCC'));
    await servizio.registerCost({ label: 'Render', category: 'infrastructure', amountCents: 4529, date: '2026-08-05', paidWith: 'Conto BCC' }, 'u1');
    expect(create.mock.calls[0][0].data.paidWith).toBe('Conto BCC');
  });

  it('una voce FUORI elenco viene rifiutata, e il messaggio dice dove si aggiunge', async () => {
    const { servizio, create } = svc(conVoci('Carta rossa'));
    await expect(
      servizio.registerCost({ label: 'Render', category: 'infrastructure', amountCents: 100, date: '2026-08-05', paidWith: 'Carta azindale' }, 'u1'),
    ).rejects.toThrow('Parametri');
    expect(create).not.toHaveBeenCalled();
  });

  it('campo assente o vuoto → resta nullo: i costi vecchi non si devono inventare un pagamento', async () => {
    const { servizio, create } = svc(conVoci('Carta rossa'));
    await servizio.registerCost({ label: 'Render', category: 'infrastructure', amountCents: 100, date: '2026-08-05' }, 'u1');
    expect(create.mock.calls[0][0].data.paidWith).toBeNull();
    await servizio.registerCost({ label: 'Vercel', category: 'infrastructure', amountCents: 100, date: '2026-08-05', paidWith: '   ' }, 'u1');
    expect(create.mock.calls[1][0].data.paidWith).toBeNull();
  });
});
