import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { DayComboService } from './day-combo.service';

/**
 * LE ALLERGIE DENTRO LA GUARDIA CHE COMPONE IL MENU.
 *
 * `evaluateMeals` è la funzione che i commenti del motore chiamano «la sicurezza» (§2/§7).
 * Fino al 20/8 costruiva le esclusioni da **intolleranze** e **cibi non graditi**: le allergie si
 * leggevano solo per la regola del delattosato, e la riga di uscita rapida
 * (`if (!intolerances.length && !dislikes.length) return …`) faceva uscire senza guardare niente
 * chi aveva dichiarato **soltanto allergie** — in produzione, otto clienti su nove.
 *
 * ⛔ Si è potuto correggere perché è stato **misurato prima**: `npm run diag:allergeni-piatto` ha
 * detto zero clienti e zero pasti, cioè le diete assegnate erano già scelte bene e questa è una
 * rete che oggi non toglie niente a nessuno. Con un numero diverso una violazione qui **ferma
 * l'erogazione del menu**, e prima si sarebbero sistemati quei piatti.
 */
describe('evaluateMeals — le allergie bloccano come le intolleranze', () => {
  /** Il minimo per costruire il servizio: questi test guardano una funzione sola. */
  const crea = (profilo: Record<string, unknown>, ricette: Record<string, unknown>[]) => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) },
      recipe: { findMany: jest.fn().mockResolvedValue(ricette) },
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
    // `evaluateMeals` è privata di proposito: il suo esito è la sicurezza del menu, non un'API.
    // Qui si chiama per nome perché è l'unico punto in cui quel giudizio si vede da solo.
    const valuta = (pasti: { slot: string; recipeId: string; name: string }[]) =>
      (service as unknown as {
        evaluateMeals(c: string, m: unknown[], e?: string[]): Promise<{ violations: string[]; subsByRecipe: Record<string, unknown[]> }>;
      }).evaluateMeals('c1', pasti);
    return { prisma, valuta };
  };

  const PASTO = [{ slot: 'lunch', recipeId: 'r1', name: 'Piatto' }];

  it('⛔ una cliente con SOLO allergie non esce più senza che si guardi niente', async () => {
    const { prisma, valuta } = crea(
      { allergies: ['frutta a guscio'], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Insalata con mandorle', ingredients: [{ name: 'mandorle' }], allergens: [] }],
    );
    const esito = await valuta(PASTO);
    // Prima: usciva alla prima riga e non interrogava nemmeno il catalogo.
    expect(prisma.recipe.findMany).toHaveBeenCalled();
    expect(esito.violations).toHaveLength(1);
    expect(esito.violations[0]).toContain('allergia: frutta a guscio');
  });

  it('e la radice vale anche qui: «mandorla» al singolare blocca lo stesso', async () => {
    // ⚠️ Nona copia del confronto: dentro il ciclo sugli ingredienti c'era `low.includes(...)` a
    // mano, quindi la correzione sulla radice non arrivava fin qui.
    const { valuta } = crea(
      { allergies: ['frutta a guscio'], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Smoothie', ingredients: [{ name: 'latte di mandorla' }], allergens: [] }],
    );
    expect((await valuta(PASTO)).violations).toHaveLength(1);
  });

  it('⚠️ il TAG confermato blocca anche quando gli ingredienti non lo dicono a parole', async () => {
    // È il caso per cui i tag esistono: il sedano dentro un brodo, il pesce dentro il surimi.
    const { valuta } = crea(
      { allergies: ['sedano'], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Vellutata della casa', ingredients: [{ name: 'brodo vegetale' }], allergens: ['sedano'] }],
    );
    const esito = await valuta(PASTO);
    expect(esito.violations[0]).toContain('Sedano');
    expect(esito.violations[0]).toContain('allergene dichiarato');
  });

  it('un tag che la cliente non ha dichiarato non blocca niente', async () => {
    const { valuta } = crea(
      { allergies: ['sedano'], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Vellutata', ingredients: [{ name: 'zucca' }], allergens: ['latte'] }],
    );
    expect((await valuta(PASTO)).violations).toEqual([]);
  });

  it('senza allergie, intolleranze e cibi non graditi si esce subito, come prima', async () => {
    const { prisma, valuta } = crea(
      { allergies: [], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Pasta al pomodoro', ingredients: [{ name: 'pasta' }], allergens: ['glutine'] }],
    );
    const esito = await valuta(PASTO);
    expect(esito.violations).toEqual([]);
    // ⚠️ E non si interroga il catalogo: era il comportamento di prima e non deve costare query in più.
    expect(prisma.recipe.findMany).not.toHaveBeenCalled();
  });

  it('se l’ingrediente ha una sostituzione sicura il piatto si eroga, come per le intolleranze', async () => {
    const { valuta } = crea(
      { allergies: ['latte'], intolerances: [], dislikedFoods: [] },
      [{ id: 'r1', name: 'Vellutata', ingredients: [{ name: 'panna' }], allergens: [] }],
    );
    const esito = await valuta(PASTO);
    expect(esito.violations).toEqual([]);
    expect(esito.subsByRecipe['r1']).toHaveLength(1);
  });

  it('le intolleranze continuano a comportarsi come prima', async () => {
    const { valuta } = crea(
      { allergies: [], intolerances: ['frutta a guscio'], dislikedFoods: [] },
      [{ id: 'r1', name: 'Insalata con mandorle', ingredients: [{ name: 'mandorle' }], allergens: [] }],
    );
    expect((await valuta(PASTO)).violations).toHaveLength(1);
  });
});
