import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietLearningService } from '../diet-learning/diet-learning.service';
import { EscalationRoutingService } from '../escalations/escalation-routing.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';
// `toDateOnly` vive in common/date-only: signals.service lo importa soltanto, non lo riesporta.
// L'import sbagliato teneva ROSSA l'intera suite (TS2459 in compilazione), quindi fino a oggi
// nessuno dei test qui sotto girava davvero.
import { giornoLocale, toDateOnly } from '../common/date-only';
import { SignalsService } from './signals.service';

describe('toDateOnly', () => {
  it('normalizza a mezzanotte UTC', () => {
    const d = toDateOnly('2026-07-09');
    expect(d.toISOString()).toBe('2026-07-09T00:00:00.000Z');
  });

  it('data non valida → errore', () => {
    expect(() => toDateOnly('non-una-data')).toThrow(BadRequestException);
  });
});

describe('SignalsService', () => {
  let service: SignalsService;
  let prisma: any;
  let config: { getNumber: jest.Mock; getString: jest.Mock };

  beforeEach(async () => {
    prisma = {
      measurement: {
        upsert: jest.fn().mockResolvedValue({ id: 'm1', weightKg: 67 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ weightKg: 67 }),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
      },
      dailyCheckin: {
        upsert: jest.fn().mockResolvedValue({ id: 'c1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      checkinSkip: {
        upsert: jest.fn().mockResolvedValue({ id: 'sk1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      waterLog: {
        upsert: jest.fn().mockResolvedValue({ id: 'w1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      stepLog: {
        upsert: jest.fn().mockResolvedValue({ id: 's1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      milestone: { createMany: jest.fn().mockResolvedValue({ count: 0 }), findMany: jest.fn() },
      // Sblocco gate misure: chiude gli avvisi coach "misure mancanti".
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        // `create`: le notifiche delle segnalazioni passano da `apriSegnalazione` (8/8).
        create: jest.fn().mockResolvedValue({}),
      },
      escalation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ startWeightKg: 68, assignedNutritionistId: 'staff-n' }),
      },
      // `staff.findMany` e `findFirst` servono a `apriSegnalazione` per decidere i destinatari
      // (8/8): senza, la decisione falliva e la segnalazione nasceva orfana — che è il
      // comportamento voluto in produzione, ma qui nascondeva l'assegnazione che il test verifica.
      staff: {
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-n', userId: 'user-nutri' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-capo', userId: 'user-capo' }),
      },
      objective: { findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 62 }) },
      // Il check-in si propone SOLO con un piano attivo (voce #5 del 5/8): senza questo
      // modello nel finto Prisma, todayStatus esplode invece di rispondere.
      subscription: { findMany: jest.fn().mockResolvedValue([{ endDate: null }]) },
    };
    config = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          // water_ml_per_kg mancava: il finto config rispondeva 0 ml/kg, l'obiettivo d'acqua
          // finiva schiacciato sul minimo (6 bicchieri) e i due test sotto sembravano sbagliati
          // pur essendo sbagliato il mock.
          // Le due chiavi dell'11/8 (tregua dopo una «risolta» e soglia di peggioramento) sono qui
          // per lo stesso motivo di `water_ml_per_kg`: il `?? 0` in fondo NON è un default, è uno
          // zero. Con `escalation_reopen_days: 0` la tregua non esisteva e il test «non si riapre»
          // era rosso pur essendo giusto il codice.
          ({
            max_weight_change_alert_kg_week: 1.5,
            water_ml_per_kg: 33,
            water_goal_glasses: 8,
            steps_goal: 8000,
            moving_average_window: 3,
            escalation_reopen_days: 14,
            rapid_loss_reopen_worsening_kg: 0.5,
          } as Record<string, number>)[key] ?? 0,
        ),
      ),
      getString: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SignalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: DietLearningService, useValue: { onCycleClose: jest.fn().mockResolvedValue(null) } },
        // Le tre dipendenze qui sotto mancavano: il servizio ne ha sette, il modulo di test ne
        // dichiarava quattro. Non se n'era accorto nessuno perché la suite non compilava proprio.
        { provide: ProgressService, useValue: { getProgress: jest.fn().mockResolvedValue({ alerts: {} }) } },
        { provide: EscalationRoutingService, useValue: { open: jest.fn().mockResolvedValue(null) } },
        { provide: MenuService, useValue: { deliverIfEligible: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = moduleRef.get(SignalsService);
  });

  it('misura: upsert per (cliente, giorno) — stessa data aggiorna, non duplica', async () => {
    await service.upsertMeasurement('u1', { weightKg: 67 });
    expect(prisma.measurement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientId_date: expect.anything() }) }),
    );
  });

  it('misura nel futuro → rifiutata', async () => {
    const future = giornoLocale(new Date(Date.now() + 3 * 86_400_000));
    await expect(service.upsertMeasurement('u1', { weightKg: 67, date: future })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('prima misura → traguardo first_measurement, con l\'etichetta che legge la cliente', async () => {
    prisma.milestone.createMany.mockResolvedValue({ count: 1 });
    const result = await service.upsertMeasurement('u1', { weightKg: 67 });
    /**
     * ⚠️ Esce l'ETICHETTA, non solo il codice (16/8). Sono parole che legge la cliente e sono già
     * scritte nel servizio: farle uscire di qui evita una seconda copia nell'app — e fra un anno
     * due frasi diverse per lo stesso traguardo.
     */
    // `toContainEqual` e non `toEqual`: con questo peso di partenza scattano anche i «-1 kg», e
    // fissare l'elenco intero renderebbe il test fragile su una cosa che non sta collaudando.
    expect(result.newMilestones).toContainEqual({
      type: 'first_measurement',
      label: 'Prima misura registrata: si parte!',
    });
  });

  it('⚠️ un traguardo GIÀ raggiunto non si ridice: solo quelli appena scritti', async () => {
    // `skipDuplicates` fa tornare count 0 quando c'era già: è quello che distingue «l'ha appena
    // raggiunto» da «ce l'aveva da un mese», e senza questa riga l'app festeggerebbe a ogni pesata.
    prisma.milestone.createMany.mockResolvedValue({ count: 0 });
    const result = await service.upsertMeasurement('u1', { weightKg: 67 });
    expect(result.newMilestones).toEqual([]);
  });

  it('guardrail calo rapido: oltre soglia → escalation al nutrizionista', async () => {
    // 2 kg persi in 8 giorni = 1.75 kg/settimana > 1.5
    const mk = (n: number, w: number) => ({ date: new Date(Date.UTC(2026, 6, n)), weightKg: w });
    prisma.measurement.findMany.mockResolvedValue([mk(1, 68), mk(5, 67), mk(9, 66)]);
    const result = await service.upsertMeasurement('u1', { weightKg: 66 });
    expect(result.rapidLossAlert).toBe(true);
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'engine', category: 'clinical', assignedToId: 'staff-n' }),
      }),
    );
  });

  it('guardrail: calo normale → nessuna escalation', async () => {
    const mk = (n: number, w: number) => ({ date: new Date(Date.UTC(2026, 6, n)), weightKg: w });
    prisma.measurement.findMany.mockResolvedValue([mk(1, 68), mk(5, 67.7), mk(9, 67.4)]);
    const result = await service.upsertMeasurement('u1', { weightKg: 67.4 });
    expect(result.rapidLossAlert).toBe(false);
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  it('guardrail: escalation già aperta → non ne apre un\'altra', async () => {
    const mk = (n: number, w: number) => ({ date: new Date(Date.UTC(2026, 6, n)), weightKg: w });
    prisma.measurement.findMany.mockResolvedValue([mk(1, 68), mk(5, 67), mk(9, 66)]);
    prisma.escalation.findFirst.mockResolvedValue({ id: 'e-open' });
    await service.upsertMeasurement('u1', { weightKg: 66 });
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  /**
   * «SE IL NUTRIZIONISTA DICE OK, RESTA OK: NON DEVI CONTINUARE A TEDIARLO» (Simone, 11/8).
   *
   * Il finto Prisma qui risponde in base allo `status` chiesto, perché è esattamente la differenza
   * che il difetto sfruttava: il controllo di prima chiedeva solo le APERTE, quindi una «risolta»
   * per lui non esisteva e la segnalazione tornava al primo peso del giorno dopo.
   */
  const conSegnalazioneRisolta = (giorniFa: number, severity: number | null = 1.75) => {
    prisma.escalation.findFirst.mockImplementation(({ where }: any) => {
      const stato = where.status;
      if (typeof stato === 'object' && Array.isArray(stato?.in)) return Promise.resolve(null); // nessuna aperta
      return Promise.resolve({
        id: 'e-chiusa',
        status: 'resolved',
        severity,
        resolvedAt: new Date(Date.now() - giorniFa * 86_400_000),
      });
    });
  };
  /** Calo di 1,75 kg/settimana: sopra la soglia di 1,5. */
  const caloRapido = () => {
    const mk = (n: number, w: number) => ({ date: new Date(Date.UTC(2026, 6, n)), weightKg: w });
    prisma.measurement.findMany.mockResolvedValue([mk(1, 68), mk(5, 67), mk(9, 66)]);
  };

  it('calo rapido già RISOLTO ieri: non si riapre', async () => {
    caloRapido();
    conSegnalazioneRisolta(1);
    const result = await service.upsertMeasurement('u1', { weightKg: 66 });
    // Il guardrail vede ancora il calo — è vero, la cliente sta calando così — ma non disturba.
    expect(result.rapidLossAlert).toBe(true);
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  it('risolto venti giorni fa e il calo continua: torna a segnalarlo', async () => {
    caloRapido();
    conSegnalazioneRisolta(20);
    await service.upsertMeasurement('u1', { weightKg: 66 });
    expect(prisma.escalation.create).toHaveBeenCalled();
  });

  it('risolto ieri ma il calo è PEGGIORATO: si riapre — è la valvola di sicurezza', async () => {
    // Chiusa quando calava 1,0 kg/settimana; ora 1,75: +0,75, oltre la soglia di 0,5.
    caloRapido();
    conSegnalazioneRisolta(1, 1.0);
    await service.upsertMeasurement('u1', { weightKg: 66 });
    expect(prisma.escalation.create).toHaveBeenCalled();
  });

  it('la gravità di adesso si scrive sulla riga: è il numero con cui si misurerà il peggioramento', async () => {
    caloRapido();
    await service.upsertMeasurement('u1', { weightKg: 66 });
    const creata = prisma.escalation.create.mock.calls[0][0].data;
    expect(typeof creata.severity).toBe('number');
    expect(creata.severity).toBeGreaterThan(1.5);
  });

  it('check-in: upsert per giorno', async () => {
    await service.upsertCheckin('u1', { mood: 'good', energy: 4 });
    expect(prisma.dailyCheckin.upsert).toHaveBeenCalled();
  });

  it('acqua e passi: obiettivi presi da config_param', async () => {
    // L'acqua non è più un numero fisso: 33 ml/kg sull'ultimo peso (67 kg) diviso il bicchiere
    // da 250 ml = 9 bicchieri. Il vecchio 8 era il globale, superato quando l'obiettivo è
    // diventato personale.
    await service.upsertWater('u1', { glasses: 5 });
    expect(prisma.waterLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ goal: 9 }) }),
    );
    await service.upsertSteps('u1', { steps: 6000 });
    expect(prisma.stepLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ goal: 8000, source: 'manual' }) }),
    );
  });

  it('todayStatus: segnala il check-in mancante per il popup', async () => {
    const status = await service.todayStatus('u1');
    expect(status.checkinDone).toBe(false);
    expect(status.water.goal).toBe(9); // personalizzato sul peso, vedi sopra
  });

  // --- "Salta per oggi" ------------------------------------------------------------------
  // Il tasto prima non salvava niente: chiudeva il popup e basta, e bastava uscire dalla home
  // per rivederlo. Questi test tengono ferme le due cose che contano: che lo skip duri fino a
  // domani, e che non venga mai scambiato per un check-in fatto.

  it('salta per oggi: registrato sulla data di oggi, una riga sola', async () => {
    const res = await service.skipCheckinToday('u1');
    // Il giorno ITALIANO, non quello UTC: con `toISOString()` questo test cadeva ogni notte fra
    // mezzanotte e le 2 (vedi la nota in `common/date-only.ts`).
    const oggi = giornoLocale(new Date());
    expect(res).toEqual({ skipped: true, date: oggi });
    expect(prisma.checkinSkip.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId_date: { clientId: 'u1', date: toDateOnly(oggi) } },
        create: { clientId: 'u1', date: toDateOnly(oggi) },
        update: {}, // idempotente: toccare "Salta" due volte non deve cambiare la riga
      }),
    );
  });

  it("salta per oggi: NON scrive un check-in, altrimenti gonfierebbe l'aderenza", async () => {
    await service.skipCheckinToday('u1');
    expect(prisma.dailyCheckin.upsert).not.toHaveBeenCalled();
    expect(prisma.dailyCheckin.count).not.toHaveBeenCalled();
  });

  it('todayStatus: dopo lo skip il popup non si mostra, ma il check-in resta NON fatto', async () => {
    prisma.checkinSkip.findUnique.mockResolvedValue({ id: 'sk1' });
    const status = await service.todayStatus('u1');
    expect(status.checkinSkipped).toBe(true);
    // Questa è la riga che protegge i report: saltare non è rispondere.
    expect(status.checkinDone).toBe(false);
  });

  it('todayStatus: senza skip il popup si mostra (e il giorno dopo torna)', async () => {
    // findUnique è cercato sulla data di OGGI: uno skip di ieri non ha la stessa chiave e qui
    // non compare, quindi domani la cliente rivede il popup.
    prisma.checkinSkip.findUnique.mockResolvedValue(null);
    const status = await service.todayStatus('u1');
    expect(status.checkinSkipped).toBe(false);
    const oggi = toDateOnly();
    expect(prisma.checkinSkip.findUnique).toHaveBeenCalledWith({
      where: { clientId_date: { clientId: 'u1', date: oggi } },
    });
  });
});
