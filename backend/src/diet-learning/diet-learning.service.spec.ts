import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DietLearningService, distinctiveCredits } from './diet-learning.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function make(prisma: Record<string, unknown>, opts?: { distinctive?: boolean; alpha?: number }) {
  const config = {
    getNumber: jest.fn((k: string, d?: number) =>
      Promise.resolve(k === 'learning_distinctiveness_alpha' ? (opts?.alpha ?? 0.5) : (d ?? 0)),
    ),
    getBool: jest.fn((_k: string, d?: boolean) => Promise.resolve(opts?.distinctive ?? d ?? false)),
  };
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

  it('attribuzione causale (distintività ON): la ricetta rara prende più credito della base', async () => {
    const menuWeightUpsert = jest.fn().mockResolvedValue({});
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(cycleMenuDays()) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-3)), weightKg: 71, waistCm: 80, hipsCm: 100 }) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ id: 'ck' }) },
      cycleFeedback: { upsert: jest.fn().mockResolvedValue({}) },
      menuWeight: {
        // r1 è una ricetta abituale (10 samples), r2 è rara (0 samples)
        findMany: jest.fn().mockResolvedValue([{ recipeId: 'r1', samples: 10 }, { recipeId: 'r2', samples: 0 }]),
        upsert: menuWeightUpsert,
      },
    };
    const res = await make(prisma, { distinctive: true, alpha: 0.5 }).onCycleClose('c1', measurement);
    expect(res?.esitoPeso).toBe('perso');
    const r1 = menuWeightUpsert.mock.calls.find((c) => c[0].where.clientId_recipeId.recipeId === 'r1')![0].create.score;
    const r2 = menuWeightUpsert.mock.calls.find((c) => c[0].where.clientId_recipeId.recipeId === 'r2')![0].create.score;
    expect(r2).toBe(1); // rara → credito pieno
    expect(r1).toBeCloseTo(0.167, 2); // abituale → credito scontato
    expect(r2).toBeGreaterThan(r1);
  });
});

describe('distinctiveCredits', () => {
  it('ricetta più rara → peso maggiore, normalizzato al massimo del ciclo', () => {
    const credits = distinctiveCredits(['a', 'b'], new Map([['a', 0], ['b', 8]]), 1, 0.5);
    expect(credits.get('a')).toBe(1); // rara → 1
    expect(credits.get('b')).toBeCloseTo(1 / 5, 3); // 1/(1+0.5*8)=1/5 normalizzato a 1
  });

  it('stessa frequenza → credito uniforme (nessuna distintività)', () => {
    const credits = distinctiveCredits(['a', 'b', 'c'], new Map([['a', 3], ['b', 3], ['c', 3]]), -1, 0.5);
    expect(credits.get('a')).toBe(-1);
    expect(credits.get('b')).toBe(-1);
    expect(credits.get('c')).toBe(-1);
  });

  it('nudge 0 (esito stabile) → tutti i crediti 0', () => {
    const credits = distinctiveCredits(['a', 'b'], new Map([['a', 0], ['b', 5]]), 0, 0.5);
    expect(credits.get('a')).toBe(0);
    expect(credits.get('b')).toBe(0);
  });

  it('samples mancanti → trattati come 0 (ricetta mai vista = massimo credito)', () => {
    const credits = distinctiveCredits(['nuova', 'vecchia'], new Map([['vecchia', 6]]), 1, 0.5);
    expect(credits.get('nuova')).toBe(1);
    expect(credits.get('vecchia')).toBeCloseTo(1 / 4, 3);
  });
});
