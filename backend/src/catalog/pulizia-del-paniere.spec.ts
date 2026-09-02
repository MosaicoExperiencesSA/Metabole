import { chiaveCella, cosaTogliere, type RicettaPerPulizia, type RigaDelPaniere } from './pulizia-del-paniere';

/**
 * ⛔ IL GIUDIZIO DI `panieri:pulisci`, provato PRIMA che cancelli qualcosa.
 *
 * Lo script toglie righe di appartenenza in produzione. Un mese fa `rifai:troppi-pasti` avrebbe
 * aperto buchi permanenti nei menu di due clienti, e a fermarlo non è stata una rilettura: è stata
 * una sentinella. La differenza è che quel giudizio stava dentro lo script, dove nessuna prova
 * arriva. Questo sta fuori, e queste sono le prove.
 */
describe('cosaTogliere', () => {
  const riga = (id: string, slot: string, recipeId: string, regime = 'vegan', famiglia = 'Mediterranea'): RigaDelPaniere =>
    ({ id, slot, recipeId, famiglia, regime });
  const ric = (id: string, regime: string, active = true): RicettaPerPulizia =>
    ({ id, name: `Piatto ${id}`, regime, active });
  /** Riempie uno slot di ricette buone, per stare sopra soglia dove non è quello il punto. */
  const tante = (n: number, slot: string, regime = 'vegan') => ({
    righe: Array.from({ length: n }, (_, i) => riga(`x${slot}${i}`, slot, `r${slot}${i}`, regime)),
    ricette: Array.from({ length: n }, (_, i) => ric(`r${slot}${i}`, 'vegan')),
  });

  it('toglie la ricetta il cui regime il paniere non può mangiare', () => {
    const base = tante(40, 'lunch');
    const v = cosaTogliere(
      [...base.righe, riga('cattiva', 'lunch', 'salmone')],
      [...base.ricette, ric('salmone', 'pescetarian')],
      30,
    );
    expect(v.daTogliere.map((d) => d.id)).toEqual(['cattiva']);
    expect(v.daTogliere[0].attiva).toBe(true);
    expect(v.caselleSotto).toEqual([]);
  });

  it('⛔ una ricetta più STRETTA del paniere resta: un piatto vegano sta in un paniere onnivoro', () => {
    const v = cosaTogliere([riga('a', 'lunch', 'r1', 'omnivore')], [ric('r1', 'vegan')], 1);
    expect(v.daTogliere).toEqual([]);
  });

  /**
   * ⛔ È il freno, ed è la ragione per cui questo modulo esiste. Senza, lo script svuoterebbe una
   * casella e la cliente lo scoprirebbe mangiando lo stesso piatto tre volte in una settimana.
   */
  it('⛔ segnala la casella che scende sotto soglia', () => {
    const base = tante(3, 'dinner');
    const v = cosaTogliere(
      [...base.righe, riga('cattiva', 'dinner', 'salmone')],
      [...base.ricette, ric('salmone', 'pescetarian')],
      30,
    );
    expect(v.daTogliere).toHaveLength(1);
    expect(v.caselleSotto).toEqual([{ chiave: chiaveCella('Mediterranea', 'vegan'), slot: 'dinner', prima: 4, dopo: 3 }]);
  });

  it('⚠️ una casella che era GIÀ a zero non si segnala: non è la pulizia a svuotarla', () => {
    /** Nessuna riga per «breakfast»: prima 0, dopo 0 — non è un peggioramento. */
    const v = cosaTogliere([riga('a', 'lunch', 'r1')], [ric('r1', 'vegan')], 30);
    expect(v.caselleSotto.map((c) => c.slot)).not.toContain('breakfast');
  });

  it('⚠️ e se il conto non cambia la casella non si segnala, anche se è povera', () => {
    const v = cosaTogliere([riga('a', 'lunch', 'r1')], [ric('r1', 'vegan')], 30);
    expect(v.caselleSotto).toEqual([]);
  });

  /**
   * ⛔ **I gemelli si contano UNITI** (Fase 2): spuntino e merenda sono un paniere solo, ed è così
   * che la cliente li vede. Separati direbbero due caselle povere dove ce n'è una piena.
   */
  it('⛔ spuntino e merenda si contano insieme: 20 + 20 stanno sopra una soglia di 30', () => {
    const a = tante(20, 'morning_snack');
    const b = tante(20, 'afternoon_snack');
    const v = cosaTogliere(
      [...a.righe, ...b.righe, riga('cattiva', 'morning_snack', 'salmone')],
      [...a.ricette, ...b.ricette, ric('salmone', 'pescetarian')],
      30,
    );
    expect(v.daTogliere).toHaveLength(1);
    // Contati separati sarebbero 19 e 20, cioè due caselle «sotto soglia» che non esistono.
    expect(v.caselleSotto).toEqual([]);
  });

  /**
   * ⛔ **Le spente non contano nel pool, ma si tolgono lo stesso.** Il motore non le vede più, però
   * una riga sbagliata resta sbagliata: il giorno che qualcuno riattiva quella ricetta tornerebbe
   * in un paniere che non può mangiarla.
   */
  it('⛔ una ricetta SPENTA fuori regime si toglie, e non conta nel pool', () => {
    const base = tante(3, 'lunch');
    const v = cosaTogliere(
      [...base.righe, riga('spenta', 'lunch', 'salmone')],
      [...base.ricette, ric('salmone', 'pescetarian', false)],
      30,
    );
    expect(v.daTogliere.map((d) => d.id)).toEqual(['spenta']);
    /** ⛔ Ed è il campo che il 2/9 ha fermato una scrittura: attiva e spenta si decidono diverso. */
    expect(v.daTogliere[0].attiva).toBe(false);
    // Il pool era 3 e resta 3: la spenta non c'era già prima, quindi nessuna casella peggiora.
    expect(v.caselleSotto).toEqual([]);
  });

  it('⚠️ una riga che punta a una ricetta che non esiste non si giudica', () => {
    const v = cosaTogliere([riga('orfana', 'lunch', 'sparita')], [], 30);
    expect(v.daTogliere).toEqual([]);
    expect(v.caselleSotto).toEqual([]);
  });

  it('⚠️ celle diverse non si mescolano', () => {
    const v = cosaTogliere(
      [riga('a', 'lunch', 'salmone', 'vegan', 'Mediterranea'), riga('b', 'lunch', 'salmone', 'vegan', 'Low carb')],
      [ric('salmone', 'pescetarian')],
      30,
    );
    expect(v.daTogliere.map((d) => d.chiave).sort())
      .toEqual([chiaveCella('Low carb', 'vegan'), chiaveCella('Mediterranea', 'vegan')]);
  });

  it('le caselle sotto soglia escono dalla più povera', () => {
    const uno = tante(5, 'lunch');
    const due = tante(1, 'dinner');
    const v = cosaTogliere(
      [...uno.righe, ...due.righe, riga('c1', 'lunch', 'salmone'), riga('c2', 'dinner', 'salmone')],
      [...uno.ricette, ...due.ricette, ric('salmone', 'pescetarian')],
      30,
    );
    expect(v.caselleSotto.map((c) => c.slot)).toEqual(['dinner', 'lunch']);
  });

  it('niente da togliere → niente caselle', () => {
    const base = tante(3, 'lunch');
    expect(cosaTogliere(base.righe, base.ricette, 30)).toEqual({ daTogliere: [], caselleSotto: [] });
  });
});
