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
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-x' }) },
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
