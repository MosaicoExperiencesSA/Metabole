import { esclusioniDi } from './esclusioni-della-cliente';
import { pastiDaSistemare } from './giorni-non-sicuri';

/**
 * Le due giornate vere di Sonia, misurate il 31/8 — e la terza, quella che era già corretta e che
 * questo controllo NON deve toccare. Se toccasse anche quella, rifarebbe mezzo calendario.
 */
describe('pastiDaSistemare — le giornate già scritte che oggi non passerebbero', () => {
  const e = esclusioniDi({ allergies: ['crostacei', 'solfiti'], intolerances: [], dislikedFoods: [] });
  const ricette = new Map([
    ['g1', { id: 'g1', name: 'Crostacei: Gamberoni al cartoccio', ingredients: [{ name: 'Gamberoni' }], allergens: ['crostacei'] }],
    ['p1', { id: 'p1', name: 'Ricotta con prugne secche', ingredients: [{ name: 'Prugne secche' }], allergens: [] }],
    ['ok', { id: 'ok', name: 'Yogurt e mirtilli', ingredients: [{ name: 'Yogurt' }], allergens: [] }],
  ]);

  it('⛔ il pranzo del 25/8: il piatto non si sarebbe dovuto servire', () => {
    const fuori = pastiDaSistemare([{ slot: 'lunch', recipeId: 'g1' }], ricette, e);
    expect(fuori).toHaveLength(1);
    // ⚠️ non `toContain('Crostacei')`: la ricetta si chiama così, e l'asserzione passerebbe anche
    //    se la giornata fosse finita nel ramo sbagliato (revisione del 31/8).
    expect(fuori[0].motivo).toContain('allergene dichiarato');
  });

  it('⛔ la merenda del 30/8: il piatto va bene, ma la sostituzione non è scritta', () => {
    const fuori = pastiDaSistemare([{ slot: 'afternoon_snack', recipeId: 'p1' }], ricette, e);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].motivo).toContain('manca la sostituzione');
  });

  it('✅ la merenda del 28/8, con la sostituzione già annotata, NON si tocca', () => {
    const fuori = pastiDaSistemare(
      [{ slot: 'afternoon_snack', recipeId: 'p1', substitutions: [{ from: 'Prugne secche', to: 'prugne essiccate in casa a bassa temperatura', reason: 'allergia: solfiti' }] }],
      ricette,
      e,
    );
    expect(fuori).toEqual([]);
  });

  it('una giornata pulita non ha niente da sistemare, e senza esclusioni non si guarda nulla', () => {
    expect(pastiDaSistemare([{ slot: 'breakfast', recipeId: 'ok' }], ricette, e)).toEqual([]);
    const nessuna = esclusioniDi({ allergies: [], intolerances: [], dislikedFoods: [] });
    expect(pastiDaSistemare([{ slot: 'lunch', recipeId: 'g1' }], ricette, nessuna)).toEqual([]);
  });

  it('⛔ un cibo NON GRADITO non fa rifare niente: è una preferenza, non la sicurezza', () => {
    // Senza questo filtro basta scrivere «cipolla» fra i non graditi a calendario già composto
    // perché ogni giornata risulti da rifare, e la coda si porti via tutto il futuro.
    const conGusti = esclusioniDi({ allergies: ['crostacei'], intolerances: [], dislikedFoods: ['cipolla'] });
    const conCipolla = new Map([['c1', { id: 'c1', name: 'Frittata di zucchine', ingredients: [{ name: 'Cipolla' }], allergens: [] }]]);
    expect(pastiDaSistemare([{ slot: 'lunch', recipeId: 'c1' }], conCipolla, conGusti)).toEqual([]);
  });

  it('⛔ una sostituzione scritta con la mappa VECCHIA non è «a posto»', () => {
    // Il `from` combacia, ma quello che la cliente mette in pentola è il `to`.
    const fuori = pastiDaSistemare(
      [{ slot: 'afternoon_snack', recipeId: 'p1', substitutions: [{ from: 'Prugne secche', to: 'prugne sciroppate', reason: 'allergia: solfiti' }] }],
      ricette,
      e,
    );
    expect(fuori).toHaveLength(1);
    expect(fuori[0].motivo).toContain('non è più quella giusta');
  });

  it('⛔ vale anche per le INTOLLERANZE, non solo per le allergie', () => {
    // ⚠️ La `reason` di un'intolleranza è il testo dell'intolleranza («lattosio»), non
    //    «allergia: …»: chi un giorno stringesse il filtro su `startsWith('allergia')`
    //    spegnerebbe il controllo per metà delle clienti con la suite verde. Questo lo impedisce.
    const intollerante = esclusioniDi({ allergies: [], intolerances: ['lattosio'], dislikedFoods: [] });
    const conLatte = new Map([['l1', { id: 'l1', name: 'Pasta al burro', ingredients: [{ name: 'Burro' }], allergens: [] }]]);
    const fuori = pastiDaSistemare([{ slot: 'lunch', recipeId: 'l1' }], conLatte, intollerante);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].motivo).toContain('manca la sostituzione');
  });

  it('un pasto che nomina una ricetta sparita non fa esplodere niente', () => {
    expect(pastiDaSistemare([{ slot: 'lunch', recipeId: 'non-esiste' }, {}], ricette, e)).toEqual([]);
  });
});
