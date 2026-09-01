import { chiaveCoppia, coppiaDellaGiornata, scartaLeCoppieGiaViste } from './coppia-pranzo-cena';

/**
 * ⚠️ Richiesta testuale di Simone del 26/8: *«se a Simone oggi dai a pranzo spaghetti al pomodoro e
 * cena branzino al forno, la prossima volta che a pranzo avrò spaghetti al pomodoro mi devi
 * cambiare la cena»*.
 */
describe('la coppia di una giornata', () => {
  const giornata = (pasti: [string, string][]) => pasti.map(([slot, recipeId]) => ({ slot, recipeId }));

  it('è pranzo e cena, e ignora gli altri pasti', () => {
    expect(coppiaDellaGiornata(giornata([
      ['breakfast', 'c1'], ['lunch', 'spaghetti'], ['afternoon_snack', 's1'], ['dinner', 'branzino'],
    ]))).toBe(chiaveCoppia('spaghetti', 'branzino'));
  });

  /**
   * ⚠️ **L'ordine conta.** «Spaghetti a pranzo e branzino a cena» è una giornata diversa da
   * «branzino a pranzo e spaghetti a cena» — che infatti nessuno servirebbe. Se la chiave fosse
   * l'insieme, vietare la prima vieterebbe anche la seconda.
   */
  it('⚠️ pranzo e cena scambiati NON sono la stessa coppia', () => {
    const a = coppiaDellaGiornata(giornata([['lunch', 'x'], ['dinner', 'y']]));
    const b = coppiaDellaGiornata(giornata([['lunch', 'y'], ['dinner', 'x']]));
    expect(a).not.toBe(b);
  });

  /**
   * ⚠️ Una giornata senza pranzo o senza cena non ha coppia: il digiuno stretto, gli spuntini
   * tolti, una giornata monca. Trattarla come «coppia vuota» vorrebbe dire vietare tutte le altre
   * giornate monche insieme a lei.
   */
  it('⚠️ senza pranzo o senza cena non c\'è coppia, e non è un errore', () => {
    expect(coppiaDellaGiornata(giornata([['breakfast', 'c1'], ['lunch', 'p1']]))).toBeNull();
    expect(coppiaDellaGiornata(giornata([['dinner', 'd1']]))).toBeNull();
    expect(coppiaDellaGiornata([])).toBeNull();
    expect(coppiaDellaGiornata(null)).toBeNull();
  });

  it('una riga senza ricetta non fa coppia con niente', () => {
    expect(coppiaDellaGiornata([{ slot: 'lunch', recipeId: 'p1' }, { slot: 'dinner', recipeId: null }])).toBeNull();
  });
});

describe('scartaLeCoppieGiaViste', () => {
  type C = { pranzo: string; cena: string };
  const k = (c: C) => chiaveCoppia(c.pranzo, c.cena);
  const candidati: C[] = [
    { pranzo: 'spaghetti', cena: 'branzino' },
    { pranzo: 'spaghetti', cena: 'pollo' },
    { pranzo: 'riso', cena: 'branzino' },
  ];

  it('toglie le coppie già servite e tiene le altre', () => {
    const esito = scartaLeCoppieGiaViste(candidati, k, new Set([chiaveCoppia('spaghetti', 'branzino')]));
    expect(esito.ripiegato).toBe(false);
    expect(esito.restano.map(k)).toEqual([chiaveCoppia('spaghetti', 'pollo'), chiaveCoppia('riso', 'branzino')]);
  });

  /**
   * ⛔ **NON SVUOTA MAI.** Con un pool piccolo le coppie si esauriscono, e un divieto che vince
   * sempre diventa «niente da mangiare». Una coppia ripetuta è un difetto di varietà; una giornata
   * vuota è una cliente senza cena. Chi chiama lo sa da `ripiegato`.
   */
  it('⛔ se sono tutte già viste le tiene tutte, e lo dichiara', () => {
    const esito = scartaLeCoppieGiaViste(candidati, k, new Set(candidati.map(k)));
    expect(esito.restano).toHaveLength(3);
    expect(esito.ripiegato).toBe(true);
  });

  it('senza storico non tocca niente', () => {
    const esito = scartaLeCoppieGiaViste(candidati, k, new Set());
    expect(esito.restano).toHaveLength(3);
    expect(esito.ripiegato).toBe(false);
  });

  /** ⚠️ Un candidato senza coppia (giornata monca) passa sempre: non c'è niente da confrontare. */
  it('⚠️ una giornata senza coppia non viene mai scartata', () => {
    const esito = scartaLeCoppieGiaViste(
      [{ pranzo: 'spaghetti', cena: 'branzino' }, { pranzo: '', cena: '' }],
      (c) => (c.pranzo && c.cena ? k(c) : null),
      new Set([chiaveCoppia('spaghetti', 'branzino')]),
    );
    expect(esito.restano).toHaveLength(1);
    expect(esito.ripiegato).toBe(false);
  });

  it('un elenco vuoto resta vuoto senza dichiarare un ripiego', () => {
    expect(scartaLeCoppieGiaViste([], k, new Set(['x|y']))).toEqual({ restano: [], ripiegato: false });
  });
});
