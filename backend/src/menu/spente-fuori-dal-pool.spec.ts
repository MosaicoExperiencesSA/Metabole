import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { DayComboService } from './day-combo.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { comeDalDatabase } from './come-dal-database';

/**
 * UNA BOZZA MAI VALIDATA NON ARRIVA NEL PIATTO — §2.4 del piano panieri, 1/9.
 *
 * Il pool chiedeva le ricette per id e basta: una ricetta archiviata, o una bozza scritta
 * dall'agente notturno e che nessuno ha ancora guardato, se stava nel pool veniva servita.
 *
 * ⚠️ Questi test guardano il pool **dentro** `buildScoringContext`, non la funzione pura: quella ha
 * i suoi in `togli-dal-pool.spec.ts`. Qui si prova il collegamento — che è il pezzo che l'1/9 era
 * scritto e non esercitato, perché i finti Prisma non rendevano `active`.
 */
describe('le ricette spente escono dal pool', () => {
  const VIVA = { id: 'r-viva', name: 'Pollo alle erbe', kcal: 450, macros: {}, seasons: [], ingredients: [], allergens: [], active: true };
  const BOZZA = { id: 'r-bozza', name: 'Bozza dell\'agente', kcal: 460, macros: {}, seasons: [], ingredients: [], allergens: [], active: false };

  const creaServizio = (ricette: object[]) => {
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
    const pool = (templates: unknown[]) =>
      (service as unknown as {
        buildScoringContext(
          c: string, regime: string, t: unknown[], s?: unknown, o?: string, ov?: unknown, v?: string[], e?: unknown,
        ): Promise<{ slotPool: Map<string, Set<string>> } | null>;
      }).buildScoringContext('c1', 'omnivore', templates, 'normale', 'dimagrimento', new Map(), [], null);
    return { pool };
  };

  const conRicette = (...ids: string[]) => [{ meals: ids.map((id) => ({ slot: 'lunch', recipeId: id })) }];

  it('⛔ la bozza non è più fra i candidati per il pranzo', async () => {
    const { pool } = creaServizio([VIVA, BOZZA]);
    const ctx = await pool(conRicette('r-viva', 'r-bozza'));
    expect([...(ctx!.slotPool.get('lunch') ?? [])]).toEqual(['r-viva']);
  });

  it('⚠️ uno slot fatto SOLO di spente non si svuota: una giornata con un buco sarebbe un danno nuovo', async () => {
    const { pool } = creaServizio([BOZZA]);
    const ctx = await pool(conRicette('r-bozza'));
    expect([...(ctx!.slotPool.get('lunch') ?? [])]).toEqual(['r-bozza']);
  });

  it('un pool tutto attivo resta quello di sempre', async () => {
    const { pool } = creaServizio([VIVA, { ...BOZZA, active: true }]);
    const ctx = await pool(conRicette('r-viva', 'r-bozza'));
    expect([...(ctx!.slotPool.get('lunch') ?? [])].sort()).toEqual(['r-bozza', 'r-viva']);
  });

  it('⛔ il filtro tocca lo slot giusto e lascia stare gli altri', async () => {
    const { pool } = creaServizio([VIVA, BOZZA, { ...VIVA, id: 'r-cena' }]);
    const ctx = await pool([{ meals: [
      { slot: 'lunch', recipeId: 'r-viva' },
      { slot: 'lunch', recipeId: 'r-bozza' },
      { slot: 'dinner', recipeId: 'r-cena' },
    ] }]);
    expect([...(ctx!.slotPool.get('lunch') ?? [])]).toEqual(['r-viva']);
    expect([...(ctx!.slotPool.get('dinner') ?? [])]).toEqual(['r-cena']);
  });
});

/**
 * ⛔ **LA SENTINELLA: LA QUERY DEL POOL DEVE CHIEDERE `active`.**
 *
 * Togliere `active: true` dalla `select` è una parola, e nessuno dei test qui sopra se ne accorge:
 * il finto Prisma rende quello che gli si dice, la `select` non la guarda. In produzione invece
 * `ricetteSpente` griderebbe a ogni composizione di ogni cliente — rumoroso, ma scoperto tardi.
 *
 * ⚠️ Cerca la chiamata che legge il pool (`id: { in: [...poolIds] }`), non il file intero: un
 * `active` che compare da qualche altra parte in quattromila righe non è questa promessa.
 */
describe('sentinella: la query del pool chiede `active`', () => {
  it('⛔ la findMany che legge il pool ha `active: true` nella select', () => {
    const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');
    const chiamata = src.match(/recipe\.findMany\(\{ where: \{ id: \{ in: \[\.\.\.poolIds\] \} \}[^\n]*/);
    expect(chiamata).not.toBeNull();
    expect(chiamata![0]).toContain('active: true');
  });
});
