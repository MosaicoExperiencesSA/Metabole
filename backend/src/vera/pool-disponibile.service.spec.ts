import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { PoolDisponibileService } from './pool-disponibile.service';

/**
 * ⚠️ Il test che conta di più in questo file è «l'anteprima non salva niente».
 *
 * È lo stesso di `nutritionist.service.spec.ts` per `simulaKcal`, e per la stessa ragione: una
 * funzione che si chiama «anteprima» e scrive è peggio di una che scrive e basta, perché nessuno va
 * a controllare. Qui i metodi di scrittura di Prisma non sono nemmeno definiti nel finto: se il
 * servizio ne chiamasse uno, il test esploderebbe invece di passare in silenzio.
 */

const RICETTE = [
  { id: 'r1', name: 'Branzino al forno', ingredients: [{ name: 'branzino' }] },
  { id: 'r2', name: 'Insalata di tonno', ingredients: [{ name: 'tonno' }] },
  { id: 'r3', name: 'Caprese', ingredients: [{ name: 'mozzarella' }, { name: 'pomodori' }] },
];

const makePrisma = (over: Record<string, unknown> = {}) =>
  ({
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Giulia',
        regime: 'omnivore',
        dietStyle: 'mediterranean',
        dietFamily: null,
        mealsPerDay: 3,
        objective: 'dimagrimento',
        pathType: null,
        allergies: [],
        intolerances: [],
        dislikedFoods: [],
      }),
    },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Mediterranea' }) },
    dietDayTemplate: {
      findMany: jest.fn().mockResolvedValue([
        { meals: [{ slot: 'dinner', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }, { slot: 'lunch', recipeId: 'r3' }] },
      ]),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(RICETTE) },
    ...over,
  }) as unknown as PrismaService;

const makeConfig = (soglia = 3) =>
  ({ getNumber: jest.fn().mockResolvedValue(soglia) }) as unknown as ConfigParamsService;

describe('PoolDisponibileService.anteprima', () => {
  it('NON salva niente: nessun metodo di scrittura di Prisma è nemmeno disponibile', async () => {
    const prisma = makePrisma();
    const service = new PoolDisponibileService(prisma, makeConfig());
    await service.anteprima('c1', ['tonno']);
    // Se un giorno qualcuno aggiungesse una scrittura qui dentro, il finto non avrebbe il metodo e
    // la chiamata fallirebbe: è il tipo di verifica che regge anche quando cambia chi scrive.
    for (const modello of ['clientProfile', 'diet', 'dietDayTemplate', 'recipe'] as const) {
      const m = (prisma as unknown as Record<string, Record<string, unknown>>)[modello];
      expect(m.create).toBeUndefined();
      expect(m.update).toBeUndefined();
      expect(m.upsert).toBeUndefined();
      expect(m.updateMany).toBeUndefined();
      expect(m.delete).toBeUndefined();
    }
  });

  it('mostra il prima e il dopo, e racconta cosa cambia', async () => {
    const service = new PoolDisponibileService(makePrisma(), makeConfig());
    const esito = await service.anteprima('c1', ['tonno']);
    expect(esito.prima.totaleRestanti).toBe(3);
    expect(esito.dopo.totaleRestanti).toBe(2);
    expect(esito.racconto).toContain('toglie 1 ricetta');
    expect(esito.dieta).toEqual({ id: 'd1', nome: 'Mediterranea' });
  });

  it('senza termini in più il «dopo» è identico al «prima»', async () => {
    const service = new PoolDisponibileService(makePrisma(), makeConfig());
    const esito = await service.anteprima('c1');
    expect(esito.dopo.totaleRestanti).toBe(esito.prima.totaleRestanti);
    expect(esito.aggiunti).toEqual([]);
  });

  it('parte dalle esclusioni che la cliente ha GIÀ, non dal catalogo pieno', async () => {
    // Se il «prima» ignorasse le sue intolleranze, la nutrizionista vedrebbe un pool più grande di
    // quello vero e la regola sembrerebbe meno pesante di quanto è.
    const prisma = makePrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Giulia', regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: null,
          mealsPerDay: 3, objective: 'dimagrimento', pathType: null,
          allergies: [], intolerances: ['lactose'], dislikedFoods: [],
        }),
      },
    });
    const service = new PoolDisponibileService(prisma, makeConfig());
    const esito = await service.anteprima('c1');
    // `lactose` → alias `lattosio` → i derivati del latte: la caprese esce già in partenza.
    expect(esito.prima.totaleRestanti).toBe(2);
  });

  it('se la cliente non ha una dieta abbinata non esplode: pool vuoto e nessuna dieta', async () => {
    const service = new PoolDisponibileService(
      makePrisma({ diet: { findFirst: jest.fn().mockResolvedValue(null) } }),
      makeConfig(),
    );
    const esito = await service.anteprima('c1', ['tonno']);
    expect(esito.dieta).toBeNull();
    expect(esito.dopo.totaleRestanti).toBe(0);
  });

  it('una ricetta sparita dal catalogo non conta come disponibile', async () => {
    const service = new PoolDisponibileService(
      makePrisma({ recipe: { findMany: jest.fn().mockResolvedValue([RICETTE[0]]) } }),
      makeConfig(),
    );
    const esito = await service.anteprima('c1');
    expect(esito.prima.totaleRestanti).toBe(1);
  });
});

describe('PoolDisponibileService.alternativeInCatalogo', () => {
  it('propone solo piatti che ESISTONO e che la cliente può mangiare', async () => {
    const prisma = makePrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Giulia', regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: null,
          mealsPerDay: 3, objective: 'dimagrimento', pathType: null,
          allergies: [], intolerances: [], dislikedFoods: ['tonno'],
        }),
      },
    });
    const service = new PoolDisponibileService(prisma, makeConfig());
    const alt = await service.alternativeInCatalogo('c1', 'dinner');
    expect(alt.map((a) => a.name)).toEqual(['Branzino al forno']);
  });

  it('senza dieta non inventa niente: elenco vuoto', async () => {
    const service = new PoolDisponibileService(
      makePrisma({ diet: { findFirst: jest.fn().mockResolvedValue(null) } }),
      makeConfig(),
    );
    expect(await service.alternativeInCatalogo('c1', 'dinner')).toEqual([]);
  });
});
