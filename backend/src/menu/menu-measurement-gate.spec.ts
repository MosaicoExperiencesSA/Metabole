import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';

const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

function makeService(prisma: unknown) {
  const config = {
    getNumber: jest.fn((k: string, def?: number) =>
      Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[k] ?? def),
    ),
  };
  const audit = { log: jest.fn() };
  const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
  return new MenuService(
    prisma as PrismaService,
    config as unknown as ConfigParamsService,
    audit as unknown as AuditService,
    events as unknown as EventsService,
  );
}

describe('MenuService — gate misure', () => {
  it('nessun menu erogato → gate non richiesto', async () => {
    const prisma = { menuDay: { findFirst: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res).toEqual({ required: false, blocking: false, cycleDate: null });
  });

  it('2° giorno del ciclo passato e nessuna misura → bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
    expect(res.cycleDate).toBe(dayIso(-1));
  });

  it('2° giorno del ciclo oggi e nessuna misura → bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(0)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });

  it('2° giorno del ciclo nel futuro → non bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(1)) }) },
      measurement: { findFirst: jest.fn() },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
    expect(prisma.measurement.findFirst).not.toHaveBeenCalled();
  });

  it('misura del ciclo presente → non bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
  });

  const deliveryPrisma = (over: Record<string, unknown>) => ({
    subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
    menuDay: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    dailyCheckin: { findUnique: jest.fn() },
    engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
    dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ dayIndex: 1, level: 1, meals: [{ slot: 'breakfast', recipeId: 'r1' }] }]) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  });

  it('sicurezza: intolleranza NON sostituibile → blocca ed apre escalation al nutrizionista', async () => {
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: ['frutta secca'], dislikedFoods: [], assignedNutritionistId: 'nut-1',
        }),
      },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Insalata con noci', kcal: 300, ingredients: [{ name: 'noci sgusciate' }] }]) },
    });
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]);
    expect((prisma.escalation.create as jest.Mock)).toHaveBeenCalled();
    expect((prisma.escalation.create as jest.Mock).mock.calls[0][0].data.reason).toContain('Piano bloccato');
    expect((prisma.menuDay.upsert as jest.Mock)).not.toHaveBeenCalled();
  });

  it('selezione: a parità di kcal sceglie la ricetta più gradita', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      dietDayTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { dayIndex: 1, level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }] },
          { dayIndex: 2, level: 1, meals: [{ slot: 'lunch', recipeId: 'r2' }] },
        ]),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', name: 'Pasta A', kcal: 500, ingredients: [] },
          { id: 'r2', name: 'Pasta B', kcal: 500, ingredients: [] },
        ]),
      },
      recipeRating: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'r1', stars: 2 }, { recipeId: 'r2', stars: 5 }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), upsert },
    });
    await makeService(prisma).deliverIfEligible('c1');
    // il giorno che parte dal template con r1 deve erogare r2 (più gradita, stesse kcal)
    const firstDayMeals = upsert.mock.calls[0][0].create.meals;
    expect(firstDayMeals[0].recipeId).toBe('r2');
  });

  it('sostituzione: intolleranza sostituibile → eroga con nota di sostituzione', async () => {
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: ['lattosio'], dislikedFoods: [], assignedNutritionistId: 'nut-1',
        }),
      },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Yogurt e avena', kcal: 300, ingredients: [{ name: 'yogurt greco' }] }]) },
    });
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created.length).toBeGreaterThan(0); // erogato, non bloccato
    expect((prisma.escalation.create as jest.Mock)).not.toHaveBeenCalled();
    const meals = (prisma.menuDay.upsert as jest.Mock).mock.calls[0][0].create.meals;
    expect(meals[0].substitutions[0]).toEqual({ from: 'yogurt greco', to: 'yogurt senza lattosio', reason: 'lattosio' });
  });

  it('erogazione: senza misura del ciclo NON eroga (ciclo successivo "held")', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-2)) }) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue({ id: 'ck' }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]); // held: l'avviso coach lo genera l'Alert engine
  });
});
