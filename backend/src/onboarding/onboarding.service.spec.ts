import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { OnboardingService } from './onboarding.service';

const baseAnswers = (): SubmitAnswersDto =>
  ({
    name: 'Giulia',
    age: 34,
    sex: 'female',
    heightCm: 168,
    startWeightKg: 68,
    startWaistCm: 80,
    startHipsCm: 99,
    regime: 'omnivore',
    dietStyle: 'mediterranean',
    intolerances: ['none'],
    dislikedFoods: ['funghi'],
    lifestyle: { work: 'sedentary', cookingTime: 'some', weekdayLunch: 'out' },
    mealsPerDay: 5,
    pathType: 'five',
    health: { hasConditions: 'no', takesMedications: 'no' },
    objective: { weightToLoseKg: 6, weeks: 18, waistToLoseCm: 8 },
    coachStyle: 'when_needed',
    character: 'needs_push',
    themeColor: '#12A386',
    healthDataConsent: true,
  }) as SubmitAnswersDto;

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      clientProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'p1', screeningFlag: false }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          screeningFlag: false,
          onboardingCompletedAt: new Date(),
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          pathType: 'five',
          regime: 'omnivore',
          assignedCoach: { id: 's-c', displayName: 'Marta' },
          assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Bini' },
        }),
      },
      objective: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', status: 'proposed' }),
      },
      escalation: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's-a', displayName: 'A', _count: { clientsAsCoach: 5 } },
          { id: 's-b', displayName: 'B', _count: { clientsAsCoach: 2 } },
        ]),
      },
    };
    const configParams = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(key === 'sustainable_rate_max_kg_week' ? 0.7 : 1.0),
      ),
      getString: jest.fn().mockResolvedValue('warn'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: configParams },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PersonalBaseService, useValue: { buildPersonalBase: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  it('senza consenso ai dati sanitari rifiuta (GDPR)', async () => {
    const dto = { ...baseAnswers(), healthDataConsent: false };
    await expect(service.submitAnswers('u1', dto)).rejects.toThrow(BadRequestException);
  });

  it('flusso felice: profilo, obiettivo, team, nessuna escalation', async () => {
    const result = await service.submitAnswers('u1', baseAnswers());
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
    expect(prisma.objective.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetWeightKg: 62, status: 'proposed' }),
      }),
    );
    expect(prisma.escalation.create).not.toHaveBeenCalled();
    expect(result.path.name).toBe('Equilibrio Mediterraneo');
    expect(result.team.coach.displayName).toBe('Marta');
  });

  it('senza ref code il team NON si assegna in automatico (lo assegna il responsabile)', async () => {
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedCoachId).toBeNull();
    expect(createArgs.assignedNutritionistId).toBeNull();
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  it('col ref code sul lead, coach e nutrizionista si propagano al profilo', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({
      assignedCoachId: 's-ref-coach',
      assignedNutritionistId: 's-ref-nutri',
    });
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedCoachId).toBe('s-ref-coach');
    expect(createArgs.assignedNutritionistId).toBe('s-ref-nutri');
  });

  it('patologie dichiarate → screening_flag + escalation al nutrizionista', async () => {
    const dto = baseAnswers();
    dto.health = { hasConditions: 'yes', takesMedications: 'no' } as never;
    await service.submitAnswers('u1', dto);
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.screeningFlag).toBe(true);
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'screening' }),
      }),
    );
  });

  it('"none" viene rimosso dalle intolleranze salvate', async () => {
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.intolerances).toEqual([]);
  });

  it('obiettivo irreale con action=warn: accettato ma tracciato in validazione', async () => {
    const dto = baseAnswers();
    dto.objective = { weightToLoseKg: 15, weeks: 10 } as never;
    const result = await service.submitAnswers('u1', dto);
    expect((result as any).objectiveValidation.pace).toBe('unreal');
    expect(prisma.objective.create).toHaveBeenCalled();
  });
});
