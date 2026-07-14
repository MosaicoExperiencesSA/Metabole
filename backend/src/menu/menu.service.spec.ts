import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const todayIso = new Date().toISOString().slice(0, 10);
const daysFromToday = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('MenuService (erogazione 2 giorni alla volta)', () => {
  let service: MenuService;
  let prisma: any;

  const template = (dayIndex: number) => ({
    dayIndex,
    level: 1,
    meals: [{ slot: 'lunch', recipeId: 'r1' }],
  });

  beforeEach(async () => {
    prisma = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(todayIso),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          intolerances: [], // nessuna esclusione → nessun blocco di sicurezza
          assignedNutritionistId: null,
        }),
      },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      // Gate misure: misura del ciclo presente → non blocca l'erogazione.
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
      dietDayTemplate: {
        findMany: jest.fn().mockResolvedValue([template(1), template(2)]),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Farro', kcal: 520 }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      recipeRating: {
        upsert: jest.fn().mockResolvedValue({ id: 'rt1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      shoppingList: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sl1', ...data })),
        update: jest.fn(),
      },
    };
    prisma.engineDecision = { findFirst: jest.fn().mockResolvedValue(null) };
    prisma.subscription = { findFirst: jest.fn().mockResolvedValue({ id: 'sub1', status: 'active' }) };
    const config = {
      getNumber: jest.fn((key: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[key] ?? def),
      ),
      getBool: jest.fn((_key: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    (globalThis as any).__eventsMock = events;
    const moduleRef = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: require('../calendar/events.service').EventsService, useValue: events },
        { provide: require('../diet-agent/diet-agent.service').DietAgentService, useValue: { stateFor: jest.fn().mockResolvedValue('normale') } },
        { provide: require('./day-combo.service').DayComboService, useValue: new (require('./day-combo.service').DayComboService)() },
      ],
    }).compile();
    service = moduleRef.get(MenuService);
  });

  it('prima erogazione: 2 giorni dal via del piano', async () => {
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([todayIso, daysFromToday(1)]);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);
  });

  it('SENZA abbonamento attivo il menu non si genera (gating bonifico)', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
  });

  it('periodo di pausa attivo: erogazione sospesa', async () => {
    ((globalThis as any).__eventsMock.activePausePeriod as jest.Mock).mockResolvedValue({ id: 'ev-pausa' });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('la decisione del motore guida livello e source_rule_id', async () => {
    prisma.engineDecision.findFirst.mockResolvedValue({
      ruleId: 'p3',
      action: { levelDelta: 1 },
      date: new Date(),
    });
    prisma.dietDayTemplate.findMany
      .mockResolvedValueOnce([template(1)]) // livello 2 esiste
      .mockResolvedValue([template(1), template(2)]);
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(2);
    expect(call.create.sourceRuleId).toBe('p3');
  });

  it('livello richiesto inesistente: si ripiega sul livello 1', async () => {
    prisma.engineDecision.findFirst.mockResolvedValue({
      ruleId: 'p3',
      action: { levelDelta: 1 },
      date: new Date(),
    });
    prisma.dietDayTemplate.findMany
      .mockResolvedValueOnce([]) // livello 2 non esiste
      .mockResolvedValue([template(1), template(2)]); // fallback livello 1
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(1);
  });

  it('niente menu senza plan_start_date', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: null });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('troppo presto: piano che inizia tra 5 giorni → nessuna erogazione', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(5)),
      regime: 'omnivore',
      mealsPerDay: 5,
    });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('finestra di anticipo: piano tra 2 giorni → eroga (visible_from = start - 2)', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(2)),
      regime: 'omnivore',
      dietStyle: 'mediterranean',
      mealsPerDay: 5,
    });
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([daysFromToday(2), daysFromToday(3)]);
  });

  it('menu di oggi già erogato → non eroga di nuovo', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(1)) });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti SENZA check-in di oggi → resta bloccato (spec: sblocco dopo check-in)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.dailyCheckin.findUnique.mockResolvedValue(null);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti CON check-in di oggi → eroga i 2 successivi', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.dailyCheckin.findUnique.mockResolvedValue({ id: 'c1' });
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([todayIso, daysFromToday(1)]);
  });

  it('mai sovrascrivere un giorno già erogato (upsert con update vuoto)', async () => {
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.update).toEqual({});
  });

  it('valutazione: upsert per cliente+ricetta+giorno, mai nel futuro', async () => {
    await service.rateRecipe('u1', { recipeId: 'r1', stars: 4, tags: ['buono'] });
    expect(prisma.recipeRating.upsert).toHaveBeenCalled();
    await expect(
      service.rateRecipe('u1', { recipeId: 'r1', stars: 4, date: daysFromToday(2) }),
    ).rejects.toThrow();
  });

  it('pending: pasti dei giorni erogati senza valutazione', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1', name: 'Farro', kcal: 520 }] },
    ]);
    prisma.recipeRating.findMany.mockResolvedValue([]);
    const pending = await service.pendingRatings('u1');
    expect(pending).toHaveLength(1);
    expect(pending[0].recipeId).toBe('r1');
  });

  it('lista spesa: aggrega gli ingredienti per nome e unità', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }] },
    ]);
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r1', ingredients: [{ name: 'Zucchine', qty: 100, unit: 'g' }] },
      { id: 'r2', ingredients: [{ name: 'zucchine', qty: 150, unit: 'g' }, { name: 'Uova', qty: 2, unit: 'pz' }] },
    ]);
    const list: any = await service.shoppingList('u1');
    const zucchine = list.items.find((i: any) => i.name.toLowerCase() === 'zucchine');
    expect(zucchine.qty).toBe(250);
    expect(list.items).toHaveLength(2);
  });
});

describe('MenuService — DayCombo (giornate bilanciate, opt-in)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // Pool: 2 candidati per slot; target livello 1400 kcal (±15% = [1190,1610]).
  const recipes = [
    { id: 'b1', name: 'Colazione A', kcal: 300, macros: { protein_g: 15, carbs_g: 40, fat_g: 8 } },
    { id: 'b2', name: 'Colazione B', kcal: 350, macros: { protein_g: 18, carbs_g: 45, fat_g: 9 } },
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 600, macros: { protein_g: 35, carbs_g: 60, fat_g: 18 } },
    { id: 'd1', name: 'Cena A', kcal: 500, macros: { protein_g: 32, carbs_g: 40, fat_g: 16 } },
    { id: 'd2', name: 'Cena B', kcal: 700, macros: { protein_g: 40, carbs_g: 60, fat_g: 22 } },
  ];
  const tmpl = (dayIndex: number, b: string, l: string, d: string) => ({
    dayIndex,
    level: 1,
    meals: [{ slot: 'colazione', recipeId: b }, { slot: 'pranzo', recipeId: l }, { slot: 'cena', recipeId: d }],
  });

  function build(daycombo: boolean) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 3,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', levels: [{ level: 1, kcal: 1400 }] }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'b1', 'l1', 'd1'), tmpl(2, 'b2', 'l2', 'd2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((k: string, def?: boolean) => Promise.resolve(k === 'menu_daycombo_enabled' ? daycombo : (def ?? false))),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService,
      config as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      events as any,
      dietAgent as any,
      new DayComboService(),
    );
    return { service, prisma };
  }

  it('compone le giornate dentro la banda kcal del livello usando solo ricette del pool', async () => {
    const { service, prisma } = build(true);
    const created = await service.deliverIfEligible('u1');
    expect(created).toHaveLength(2);
    const poolIds = recipes.map((r) => r.id);
    for (const call of prisma.menuDay.upsert.mock.calls) {
      const meals = call[0].create.meals as { slot: string; recipeId: string; kcal: number }[];
      expect(meals.map((m) => m.slot)).toEqual(['colazione', 'pranzo', 'cena']);
      meals.forEach((m) => expect(poolIds).toContain(m.recipeId));
      const kcal = meals.reduce((a, m) => a + m.kcal, 0);
      expect(kcal).toBeGreaterThanOrEqual(1400 * 0.85);
      expect(kcal).toBeLessThanOrEqual(1400 * 1.15);
    }
  });

  it('con DayCombo spento eroga comunque i giorni (fallback ai template)', async () => {
    const { service, prisma } = build(false);
    const created = await service.deliverIfEligible('u1');
    expect(created).toHaveLength(2);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('MenuService — R11 penalità di ripetizione (varietà)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  const tmpl = (dayIndex: number, l: string) => ({ dayIndex, level: 1, meals: [{ slot: 'lunch', recipeId: l }] });

  function build(penalty: number, recentLunch: string[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      // findMany qui è consumata SOLO dalla penalità (le giornate recenti); ne conto le ripetizioni di l1.
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentLunch.map((r) => ({ meals: [{ slot: 'lunch', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: penalty, menu_repeat_window_days: 14 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('penalità attiva: la ricetta servita di recente viene evitata a favore dell\'alternativa', async () => {
    const { service, prisma } = build(1, ['l1', 'l1', 'l1']); // l1 ripetuta di recente
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']); // entrambe le giornate scelgono l2
  });

  it('penalità disattivata (0): resta la ricetta del template (comportamento invariato)', async () => {
    const { service, prisma } = build(0, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l2']); // template: giorno1 l1, giorno2 l2
  });
});

describe('MenuService — R12 modulazione da objective (mantenimento = efficacia neutra)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  const tmpl = (dayIndex: number, l: string) => ({ dayIndex, level: 1, meals: [{ slot: 'lunch', recipeId: l }] });

  function build(objective: string) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      // l2 = ricetta "che fa perdere di più" (efficacia appresa alta); l1 = più gradita.
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'l2', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'l1', stars: 5 }, { recipeId: 'l2', stars: 1 }]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      // R12: mantenimento = efficacia RIDOTTA ma non zero (0,1 quando il dimagrimento vale 1).
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_maintenance_w_eff: 0.1 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('DIMAGRIMENTO (w_eff=1): l\'efficacia appresa alta batte il gusto → vince l2', async () => {
    const { service, prisma } = build('dimagrimento');
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']); // efficacia 1.0 supera il gradimento di l1
  });

  it('MANTENIMENTO (w_eff=0,1): efficacia ridotta ma non zero → a gradimento più alto vince il gusto (l1)', async () => {
    const { service, prisma } = build('mantenimento');
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l1']); // l1 (5★) batte l2 (1★) perché l'efficacia pesa solo 0,1
  });
});

describe('MenuService — regola ripetizione bigiornaliera (menu_repeat_two_days)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // r1 e r2: stesso slot, stesse kcal, alimenti principali diversi (orata/branzino).
  // menuWeight su r1 → r1 vince lo scoring per ENTRAMBI i giorni (base = r1, r1).
  const recipes = [
    { id: 'r1', name: 'Orata al forno', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 }, ingredients: [{ name: 'Orata', qty: 150, unit: 'g' }] },
    { id: 'r2', name: 'Branzino in crosta', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 }, ingredients: [{ name: 'Branzino', qty: 150, unit: 'g' }] },
  ];
  const tmpl = (dayIndex: number, l: string) => ({ dayIndex, level: 1, meals: [{ slot: 'lunch', recipeId: l }] });

  // ruleEnabled: valore di ProductRule.enabled (null = regola non impostata → default off).
  function build(ruleEnabled: boolean | null, groups: { id: string; members: { items: string[] } }[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(ruleEnabled === null ? null : { enabled: ruleEnabled }) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue(groups) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'r1'), tmpl(2, 'r2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      // r1 con efficacia appresa alta → vince lo scoring in entrambi i giorni (base r1,r1).
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'r1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, repeat_twin_kcal_tolerance_pct: 15 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  const grp = [{ id: 'g1', members: { items: ['orata', 'branzino'] } }];

  it('regola OFF (default): il 2° giorno resta la ricetta composta dal motore (r1)', async () => {
    const { service, prisma } = build(null, grp);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r1']); // nessun override gemella
  });

  it('regola ON: il 2° giorno ripropone lo STESSO alimento con ricetta DIVERSA (gemella r2)', async () => {
    const { service, prisma } = build(true, grp);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r2']); // giorno1 orata → giorno2 branzino (stesso gruppo)
  });

  it('regola ON ma senza gruppo di equivalenza approvato: inerte, resta il pasto composto (r1)', async () => {
    const { service, prisma } = build(true, []); // il nutrizionista non ha ancora approvato gruppi
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r1']);
  });
});
