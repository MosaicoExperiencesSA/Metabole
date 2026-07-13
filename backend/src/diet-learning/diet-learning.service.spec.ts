import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DietLearningService } from './diet-learning.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function make(prisma: Record<string, unknown>) {
  const config = { getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 0)) };
  return new DietLearningService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

const cycleMenuDays = () => [
  { date: D(dayIso(-1)), meals: [{ recipeId: 'r1' }] },
  { date: D(dayIso(-2)), meals: [{ recipeId: 'r2' }] },
];
const measurement = { date: D(dayIso(-1)), weightKg: 70.5, waistCm: 79, hipsCm: 99.5 };

describe('DietLearningService.onCycleClose', () => {
  it('perdita di peso + seguito → esito "perso" e aggiorna i MenuWeight del ciclo', async () => {
    const menuWeightUpsert = jest.fn().mockResolvedValue({});
    const cycleUpsert = jest.fn().mockResolvedValue({});
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(cycleMenuDays()) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-3)), weightKg: 71, waistCm: 80, hipsCm: 100 }) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ id: 'ck' }) },
      cycleFeedback: { upsert: cycleUpsert },
      menuWeight: { upsert: menuWeightUpsert },
    };
    const res = await make(prisma).onCycleClose('c1', measurement);
    expect(res).toEqual({ esitoPeso: 'perso', esitoCm: 'perso', followed: true });
    expect(cycleUpsert.mock.calls[0][0].create.esitoPeso).toBe('perso');
    expect(menuWeightUpsert).toHaveBeenCalledTimes(2); // r1 + r2
    expect(menuWeightUpsert.mock.calls[0][0].create.score).toBe(1);
  });

  it('senza misura precedente → esito n.d. e nessun aggiornamento dei pesi', async () => {
    const menuWeightUpsert = jest.fn();
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(cycleMenuDays()) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ id: 'ck' }) },
      cycleFeedback: { upsert: jest.fn().mockResolvedValue({}) },
      menuWeight: { upsert: menuWeightUpsert },
    };
    const res = await make(prisma).onCycleClose('c1', measurement);
    expect(res?.esitoPeso).toBe('n.d.');
    expect(menuWeightUpsert).not.toHaveBeenCalled();
  });

  it('ciclo non seguito (nessun check-in) → registra ma non aggiorna i pesi', async () => {
    const menuWeightUpsert = jest.fn();
    const cycleUpsert = jest.fn().mockResolvedValue({});
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(cycleMenuDays()) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-3)), weightKg: 71, waistCm: 80, hipsCm: 100 }) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue(null) },
      cycleFeedback: { upsert: cycleUpsert },
      menuWeight: { upsert: menuWeightUpsert },
    };
    const res = await make(prisma).onCycleClose('c1', measurement);
    expect(res?.followed).toBe(false);
    expect(cycleUpsert).toHaveBeenCalled();
    expect(menuWeightUpsert).not.toHaveBeenCalled();
  });

  it('nessun menu erogato → nulla da fare', async () => {
    const prisma = { menuDay: { findMany: jest.fn().mockResolvedValue([]) } };
    const res = await make(prisma).onCycleClose('c1', measurement);
    expect(res).toBeNull();
  });
});
