/**
 * IL REPORT DENTRO L'APP DICE LA TENDENZA, NON LA PESATA DI STAMATTINA (19/8, decisione di Simone).
 *
 * ⚠️ Questa **non** è la scheda PDF firmata: quella resta sul peso misurato — è un fatto verificabile
 * che la cliente può portare dal medico — e lo dichiara (`reports.service`). Questo è
 * `plan-report.service`, che alimenta `app/src/pages/Report.tsx`: la schermata che lei apre a fine
 * piano, e che scriveva «−4,2 kg da oggi» sull'ultima pesata mentre la pagina Obiettivo della stessa
 * app, due schermate più in là, ne diceva un altro sulla media mobile.
 */
import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanReportService } from './plan-report.service';

const giorno = (n: number) => new Date(Date.UTC(2026, 6, n));

describe('PlanReportService — quanto manca all\'obiettivo', () => {
  let service: PlanReportService;
  let prisma: any;

  /**
   * ⚠️ IL CASO CHE VALE LA MODIFICA: l'ultima pesata dice 69,8 (obiettivo raggiunto!) ma la media
   * delle ultime tre è 70,6. Sull'ultima, la schermata annunciava «raggiunto 🎉» e il piano
   * suggerito diventava il Mantenimento; sulla tendenza mancano ancora 0,6 kg.
   */
  const pesate = [
    { date: giorno(1), weightKg: 72.0, waistCm: null, hipsCm: null },
    { date: giorno(10), weightKg: 71.4, waistCm: null, hipsCm: null },
    { date: giorno(18), weightKg: 70.6, waistCm: null, hipsCm: null },
    { date: giorno(19), weightKg: 69.8, waistCm: null, hipsCm: null },
  ];

  const vuoto = { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) };

  beforeEach(async () => {
    prisma = {
      clientReport: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'r1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Maria', regime: null, dietStyle: null, mealsPerDay: null, allergies: [], intolerances: [], dislikedFoods: [], startWeightKg: 78, assignedCoach: null }) },
      measurement: { findMany: jest.fn().mockResolvedValue(pesate) },
      objective: { findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 70 }) },
      subscription: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      plan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([{ id: 'p1', name: 'Mantenimento', priceCents: 4900, listPriceCents: null, promoEndsAt: null, period: 'maintenance' }, { id: 'p3', name: '3 mesi', priceCents: 9900, listPriceCents: null, promoEndsAt: null, period: '3m' }]) },
      discountCode: { findFirst: jest.fn().mockResolvedValue(null) },
      dailyCheckin: { ...vuoto },
      event: { ...vuoto },
      menuWeight: { ...vuoto },
      recipeRating: { ...vuoto },
      stepLog: { ...vuoto },
      waterLog: { ...vuoto },
      clientCycle: { ...vuoto, findUnique: jest.fn().mockResolvedValue(null) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(PlanReportService);
  });

  const salvato = async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 's1', clientId: 'c1', startDate: giorno(1), endDate: giorno(19),
      plan: { name: 'Percorso 3 mesi', priceCents: 9900 },
    });
    await service.generateForSubscription('s1');
    return (prisma.clientReport.create as jest.Mock).mock.calls[0][0].data.data as {
      objective: { targetWeightKg: number | null; toGoKg: number | null };
      offer?: { period?: string } | null;
    };
  };

  /**
   * ⚠️ Con la media a 70,6 e l'obiettivo a 70 mancano 0,6 kg. Sull'ultima pesata (69,8) il numero
   * sarebbe −0,2, cioè «raggiunto»: annunciarlo per una mattina fortunata vuol dire dirle che ha
   * finito il giorno prima che la bilancia le dia torto.
   */
  it('⚠️ i chili che mancano si contano sulla media mobile, non sull\'ultima pesata', async () => {
    expect((await salvato()).objective.toGoKg).toBe(0.6);
  });

  /**
   * ⚠️ E cambia la DECISIONE che ci sta sotto: `objectiveReached` sceglie se offrirle il Mantenimento
   * o un altro piano-obiettivo. È la stessa domanda di `commerce.hasReachedObjective`, passata alla
   * media mobile lo stesso giorno: due punti che rispondono alla stessa domanda devono dare la
   * stessa risposta.
   */
  it('⚠️ e con l\'obiettivo non ancora raggiunto sulla tendenza, si propone un piano-obiettivo', async () => {
    expect((await salvato()).offer?.period).toBe('3m');
  });

  /** Quando la tendenza dice che ci è arrivata davvero, l'offerta sparisce (tocca al Mantenimento). */
  it('raggiunto sulla tendenza: nessun piano-obiettivo', async () => {
    prisma.measurement.findMany.mockResolvedValue([
      { date: giorno(10), weightKg: 69.9, waistCm: null, hipsCm: null },
      { date: giorno(18), weightKg: 69.7, waistCm: null, hipsCm: null },
      { date: giorno(19), weightKg: 69.5, waistCm: null, hipsCm: null },
    ]);
    const r = await salvato();
    expect(r.objective.toGoKg).toBeLessThanOrEqual(0);
    expect(r.offer).toBeNull();
  });
});
