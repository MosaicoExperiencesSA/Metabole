import {
  confrontaIngredienti,
  fraseConfermaDecaduta,
  laConfermaDecade,
  nomeConfrontabile,
} from './conferma-allergeni-decade';

const ing = (...nomi: string[]) => nomi.map((name, i) => ({ name, qty: 10 * (i + 1), unit: 'g' }));

describe('nomeConfrontabile', () => {
  it('minuscole, accenti, punteggiatura e spazi: «Farina 00 » è «farina 00»', () => {
    expect(nomeConfrontabile('Farina 00 ')).toBe('farina 00');
    expect(nomeConfrontabile('Sedàno,  rapa')).toBe('sedano rapa');
  });

  it('quello che non è una stringa non è un nome', () => {
    expect(nomeConfrontabile(null)).toBe('');
    expect(nomeConfrontabile(42)).toBe('');
  });
});

describe('confrontaIngredienti', () => {
  it('stessi nomi, quantità diverse: uguali — una quantità non sposta un allergene', () => {
    expect(confrontaIngredienti(
      [{ name: 'Farina 00', qty: 80, unit: 'g' }],
      [{ name: 'Farina 00', qty: 120, unit: 'g' }],
    )).toBe('uguali');
  });

  it('l\'ORDINE non conta: spostare una riga nel form non è una modifica', () => {
    expect(confrontaIngredienti(ing('uova', 'latte'), ing('latte', 'uova'))).toBe('uguali');
  });

  it('uno in più, uno in meno, uno rinominato: cambiati', () => {
    expect(confrontaIngredienti(ing('uova'), ing('uova', 'latte'))).toBe('cambiati');
    expect(confrontaIngredienti(ing('uova', 'latte'), ing('uova'))).toBe('cambiati');
    expect(confrontaIngredienti(ing('latte'), ing('latte di soia'))).toBe('cambiati');
  });

  /**
   * ⚠️ IL CASO CHE VALE PIÙ DI TUTTI: stesso numero di ingredienti, uno scambiato. Un confronto
   * fatto sulla LUNGHEZZA della lista — la scorciatoia che viene in mente per prima — direbbe
   * «uguali», e il piatto resterebbe in catalogo con la conferma di quando c'era la farina.
   */
  it('⚠️ stesso NUMERO ma uno scambiato: cambiati', () => {
    expect(confrontaIngredienti(ing('farina', 'uova'), ing('mandorle', 'uova'))).toBe('cambiati');
  });

  it('quello che non si legge si dichiara illeggibile, non «uguale»', () => {
    expect(confrontaIngredienti('non-una-lista', ing('uova'))).toBe('illeggibili');
    expect(confrontaIngredienti(ing('uova'), null)).toBe('illeggibili');
    expect(confrontaIngredienti(ing('uova'), [{ qty: 10 }])).toBe('illeggibili');
  });
});

describe('laConfermaDecade', () => {
  it('confermata + ingredienti cambiati = decade', () => {
    expect(laConfermaDecade(true, ing('farina'), ing('mandorle'))).toBe(true);
  });

  it('confermata + solo le quantità = resta', () => {
    expect(laConfermaDecade(true, [{ name: 'farina', qty: 80 }], [{ name: 'farina', qty: 100 }])).toBe(false);
  });

  /**
   * ⚠️ `updateRecipe` aggiorna SOLO i campi inviati: chi salva il nome o le stagioni non manda
   * `ingredients`. Senza questo ramo, cambiare il titolo di una ricetta le toglierebbe la conferma
   * degli allergeni — e il difetto sarebbe peggiore di quello che stiamo correggendo.
   */
  it('⚠️ un salvataggio che NON tocca gli ingredienti non fa decadere niente', () => {
    expect(laConfermaDecade(true, ing('farina'), undefined)).toBe(false);
  });

  it('non confermata: non c\'è niente da far decadere', () => {
    expect(laConfermaDecade(false, ing('farina'), ing('mandorle'))).toBe(false);
  });

  /**
   * ⚠️ Su un campo di sicurezza «non ho capito» vale «non è confermato», mai il contrario. Se gli
   * ingredienti arrivano in una forma che non si sa leggere, si azzera.
   */
  it('⚠️ ingredienti illeggibili: si azzera, perché il dubbio sta dalla parte sicura', () => {
    expect(laConfermaDecade(true, ing('farina'), 'boh')).toBe(true);
  });
});

describe('fraseConfermaDecaduta — deve dire la CONSEGUENZA e DOVE si rimedia', () => {
  it('col nome della ricetta', () => {
    expect(fraseConfermaDecaduta('Torta di mele').startsWith('Torta di mele:')).toBe(true);
  });

  it('senza nome resta una frase', () => {
    expect(fraseConfermaDecaduta(null).startsWith('Questa ricetta:')).toBe(true);
  });

  /** ⚠️ «Conferma azzerata» è gergo nostro: chi legge non capisce che il piatto ha appena smesso
   *  di entrare nei menu, e non sa dove andare a rimediare. */
  it('⚠️ dice che non entra più nei menu, dove si riconferma, e che i menu già consegnati restano', () => {
    const f = fraseConfermaDecaduta('Torta');
    expect(f).toContain('NON entra nei menu nuovi');
    expect(f).toContain('«Allergeni ricette»');
    expect(f).toContain('già consegnati non cambiano');
  });
});
