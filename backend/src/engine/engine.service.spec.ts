import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EngineService } from './engine.service';
import { EngineSignals } from './rules-evaluator';
import { SignalsCollectorService } from './signals-collector.service';

const signals = (over: Partial<EngineSignals> = {}): EngineSignals => ({
  stallDays: 0,
  weeklyRateKg: 0.5,
  direction: 'down',
  rapidLoss: false,
  progressPercent: 30,
  measurementsCount: 10,
  moodAvg: 3.5,
  energyAvg: 3.5,
  stressAvg: 2.5,
  lowEnergyChronic: false,
  checkinsLast7: 6,
  cookingTime: 'some',
  busyLifestyle: false,
  upcomingEvent: false,
  pausePeriodActive: false,
  avgRating: 4,
  adherenceLast7: 0.86,
  ...over,
});

describe('EngineService', () => {
  let service: EngineService;
  let prisma: any;
  let collector: { collect: jest.Mock };

  beforeEach(async () => {
    prisma = {
      engineDecision: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'dec1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'dec1', ...data })),
      },
      protocol: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p5',
            name: 'Aderente, umore alto, obiettivo vicino',
            definition: {
              priority: 50,
              conditions: [
                { field: 'adherenceLast7', op: 'gte', value: 0.8 },
                { field: 'moodAvg', op: 'gte', value: 4 },
                { field: 'progressPercent', op: 'gte', value: 75 },
              ],
              action: { menu: 'celebrate_step', tone: 'celebratory', timing: 'morning' },
            },
          },
        ]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pr1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pr1', ...data })),
        count: jest.fn(),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'staff-n' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      // `staff.findMany` e `findFirst` servono a `apriSegnalazione` per decidere i destinatari
      // (8/8): senza, la decisione falliva e la segnalazione nasceva orfana — che è il
      // comportamento voluto in produzione, ma qui nascondeva l'assegnazione che il test verifica.
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-x' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-n', userId: 'user-nutri' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-capo', userId: 'user-capo' }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }) },
    };
    collector = { collect: jest.fn().mockResolvedValue({ signals: signals(), screeningFlag: false }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: SignalsCollectorService, useValue: collector },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(EngineService);
  });

  it('caso normale: applica la regola approvata e logga la decisione spiegabile', async () => {
    collector.collect.mockResolvedValue({
      signals: signals({ adherenceLast7: 1, moodAvg: 4.5, progressPercent: 80 }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');
    expect(decision.ruleId).toBe('p5');
    expect(decision.flaggedForReview).toBe(false);
    expect((decision.action as any).tone).toBe('celebratory');
    expect((decision.inputs as any).signals.moodAvg).toBe(4.5);
  });

  it('idempotente: seconda esecuzione nello stesso giorno non decide di nuovo', async () => {
    prisma.engineDecision.findFirst.mockResolvedValue({ id: 'dec-old' });
    const result = await service.runForClient('u1');
    expect(result.alreadyRun).toBe(true);
    expect(prisma.engineDecision.create).not.toHaveBeenCalled();
  });

  it('GUARDRAIL screening: il motore non decide, flag per il nutrizionista', async () => {
    collector.collect.mockResolvedValue({ signals: signals(), screeningFlag: true });
    const { decision } = await service.runForClient('u1');
    expect(decision.flaggedForReview).toBe(true);
    expect(decision.ruleId).toBeNull();
    expect((decision.action as any).menu).toBe('keep');
  });

  it('GUARDRAIL calo rapido + energia bassa: flag + escalation al nutrizionista', async () => {
    collector.collect.mockResolvedValue({
      signals: signals({ rapidLoss: true, energyAvg: 2 }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');
    expect(decision.flaggedForReview).toBe(true);
    expect((decision.action as any).menu).toBe('increase_calories');
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'engine', category: 'clinical', assignedToId: 'staff-n' }),
      }),
    );
  });

  it('GUARDRAIL energia bassa cronica: flag + escalation', async () => {
    collector.collect.mockResolvedValue({
      signals: signals({ lowEnergyChronic: true }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');
    expect(decision.flaggedForReview).toBe(true);
    expect(prisma.escalation.create).toHaveBeenCalled();
  });

  // --- Una riga per cliente per causa (13/8) ---
  //
  // Il motore gira ogni notte: senza questi controlli la stessa segnalazione ricompare in coda
  // ogni giorno finché il problema dura, e la riga che conta finisce sepolta sotto le sue copie.

  /**
   * Il mock unico di `findFirst` serve due domande diverse (la decisione di oggi, e la causa già
   * aperta): le si distingue dal `where`. `causeAperte` elenca QUALI cause risultano aperte, non
   * un sì/no — con un booleano il test della causa diversa passerebbe anche contro
   * un'implementazione che deduplica per cliente ignorando la causa, cioè il bug da intercettare.
   */
  const findFirstCon = (...causeAperte: string[]) =>
    prisma.engineDecision.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where?.reasonKey && causeAperte.includes(where.reasonKey) ? { id: 'dec-aperta' } : null),
    );

  it('la stessa causa non torna in coda finché nessuno ha guardato quella aperta', async () => {
    findFirstCon('calo_rapido_energia');
    collector.collect.mockResolvedValue({
      signals: signals({ rapidLoss: true, energyAvg: 2 }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');

    expect(decision.flaggedForReview).toBe(false); // niente seconda chiamata a guardarla
    expect(decision.reasonKey).toBe('calo_rapido_energia');
    // …ma la riga esiste, con la sua frase: serve al tono del messaggio di oggi e allo storico.
    expect(decision.flagReason).toContain('Calo troppo rapido');
    expect(prisma.engineDecision.create).toHaveBeenCalled();
  });

  it('una causa DIVERSA entra in coda anche se ce n’è già un’altra aperta', async () => {
    // La cliente ha già una riga aperta per il calo rapido: quella per l'energia bassa è un'altra
    // cosa da guardare, e deve arrivare lo stesso. Se il dedup fosse per cliente, qui fallirebbe.
    findFirstCon('calo_rapido_energia');
    collector.collect.mockResolvedValue({
      signals: signals({ lowEnergyChronic: true }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');
    expect(decision.flaggedForReview).toBe(true);
    expect(decision.reasonKey).toBe('energia_bassa_cronica');
  });

  it('la causa si considera «aperta» solo se flaggata e NON ancora revisionata', async () => {
    findFirstCon();
    collector.collect.mockResolvedValue({
      signals: signals({ rapidLoss: true, energyAvg: 2 }),
      screeningFlag: false,
    });
    await service.runForClient('u1');
    // Senza `reviewedAt: null` una riga già guardata zittirebbe il motore per sempre: la causa
    // non tornerebbe mai in coda, che è il modo silenzioso di spegnere un guardrail.
    expect(prisma.engineDecision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'u1',
          reasonKey: 'calo_rapido_energia',
          flaggedForReview: true,
          reviewedAt: null,
        }),
      }),
    );
  });

  it('decisione ordinaria: nessuna causa, quindi il menu la può applicare', async () => {
    collector.collect.mockResolvedValue({
      signals: signals({ adherenceLast7: 1, moodAvg: 4.5, progressPercent: 80 }),
      screeningFlag: false,
    });
    const { decision } = await service.runForClient('u1');
    // `menu.service` legge le decisioni con `flaggedForReview: false` E `reasonKey: null`: una
    // causa valorizzata qui la escluderebbe dall'erogazione.
    expect(decision.reasonKey).toBeNull();
    expect(decision.flagReason).toBeNull();
  });

  it('runBatch gira solo su chi ha un piano alimentare attivo', async () => {
    await service.runBatch();
    const where = prisma.clientProfile.findMany.mock.calls[0][0].where;
    // Il filtro si AGGIUNGE ai due che c'erano: lo spread di un oggetto è il modo più facile di
    // far sparire una condizione senza accorgersene.
    expect(where.onboardingCompletedAt).toEqual({ not: null });
    expect(where.user).toEqual(expect.objectContaining({ status: 'active', deletedAt: null }));
    expect(where.user.subscriptions.some).toEqual(
      expect.objectContaining({
        status: 'active',
        // Il monitoraggio è un abbonamento attivo ma non è un piano alimentare: chi lo ha non
        // riceve menu, quindi non c'è niente su cui il motore possa decidere. Il confronto è
        // insensibile alle maiuscole perché il Negozio salva `period` come è stato scritto.
        plan: { period: { not: 'monitoring', mode: 'insensitive' } },
      }),
    );
    // Un piano scaduto ieri è concluso; uno che finisce oggi vale ancora oggi.
    expect(where.user.subscriptions.some.OR).toEqual([
      { endDate: null },
      { endDate: { gte: expect.any(Date) } },
    ]);
  });

  it('revisione: confirm imposta esito e revisore, doppia revisione rifiutata', async () => {
    prisma.engineDecision.findUnique.mockResolvedValue({ id: 'dec1', reviewedAt: null });
    const reviewed = await service.reviewDecision('nutri-user', 'dec1', 'confirmed', 'ok');
    expect(reviewed.reviewOutcome).toBe('confirmed');

    prisma.engineDecision.findUnique.mockResolvedValue({ id: 'dec1', reviewedAt: new Date() });
    await expect(service.reviewDecision('nutri-user', 'dec1', 'corrected')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('revisione: un nutrizionista NON può revisionare decisioni di pazienti non suoi', async () => {
    // Reviewer nutrizionista (non capo) con paziente assegnato a un altro staff.
    prisma.user.findUnique.mockResolvedValue({ role: 'nutritionist' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff-x' });
    prisma.engineDecision.findUnique.mockResolvedValue({ id: 'dec1', reviewedAt: null, clientId: 'c1' });
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedNutritionistId: 'staff-altro' });
    await expect(service.reviewDecision('nutri-user', 'dec1', 'confirmed')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('protocolli: non si valida il proprio', async () => {
    prisma.protocol.findUnique.mockResolvedValue({ id: 'pr1', status: 'pending', authorId: 'staff-x' });
    await expect(service.validateProtocol('user-x', 'pr1', true)).rejects.toThrow(ForbiddenException);
  });

  it('protocolli: validazione di un collega → approved con validatore', async () => {
    prisma.protocol.findUnique.mockResolvedValue({ id: 'pr1', status: 'pending', authorId: 'staff-altro' });
    const validated = await service.validateProtocol('user-x', 'pr1', true);
    expect(validated.status).toBe('approved');
    expect(validated.validatedById).toBe('staff-x');
  });

  it('protocolli: definition senza conditions/action → rifiutata', async () => {
    await expect(
      service.createProtocol('user-x', { name: 'X', type: 'library', definition: { foo: 1 } }),
    ).rejects.toThrow(BadRequestException);
  });
});
