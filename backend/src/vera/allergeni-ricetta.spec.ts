import { leggiAllergeni, raccontaScelti, raccontaSuggerimenti } from './allergeni-ricetta';

/**
 * GLI ALLERGENI DELLA RICETTA NUOVA — voce 227.
 * Foglio: `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`.
 *
 * ⚠️ La regola che governa ogni scelta qui dentro: **aggiungere un allergene di troppo costa una
 * ricetta in meno, dimenticarne uno costa una cliente**. Fra i due errori si sceglie sempre lo stesso.
 */

describe('leggiAllergeni — cosa ha risposto il capo', () => {
  it('«sì» conferma quelli che ha appena letto', () => {
    for (const f of ['sì', 'si', 'confermo', 'va bene', 'ok']) {
      expect(leggiAllergeni(f)).toEqual({ tipo: 'tutti' });
    }
  });

  it('«nessuno» è una risposta, e dice che questa ricetta non ne ha', () => {
    for (const f of ['nessuno', 'niente', 'nessun allergene']) {
      expect(leggiAllergeni(f)).toEqual({ tipo: 'nessuno' });
    }
  });

  it('un elenco per etichetta: «latte e uova»', () => {
    expect(leggiAllergeni('latte e uova')).toEqual({ tipo: 'elenco', codici: ['uova', 'latte'] });
  });

  it('l\'etichetta lunga si riconosce intera: «frutta a guscio»', () => {
    expect(leggiAllergeni('frutta a guscio')).toEqual({ tipo: 'elenco', codici: ['frutta_a_guscio'] });
  });

  it('⚠️ si riconosce anche l\'ALIMENTO, non solo il nome dell\'allergene: «le noci» → frutta a guscio', () => {
    // Il capo detta come parla. «Noci» è una parola-chiave di `frutta_a_guscio` in catalog/allergens:
    // usare lo stesso dizionario è ciò che rende questa risposta uguale a quella della scheda.
    expect(leggiAllergeni('le noci')).toEqual({ tipo: 'elenco', codici: ['frutta_a_guscio'] });
  });

  it('la virgola vale come la «e», e un doppione non si conta due volte', () => {
    expect(leggiAllergeni('latte, burro e uova')).toEqual({ tipo: 'elenco', codici: ['uova', 'latte'] });
  });

  it('⚠️ «sì, aggiungi anche il sesamo» NON è un sì secco e NON è un elenco che sostituisce', () => {
    // Le due letture sbagliate sono tutte e due gravi, e in versi opposti: leggerlo come «sì»
    // perde il sesamo; leggerlo come elenco perde TUTTI quelli suggeriti. Si dice quello che è —
    // «questi IN PIÙ» — e chi chiama fa l'unione.
    expect(leggiAllergeni('sì, aggiungi anche il sesamo')).toEqual({ tipo: 'aggiungi', codici: ['sesamo'] });
    expect(leggiAllergeni('va bene, più la soia')).toEqual({ tipo: 'aggiungi', codici: ['soia'] });
  });

  it('⚠️ un elenco SENZA sì sostituisce: è il capo che riscrive la lista', () => {
    expect(leggiAllergeni('solo latte e uova')).toEqual({ tipo: 'elenco', codici: ['uova', 'latte'] });
  });

  it('⚠️ quello che non è né sì né no né un elenco riconosciuto è null: non si indovina', () => {
    for (const f of ['', '   ', 'boh', 'e la cena?']) {
      expect(leggiAllergeni(f)).toBeNull();
    }
  });

  it('⚠️ una frase che nomina allergeni ma non ne riconosce nessuno NON diventa «nessuno»', () => {
    // Dire «non lo so» e dire «non ne ha» sono due cose diverse, e la seconda apre il piatto a
    // tutte. Se non ho capito, richiedo.
    expect(leggiAllergeni('quelli soliti')).toBeNull();
  });
});

describe('raccontaSuggerimenti — si mostra PERCHÉ, non solo cosa', () => {
  const sugg = [
    { allergen: 'pesce', label: 'Pesce', matched: ['orata'] },
    { allergen: 'glutine', label: 'Glutine', matched: ['pangrattato'] },
  ];

  it('per ogni allergene dice la parola dell\'ingrediente che l\'ha fatto scattare', () => {
    const t = raccontaSuggerimenti(sugg);
    expect(t).toContain('Pesce');
    expect(t).toContain('orata');
    expect(t).toContain('Glutine');
    expect(t).toContain('pangrattato');
  });

  it('nessun suggerimento: lo dice, e non finge un elenco vuoto', () => {
    expect(raccontaSuggerimenti([])).toContain('nessun');
  });
});

describe('raccontaScelti — l\'elenco si rilegge prima di scriverlo', () => {
  it('scrive le etichette, non i codici: chi conferma legge parole', () => {
    const t = raccontaScelti(['latte', 'frutta_a_guscio']);
    expect(t).toContain('Latte e derivati');
    expect(t).toContain('Frutta a guscio');
    expect(t).not.toContain('frutta_a_guscio');
  });

  it('l\'elenco vuoto si dice a parole: è la risposta più impegnativa che ci sia', () => {
    expect(raccontaScelti([])).toMatch(/nessun/i);
  });
});
