import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { DayComboService } from './day-combo.service';
import { esclusioniDi, ricetteNonSicure, valutaRicetta } from './esclusioni-della-cliente';

import { comeDalDatabase } from './come-dal-database';
/**
 * NON SI PROPONE QUELLO CHE POI SI VIETA — il caso Sonia (21/8).
 *
 * Sei allergie dichiarate (fra cui molluschi e solfiti) e **zero menu erogati**. La segnalazione
 * diceva perché: la giornata composta conteneva «Polpo grigliato» e «Bresaola», e la guardia
 * fermava tutta l'erogazione. Il blocco era giusto: era la **scelta** a essere sbagliata, perché il
 * pool da cui il motore pesca non toglieva le ricette che lei non può mangiare — nel pool c'erano
 * altri piatti, e nessuno li stava preferendo.
 *
 * ⚠️ Questi test guardano due cose che devono restare vere insieme: che il filtro tolga i piatti
 * giusti, e che tolga **esattamente** quelli che la guardia vieterebbe. Se un giorno divergono, una
 * cliente resta ferma senza che nessuno capisca perché.
 */
describe('le esclusioni della cliente escono dal pool, non fermano il piatto in tavola', () => {
  const SONIA = {
    allergies: ['molluschi', 'solfiti', 'pesce'],
    intolerances: [],
    dislikedFoods: [],
  };
  const POLPO = {
    id: 'r-polpo',
    name: 'Polpo grigliato con orzo perlato',
    ingredients: [{ name: 'polpo' }, { name: 'orzo perlato' }],
    allergens: ['molluschi'],
  };
  const POLLO = {
    id: 'r-pollo',
    name: 'Pollo alle erbe con patate',
    ingredients: [{ name: 'petto di pollo' }, { name: 'patate' }],
    allergens: [],
  };

  it('⛔ il piatto che la guardia vieterebbe esce dal pool PRIMA che venga scelto', () => {
    const e = esclusioniDi(SONIA);
    const fuori = ricetteNonSicure([POLPO, POLLO], e);
    expect([...fuori.keys()]).toEqual(['r-polpo']);
    expect(fuori.get('r-polpo')).toContain('Molluschi');
  });

  it('il filtro e la guardia dicono la STESSA cosa su ogni ricetta', () => {
    const e = esclusioniDi(SONIA);
    const fuori = ricetteNonSicure([POLPO, POLLO], e);
    for (const r of [POLPO, POLLO]) {
      const vietata = valutaRicetta(r, e).violations.length > 0;
      expect(fuori.has(r.id)).toBe(vietata);
    }
  });

  it('una ricetta solo SOSTITUIBILE resta nel pool: il piatto si eroga con la sostituzione', () => {
    const e = esclusioniDi({ allergies: [], intolerances: [], dislikedFoods: ['pomodoro'] });
    const conPomodoro = { id: 'r-pom', name: 'Pasta al pomodoro', ingredients: [{ name: 'pomodoro' }], allergens: [] };
    // Non gradito: non blocca mai — quindi non esce dal pool.
    expect(ricetteNonSicure([conPomodoro], e).size).toBe(0);
  });

  it('senza allergie, intolleranze e cibi esclusi non si filtra niente', () => {
    const e = esclusioniDi({ allergies: [], intolerances: [], dislikedFoods: [] });
    expect(e.vuoto).toBe(true);
    expect(ricetteNonSicure([POLPO, POLLO], e).size).toBe(0);
  });

  // ---------- il pool vero, dentro `buildScoringContext` ----------

  const creaServizio = (ricette: Record<string, unknown>[]) => {
    const prisma = {
      recipe: { findMany: jest.fn().mockResolvedValue(comeDalDatabase(ricette)) },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MenuService(
      prisma as unknown as PrismaService,
      { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0), getString: jest.fn() } as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null), pausaAppenaFinita: jest.fn().mockResolvedValue(null) } as never,
      { stateFor: jest.fn().mockResolvedValue('normale') } as never,
      new DayComboService(),
      { computeTargetKcal: jest.fn().mockResolvedValue(null) } as never,
      { sendToUser: jest.fn() } as never,
    );
    // Privata di proposito: qui si chiama per nome perché il pool è esattamente ciò che cambia.
    const pool = (templates: unknown[], esclusioni: unknown) =>
      (service as unknown as {
        buildScoringContext(
          c: string, regime: string, t: unknown[], s?: unknown, o?: string, ov?: unknown, v?: string[], e?: unknown,
        ): Promise<{ slotPool: Map<string, Set<string>> } | null>;
      }).buildScoringContext('c1', 'omnivore', templates, 'normale', 'dimagrimento', new Map(), [], esclusioni);
    return { pool };
  };

  const conRicette = (...ids: string[]) => [{ meals: ids.map((id) => ({ slot: 'lunch', recipeId: id })) }];

  it('⛔ il polpo non è più fra i candidati per il pranzo', async () => {
    const { pool } = creaServizio([{ ...POLPO, kcal: 400, macros: {}, seasons: [] }, { ...POLLO, kcal: 450, macros: {}, seasons: [] }]);
    const ctx = await pool(conRicette('r-polpo', 'r-pollo'), esclusioniDi(SONIA));
    expect([...(ctx!.slotPool.get('lunch') ?? [])]).toEqual(['r-pollo']);
  });

  it('⚠️ uno slot che resterebbe VUOTO non si svuota: a fermare la giornata è la guardia, che sa dire perché', async () => {
    const { pool } = creaServizio([{ ...POLPO, kcal: 400, macros: {}, seasons: [] }]);
    const ctx = await pool(conRicette('r-polpo'), esclusioniDi(SONIA));
    // Il pool resta com'era: svuotarlo qui vorrebbe dire una giornata senza un pasto, in silenzio.
    expect([...(ctx!.slotPool.get('lunch') ?? [])]).toEqual(['r-polpo']);
  });

  it('senza esclusioni il pool è quello di sempre', async () => {
    const { pool } = creaServizio([{ ...POLPO, kcal: 400, macros: {}, seasons: [] }, { ...POLLO, kcal: 450, macros: {}, seasons: [] }]);
    const ctx = await pool(conRicette('r-polpo', 'r-pollo'), null);
    expect([...(ctx!.slotPool.get('lunch') ?? [])].sort()).toEqual(['r-pollo', 'r-polpo']);
  });
});
