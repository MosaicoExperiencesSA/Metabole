import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';

const mk = (n: number, w: number) => ({
  date: new Date(Date.UTC(2026, 6, n)),
  weightKg: w,
  waistCm: null,
  hipsCm: null,
});

/** Una misura al giorno a partire dal 1° gennaio 2026: come le pesate vere di una cliente costante. */
const serieGiornaliera = (giorni: number, da = 80, calo = 0.05) =>
  Array.from({ length: giorni }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)),
    weightKg: Math.round((da - i * calo) * 100) / 100,
    waistCm: null,
    hipsCm: null,
  }));

describe('ProgressService', () => {
  let service: ProgressService;
  let prisma: any;

  /**
   * Il finto Prisma **rispetta `orderBy` e `take`**, come quello vero.
   *
   * Prima restituiva sempre l'array così com'era, qualunque cosa il servizio avesse chiesto: per
   * questo il difetto del troncamento dal lato sbagliato (`asc` invece di `desc`) è passato inosservato
   * per mesi con i test verdi. Un mock che ignora la query non può smentire la query.
   */
  const setSerie = (serie: ReturnType<typeof mk>[]) => {
    prisma.measurement.findMany.mockImplementation(({ orderBy, take }: any) => {
      const ordinata = orderBy?.date === 'desc' ? [...serie].reverse() : [...serie];
      return Promise.resolve(typeof take === 'number' ? ordinata.slice(0, take) : ordinata);
    });
    prisma.measurement.count.mockResolvedValue(serie.length);
    prisma.measurement.findFirst.mockImplementation(({ orderBy }: any) =>
      Promise.resolve(serie.length === 0 ? null : orderBy?.date === 'desc' ? serie[serie.length - 1] : serie[0]),
    );
  };

  beforeEach(async () => {
    prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ startWeightKg: 68, startWaistCm: 80, startHipsCm: 99 }),
      },
      objective: {
        findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 62, targetDate: new Date('2026-11-01') }),
      },
      measurement: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    };
    setSerie([]);
    const config = {
      getString: jest.fn(async (_k: string, d?: string) => d),
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          ({
            moving_average_window: 3,
            stall_days_before_coach_alert: 6,
            max_weight_change_alert_kg_week: 1.5,
            // Il pavimento del ri-armo dopo «Autorizza a proseguire» (§15.2 punto 3).
            rapid_loss_resume_min_days: 4,
            rapid_loss_resume_min_measures: 3,
          } as Record<string, number>)[key],
        ),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(ProgressService);
  });

  it('senza misure: messaggio di invito, nessun crash', async () => {
    const result = await service.getProgress('u1');
    expect(result.measurementsCount).toBe(0);
    expect((result as any).message).toContain('prima');
  });

  it('con calo regolare: percentuale, tendenza in discesa e proiezione presente', async () => {
    const series = [1, 3, 5, 7, 9, 11, 13, 15].map((n, i) => mk(n, 68 - i * 0.15));
    setSerie(series);
    const result: any = await service.getProgress('u1');
    expect(result.progress.weightPercent).toBeGreaterThan(0);
    expect(result.trend.direction).toBe('down');
    expect(result.trend.weeklyRateKg).toBeGreaterThan(0);
    expect(result.trend.projectedTargetDate).not.toBeNull();
    expect(result.alerts.rapidLoss).toBe(false);
    expect(result.series.length).toBe(series.length);
  });

  it('peso fermo da giorni: stallo segnalato oltre soglia config', async () => {
    setSerie([1, 3, 5, 7, 9, 11, 13].map((n) => mk(n, 67)));
    const result: any = await service.getProgress('u1');
    expect(result.trend.direction).toBe('flat');
    expect(result.alerts.stallDays).toBeGreaterThanOrEqual(0);
  });

  it('calo troppo rapido: flag rapidLoss', async () => {
    setSerie([1, 3, 5, 7, 9].map((n, i) => mk(n, 68 - i * 0.6)));
    const result: any = await service.getProgress('u1');
    expect(result.alerts.rapidLoss).toBe(true);
  });
});

/**
 * LA FINESTRA DELLE MISURE GUARDA AVANTI, NON INDIETRO (difetto trovato l'11/8).
 *
 * Le misure si leggevano con `orderBy: 'asc', take: 120`: le 120 **più vecchie**. Con una pesata al
 * giorno, dopo quattro mesi la schermata Progressi si congelava — peso «attuale» di mesi prima, chili
 * persi sbagliati, stallo calcolato su una data ferma, e quell'alert va alla coach.
 *
 * Il difetto non aspettava la crescita del database: aspettava la **costanza della cliente**. Questi
 * test lo fissano su una serie di trecento giorni, cioè su una cliente che si pesa tutti i giorni per
 * dieci mesi — che è il caso normale, non quello estremo.
 */
describe('ProgressService — la finestra tiene le misure RECENTI', () => {
  let service: ProgressService;
  let prisma: any;

  const crea = async (serie: ReturnType<typeof serieGiornaliera>, startWeightKg: number | null = 80) => {
    prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ startWeightKg, startWaistCm: null, startHipsCm: null }) },
      objective: { findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 70 }) },
      measurement: {
        findMany: jest.fn().mockImplementation(({ orderBy, take }: any) => {
          const ordinata = orderBy?.date === 'desc' ? [...serie].reverse() : [...serie];
          return Promise.resolve(typeof take === 'number' ? ordinata.slice(0, take) : ordinata);
        }),
        count: jest.fn().mockResolvedValue(serie.length),
        findFirst: jest.fn().mockImplementation(({ orderBy }: any) =>
          Promise.resolve(orderBy?.date === 'desc' ? serie[serie.length - 1] : serie[0]),
        ),
      },
    };
    const config = { getNumber: jest.fn((k: string) => Promise.resolve(({ moving_average_window: 3, stall_days_before_coach_alert: 6, max_weight_change_alert_kg_week: 1.5 } as Record<string, number>)[k])) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(ProgressService);
  };

  it('la query chiede le più recenti, non le più vecchie', async () => {
    await crea(serieGiornaliera(300));
    await service.getProgress('u1');
    const chiamata = prisma.measurement.findMany.mock.calls[0][0];
    expect(chiamata.orderBy.date).toBe('desc');
    expect(chiamata.take).toBe(120);
  });

  it('con 300 pesate il peso «attuale» è l\'ULTIMA, non la centoventesima', async () => {
    const serie = serieGiornaliera(300);
    await crea(serie);
    const r: any = await service.getProgress('u1');

    const ultima = serie[serie.length - 1];
    expect(r.current.weightKg).toBe(ultima.weightKg);
    expect(new Date(r.current.date).toISOString()).toBe(ultima.date.toISOString());
    // Il difetto vecchio avrebbe dato il peso del 120° giorno: la prova che non è più così.
    expect(r.current.weightKg).not.toBe(serie[119].weightKg);
  });

  it('«misure registrate» è il conteggio vero, non la lunghezza della finestra', async () => {
    await crea(serieGiornaliera(300));
    const r: any = await service.getProgress('u1');
    expect(r.measurementsCount).toBe(300);
    expect(r.measurementsCount).not.toBe(120);
  });

  it('i chili persi si contano dal peso di partenza, non dall\'inizio della finestra', async () => {
    // 300 giorni a -0,05 kg: 80 → 65,05. Con la finestra sbagliata i «persi» erano ~6, non ~15.
    await crea(serieGiornaliera(300));
    const r: any = await service.getProgress('u1');
    expect(r.progress.lostKg).toBeGreaterThan(13);
  });

  /**
   * Il ripiego del peso di partenza. Con `asc` la prima misura della finestra ERA la prima in
   * assoluto; con `desc` non lo è più, e prenderla da lì vorrebbe dire dire alla cliente che ha perso
   * i chili degli ultimi quattro mesi invece di quelli di tutto il percorso.
   */
  it('senza peso di partenza nel profilo usa la PRIMA misura in assoluto', async () => {
    const serie = serieGiornaliera(300);
    await crea(serie, null);
    const r: any = await service.getProgress('u1');
    expect(r.start.weightKg).toBe(serie[0].weightKg);
    expect(prisma.measurement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: 'asc' } }),
    );
  });

  it('la tendenza è calcolata sul tratto RECENTE: una cliente che sta calando ora risulta in calo', async () => {
    // Primi 200 giorni fermi, ultimi 100 in calo: col troncamento vecchio la tendenza era «flat».
    const fermi = Array.from({ length: 200 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)), weightKg: 80, waistCm: null, hipsCm: null }));
    const calo = Array.from({ length: 100 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 201 + i)), weightKg: Math.round((80 - (i + 1) * 0.05) * 100) / 100, waistCm: null, hipsCm: null }));
    await crea([...fermi, ...calo]);
    const r: any = await service.getProgress('u1');
    expect(r.trend.direction).toBe('down');
  });
});

/**
 * IL COLLEGAMENTO, non solo la regola (§15.2 punto 3).
 *
 * Il modulo `allarme-calo.ts` è nato con otto test verdi **e non era chiamato da nessuno**: il
 * campo `rapidLossBaselineAt` veniva scritto dal nutrizionista, letto qui, e mai usato per
 * calcolare niente. Una suite verde certificava la regola, non il fatto che fosse attaccata.
 * Questi test guardano l'unica cosa che conta per la cliente: se l'allarme suona o no.
 */
describe('ProgressService — «Autorizza a proseguire» spegne l’allarme, non i progressi', () => {
  let service: ProgressService;
  let prisma: any;

  /** Calo ripidissimo: ~2,8 kg/settimana, cioè ben oltre la soglia di 1,5. */
  const caloRapido = Array.from({ length: 10 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 7, 1 + i)),
    weightKg: Math.round((80 - i * 0.4) * 100) / 100,
    waistCm: null,
    hipsCm: null,
  }));

  const monta = async (baseline: Date | null, adesso: Date) => {
    jest.useFakeTimers().setSystemTime(adesso);
    prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          startWeightKg: 80, startWaistCm: null, startHipsCm: null, rapidLossBaselineAt: baseline,
        }),
      },
      objective: { findFirst: jest.fn().mockResolvedValue(null) },
      measurement: {
        findMany: jest.fn().mockImplementation(({ orderBy, take }: any) => {
          const ord = orderBy?.date === 'desc' ? [...caloRapido].reverse() : [...caloRapido];
          return Promise.resolve(typeof take === 'number' ? ord.slice(0, take) : ord);
        }),
        count: jest.fn().mockResolvedValue(caloRapido.length),
        findFirst: jest.fn().mockResolvedValue(caloRapido[0]),
      },
    };
    const config = {
      getString: jest.fn(async (_k: string, d?: string) => d),
      getNumber: jest.fn((key: string, def?: number) =>
        Promise.resolve(
          ({
            moving_average_window: 3,
            stall_days_before_coach_alert: 6,
            max_weight_change_alert_kg_week: 1.5,
            rapid_loss_resume_min_days: 4,
            rapid_loss_resume_min_measures: 3,
          } as Record<string, number>)[key] ?? def,
        ),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(ProgressService);
  };

  afterEach(() => jest.useRealTimers());

  it('senza autorizzazione: l’allarme suona (è il caso di sempre)', async () => {
    await monta(null, new Date(Date.UTC(2026, 7, 10)));
    const r = (await service.getProgress('u1')) as any;
    expect(r.alerts.rapidLoss).toBe(true);
    expect(r.alerts.rapidLossInPausa).toBeNull();
  });

  it('appena autorizzata: l’allarme TACE, e dice perché', async () => {
    // Il giorno dopo l'ok. Senza il pavimento, le due pesate successive basterebbero a
    // ricostruire la stessa pendenza e la riga tornerebbe in coda subito.
    await monta(new Date(Date.UTC(2026, 7, 9)), new Date(Date.UTC(2026, 7, 10)));
    const r = (await service.getProgress('u1')) as any;
    expect(r.alerts.rapidLoss).toBe(false);
    expect(r.alerts.rapidLossInPausa).toContain('autorizzazione');
  });

  it('i PROGRESSI restano interi: chili persi e tendenza leggono tutta la storia', async () => {
    await monta(new Date(Date.UTC(2026, 7, 9)), new Date(Date.UTC(2026, 7, 10)));
    const r = (await service.getProgress('u1')) as any;
    // 80 → ~76,4 di media mobile: i chili persi non si azzerano perché il nutrizionista ha
    // autorizzato. Azzerare anche questi vorrebbe dire cancellarle dallo schermo il percorso.
    expect(r.progress.lostKg).toBeGreaterThan(2);
    expect(r.trend.weeklyRateKg).toBeGreaterThan(1.5);
    expect(r.series.length).toBeGreaterThan(5);
  });

  it('passati i giorni e con pesate nuove a sufficienza, l’allarme può tornare', async () => {
    // Autorizzata il 1° agosto: al 10 ci sono 9 giorni e 9 pesate nuove, e il calo continua.
    await monta(new Date(Date.UTC(2026, 7, 1)), new Date(Date.UTC(2026, 7, 10)));
    const r = (await service.getProgress('u1')) as any;
    expect(r.alerts.rapidLoss).toBe(true);
  });
});
