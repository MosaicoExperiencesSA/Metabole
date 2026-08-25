/**
 * ⛔ **ANCHE LE SOSTITUZIONI DI SICUREZZA SONO A PARI GRAMMATURA, E SUI GRASSI NON REGGE.**
 *
 * Trovato al secondo giro di revisione del lavoro sui grassi, 25/8. Il lavoro aveva sistemato la
 * **chat** — dove il cambio lo chiede la cliente — e lasciato intatta la strada **automatica**:
 * `SUBSTITUTION_MAP` contiene `burro → olio evo`, `valutaRicetta` scrive la sostituzione senza
 * quantità, e `ingredienti-effettivi.ts` fa `qty: s.toQty ?? i.qty`. Trenta grammi di burro
 * diventavano trenta di olio, mentre il numero giusto è **venticinque**: +20% di lipidi su
 * quell'ingrediente, ogni giorno, su ogni cliente intollerante al lattosio — e senza che nessuno
 * l'avesse chiesto.
 *
 * ⚠️ Due porte rispondevano in modo diverso alla stessa domanda, e quella che rispondeva male è
 * quella che tocca più persone.
 */
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DayComboService } from './day-combo.service';
import { MenuService } from './menu.service';

const PESI = { burro: 120, 'olio evo': 100, 'panna fresca': 285 };

const GRUPPO_PESI = {
  name: 'Oli e grassi da condimento',
  members: {
    items: Object.keys(PESI),
    fattori: { riferimento: 'olio evo', fonte: 'CREA / USDA', pesi: PESI },
  },
};

type Sub = { from: string; to: string; fromQty?: number; toQty?: number; unit?: string; unitA?: string };

const crea = (ricette: Record<string, unknown>[], gruppi: unknown[] = [GRUPPO_PESI]) => {
  const prisma = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ allergies: [], intolerances: ['lattosio'], dislikedFoods: [] }),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(ricette) },
    /**
     * ⚠️ **Il finto c'è, e non è un dettaglio.** Senza `equivalenceGroup` la lettura dei pesi
     * lancia, la rete la prende, e il test passerebbe **col difetto dentro**: un finto che manca non
     * fa fallire niente, fa passare tutto.
     */
    equivalenceGroup: { findMany: jest.fn().mockResolvedValue(gruppi) },
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
  const valuta = () =>
    (service as unknown as {
      evaluateMeals(c: string, m: unknown[], e?: string[]): Promise<{ violations: string[]; subsByRecipe: Record<string, Sub[]> }>;
    }).evaluateMeals('c1', [{ slot: 'lunch', recipeId: 'r1', name: 'Piatto' }]);
  return { prisma, valuta };
};

describe('⛔ i grassi convertiti anche sulla strada automatica', () => {
  /** ⛔ Il caso misurato: 30 g di burro su una cliente intollerante al lattosio. */
  it('⛔ trenta grammi di burro diventano venticinque di olio, non trenta', async () => {
    const { valuta } = crea([
      { id: 'r1', name: 'Risotto', ingredients: [{ name: 'burro', qty: 30, unit: 'g' }], allergens: [] },
    ]);
    const [sub] = (await valuta()).subsByRecipe['r1'];
    expect(sub.to).toBe('olio evo');
    expect(sub.fromQty).toBe(30);
    expect(sub.toQty).toBe(25);
    // ⚠️ La tabella di Nocanty è in GRAMMI: dopo una conversione l'unità è il grammo.
    expect(sub.unitA).toBe('g');
  });

  /**
   * ⛔ **E dove il numero non c'è, NON si passa la mano.** In chat un grasso senza peso ferma la
   * proposta; qui la sostituzione esiste per rendere **sicuro** un piatto che contiene
   * un'intolleranza. Toglierla vorrebbe dire servire il lattosio a chi non lo tollera: un cancello
   * aperto, che è peggio di un cancello chiuso. Resta la pari grammatura, contata e scritta nel log.
   */
  it('⛔ senza il peso la sostituzione RESTA: la sicurezza non si sacrifica al numero', async () => {
    const { valuta } = crea([
      { id: 'r1', name: 'Vellutata', ingredients: [{ name: 'panna', qty: 70, unit: 'ml' }], allergens: [] },
    ]);
    const [sub] = (await valuta()).subsByRecipe['r1'];
    // ⚠️ Il sostituto lo sceglie `decisioneLattosio`, non `SUBSTITUTION_MAP`: «panna senza lattosio».
    // Ed è un grasso che la tabella non nomina — appunto il caso in cui non si sa convertire.
    expect(sub.to).toBe('panna senza lattosio');
    // Nessuna quantità inventata: resta quella di prima, che è quello che il prodotto faceva.
    expect(sub.toQty).toBeUndefined();
  });

  it('⚠️ e senza il gruppo dei pesi tutto si comporta come prima del 25/8', async () => {
    const { valuta } = crea(
      [{ id: 'r1', name: 'Risotto', ingredients: [{ name: 'burro', qty: 30, unit: 'g' }], allergens: [] }],
      [],
    );
    const [sub] = (await valuta()).subsByRecipe['r1'];
    expect(sub.to).toBe('olio evo');
    expect(sub.toQty).toBeUndefined();
  });

  /** ⚠️ Sulle sostituzioni che non sono di grassi non cambia niente: lì la pari grammatura regge. */
  it('⚠️ il pane senza glutine resta alla stessa grammatura', async () => {
    const prisma = crea([
      { id: 'r1', name: 'Bruschetta', ingredients: [{ name: 'pane', qty: 80, unit: 'g' }], allergens: [] },
    ]);
    prisma.prisma.clientProfile.findUnique.mockResolvedValue({
      allergies: [], intolerances: ['glutine'], dislikedFoods: [],
    });
    const [sub] = (await prisma.valuta()).subsByRecipe['r1'];
    expect(sub.to).toBe('pane senza glutine');
    expect(sub.toQty).toBeUndefined();
  });

  /**
   * ⚠️ **«Si toglie» è un'assenza, non un sostituto**: non c'è niente da convertire, e provare a
   * farlo scriverebbe una grammatura accanto a una riga che dice «niente al suo posto».
   */
  it('⚠️ un ingrediente che si toglie non prende una quantità', async () => {
    const prisma = crea([
      { id: 'r1', name: 'Pere al vino', ingredients: [{ name: 'vino rosso', qty: 100, unit: 'ml' }], allergens: [] },
    ]);
    prisma.prisma.clientProfile.findUnique.mockResolvedValue({
      allergies: ['solfiti'], intolerances: [], dislikedFoods: [],
    });
    const subs = (await prisma.valuta()).subsByRecipe['r1'] ?? [];
    for (const s of subs) expect(s.toQty).toBeUndefined();
  });
});
