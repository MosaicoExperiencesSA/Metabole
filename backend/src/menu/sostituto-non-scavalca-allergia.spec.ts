/**
 * ⛔ **IL SOSTITUTO NON SCAVALCA UN'ALLERGIA — il caso Sonia, 31/8.**
 *
 * `diag:allergeni-piatto` in produzione: **1 cliente, 3 pasti**. Sonia — allergica a crostacei,
 * pesce, solfiti, lupini, molluschi e soia, e **senza intolleranze** — aveva in menu «Gamberoni al
 * cartoccio con miglio e zucchine», con la parola *crostacei* **e** il tag allergene confermato.
 *
 * ## Come ci arrivava
 *
 * `swapDislikedDishes` cambia un piatto quando contiene un cibo **non gradito**. Leggeva il profilo
 * così: `select: { regime, intolerances, dislikedFoods }` — **le allergie non c'erano**. Quindi
 * l'insieme degli esclusi non le conteneva, il candidato si giudicava sul solo **testo**, e i tag
 * allergene non si leggevano affatto.
 *
 * ⛔ E soprattutto: questo pezzo gira **dopo** `evaluateMeals`, e dopo di lui non c'è nessun altro
 * controllo. La guardia approvava la giornata, poi il sostituto ci infilava dentro l'allergene.
 *
 * ⚠️ **È il verso pericoloso.** Lo stesso giorno, il caso Patrizia sbaglia per eccesso di prudenza:
 * non eroga. Questo eroga — e mette un allergene nel piatto di una persona.
 *
 * Queste prove tengono ferme le due metà: che il sostituto passi dalla **stessa** `valutaRicetta`
 * della guardia, e che i **tag** contino quanto le parole.
 */
import { esclusioniDi, valutaRicetta } from './esclusioni-della-cliente';
import { MenuService } from './menu.service';
import type { AuditService } from '../audit/audit.service';
import type { ConfigParamsService } from '../config-params/config-params.service';
import type { PrismaService } from '../prisma/prisma.service';

/** Sonia, com'è in produzione: allergie sì, intolleranze no. */
const SONIA = {
  allergies: ['crostacei', 'pesce', 'solfiti', 'lupini', 'molluschi', 'soia'],
  intolerances: [],
  dislikedFoods: ['zucchine'],
};

const GAMBERONI = {
  id: 'r-gamberoni',
  name: 'Gamberoni al cartoccio con miglio e zucchine',
  ingredients: [{ name: 'gamberoni' }, { name: 'miglio' }, { name: 'zucchine' }],
  allergens: ['crostacei'],
};
/** Il caso che il filtro per TESTO non può vedere: l'allergene sta solo nel tag. */
const TAG_MUTO = {
  id: 'r-tag',
  name: 'Insalata dell\'orto con crema di stagione',
  ingredients: [{ name: 'lattuga' }, { name: 'crema vegetale' }],
  allergens: ['soia'],
};
const SICURO = {
  id: 'r-sicuro',
  name: 'Pollo alle erbe con patate',
  ingredients: [{ name: 'petto di pollo' }, { name: 'patate' }],
  allergens: [],
};

describe('un sostituto non può contenere un allergene della cliente', () => {
  const e = esclusioniDi(SONIA as never);

  it('⛔ IL CASO SONIA: i gamberoni non sono un sostituto valido per un\'allergica ai crostacei', () => {
    expect(valutaRicetta(GAMBERONI as never, e).violations.length).toBeGreaterThan(0);
  });

  it('⛔ e il tag da solo basta: un piatto che l\'allergene non lo NOMINA resta fuori', () => {
    // Nessuna parola sospetta nel nome né negli ingredienti: solo il tag `soia`.
    const testo = (TAG_MUTO.name + ' ' + TAG_MUTO.ingredients.map((i) => i.name).join(' ')).toLowerCase();
    expect(testo).not.toContain('soia');
    expect(valutaRicetta(TAG_MUTO as never, e).violations.length).toBeGreaterThan(0);
  });

  it('un piatto senza i suoi allergeni resta un sostituto valido: non si chiude più del necessario', () => {
    expect(valutaRicetta(SICURO as never, e).violations).toEqual([]);
  });

  it('⚠️ le allergie contano ANCHE senza intolleranze — è il profilo di Sonia', () => {
    // La vecchia strada usciva subito quando non c'erano intolleranze né non graditi.
    const soloAllergie = esclusioniDi({ allergies: ['crostacei'], intolerances: [], dislikedFoods: [] } as never);
    expect(soloAllergie.vuoto).toBe(false);
    expect(valutaRicetta(GAMBERONI as never, soloAllergie).violations.length).toBeGreaterThan(0);
  });
});

describe('il codice del sostituto chiede quello che gli serve per giudicare', () => {
  const sorgente = require('fs').readFileSync(`${__dirname}/menu.service.ts`, 'utf8') as string;
  const funzione = sorgente.slice(
    sorgente.indexOf('private async swapDislikedDishes'),
    sorgente.indexOf('/**', sorgente.indexOf('return swapped;')),
  );

  it('⛔ legge le ALLERGIE dal profilo: senza, l\'insieme degli esclusi non le contiene', () => {
    expect(funzione).toMatch(/select:\s*\{[^}]*allergies:\s*true/);
  });

  it('⛔ giudica il candidato con la STESSA funzione della guardia, non con un secondo elenco', () => {
    expect(funzione).toContain('valutaRicetta(');
  });

  it('⚠️ e chiede i TAG allergene: senza, `valutaRicetta` guarda un elenco vuoto', () => {
    // Tutte e due le query dei candidati — quella della dieta e quella del catalogo.
    const conTag = funzione.match(/allergens:\s*true/g) ?? [];
    expect(conTag.length).toBeGreaterThanOrEqual(2);
  });
});


/**
 * ⛔ **LA PROVA CHE GUARDA IL COMPORTAMENTO, non il sorgente.**
 *
 * Le prove strutturali qui sopra cadono se qualcuno TOGLIE la chiamata. Non cadono se qualcuno la
 * neutralizza — `return true || valutaRicetta(…)` le lascia tutte verdi, ed è precisamente la forma
 * che una mutazione ha trovato. Questa invece chiama `swapDislikedDishes` davvero.
 */
describe('swapDislikedDishes — il sostituto pericoloso non viene scelto', () => {
  /** Il piatto di partenza contiene un NON GRADITO: è quello che fa scattare lo scambio. */
  const pasto = () => ({ slot: 'lunch', recipeId: 'r-partenza', name: 'Insalata di zucchine e ceci', kcal: 400 });

  function servizio(candidato: { id: string; name: string; kcal: number; ingredients: unknown; allergens: string[] }) {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          regime: 'omnivore',
          allergies: ['crostacei', 'soia'],
          intolerances: [],
          dislikedFoods: ['zucchine'],
        }),
      },
      recipe: {
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          // 1° giro: gli ingredienti dei pasti in tavola (per riconoscere il non gradito).
          if (where.id && !where.active) {
            return Promise.resolve([{ id: 'r-partenza', ingredients: [{ name: 'zucchine' }, { name: 'ceci' }] }]);
          }
          // 2°/3° giro: i candidati (pool della dieta, poi catalogo). Qui ce n'è uno solo.
          return Promise.resolve([candidato]);
        }),
      },
    };
    const s = new MenuService(
      prisma as unknown as PrismaService,
      {} as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );
    return s as unknown as {
      swapDislikedDishes: (
        c: string, m: ReturnType<typeof pasto>[], d: string[],
      ) => Promise<{ from: string; to: string }[]>;
    };
  }

  it('⛔ IL CASO SONIA: l\'unico candidato ha il suo allergene → il piatto NON si cambia', async () => {
    const s = servizio(GAMBERONI as never);
    const meals = [pasto()];
    const fatti = await s.swapDislikedDishes('sonia', meals, ['zucchine']);
    expect(fatti).toEqual([]);
    expect(meals[0].recipeId).toBe('r-partenza'); // resta il suo, che la guardia aveva già approvato
  });

  it('⛔ e vale anche quando l\'allergene sta SOLO nel tag: il testo non basta a vederlo', async () => {
    const s = servizio(TAG_MUTO as never);
    const meals = [pasto()];
    expect(await s.swapDislikedDishes('sonia', meals, ['zucchine'])).toEqual([]);
    expect(meals[0].recipeId).toBe('r-partenza');
  });

  it('✅ un candidato sicuro invece viene scelto: non si è chiuso più del necessario', async () => {
    const s = servizio(SICURO as never);
    const meals = [pasto()];
    const fatti = await s.swapDislikedDishes('sonia', meals, ['zucchine']);
    expect(fatti).toEqual([{ from: 'Insalata di zucchine e ceci', to: 'Pollo alle erbe con patate' }]);
    expect(meals[0].recipeId).toBe('r-sicuro');
  });
});
