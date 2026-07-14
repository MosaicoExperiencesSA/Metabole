import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { CycleService } from './cycle.service';

const DAY = 86_400_000;
const d = (n: number) => new Date(Date.UTC(2026, 6, n));

function make(over: {
  menuDays?: Record<string, unknown>[];
  ratings?: { recipeId: string; stars: number }[];
  existingCycle?: { id: string; state: string } | null;
  lastFeedback?: Record<string, unknown> | null;
  cookingMethods?: Record<string, unknown>[];
  defaultRating?: number;
}) {
  const cycleWrites: Record<string, unknown>[] = [];
  const prisma = {
    menuDay: { findMany: jest.fn().mockResolvedValue(over.menuDays ?? []) },
    recipe: { findMany: jest.fn().mockResolvedValue(over.cookingMethods ?? [{ cookingMethods: [{ type: 'veloce' }, { type: 'forno' }] }]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue(over.ratings ?? []) },
    clientCycle: {
      findFirst: jest.fn().mockResolvedValue(over.existingCycle ?? null),
      create: jest.fn((a: { data: Record<string, unknown> }) => { cycleWrites.push(a.data); return Promise.resolve(a.data); }),
      update: jest.fn((a: { data: Record<string, unknown> }) => { cycleWrites.push(a.data); return Promise.resolve(a.data); }),
    },
    cycleFeedback: { findFirst: jest.fn().mockResolvedValue(over.lastFeedback ?? null) },
  };
  const config = { getNumber: jest.fn((k: string, def?: number) => Promise.resolve(k === 'cycle_default_rating' ? (over.defaultRating ?? 5) : def ?? 2)) };
  const service = new CycleService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
  return { service, cycleWrites, prisma };
}

const twoDays = [
  { date: d(10), dietId: 'diet1', level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }] },
  { date: d(9), dietId: 'diet1', level: 1, meals: [{ slot: 'lunch', recipeId: 'r3' }] },
];

describe('CycleService.getActiveCycle', () => {
  it('nessun menu erogato → nessun ciclo attivo', async () => {
    const { service } = make({ menuDays: [] });
    const res = await service.getActiveCycle('c1');
    expect(res.active).toBe(false);
  });

  it('materializza il ciclo attivo con finestra, cotture e stato di default', async () => {
    const { service, cycleWrites } = make({ menuDays: twoDays });
    const res = await service.getActiveCycle('c1');
    expect(res.active).toBe(true);
    if (!res.active) return;
    expect(res.cycleEnd).toEqual(d(10));
    expect(res.cycleStart).toEqual(d(9));
    expect(res.state).toBe('normale');
    expect(res.cooking.g1).toBe('veloce');
    expect(res.cooking.g2).toBe('forno');
    expect(cycleWrites).toHaveLength(1); // creato
  });

  it('conserva lo stato del ciclo esistente (non lo resetta)', async () => {
    const { service } = make({ menuDays: twoDays, existingCycle: { id: 'cy1', state: 'conforto' } });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.state).toBe('conforto');
  });

  it('gradimento = MIN tra i max delle ricette; default 5 se non valutate', async () => {
    const { service } = make({ menuDays: twoDays }); // r1,r2,r3 non valutate
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.gradimento).toBe(5);
  });

  it('una ricetta con poche stelle abbassa il gradimento del ciclo (pasto peggiore traina)', async () => {
    const { service } = make({ menuDays: twoDays, ratings: [{ recipeId: 'r2', stars: 2 }] });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.gradimento).toBe(2);
  });

  it('espone l\'esito dell\'ultimo ciclo chiuso', async () => {
    const { service } = make({ menuDays: twoDays, lastFeedback: { esitoPeso: 'perso', esitoCm: 'stabile', followed: true, cycleEnd: d(8) } });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.lastOutcome).toEqual({ esitoPeso: 'perso', esitoCm: 'stabile', followed: true });
  });
});

describe('CycleService.menuGradimento', () => {
  it('max per ricetta, poi min sul ciclo', async () => {
    const { service } = make({ ratings: [{ recipeId: 'a', stars: 3 }, { recipeId: 'a', stars: 5 }, { recipeId: 'b', stars: 4 }] });
    // a → max 5, b → max 4, c → default 5 ; min = 4
    expect(await service.menuGradimento('c1', ['a', 'b', 'c'])).toBe(4);
  });
});
