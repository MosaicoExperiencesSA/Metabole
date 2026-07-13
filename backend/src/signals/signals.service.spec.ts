import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { SignalsService, toDateOnly } from './signals.service';

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
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      escalation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ startWeightKg: 68, assignedNutritionistId: 'staff-n' }),
      },
      objective: { findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 62 }) },
    };
    config = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          ({ max_weight_change_alert_kg_week: 1.5, water_goal_glasses: 8, steps_goal: 8000, moving_average_window: 3 } as Record<string, number>)[key] ?? 0,
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
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await expect(service.upsertMeasurement('u1', { weightKg: 67, date: future })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('prima misura → traguardo first_measurement', async () => {
    prisma.milestone.createMany.mockResolvedValue({ count: 1 });
    const result = await service.upsertMeasurement('u1', { weightKg: 67 });
    expect(result.newMilestones).toContain('first_measurement');
  });

  it('guardrail calo rapido: oltre soglia → escalation al nutrizionista', async () => {
    // 2 kg persi in 8 giorni = 1.75 kg/settimana > 1.5
    const mk = (n: number, w: number) => ({ date: new Date(Date.UTC(2026, 6, n)), weightKg: w });
    prisma.measurement.findMany.mockResolvedValue([mk(1, 68), mk(5, 67), mk(9, 66)]);
    const result = await service.upsertMeasurement('u1', { weightKg: 66 });
    expect(result.rapidLossAlert).toBe(true);
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'engine', assignedToId: 'staff-n' }),
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

  it('check-in: upsert per giorno', async () => {
    await service.upsertCheckin('u1', { mood: 'good', energy: 4 });
    expect(prisma.dailyCheckin.upsert).toHaveBeenCalled();
  });

  it('acqua e passi: obiettivi presi da config_param', async () => {
    await service.upsertWater('u1', { glasses: 5 });
    expect(prisma.waterLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ goal: 8 }) }),
    );
    await service.upsertSteps('u1', { steps: 6000 });
    expect(prisma.stepLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ goal: 8000, source: 'manual' }) }),
    );
  });

  it('todayStatus: segnala il check-in mancante per il popup', async () => {
    const status = await service.todayStatus('u1');
    expect(status.checkinDone).toBe(false);
    expect(status.water.goal).toBe(8);
  });
});
