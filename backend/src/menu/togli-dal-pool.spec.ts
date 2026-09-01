import { ricetteSpente, togliDalPool } from './togli-dal-pool';

const pool = (o: Record<string, string[]>) =>
  new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]));

describe('togliDalPool', () => {
  it('toglie gli id indicati da ogni slot', () => {
    const p = pool({ lunch: ['a', 'b', 'c'], dinner: ['b', 'd'] });
    const risparmiati = togliDalPool(p, new Set(['b']));
    expect([...p.get('lunch')!]).toEqual(['a', 'c']);
    expect([...p.get('dinner')!]).toEqual(['d']);
    expect(risparmiati).toEqual([]);
  });

  it('⛔ uno slot che resterebbe VUOTO non si svuota, e torna indietro a chi chiama', () => {
    const p = pool({ lunch: ['a', 'b'], dinner: ['x', 'y'] });
    const risparmiati = togliDalPool(p, new Set(['x', 'y']));
    // la cena resta com'era: la regola non si applica lì
    expect([...p.get('dinner')!].sort()).toEqual(['x', 'y']);
    expect(risparmiati).toEqual([{ slot: 'dinner', erano: 2 }]);
    // e il pranzo è stato filtrato lo stesso
    expect([...p.get('lunch')!].sort()).toEqual(['a', 'b']);
  });

  it('⚠️ «erano» è quante ce n\'erano PRIMA: è il numero che va nel log', () => {
    const p = pool({ breakfast: ['a', 'b', 'c', 'd'] });
    expect(togliDalPool(p, new Set(['a', 'b', 'c', 'd']))).toEqual([{ slot: 'breakfast', erano: 4 }]);
  });

  it('un elenco vuoto non tocca niente e non gira sul pool', () => {
    const p = pool({ lunch: ['a'] });
    expect(togliDalPool(p, new Set<string>())).toEqual([]);
    expect([...p.get('lunch')!]).toEqual(['a']);
  });

  it('⚠️ accetta anche una MAPPA id → motivo, che è la forma delle esclusioni', () => {
    const p = pool({ lunch: ['a', 'b'] });
    const fuori = new Map([['a', 'contiene molluschi']]);
    expect(togliDalPool(p, fuori)).toEqual([]);
    expect([...p.get('lunch')!]).toEqual(['b']);
  });
});

describe('ricetteSpente', () => {
  it('rende gli id delle ricette con active falso', () => {
    const out = ricetteSpente([
      { id: 'viva', active: true },
      { id: 'bozza', active: false },
      { id: 'archiviata', active: false },
    ]);
    expect([...out].sort()).toEqual(['archiviata', 'bozza']);
  });

  it('⛔ una ricetta ATTIVA non esce mai', () => {
    expect(ricetteSpente([{ id: 'viva', active: true }]).size).toBe(0);
  });

  /**
   * ⛔ La prova che l'1/9 mancava, e senza la quale il resto non vale: se `active` non c'è, questa
   * funzione **grida**. Trattandolo come «spenta» ogni ricetta uscirebbe dal pool, ogni slot
   * verrebbe risparmiato dalla regola qui sopra, e il pool tornerebbe identico a prima: 54 test
   * verdi senza esercitare una riga. Era esattamente quello che stava succedendo.
   */
  it('⛔ una ricetta senza `active` non è «spenta»: è una lettura sbagliata, e si grida', () => {
    expect(() => ricetteSpente([{ id: 'r1' } as never])).toThrow(/active/);
    expect(() => ricetteSpente([{ id: 'r1' } as never])).toThrow(/r1/);
  });

  it('⚠️ e grida anche se la ricetta senza `active` è in mezzo alle altre', () => {
    expect(() => ricetteSpente([
      { id: 'viva', active: true },
      { id: 'muta' } as never,
    ])).toThrow(/muta/);
  });
});
