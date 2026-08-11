import {
  conRicettaNelloSlot, giorniDi, giornoNellaSettimana, pastiDi, senzaRicetta, settimanaDi,
} from './collega-ricetta';

/**
 * Collegare una ricetta a una giornata: la parte che decide **cosa resta scritto** nella giornata.
 *
 * Il rischio di questa funzione non è rompersi, è funzionare male in silenzio: le giornate sono un
 * JSON, e un pasto sovrascritto o duplicato non dà nessun errore — si scopre quando una cliente
 * riceve due cene, o quando un piatto scelto con cura non c'è più e nessuno sa quando è sparito.
 */

describe('settimane e giorni', () => {
  it.each([[1, 1], [7, 1], [8, 2], [14, 2], [15, 3], [84, 12]])(
    'il giorno %i sta nella settimana %i',
    (giorno, settimana) => expect(settimanaDi(giorno)).toBe(settimana),
  );

  it('la settimana ha sette giorni, in fila', () => {
    expect(giorniDi(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(giorniDi(3)).toEqual([15, 16, 17, 18, 19, 20, 21]);
  });

  it('il posto dentro la settimana torna a 1 a ogni settimana', () => {
    expect(giornoNellaSettimana(1)).toBe(1);
    expect(giornoNellaSettimana(7)).toBe(7);
    expect(giornoNellaSettimana(8)).toBe(1);
    expect(giornoNellaSettimana(15)).toBe(1);
  });
});

describe('pastiDi — un JSON di cui non ci si può fidare', () => {
  it('tiene solo i pasti con slot e ricetta', () => {
    expect(pastiDi([
      { slot: 'lunch', recipeId: 'r1' },
      { slot: 'dinner' },
      { slot: 'dinner', recipeId: '' },
      { recipeId: 'r2' },
      null,
      'guasto',
    ])).toEqual([{ slot: 'lunch', recipeId: 'r1' }]);
  });

  it('un `meals` che non è un array non fa cadere niente', () => {
    expect(pastiDi(null)).toEqual([]);
    expect(pastiDi({ slot: 'lunch' })).toEqual([]);
    expect(pastiDi(undefined)).toEqual([]);
  });
});

describe('conRicettaNelloSlot — mettere il piatto nella giornata', () => {
  const giornata = [
    { slot: 'breakfast', recipeId: 'colazione' },
    { slot: 'lunch', recipeId: 'pranzo' },
    { slot: 'dinner', recipeId: 'cena-vecchia' },
  ];

  it('⚠️ LASCIA I PASTI NELL\'ORDINE DELLA GIORNATA', () => {
    // L'app disegna i pasti nell'ordine dell'array e il motore ne eredita l'ordine dalla prima
    // giornata del ciclo: mettere in fondo lo slot appena toccato sposta la colazione dopo la cena
    // per tutte le clienti di quella dieta. È il difetto che un `toContainEqual` non vede.
    const e = conRicettaNelloSlot([{ slot: 'lunch', recipeId: 'p' }, { slot: 'dinner', recipeId: 'c' }], 'breakfast', 'col');
    expect(e.meals).toEqual([
      { slot: 'breakfast', recipeId: 'col' },
      { slot: 'lunch', recipeId: 'p' },
      { slot: 'dinner', recipeId: 'c' },
    ]);
  });

  it('riordina anche i cinque pasti, e anche quando la giornata arriva in disordine', () => {
    const e = conRicettaNelloSlot(
      [{ slot: 'dinner', recipeId: 'c' }, { slot: 'breakfast', recipeId: 'col' }, { slot: 'morning_snack', recipeId: 's' }],
      'afternoon_snack', 'm',
    );
    expect(e.meals.map((m) => m.slot)).toEqual(['breakfast', 'morning_snack', 'afternoon_snack', 'dinner']);
  });

  it('togliere un pasto non scompiglia l\'ordine degli altri', () => {
    const e = senzaRicetta(
      [{ slot: 'dinner', recipeId: 'c' }, { slot: 'breakfast', recipeId: 'col' }, { slot: 'lunch', recipeId: 'p' }],
      'c',
    );
    expect(e.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch']);
  });

  it('sostituisce il piatto che c\'era nello stesso slot, e lo DICE', () => {
    const e = conRicettaNelloSlot(giornata, 'dinner', 'cena-nuova');
    expect(e.sostituito).toBe('cena-vecchia');
    expect(e.meals).toHaveLength(3);
    expect(e.meals.filter((m) => m.slot === 'dinner')).toEqual([{ slot: 'dinner', recipeId: 'cena-nuova' }]);
  });

  it('non tocca gli altri pasti della giornata', () => {
    const e = conRicettaNelloSlot(giornata, 'dinner', 'cena-nuova');
    expect(e.meals).toContainEqual({ slot: 'breakfast', recipeId: 'colazione' });
    expect(e.meals).toContainEqual({ slot: 'lunch', recipeId: 'pranzo' });
  });

  it('su uno slot libero aggiunge senza sostituire niente', () => {
    const e = conRicettaNelloSlot([{ slot: 'lunch', recipeId: 'pranzo' }], 'dinner', 'cena');
    expect(e.sostituito).toBeNull();
    expect(e.meals).toHaveLength(2);
  });

  it('su una giornata che non esiste ancora scrive il solo pasto', () => {
    const e = conRicettaNelloSlot(undefined, 'dinner', 'cena');
    expect(e.meals).toEqual([{ slot: 'dinner', recipeId: 'cena' }]);
    expect(e.sostituito).toBeNull();
  });

  it('ricollegare la STESSA ricetta non duplica e non dichiara una sostituzione', () => {
    // Succede: si clicca due volte, o si ricollega un piatto che c'è già. Duplicarlo darebbe due
    // cene nella stessa giornata, e nessun controllo a valle se ne accorgerebbe.
    const e = conRicettaNelloSlot(giornata, 'dinner', 'cena-vecchia');
    expect(e.giaCosi).toBe(true);
    expect(e.sostituito).toBeNull();
    expect(e.meals.filter((m) => m.slot === 'dinner')).toHaveLength(1);
  });

  it('una giornata con due pasti nello stesso slot (dato sporco) ne lascia uno solo', () => {
    const e = conRicettaNelloSlot(
      [{ slot: 'dinner', recipeId: 'a' }, { slot: 'dinner', recipeId: 'b' }],
      'dinner',
      'c',
    );
    expect(e.meals).toEqual([{ slot: 'dinner', recipeId: 'c' }]);
  });
});

describe('senzaRicetta — togliere il piatto', () => {
  it('toglie la ricetta e lascia il resto', () => {
    const e = senzaRicetta([
      { slot: 'lunch', recipeId: 'pranzo' },
      { slot: 'dinner', recipeId: 'da-togliere' },
    ], 'da-togliere');
    expect(e.tolta).toBe(true);
    expect(e.meals).toEqual([{ slot: 'lunch', recipeId: 'pranzo' }]);
  });

  it('cerca per RICETTA, non per slot', () => {
    // Se nel frattempo qualcun altro ha messo un'altra cena in quella giornata, «togli questa
    // ricetta» non deve togliere la sua: sarebbe una cancellazione a nome di un altro.
    const e = senzaRicetta([{ slot: 'dinner', recipeId: 'un-altra-cena' }], 'la-mia');
    expect(e.tolta).toBe(false);
    expect(e.meals).toEqual([{ slot: 'dinner', recipeId: 'un-altra-cena' }]);
  });

  it('la giornata può restare vuota: è una giornata da riempire, non un errore', () => {
    const e = senzaRicetta([{ slot: 'dinner', recipeId: 'sola' }], 'sola');
    expect(e.tolta).toBe(true);
    expect(e.meals).toEqual([]);
  });
});
