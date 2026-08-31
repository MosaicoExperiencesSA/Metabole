/**
 * ⛔ **IL CASO PATRIZIA — 31/8.** Giornata a catalogo con dentro piatti che lei non può mangiare, e
 * nel pool un'alternativa sicura per ogni pasto. Il motore si fermava lo stesso.
 */
import { cercaUnAlternativa, type ContestoScelta } from './cerca-un-alternativa';

function ctx(
  pool: Record<string, string[]>,
  kcal: Record<string, number>,
  punteggi: Record<string, number> = {},
): ContestoScelta {
  return {
    slotPool: new Map(Object.entries(pool).map(([s, ids]) => [s, new Set(ids)])),
    kcalOf: new Map(Object.entries(kcal)),
    score: (id) => punteggi[id] ?? 0,
  };
}
const giorno = (meals: [string, string][]) => ({ meals: meals.map(([slot, recipeId]) => ({ slot, recipeId })) });

describe('cercaUnAlternativa — si sostituisce, non si blocca', () => {
  it('⛔ IL CASO PATRIZIA: il piatto col glutine viene sostituito e la giornata si salva', () => {
    const g = giorno([['breakfast', 'crackers'], ['lunch', 'ok-pranzo']]);
    const c = ctx({ breakfast: ['sicura'], lunch: ['ok-pranzo'] }, { crackers: 300, sicura: 310, 'ok-pranzo': 600 });
    const esito = cercaUnAlternativa([g], new Set(['crackers']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('sicura');
    expect(esito.senzaAlternativa).toEqual([]);
    expect(esito.sostituzioni).toEqual([{ slot: 'breakfast', da: 'crackers', a: 'sicura', fuoriBanda: false }]);
  });

  it('i pasti SICURI non si toccano: si cambia solo quello che non si può servire', () => {
    const g = giorno([['breakfast', 'crackers'], ['lunch', 'buono']]);
    const c = ctx({ breakfast: ['sicura'], lunch: ['altro'] }, { crackers: 300, sicura: 310, buono: 600, altro: 610 });
    cercaUnAlternativa([g], new Set(['crackers']), c, 0.15);
    expect(g.meals[1].recipeId).toBe('buono');
  });

  it('nessun piatto da sostituire: non fa niente e non racconta niente', () => {
    const g = giorno([['breakfast', 'buono']]);
    const c = ctx({ breakfast: ['a', 'b'] }, { buono: 300, a: 300, b: 300 });
    expect(cercaUnAlternativa([g], new Set(), c, 0.15)).toEqual({ sostituzioni: [], senzaAlternativa: [] });
    expect(g.meals[0].recipeId).toBe('buono');
  });

  it('⚠️ dentro la banda calorica si preferisce il PUNTEGGIO più alto', () => {
    const g = giorno([['lunch', 'vietato']]);
    const c = ctx({ lunch: ['a', 'b'] }, { vietato: 500, a: 480, b: 520 }, { a: 1, b: 9 });
    cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('b');
  });

  it('⚠️ dentro la banda comanda il PUNTEGGIO, non la vicinanza di calorie — sono due regole diverse', () => {
    /**
     * Trovato da una mutazione: `inBanda ?? vicino` sostituito con `vicino` lasciava tutto verde,
     * perché in tutti i casi precedenti le due regole rispondevano lo stesso. Qui no: «pari» ha le
     * calorie identiche al piatto vietato ma nessun voto, «buono» è più lontano ma dentro la banda
     * e piace. Dentro la banda il bilanciamento è già rispettato, quindi decide il gusto.
     */
    const g = giorno([['lunch', 'vietato']]);
    const c = ctx({ lunch: ['pari', 'buono'] }, { vietato: 500, pari: 500, buono: 570 }, { pari: 0, buono: 9 });
    const esito = cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('buono');
    expect(esito.sostituzioni[0].fuoriBanda).toBe(false);
  });

  it('⛔ fuori banda si prende il più VICINO di calorie, non il più votato: la giornata resta sensata', () => {
    // Banda 425-575: nessuno dentro. Fra 300 (votatissimo) e 600 vince 600, che è più vicino a 500.
    const g = giorno([['lunch', 'vietato']]);
    const c = ctx({ lunch: ['magro', 'vicino'] }, { vietato: 500, magro: 300, vicino: 600 }, { magro: 99, vicino: 0 });
    const esito = cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('vicino');
    expect(esito.sostituzioni[0].fuoriBanda).toBe(true);
  });

  it('⛔ un candidato che la guardia vieterebbe non si sceglie, anche se è nel pool', () => {
    const g = giorno([['lunch', 'vietato']]);
    const c = ctx({ lunch: ['pure-vietato', 'sicuro'] }, { vietato: 500, 'pure-vietato': 500, sicuro: 520 }, { 'pure-vietato': 99, sicuro: 0 });
    cercaUnAlternativa([g], new Set(['vietato', 'pure-vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('sicuro');
  });

  it('⚠️ niente doppioni nella stessa giornata: non si mette a colazione il piatto del pranzo', () => {
    const g = giorno([['breakfast', 'vietato'], ['lunch', 'gia-usato']]);
    const c = ctx({ breakfast: ['gia-usato', 'altro'] }, { vietato: 300, 'gia-usato': 300, altro: 310 }, { 'gia-usato': 99, altro: 0 });
    cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('altro');
  });

  it('⛔ pool VUOTO per quel pasto: si dichiara, e sarà il blocco a fermare la giornata', () => {
    const g = giorno([['dinner', 'vietato']]);
    const c = ctx({ dinner: [] }, { vietato: 300 });
    const esito = cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(esito.sostituzioni).toEqual([]);
    expect(esito.senzaAlternativa).toEqual([{ slot: 'dinner', recipeId: 'vietato' }]);
    expect(g.meals[0].recipeId).toBe('vietato'); // resta, e lo ferma la guardia
  });

  it('⛔ pool fatto SOLO di piatti vietati: stesso esito, nessuna scelta inventata', () => {
    const g = giorno([['dinner', 'vietato']]);
    const c = ctx({ dinner: ['anche-vietato'] }, { vietato: 300, 'anche-vietato': 300 });
    const esito = cercaUnAlternativa([g], new Set(['vietato', 'anche-vietato']), c, 0.15);
    expect(esito.senzaAlternativa).toHaveLength(1);
    expect(g.meals[0].recipeId).toBe('vietato');
  });

  it('due giornate: ognuna ragiona sui propri doppioni, non su quelli dell\'altra', () => {
    const g1 = giorno([['breakfast', 'vietato'], ['lunch', 'x']]);
    const g2 = giorno([['breakfast', 'vietato'], ['lunch', 'y']]);
    const c = ctx({ breakfast: ['x', 'y'] }, { vietato: 300, x: 300, y: 300 }, { x: 5, y: 1 });
    cercaUnAlternativa([g1, g2], new Set(['vietato']), c, 0.15);
    // In g1 «x» è già il pranzo, quindi a colazione va «y». In g2 è libero e vince «x» (punteggio).
    expect(g1.meals[0].recipeId).toBe('y');
    expect(g2.meals[0].recipeId).toBe('x');
  });

  it('a parità di punteggio comanda l\'id: due gemelli non si alternano secondo il database', () => {
    const g = giorno([['lunch', 'vietato']]);
    const c = ctx({ lunch: ['bbb', 'aaa'] }, { vietato: 500, bbb: 500, aaa: 500 });
    cercaUnAlternativa([g], new Set(['vietato']), c, 0.15);
    expect(g.meals[0].recipeId).toBe('aaa');
  });
});
