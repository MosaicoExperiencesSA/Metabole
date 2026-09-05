import { allergeniMancantiDaAggiungere, contaMancanti } from './allergeni-mancanti';

describe('allergeniMancantiDaAggiungere: aggiunge, mai toglie', () => {
  it('⛔ la spigola senza tag pesce lo guadagna, e la riga dice da quale ingrediente', () => {
    expect(allergeniMancantiDaAggiungere({ id: '1', name: 'Spigola', ingredients: [{ name: 'spigola' }], allergens: [] }))
      .toEqual([{ allergen: 'pesce', ingrediente: 'spigola' }]);
  });

  it('⚠️ chi ce l\'ha già non guadagna niente, e un tag a mano NON si toglie mai', () => {
    expect(allergeniMancantiDaAggiungere({ id: '2', name: 'Spigola', ingredients: [{ name: 'spigola' }], allergens: ['pesce', 'sesamo'] })).toEqual([]);
  });

  /** ⛔ Toccata a mano: neanche per aggiungere — un tag che lei aveva tolto apposta non si rimette a macchina. */
  it('⛔ una lista scelta a mano non si tocca nemmeno per aggiungere', () => {
    expect(allergeniMancantiDaAggiungere({ id: '3', name: 'Spigola', ingredients: [{ name: 'spigola' }], allergens: [], toccataAMano: true })).toEqual([]);
  });

  it('⛔ «pasta senza glutine» non fa guadagnare il glutine', () => {
    expect(allergeniMancantiDaAggiungere({ id: '4', name: 'Pasta', ingredients: [{ name: 'pasta senza glutine' }], allergens: [] })).toEqual([]);
  });

  it('conta per allergene, e quante portano la spunta', () => {
    const c = contaMancanti([
      { id: '1', name: 'Spigola', ingredients: [{ name: 'spigola' }], allergens: [], allergensReviewed: true },
      { id: '2', name: 'Seppie', ingredients: [{ name: 'seppie' }], allergens: [], allergensReviewed: false },
      { id: '3', name: 'Ok', ingredients: [{ name: 'riso' }], allergens: [] },
    ]);
    expect(c).toMatchObject({ esaminate: 3, daRiparare: 2, confermate: 1 });
    expect(c.perAllergene.map((x) => [x.allergen, x.ricette])).toEqual([['pesce', 1], ['molluschi', 1]]);
  });
});
