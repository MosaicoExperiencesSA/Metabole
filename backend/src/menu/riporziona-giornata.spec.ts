import { aPorzioneDiCatalogo, riporzionaSulFabbisogno } from './riporziona-giornata';
import { TETTI_PREDEFINITI } from './porzione-scalata';
import type { MealSnapshot } from './pasto-giornata';

const scalata: MealSnapshot[] = [
  { slot: 'breakfast', recipeId: 'r1', name: 'Porridge', kcal: 480, kcalBase: 300, porzione: 1.6 },
  { slot: 'lunch', recipeId: 'r2', name: 'Farro e ceci', kcal: 891, kcalBase: 495, porzione: 1.8 },
];
const mai: MealSnapshot[] = [
  { slot: 'breakfast', recipeId: 'r1', name: 'Porridge', kcal: 300 },
  { slot: 'lunch', recipeId: 'r2', name: 'Farro e ceci', kcal: 495 },
];

describe('aPorzioneDiCatalogo — si torna alla base prima di riscalare', () => {
  it('le kcal tornano quelle di catalogo e il fattore sparisce', () => {
    expect(aPorzioneDiCatalogo(scalata)).toEqual([
      { slot: 'breakfast', recipeId: 'r1', name: 'Porridge', kcal: 300 },
      { slot: 'lunch', recipeId: 'r2', name: 'Farro e ceci', kcal: 495 },
    ]);
  });

  /**
   * ⚠️ `porzione` si TOGLIE, non si mette a 1: l'app distingue «assente» da «presente», e una
   * giornata con `porzione: 1` addosso direbbe alla cliente che qualcosa è stato deciso sulla sua
   * porzione quando non è vero.
   */
  it('⚠️ il campo sparisce, non diventa 1', () => {
    const [primo] = aPorzioneDiCatalogo(scalata);
    expect('porzione' in primo).toBe(false);
    expect('kcalBase' in primo).toBe(false);
  });

  it('la giornata mai scalata resta identica', () => {
    expect(aPorzioneDiCatalogo(mai)).toEqual(mai);
  });
});

describe('riporzionaSulFabbisogno — il kit di rientro non ricopia, riporziona', () => {
  /**
   * ⚠️ IL CASO CHE VALE IL MODULO. Un giorno di prima del 18/8 non ha nessun fattore: copiato di
   * peso, il kit di rientro rimetterebbe nel futuro una giornata al 65% — e nessuno la
   * aggiusterebbe più, perché `deliverIfEligible` compone solo le date che non esistono ancora.
   */
  it('⚠️ la giornata vecchia (mai scalata) viene scalata adesso', () => {
    const { meals, cambiata } = riporzionaSulFabbisogno(mai, 1200, TETTI_PREDEFINITI);
    expect(cambiata).toBe(true);
    expect(meals.map((m) => m.kcal).reduce((a, b) => a + b, 0)).toBeGreaterThan(795);
    expect(meals[0].kcalBase).toBe(300);
    expect(meals[0].porzione).toBeGreaterThan(1);
  });

  /**
   * ⚠️ E il modo sbagliato di rimediare: scalare quello che è già scalato. 891 × 1,8 fa 1603, cioè
   * ×3,24 sulla ricetta. Qui si riparte sempre da `kcalBase`.
   */
  it('⚠️ NON si scala quello che è già scalato: si riparte dalla base', () => {
    const { meals } = riporzionaSulFabbisogno(scalata, 1200, TETTI_PREDEFINITI);
    // Stesso target, stessa giornata di catalogo: il risultato è quello della giornata mai scalata.
    const { meals: daZero } = riporzionaSulFabbisogno(mai, 1200, TETTI_PREDEFINITI);
    expect(meals).toEqual(daZero);
    expect(meals.every((m) => (m.porzione ?? 1) <= TETTI_PREDEFINITI.colazione + 0.001 || m.slot !== 'breakfast')).toBe(true);
  });

  it('col fabbisogno già coperto dal catalogo non si tocca niente (non si rimpicciolisce mai)', () => {
    const { meals, cambiata } = riporzionaSulFabbisogno(mai, 700, TETTI_PREDEFINITI);
    expect(meals).toEqual(mai);
    expect(cambiata).toBe(false);
  });

  /**
   * ⚠️ Senza fabbisogno la giornata resta ESATTAMENTE com'era. Riportarla al catalogo «perché non
   * sappiamo» le rimpicciolirebbe il piatto in silenzio, e «non si rimpicciolisce mai» è la regola
   * con cui la strada C è stata decisa.
   */
  it('⚠️ senza fabbisogno non si tocca niente, nemmeno per riportarla al catalogo', () => {
    for (const t of [null, undefined, 0, NaN]) {
      const { meals, cambiata } = riporzionaSulFabbisogno(scalata, t as number, TETTI_PREDEFINITI);
      expect(meals).toEqual(scalata);
      expect(cambiata).toBe(false);
    }
  });

  it('una giornata illeggibile non fa cadere il kit di rientro', () => {
    expect(riporzionaSulFabbisogno(null, 1200, TETTI_PREDEFINITI)).toEqual({ meals: [], cambiata: false });
  });
});
