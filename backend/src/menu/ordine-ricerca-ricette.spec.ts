/**
 * ⛔ **CHI COMINCIA CON QUELLO CHE HAI SCRITTO STA IN CIMA** — richiesta di Simone, 8/9, con lo
 * screenshot: cercando «yogurt» uscivano *Ciotola granola vegan e yogurt di cocco*, *Coppa yogurt di
 * soia*, *Grano saraceno…* — cioè l'ordine alfabetico, che è l'ordine di nessuna domanda.
 */
import { LIVELLO, livelloDiSomiglianza, ordinaPerSomiglianza } from './ordine-ricerca-ricette';

describe('a che livello somiglia', () => {
  it('⛔ il nome che COMINCIA con la parola sta al primo livello', () => {
    expect(livelloDiSomiglianza('Yogurt greco con frutta', 'yogurt')).toBe(LIVELLO.comincia);
  });

  it('⛔ una PAROLA che comincia così sta al secondo', () => {
    expect(livelloDiSomiglianza('Coppa yogurt di soia con granola', 'yogurt')).toBe(LIVELLO.parolaComincia);
  });

  it('⛔ e chi la contiene soltanto sta al terzo', () => {
    expect(livelloDiSomiglianza('Coppa yogurt di soia', 'gurt')).toBe(LIVELLO.contiene);
  });

  it('⚠️ chi non la contiene affatto non ha livello', () => {
    expect(livelloDiSomiglianza('Orata al forno', 'yogurt')).toBeNull();
  });

  /** ⚠️ Maiuscole e spazi attorno non contano: chi cerca scrive di fretta. */
  it('⚠️ maiuscole e spazi attorno non spostano niente', () => {
    expect(livelloDiSomiglianza('YOGURT greco', '  YoGurt ')).toBe(LIVELLO.comincia);
  });

  it('⚠️ a campo vuoto non c\'è nessun livello: non si sta cercando niente', () => {
    expect(livelloDiSomiglianza('Yogurt greco', '   ')).toBeNull();
  });
});

/**
 * ⛔ **L'ORDINE VERO, sull'elenco vero dello screenshot dell'8/9.**
 */
describe('come si rimettono in fila', () => {
  const elenco = [
    { nome: 'Ciotola granola vegan e yogurt di cocco' },
    { nome: 'Coppa yogurt di soia con granola fatta in casa e mirtilli' },
    { nome: 'Grano saraceno in chicchi con albicocche secche, mandorle e yogurt di cocco' },
    { nome: 'Granola Croccante e Yogurt di Cocco' },
    { nome: 'Yogurt greco con frutta secca' },
  ];

  it('⛔ «Yogurt greco» passa davanti a tutti', () => {
    expect(ordinaPerSomiglianza(elenco, 'yogurt')[0].nome).toBe('Yogurt greco con frutta secca');
  });

  /**
   * ⚠️ **E dietro di lui restano tutti**: questa funzione ordina, non filtra. Chi filtra è la query,
   * e due posti che filtrano sono due posti che un giorno filtrano cose diverse.
   */
  it('⚠️ non butta via niente: cambia l\'ordine, non l\'elenco', () => {
    expect(ordinaPerSomiglianza(elenco, 'yogurt')).toHaveLength(elenco.length);
  });

  /**
   * ⛔ **Dentro il livello si torna all'alfabetico.** Senza, due ricerche uguali danno due ordini
   * diversi a seconda di come il database ha restituito le righe, e chi cerca due volte la stessa
   * cosa vede due elenchi diversi senza aver cambiato niente.
   */
  /**
   * ⛔ **IL SECONDO LIVELLO PASSA DAVANTI AL TERZO ANCHE QUANDO L'ALFABETO DICE IL CONTRARIO** —
   * aggiunta l'8/9 da una revisione avversariale: invertendo i due livelli **tutte** le prove
   * restavano verdi, perché nelle fixture di prima chi era al secondo livello veniva prima anche in
   * ordine alfabetico. Una prova che non distingue due casi non sorveglia la regola che li separa.
   */
  it('⛔ «parola che comincia» batte «lo contiene» anche contro l\'alfabeto', () => {
    const fila = ordinaPerSomiglianza(
      [{ nome: 'Sorriso di mele e cannella' }, { nome: 'Zuppa di riso e verdure' }],
      'riso',
    ).map((r) => r.nome);
    /** ⚠️ «Sorriso» viene prima in alfabeto, ma «riso» lì è in mezzo a una parola. */
    expect(fila).toEqual(['Zuppa di riso e verdure', 'Sorriso di mele e cannella']);
  });

  /**
   * ⛔ **E l'alfabetico dentro il livello si prova su una fila SPARSA.** Con una fixture già in
   * ordine, `Array.prototype.sort` è stabile e la prova resta verde anche svuotando il comparatore:
   * misurato l'8/9, sopravviveva.
   */
  it('⛔ dentro lo stesso livello l\'alfabetico rimette in fila davvero', () => {
    const fila = ordinaPerSomiglianza(
      [{ nome: 'Zuppa di riso' }, { nome: 'Insalata di riso' }, { nome: 'Crema di riso' }],
      'riso',
    ).map((r) => r.nome);
    expect(fila).toEqual(['Crema di riso', 'Insalata di riso', 'Zuppa di riso']);
  });

  it('⛔ dentro lo stesso livello vale l\'alfabetico', () => {
    const fila = ordinaPerSomiglianza(elenco, 'yogurt').map((r) => r.nome);
    // Tutte queste hanno «yogurt» come inizio di parola: fra loro decide l'alfabeto.
    expect(fila.slice(1)).toEqual([
      'Ciotola granola vegan e yogurt di cocco',
      'Coppa yogurt di soia con granola fatta in casa e mirtilli',
      'Grano saraceno in chicchi con albicocche secche, mandorle e yogurt di cocco',
      'Granola Croccante e Yogurt di Cocco',
    ]);
  });

  /** ⛔ Chi somiglia meno finisce in fondo, ma resta: «gurt» trova ancora la coppa. */
  it('⛔ i tre livelli si vedono tutti insieme', () => {
    const fila = ordinaPerSomiglianza(
      [{ nome: 'Coppa yogurt di soia' }, { nome: 'Yogurt greco' }, { nome: 'Orata al forno' }],
      'yogurt',
    ).map((r) => r.nome);
    expect(fila).toEqual(['Yogurt greco', 'Coppa yogurt di soia', 'Orata al forno']);
  });

  it('⚠️ a campo vuoto l\'elenco non si tocca: resta quello che ha dato la query', () => {
    const dato = [{ nome: 'Zuppa' }, { nome: 'Amaranto' }];
    expect(ordinaPerSomiglianza(dato, '')).toBe(dato);
  });

  /**
   * ⚠️ **La definizione di «parola» è grezza, e lo è di proposito**: è la stessa che sa fare la
   * query (`contains: ' ' + cerca`). Una più fine qui darebbe il secondo livello a righe che la
   * query non è andata a prendere — un ordine che promette una completezza che non c'è.
   */
  it('⚠️ dopo una parentesi non è «inizio di parola»: la query non saprebbe cercarlo', () => {
    expect(livelloDiSomiglianza('Coppa (yogurt di soia)', 'yogurt')).toBe(LIVELLO.contiene);
  });
});
