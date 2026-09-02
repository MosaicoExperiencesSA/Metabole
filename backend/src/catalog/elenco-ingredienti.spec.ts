import { nomiIngredienti, statoElenco } from './elenco-ingredienti';

describe('⛔ statoElenco: «vuoto» sono tre cose diverse', () => {
  it('null e undefined sono «assente»', () => {
    expect(statoElenco(null)).toBe('assente');
    expect(statoElenco(undefined)).toBe('assente');
  });

  /** ⚠️ La colonna è `Json`: dentro ci può finire qualunque cosa, e non è un elenco. */
  it('⚠️ e lo è anche quello che non è un array', () => {
    expect(statoElenco('branzino, limone')).toBe('assente');
    expect(statoElenco({ name: 'branzino' })).toBe('assente');
    expect(statoElenco(42)).toBe('assente');
  });

  it('l’array vuoto è «vuoto» — è il caso di 6a5666fd', () => {
    expect(statoElenco([])).toBe('vuoto');
  });

  /**
   * ⛔ **Il caso che inganna.** `ingredients.length` risponde 2, la ricetta sembra compilata, e non
   * c'è dentro un solo nome che un riconoscitore possa leggere.
   */
  it('⛔ un elenco con righe ma senza nomi è «senza nomi», non «ok»', () => {
    expect(statoElenco([{ qty: 100, unit: 'g' }, { qty: 1, unit: 'pz' }])).toBe('senza nomi');
    expect(statoElenco([{ name: '' }, { name: '   ' }])).toBe('senza nomi');
    expect(statoElenco([{ name: 42 }])).toBe('senza nomi');
  });

  it('basta UN nome leggibile perché sia «ok»', () => {
    expect(statoElenco([{ qty: 100 }, { name: 'branzino', qty: 200, unit: 'g' }])).toBe('ok');
  });
});

/**
 * ⛔ **LA FORMA STRINGA ESISTE IN CATALOGO, E IGNORARLA COSTA RICETTE BUONE.**
 *
 * La prima stesura di questo modulo leggeva solo `[{name}]`. Messa a guardia del generatore avrebbe
 * buttato come «senza ingredienti» cinque piatti validi per pasto — `ingredients: ['ceci','rucola']`
 * — scrivendo pure nel log che erano tornati senza elenco. `vera/dizionario-invecchiato.ts` e
 * `catalog/allergens.ts` la forma stringa la leggevano da sempre: erano loro ad avere ragione.
 */
describe('⛔ la forma stringa: `["ceci", "rucola"]`', () => {
  it('è un elenco «ok», non «senza nomi»', () => {
    expect(statoElenco(['ceci', 'rucola', 'olio evo'])).toBe('ok');
  });

  it('e i nomi si leggono', () => {
    expect(nomiIngredienti(['ceci', ' rucola '])).toEqual(['ceci', 'rucola']);
  });

  it('⚠️ forme miste nello stesso elenco', () => {
    expect(nomiIngredienti(['ceci', { name: 'rucola', qty: 40 }, null, { qty: 1 }, '  ']))
      .toEqual(['ceci', 'rucola']);
  });

  it('⚠️ un elenco di sole stringhe vuote resta «senza nomi»', () => {
    expect(statoElenco(['', '   '])).toBe('senza nomi');
  });
});

describe('nomiIngredienti', () => {
  it('rende i nomi puliti e nient’altro', () => {
    expect(nomiIngredienti([{ name: '  branzino ' }, { qty: 1 }, { name: '' }, { name: 'limone' }]))
      .toEqual(['branzino', 'limone']);
  });

  it('su quello che non è un elenco non esplode: rende vuoto', () => {
    expect(nomiIngredienti(null)).toEqual([]);
    expect(nomiIngredienti('branzino')).toEqual([]);
  });

  /**
   * ⛔ **Perché gli spazi si tolgono**: un `name: '  '` che arriva a `eCarneIngrediente` non trova
   * niente e fa contare una riga in più a chi conta gli ingredienti — cioè fa sembrare compilata
   * una ricetta che non lo è.
   */
  it('⛔ un nome fatto di soli spazi non è un ingrediente', () => {
    expect(nomiIngredienti([{ name: '   ' }])).toEqual([]);
  });
});
