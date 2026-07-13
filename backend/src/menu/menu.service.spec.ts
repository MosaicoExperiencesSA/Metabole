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
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(todayIso),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
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
      getNumber: jest.fn((key: string) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[key]),
      ),
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
