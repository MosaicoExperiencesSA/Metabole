import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';

// Il "menu a necessità" non è oggetto di questi test: il fabbisogno non è calcolabile
// (null) e il target kcal resta quello del livello della dieta (comportamento storico).
const kcalNeedStub = () => ({ computeTargetKcal: jest.fn().mockResolvedValue(null) }) as never;

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
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
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
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[key] ?? def),
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
        { provide: require('./kcal-need.service').KcalNeedService, useValue: kcalNeedStub() },
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

  it('buffer: ha già un menu per un giorno FUTURO → non eroga altro', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(1)) });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('ultimo giorno del ciclo (menu di oggi presente) + misura inviata → eroga SUBITO i 2 successivi', async () => {
    // Scelta prodotto (Simone): l'invio delle misure fa arrivare subito i prossimi giorni,
    // senza aspettare che finisca il ciclo corrente né il check-in del giorno dopo.
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(todayIso) });
    prisma.dailyCheckin.findUnique.mockResolvedValue(null); // il check-in NON è richiesto
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([daysFromToday(1), daysFromToday(2)]);
  });

  it('ultimo giorno del ciclo SENZA la misura → resta bloccato (gate misure)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(todayIso) });
    prisma.measurement.findFirst.mockResolvedValue(null); // manca la misura del ciclo
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti SENZA la misura del ciclo → resta bloccato (gate misure)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.measurement.findFirst.mockResolvedValue(null);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti CON la misura → eroga i 2 successivi (il check-in non è richiesto)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.dailyCheckin.findUnique.mockResolvedValue(null); // nessun check-in
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
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
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
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
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
      kcalNeedStub(),
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
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
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
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: penalty, menu_repeat_window_days: 14, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub());
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
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
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
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_maintenance_w_eff: 0.1, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub());
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
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
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
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, repeat_twin_kcal_tolerance_pct: 15, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub());
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

describe('MenuService — override PER DIETA (ProductRule) letto dal motore', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  const tmpl = (dayIndex: number, l: string) => ({ dayIndex, level: 1, meals: [{ slot: 'lunch', recipeId: l }] });

  // Global penalità = 0 (spenta). L'override per dieta la porta a `penaltyOverride`.
  function build(penaltyOverride: number | null, recentLunch: string[]) {
    const prisma: any = {
      productRule: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(
          penaltyOverride == null ? [] : [{ ruleCode: 'menu_penalty_repeat', enabled: true, params: { value: penaltyOverride } }],
        ),
      },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentLunch.map((r) => ({ meals: [{ slot: 'lunch', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    // Global: penalità 0 (spenta) e finestra 14. L'override deve avere la precedenza.
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_repeat_window_days: 14, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub());
    return { service, prisma };
  }
  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('senza override: penalità globale 0 → template invariato (l1, l2)', async () => {
    const { service, prisma } = build(null, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l2']);
  });

  it('override per dieta menu_penalty_repeat=1 → la ripetuta di recente (l1) viene evitata (l2, l2)', async () => {
    const { service, prisma } = build(1, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']);
  });
});

describe('MenuService — garanzia di varietà (menu_variety_min_gap_days)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // Due colazioni equivalenti come kcal: il pool offre sempre un'alternativa.
  const recipes = [
    { id: 'c1', name: 'Frittata spinaci e feta', kcal: 400, macros: { protein_g: 25, carbs_g: 35, fat_g: 14 } },
    { id: 'c2', name: 'Salmone affumicato e cream cheese', kcal: 400, macros: { protein_g: 25, carbs_g: 35, fat_g: 14 } },
  ];
  // Il pool della dieta contiene entrambe le colazioni, ma c1 ha efficacia appresa alta e
  // vince lo scoring TUTTI i giorni: senza guard la colazione resta identica (il reclamo).
  const tmpl = (dayIndex: number, c: string) => ({ dayIndex, level: 1, meals: [{ slot: 'colazione', recipeId: c }] });

  function build(gapDays: number, recentBreakfast: string[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'pescetarian', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentBreakfast.map((r) => ({ meals: [{ slot: 'colazione', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'c1'), tmpl(2, 'c2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'c1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      // Penalità spenta di proposito: qui si misura SOLO la garanzia dura di varietà.
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: gapDays } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub());
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'colazione')?.recipeId);

  it('nessun piatto due giorni di fila nello stesso pasto quando il pool offre un\'alternativa', async () => {
    const { service, prisma } = build(2, []);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(b).toHaveLength(2);
    expect(b[0]).not.toBe(b[1]); // ← il reclamo della cliente: colazione identica ogni giorno
  });

  it('tiene conto dei giorni GIÀ erogati: se ieri c\'era c1, oggi non torna c1', async () => {
    const { service, prisma } = build(2, ['c1', 'c1']);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)[0]).toBe('c2');
  });

  it('guard disattivato (0): comportamento storico, resta la ricetta del template', async () => {
    const { service, prisma } = build(0, ['c1', 'c1']);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)).toEqual(['c1', 'c1']); // il piatto migliore vince sempre
  });
});

// La preferenza "ricette semplici" RISCRIVE i pasti dopo il guard di varietà, pescando da un
// pool proprio (tutte le ricette difficulty="semplice" del regime). Quel pool è piccolo: se in
// banda kcal resta UNA sola ricetta, `dayIndex % 1` la ripropone ogni giorno e la garanzia di
// varietà applicata a monte viene annullata.
describe('MenuService — ricette semplici senza annullare la varietà', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const macros = { protein_g: 25, carbs_g: 35, fat_g: 14 };
  // Pool della dieta: due colazioni equivalenti (il guard può alternarle).
  const dietRecipes = [
    { id: 'c1', name: 'Frittata leggera spinaci e formaggio', kcal: 400, macros },
    { id: 'c2', name: 'Avocado toast integrale con uovo poché', kcal: 400, macros },
  ];
  const simple = (id: string, name: string) => ({ id, name, kcal: 400, macros, mealSlot: 'colazione', ingredients: [], difficulty: 'semplice' });
  const tmpl = (dayIndex: number, c: string) => ({ dayIndex, level: 1, meals: [{ slot: 'colazione', recipeId: c }] });

  function build(simplePool: ReturnType<typeof simple>[]) {
    const all = [...dietRecipes, ...simplePool];
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'pescetarian', dietStyle: 'mediterranean', mealsPerDay: 5,
          allergies: [], intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
          prefersSimpleRecipes: true, // ← la cliente ha attivato "preferisco ricette semplici"
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'c1'), tmpl(2, 'c2')]) },
      // Il pool "semplice" è una query a parte (difficulty='semplice'): va distinta.
      recipe: {
        findMany: jest.fn((args: any) => Promise.resolve(args?.where?.difficulty === 'semplice' ? simplePool : all)),
        findUnique: jest.fn(),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'c1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 2 } as Record<string, number>)[k] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(),
    );
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'colazione')?.recipeId);

  it('una sola ricetta semplice in banda: non la ripete due giorni, tiene il piatto del piano', async () => {
    const { service, prisma } = build([simple('s1', 'Salmone affumicato e cream cheese')]);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(b).toHaveLength(2);
    expect(b[0]).toBe('s1'); // la preferenza della cliente viene comunque soddisfatta
    expect(b[1]).not.toBe('s1'); // ← senza questo: 's1','s1' (la colazione bloccata del reclamo)
  });

  it('due ricette semplici in banda: le alterna, restando sempre sulle semplici', async () => {
    const { service, prisma } = build([simple('s1', 'Pane, ricotta e marmellata'), simple('s2', 'Yogurt greco con mela a fette')]);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(new Set(b).size).toBe(2);
    expect(b.every((id: string) => id === 's1' || id === 's2')).toBe(true);
  });
});

// La sostituzione dei cibi NON GRADITI è l'ULTIMO passaggio prima del salvataggio: riscrive i
// pasti già composti, quindi due suoi difetti annullavano tutto il lavoro fatto a monte.
// (1) Pescava dall'intero catalogo filtrato per il `regime` REGISTRATO sulla cliente, non dal
//     pool della dieta: è così che a un piano di pesce, registrato per errore `omnivore`,
//     finiva in tavola la carne.
// (2) Sceglieva in modo deterministico il candidato più vicino in kcal, senza storico: lo
//     stesso identico sostituto ogni giorno, cioè la ripetitività del reclamo.
// Il caso qui sotto riproduce la cliente reale: colazioni del piano che contengono un cibo
// non gradito ("avena"), un pool di dieta con due alternative buone e un catalogo che offre
// un'alternativa PIÙ VICINA in kcal — che però non deve mai essere scelta.
describe('MenuService — sostituzione dei non graditi dentro il pool della dieta', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const macros = { protein_g: 25, carbs_g: 35, fat_g: 14 };
  const R = (id: string, name: string, kcal: number) => ({ id, name, kcal, macros, mealSlot: 'colazione', ingredients: [], active: true, difficulty: 'media' });
  // Pool della dieta: i due piatti del piano contengono "avena" (non gradita) e vanno cambiati;
  // a2/a3 sono le uniche alternative del pool, identiche in kcal fra loro e LONTANE dai piatti
  // del piano — così restano fuori dalla banda del compositore e a toccarle è solo lo swap.
  const dietRecipes = [
    R('d1', 'Porridge di avena e frutti di bosco', 400),
    R('d2', 'Barretta di avena, miele e mandorle', 400),
    R('a2', 'Ricotta, pere e pane integrale', 300),
    R('a3', 'Yogurt greco con mirtilli', 300),
  ];
  // Catalogo per regime: carne, e con kcal IDENTICHE al piatto da sostituire. Se lo swap
  // interrogasse il catalogo (o lo interrogasse per primo) vincerebbe questa.
  const catalogRecipes = [R('x1', 'Bresaola, grana e rucola', 400)];
  const tmpl = (dayIndex: number, c: string) => ({ dayIndex, level: 1, meals: [{ slot: 'colazione', recipeId: c }] });

  function build(gapDays: number) {
    const byId = new Map(dietRecipes.concat(catalogRecipes).map((r) => [r.id, r]));
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          allergies: [], intolerances: [], dislikedFoods: ['Avena'], assignedNutritionistId: null,
          prefersSimpleRecipes: false,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'd1'), tmpl(2, 'd2'), tmpl(3, 'a2'), tmpl(4, 'a3')]) },
      // Due query distinte: per `id in [...]` (pool della dieta) e per `mealSlot` + regime
      // (catalogo). Tenerle separate è ciò che rende il test capace di distinguerle.
      recipe: {
        findMany: jest.fn((args: any) => {
          const ids = args?.where?.id?.in as string[] | undefined;
          if (ids) return Promise.resolve(ids.map((i) => byId.get(i)).filter(Boolean));
          if (args?.where?.mealSlot) return Promise.resolve(catalogRecipes);
          return Promise.resolve(dietRecipes);
        }),
        findUnique: jest.fn(),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: gapDays } as Record<string, number>)[k] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(),
    );
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'colazione')?.recipeId);

  it('il sostituto viene dal pool della dieta, non dal catalogo per regime', async () => {
    const { service, prisma } = build(2);
    const b = (await service.deliverIfEligible('u1'), breakfastsOf(prisma));
    expect(b).toHaveLength(2);
    // ← senza il pool-first: 'x1','x1' — carne, in un piano che di carne non ne ha.
    expect(b).not.toContain('x1');
    expect(b.every((id: string) => id === 'a2' || id === 'a3')).toBe(true);
  });

  it('non ripropone lo stesso sostituto due giorni di fila', async () => {
    const { service, prisma } = build(2);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    // ← senza lo storico: 'a2','a2' — a parità di kcal vince sempre lo stesso id.
    expect(b[0]).not.toBe(b[1]);
  });

  it('il catalogo resta la rete di sicurezza quando la dieta non offre alternative', async () => {
    const { service, prisma } = build(2);
    // Pool ridotto ai soli piatti con avena: dentro la dieta non c'è niente di accettabile.
    prisma.dietDayTemplate.findMany.mockResolvedValue([tmpl(1, 'd1'), tmpl(2, 'd2')]);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)).toEqual(['x1', 'x1']); // meglio la carne che un piatto non gradito
  });
});

// «Sostituzioni: aggiungerei la casella SOLO PER OGGI. Se mi piace l'alimento ma per tot motivo
// non ce l'ho nella giornata odierna, non significa che devo toglierlo per più gg.»
// Prima esisteva una sola portata — tre giorni — e un popup che DOPO l'applicazione chiedeva se
// escludere per sempre. "Oggi non ce l'ho in casa" e "questo cibo non mi piace" finivano nello
// stesso posto, e la seconda restringe il pool di TUTTI i menu futuri: è la causa documentata
// della ripetitività in REGISTRO_Varieta_Menu.md. Qui verifico che le tre portate siano
// davvero distinte, e soprattutto che solo `forever` tocchi il profilo.
describe('MenuService — portata della sostituzione (solo oggi / questi giorni / per sempre)', () => {
  const macros = { protein_g: 20, carbs_g: 30, fat_g: 12 };
  const ing = (...names: string[]) => names.map((name) => ({ name, qty_g: 50 }));
  // Il piatto del piano ha l'avena NEL NOME: è il caso che fa scattare il cambio di piatto.
  const planDish = { id: 'p1', name: 'Porridge di avena e frutti di bosco', kcal: 400, macros, mealSlot: 'colazione', ingredients: ing('avena', 'mirtilli'), active: true, difficulty: 'media' };
  const altDish = { id: 'alt1', name: 'Yogurt greco con mirtilli', kcal: 400, macros, mealSlot: 'colazione', ingredients: ing('yogurt greco', 'mirtilli'), active: true, difficulty: 'facile' };
  const meal = () => [{ slot: 'colazione', recipeId: 'p1', name: planDish.name, kcal: 400, ...macros }];

  function build() {
    const byId = new Map([planDish, altDish].map((r) => [r.id, r]));
    // Tre giorni erogati da oggi in poi. Il mock rispetta `take`, così il numero di giorni
    // toccati è una conseguenza del codice e non del mock.
    const allDays = [0, 1, 2].map((n) => ({
      id: `md${n}`,
      date: new Date(Date.now() + n * 86_400_000),
      meals: meal(),
    }));
    const prisma: any = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ regime: 'omnivore', intolerances: [], dislikedFoods: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
      menuDay: {
        findMany: jest.fn((args: any) => Promise.resolve(allDays.slice(0, args?.take ?? allDays.length))),
        update: jest.fn().mockResolvedValue({}),
      },
      recipe: {
        findMany: jest.fn((args: any) => {
          const ids = args?.where?.id?.in as string[] | undefined;
          if (ids) return Promise.resolve(ids.map((i) => byId.get(i)).filter(Boolean));
          return Promise.resolve([altDish]); // catalogo per slot
        }),
      },
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = { getNumber: jest.fn((_k: string, def?: number) => Promise.resolve(def)), getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)) };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(),
    );
    return { service, prisma };
  }

  it('"solo per oggi": tocca un giorno soltanto', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena', 'today');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(1); // ← col vecchio take:3 fisso: 3
    expect(new Set(res.applied.map((a) => a.day)).size).toBe(1);
    expect(res.scope).toBe('today');
  });

  it('"questi giorni" resta il comportamento storico: tre giorni', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena', 'days');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(3);
    expect(new Set(res.applied.map((a) => a.day)).size).toBe(3);
  });

  it('senza portata indicata il default è "questi giorni" (le app già installate non cambiano)', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(3);
    expect(res.scope).toBe('days');
  });

  it('solo "per sempre" scrive nei cibi non graditi del profilo', async () => {
    const { service, prisma } = build();
    await service.substituteDisliked('u1', 'avena', 'today');
    await service.substituteDisliked('u1', 'avena', 'days');
    // ← il punto del reclamo: un "oggi non ce l'ho" NON deve restringere i menu futuri.
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();

    await service.substituteDisliked('u1', 'avena', 'forever');
    expect(prisma.clientProfile.update).toHaveBeenCalledTimes(1);
    expect(prisma.clientProfile.update.mock.calls[0][0].data.dislikedFoods).toContain('avena');
  });

  it('il messaggio dice per quanto vale davvero', async () => {
    const { service } = build();
    const oggi = await service.substituteDisliked('u1', 'avena', 'today');
    expect(oggi.message).toContain('nel menu di oggi');
    expect(oggi.message).toContain('Da domani torna disponibile');
    // ← senza il messaggio parametrico: "nei prossimi menu" anche a chi ha chiesto solo oggi.
    expect(oggi.message).not.toContain('prossimi due giorni');

    const giorni = await service.substituteDisliked('u1', 'avena', 'days');
    expect(giorni.message).toContain('prossimi due giorni');

    const sempre = await service.substituteDisliked('u1', 'avena', 'forever');
    expect(sempre.message).toContain('non comparirà più');
  });
});
