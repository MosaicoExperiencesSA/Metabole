import { riparaGiornate, riparaGiornata } from './ripara-giornata';

/**
 * IL PASTO CHE MANCA SI PRENDE DALLE SETTIMANE SUCCESSIVE (Simone, 14/8).
 * Decisione in progetto/NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md.
 *
 * L'esempio di Simone, testuale: digiuno intermittente, settimana 2 giorno 2, manca la cena.
 * Gli slot del digiuno sono pranzo, merenda e cena (`pastiAttesi`).
 */

/** Una giornata di digiuno: pranzo + merenda + cena. `dayIndex` 8 = settimana 2, giorno 1. */
const giorno = (dayIndex: number, meals: { slot: string; recipeId: string }[]) => ({ dayIndex, level: 1, meals });
const DIGIUNO = { mealsPerDay: 3, fasting: true };

describe('riparaGiornata — il pasto mancante arriva dalle altre giornate', () => {
  it('settimana 2 giorno 2 senza cena: la prende dalla settimana 3 (si guarda AVANTI per prime)', () => {
    const giornate = [
      giorno(8, [{ slot: 'lunch', recipeId: 'l8' }, { slot: 'afternoon_snack', recipeId: 'm8' }, { slot: 'dinner', recipeId: 'd8' }]),
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]), // ⬅️ manca la cena
      giorno(15, [{ slot: 'lunch', recipeId: 'l15' }, { slot: 'afternoon_snack', recipeId: 'm15' }, { slot: 'dinner', recipeId: 'd15' }]),
    ];
    const esito = riparaGiornata(giornate[1], giornate, DIGIUNO);
    expect(esito.riparata).toBe(true);
    const cena = (esito.giornata.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'dinner');
    expect(cena?.recipeId).toBe('d15');
    expect(esito.prese).toEqual([{ slot: 'dinner', recipeId: 'd15', daGiorno: 15 }]);
  });

  it('⚠️ avanti prima di indietro: con candidati da entrambe le parti vince quello DOPO', () => {
    const giornate = [
      giorno(1, [{ slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }]),
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
      giorno(20, [{ slot: 'lunch', recipeId: 'l20' }, { slot: 'afternoon_snack', recipeId: 'm20' }, { slot: 'dinner', recipeId: 'd20' }]),
    ];
    const esito = riparaGiornata(giornate[1], giornate, DIGIUNO);
    expect(esito.prese[0].daGiorno).toBe(20);
  });

  it('la più VICINA in avanti, non l\'ultima del ciclo', () => {
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
      giorno(11, [{ slot: 'lunch', recipeId: 'l11' }, { slot: 'afternoon_snack', recipeId: 'm11' }, { slot: 'dinner', recipeId: 'd11' }]),
      giorno(25, [{ slot: 'lunch', recipeId: 'l25' }, { slot: 'afternoon_snack', recipeId: 'm25' }, { slot: 'dinner', recipeId: 'd25' }]),
    ];
    expect(riparaGiornata(giornate[0], giornate, DIGIUNO).prese[0].daGiorno).toBe(11);
  });

  it('solo indietro: si prende da lì — meglio un pasto che nessun pasto', () => {
    const giornate = [
      giorno(1, [{ slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }]),
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
    ];
    const esito = riparaGiornata(giornate[1], giornate, DIGIUNO);
    expect(esito.riparata).toBe(true);
    expect(esito.prese[0].daGiorno).toBe(1);
  });

  it('⚠️ MAI un doppione nella stessa giornata: il piatto già presente non è un candidato', () => {
    // La cena mancante; l'unica altra cena del ciclo è il piatto che questa giornata ha già a pranzo.
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'x1' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
      giorno(15, [{ slot: 'lunch', recipeId: 'l15' }, { slot: 'afternoon_snack', recipeId: 'm15' }, { slot: 'dinner', recipeId: 'x1' }]),
    ];
    const esito = riparaGiornata(giornate[0], giornate, DIGIUNO);
    expect(esito.riparata).toBe(false);
    expect((esito.giornata.meals as unknown[]).length).toBe(2);
  });

  it('a parità comanda il TARGET calorico: vince la cena che avvicina il totale', () => {
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
      giorno(11, [{ slot: 'lunch', recipeId: 'l11' }, { slot: 'afternoon_snack', recipeId: 'm11' }, { slot: 'dinner', recipeId: 'd-grande' }]),
      giorno(12, [{ slot: 'lunch', recipeId: 'l12' }, { slot: 'afternoon_snack', recipeId: 'm12' }, { slot: 'dinner', recipeId: 'd-giusta' }]),
    ];
    const kcalDi = new Map([['l9', 600], ['m9', 200], ['d-grande', 900], ['d-giusta', 600]]);
    const esito = riparaGiornata(giornate[0], giornate, DIGIUNO, { kcalDi, targetKcal: 1400 });
    // 600+200 = 800; il target è 1400 → serve una cena da ~600, non da 900.
    expect(esito.prese[0].recipeId).toBe('d-giusta');
  });

  it('senza kcal note si prende la prima in avanti, e non si finge una scelta calorica', () => {
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
      giorno(11, [{ slot: 'lunch', recipeId: 'l11' }, { slot: 'afternoon_snack', recipeId: 'm11' }, { slot: 'dinner', recipeId: 'd11' }]),
      giorno(12, [{ slot: 'lunch', recipeId: 'l12' }, { slot: 'afternoon_snack', recipeId: 'm12' }, { slot: 'dinner', recipeId: 'd12' }]),
    ];
    expect(riparaGiornata(giornate[0], giornate, DIGIUNO, { targetKcal: 1400 }).prese[0].recipeId).toBe('d11');
  });

  it('più slot mancanti si riparano tutti, e ognuno dice da dove viene', () => {
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }]),
      giorno(15, [{ slot: 'lunch', recipeId: 'l15' }, { slot: 'afternoon_snack', recipeId: 'm15' }, { slot: 'dinner', recipeId: 'd15' }]),
    ];
    const esito = riparaGiornata(giornate[0], giornate, DIGIUNO);
    expect(esito.prese.map((p) => p.slot).sort()).toEqual(['afternoon_snack', 'dinner']);
  });

  it('una giornata già completa NON si tocca', () => {
    const g = giorno(8, [{ slot: 'lunch', recipeId: 'l8' }, { slot: 'afternoon_snack', recipeId: 'm8' }, { slot: 'dinner', recipeId: 'd8' }]);
    const esito = riparaGiornata(g, [g], DIGIUNO);
    expect(esito.riparata).toBe(false);
    expect(esito.giornata).toBe(g);
  });

  it('⚠️ l\'ordine dei pasti resta quello della giornata: il pasto aggiunto va al suo posto', () => {
    const giornate = [
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'dinner', recipeId: 'd9' }]), // manca la merenda, in mezzo
      giorno(15, [{ slot: 'lunch', recipeId: 'l15' }, { slot: 'afternoon_snack', recipeId: 'm15' }, { slot: 'dinner', recipeId: 'd15' }]),
    ];
    const esito = riparaGiornata(giornate[0], giornate, DIGIUNO);
    const slots = (esito.giornata.meals as { slot: string }[]).map((m) => m.slot);
    expect(slots).toEqual(['lunch', 'afternoon_snack', 'dinner']);
  });
});

describe('riparaGiornate — il giro su tutte', () => {
  it('ripara quelle che si possono riparare e dice quante e quali', () => {
    const giornate = [
      giorno(1, [{ slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }]),
      giorno(9, [{ slot: 'lunch', recipeId: 'l9' }, { slot: 'afternoon_snack', recipeId: 'm9' }]),
    ];
    const esito = riparaGiornate(giornate, DIGIUNO);
    expect(esito.riparate).toBe(1);
    expect(esito.dettaglio).toEqual([{ dayIndex: 9, slot: 'dinner', recipeId: 'd1', daGiorno: 1 }]);
    // Le giornate tornano tutte, nell'ordine di partenza: chi chiama filtra le complete come prima.
    expect(esito.giornate.map((g) => g.dayIndex)).toEqual([1, 9]);
  });

  it('⚠️ non si ripara da una giornata a sua volta riparata: si parte sempre dal catalogo vero', () => {
    // Se la riparazione fosse a catena, un piatto potrebbe propagarsi su mezzo ciclo.
    const giornate = [
      giorno(1, [{ slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }]),
      giorno(2, [{ slot: 'lunch', recipeId: 'l2' }, { slot: 'afternoon_snack', recipeId: 'm2' }]),
      giorno(3, [{ slot: 'lunch', recipeId: 'l3' }, { slot: 'afternoon_snack', recipeId: 'm3' }, { slot: 'dinner', recipeId: 'd3' }]),
    ];
    const esito = riparaGiornate(giornate, DIGIUNO);
    // Tutte e due prendono la cena dall'unica giornata che ce l'ha davvero.
    expect(esito.dettaglio.every((d) => d.recipeId === 'd3')).toBe(true);
    expect(esito.riparate).toBe(2);
  });

  it('nessun candidato da nessuna parte: non si inventa niente', () => {
    const giornate = [
      giorno(1, [{ slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }]),
      giorno(2, [{ slot: 'lunch', recipeId: 'l2' }, { slot: 'afternoon_snack', recipeId: 'm2' }]),
    ];
    const esito = riparaGiornate(giornate, DIGIUNO);
    expect(esito.riparate).toBe(0);
    expect(esito.giornate.every((g) => (g.meals as unknown[]).length === 2)).toBe(true);
  });

  it('vale anche per i 5 pasti, non solo per il digiuno', () => {
    const cinque = { mealsPerDay: 5, fasting: false };
    const pieno = (i: number) => giorno(i, [
      { slot: 'breakfast', recipeId: `b${i}` }, { slot: 'morning_snack', recipeId: `s${i}` },
      { slot: 'lunch', recipeId: `l${i}` }, { slot: 'afternoon_snack', recipeId: `m${i}` },
      { slot: 'dinner', recipeId: `d${i}` },
    ]);
    const senzaColazione = giorno(2, [
      { slot: 'morning_snack', recipeId: 's2' }, { slot: 'lunch', recipeId: 'l2' },
      { slot: 'afternoon_snack', recipeId: 'm2' }, { slot: 'dinner', recipeId: 'd2' },
    ]);
    const esito = riparaGiornate([senzaColazione, pieno(9)], cinque);
    expect(esito.riparate).toBe(1);
    expect(esito.dettaglio[0]).toMatchObject({ slot: 'breakfast', daGiorno: 9 });
  });
});
