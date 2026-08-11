import { giornataCompleta, giornateComplete, pastiAttesi, pastiMancanti, slotPieni } from './giornate-complete';

const giornata = (slots: string[]) => ({ meals: slots.map((s) => ({ slot: s, recipeId: `r-${s}` })) });
const CINQUE = { mealsPerDay: 5, fasting: false };
const TRE = { mealsPerDay: 3, fasting: false };

describe('giornate-complete — nel menu ci dev’essere da mangiare', () => {
  it('i pasti attesi dipendono dalla struttura della dieta', () => {
    expect(pastiAttesi(TRE)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(pastiAttesi(CINQUE)).toHaveLength(5);
    // Nel digiuno intermittente la colazione NON è un pasto mancante: è il senso del digiuno.
    expect(pastiAttesi({ mealsPerDay: 5, fasting: true })).toEqual(['lunch', 'afternoon_snack', 'dinner']);
  });

  it('IL CASO DEL 9/8: 28 giornate con la sola colazione risultano tutte monche', () => {
    const solo_colazione = Array.from({ length: 28 }, () => giornata(['breakfast']));
    const r = giornateComplete(solo_colazione, TRE);
    expect(r.complete).toHaveLength(0);
    expect(r.monche).toBe(28);
  });

  it('un pasto senza ricetta agganciata non conta come pasto', () => {
    // È il caso che sfugge guardando solo la lunghezza dell'array: lo slot c'è, il piatto no.
    const monca = { meals: [{ slot: 'breakfast', recipeId: 'r1' }, { slot: 'lunch' }, { slot: 'dinner', recipeId: 'r3' }] };
    expect(giornataCompleta(monca, pastiAttesi(TRE))).toBe(false);
    expect(slotPieni(monca).has('lunch')).toBe(false);
  });

  it('separa le complete dalle monche invece di scartare tutto', () => {
    const miste = [giornata(['breakfast', 'lunch', 'dinner']), giornata(['breakfast']), giornata(['breakfast', 'lunch', 'dinner'])];
    const r = giornateComplete(miste, TRE);
    // Due giorni buoni si servono: un ciclo più corto è meglio di una giornata con la sola colazione.
    expect(r.complete).toHaveLength(2);
    expect(r.monche).toBe(1);
  });

  it('dice quali pasti mancano, in italiano: è la frase che il nutrizionista deve leggere', () => {
    expect(pastiMancanti(giornata(['breakfast']), pastiAttesi(TRE))).toEqual(['pranzo', 'cena']);
  });

  it('una giornata a 5 pasti non è completa se ne ha 3', () => {
    // La stessa giornata è buona per la variante a 3 pasti e monca per quella a 5: è la ragione per
    // cui la completezza si chiede SEMPRE insieme alla dieta, non alla giornata da sola.
    const tre = giornata(['breakfast', 'lunch', 'dinner']);
    expect(giornataCompleta(tre, pastiAttesi(TRE))).toBe(true);
    expect(giornataCompleta(tre, pastiAttesi(CINQUE))).toBe(false);
  });

  it('nessuna giornata: zero complete e zero monche, non un errore', () => {
    expect(giornateComplete([], TRE)).toEqual({ complete: [], monche: 0, attesi: ['breakfast', 'lunch', 'dinner'] });
  });
});
