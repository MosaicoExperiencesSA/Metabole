import {
  contieneAlimento,
  decisioneLattosio,
  eFormaggioStagionatoSicuro,
  usaDelattosati,
} from './lattosio';

/**
 * La regola del lattosio (11/8/2026). Il test che conta davvero è il primo del secondo blocco:
 * **a chi è allergica al latte il delattosato non si propone mai.** Tutti gli altri casi sono
 * qualità del menu; quello è sicurezza.
 */

describe('usaDelattosati — chi riceve la sostituzione', () => {
  it('sì: intollerante al lattosio, nessuna allergia', () => {
    expect(usaDelattosati({ intolerances: ['lactose'], allergies: [] })).toBe(true);
  });

  it('sì anche se l’intolleranza è scritta in italiano', () => {
    expect(usaDelattosati({ intolerances: ['lattosio'] })).toBe(true);
    expect(usaDelattosati({ intolerances: ['intolleranza al lattosio'] })).toBe(true);
  });

  /**
   * IL CASO GIUSY: `allergies: ['latte']` + `intolerances: ['lactose']`. Il delattosato contiene
   * tutte le proteine del latte — l'idrolisi toglie lo zucchero, non l'allergene. Proporglielo
   * significherebbe mandarle in tavola ciò che le fa male con un'etichetta che la rassicura.
   */
  it('NO se è allergica al latte, anche se è pure intollerante', () => {
    expect(usaDelattosati({ intolerances: ['lactose'], allergies: ['latte'] })).toBe(false);
  });

  it.each(['latticini', 'caseina', 'proteine del latte', 'APLV', 'siero di latte', 'Formaggi'])(
    'NO con allergia dichiarata come «%s»',
    (allergia) => {
      expect(usaDelattosati({ intolerances: ['lactose'], allergies: [allergia] })).toBe(false);
    },
  );

  it('no se non è intollerante al lattosio', () => {
    expect(usaDelattosati({ intolerances: ['gluten'], allergies: [] })).toBe(false);
    expect(usaDelattosati({})).toBe(false);
  });
});

describe('i formaggi stagionati non si sostituiscono', () => {
  it.each(['Parmigiano Reggiano', 'grana padano', 'pecorino romano', 'gorgonzola', 'emmental', 'parmigiano grattugiato'])(
    '«%s» si tiene così com’è (lattosio in milligrammi)',
    (nome) => {
      expect(eFormaggioStagionatoSicuro(nome)).toBe(true);
      expect(decisioneLattosio(nome)).toEqual({ azione: 'tieni' });
    },
  );

  it('la mozzarella invece si sostituisce: è fresca', () => {
    expect(eFormaggioStagionatoSicuro('mozzarella')).toBe(false);
    expect(decisioneLattosio('mozzarella di bufala')).toEqual({ azione: 'sostituisci', con: 'mozzarella senza lattosio' });
  });
});

describe('decisioneLattosio — la sostituzione', () => {
  it('il latte diventa latte SENZA LATTOSIO, non bevanda vegetale', () => {
    expect(decisioneLattosio('latte parzialmente scremato')).toEqual({
      azione: 'sostituisci',
      con: 'latte senza lattosio',
    });
  });

  it.each([
    ['yogurt greco', 'yogurt senza lattosio'],
    ['ricotta di mucca', 'ricotta senza lattosio'],
    ['panna fresca', 'panna senza lattosio'],
    ['stracchino', 'stracchino senza lattosio'],
  ])('«%s» → «%s»', (dentro, atteso) => {
    expect(decisioneLattosio(dentro)).toEqual({ azione: 'sostituisci', con: atteso });
  });

  /**
   * ⛔ **I DERIVATI VEGETALI NON SI SOSTITUISCONO** (4/9 sera): «ricotta di mandorla senza lattosio»
   * sarebbe un latticino aggiunto a un piatto vegano — la forma del difetto del 31/8 («latte di
   * cocco»), su una forma che le frasi non conoscevano. La regola è `derivatoVegetale` in
   * `exclusions.ts`, letta e non ricopiata.
   */
  it.each(['ricotta di mandorla', 'formaggio di anacardi', 'yogurt di cocco', 'mozzarella di riso', 'latte d\'avena'])(
    '⛔ «%s» è vegetale: non si sostituisce',
    (dentro) => {
      expect(decisioneLattosio(dentro)).toBeNull();
    },
  );

  it('⛔ ma «ricotta di pecora» sì, e «frittata di zucchine» non c\'entra col lattosio', () => {
    expect(decisioneLattosio('ricotta di pecora')).toEqual({ azione: 'sostituisci', con: 'ricotta senza lattosio' });
  });

  it('il burro resta all’olio evo: il burro delattosato non si trova al supermercato', () => {
    expect(decisioneLattosio('burro')).toEqual({ azione: 'sostituisci', con: 'olio evo' });
  });

  it('quello che è già senza lattosio non si sostituisce due volte', () => {
    expect(decisioneLattosio('latte senza lattosio')).toEqual({ azione: 'tieni' });
    expect(decisioneLattosio('yogurt delattosato')).toEqual({ azione: 'tieni' });
  });

  it('su un ingrediente che non c’entra non dice niente', () => {
    expect(decisioneLattosio('petto di pollo')).toBeNull();
    expect(decisioneLattosio('')).toBeNull();
  });
});

describe('confronto per parola, non per sottostringa', () => {
  /**
   * La trappola che nel progetto ha già morso tre volte. Qui il caso concreto è «latte» dentro
   * «latteria» e «cioccolato al latte»: il primo non è latte, il secondo sì.
   */
  it('«latteria» non è «latte»', () => {
    expect(contieneAlimento('latteria', 'latte')).toBe(false);
    expect(decisioneLattosio('latteria')).toBeNull();
  });

  it('ma «cioccolato al latte» contiene latte', () => {
    expect(contieneAlimento('cioccolato al latte', 'latte')).toBe(true);
  });

  it('un nome composto combacia solo se ci sono TUTTE le parole', () => {
    expect(contieneAlimento('parmigiano reggiano dop', 'parmigiano reggiano')).toBe(true);
    expect(contieneAlimento('parmigiano', 'parmigiano reggiano')).toBe(false);
  });
});
