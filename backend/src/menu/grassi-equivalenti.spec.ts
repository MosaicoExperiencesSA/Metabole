/**
 * ⛔ **I NUMERI DI NOCANTY, PROVATI SUI SUOI STESSI ESEMPI.**
 *
 * La tabella è arrivata il 24/8 (fonte CREA / USDA), riferimento **olio EVO = 100**. Il caso che ha
 * fatto nascere tutto — 70 ml di panna → 70 g di olio, +77% sul piatto — qui diventa il caso che il
 * codice deve risolvere, e il numero atteso è quello che ha scritto lui: **~25 g**.
 */
import {
  GRUPPO_GRASSI,
  TOLLERANZA_CON_FATTORE,
  comeConvertire,
  coppiaDaNonPermettere,
  leggiFattori,
  nelGruppoDeiGrassi,
  pesoDi,
  quantitaEquivalente,
  sembraUnGrasso,
} from './grassi-equivalenti';

/** La tabella firmata da Nocanty il 24/8, com'è nel seed. */
const MEMBERS = {
  items: [
    'olio evo', 'olio extravergine di oliva', 'olio di sesamo', 'ghee', 'olio di cocco',
    'burro', 'panna fresca', 'olio di avocado', 'margarina', 'mascarpone',
  ],
  fattori: {
    riferimento: 'olio extravergine di oliva',
    fonte: 'CREA / USDA',
    pesi: {
      'olio evo': 100,
      'olio extravergine di oliva': 100,
      'olio di sesamo': 100,
      ghee: 100,
      'olio di cocco': 101,
      burro: 120,
      'panna fresca': 285,
      'olio di avocado': 100,
      margarina: 122,
      mascarpone: 212,
    },
  },
};

const F = leggiFattori(MEMBERS)!;

describe('⛔ leggere i pesi dal gruppo', () => {
  it('legge riferimento, fonte e tutti i pesi', () => {
    expect(F.riferimento).toBe('olio extravergine di oliva');
    expect(F.fonte).toBe('CREA / USDA');
    expect(Object.keys(F.pesi)).toHaveLength(10);
  });

  /**
   * ⛔ **«olio evo» e «olio extravergine di oliva» sono DUE righe.** Il confronto fra nomi di
   * alimento è **per parola** («pepe» ⊄ «peperoni»), quindi le due forme non combaciano fra loro — e
   * il catalogo le usa tutte e due (3024 ricette la lunga, 1706 la corta). Con una sola riga metà
   * delle ricette resterebbe senza peso, e Gaia passerebbe la mano su cambi che sa fare.
   */
  it('⛔ le due forme del nome dell’olio hanno tutte e due il peso', () => {
    expect(pesoDi(F, 'olio evo')).toBe(100);
    expect(pesoDi(F, 'olio extravergine di oliva')).toBe(100);
  });

  it('senza fattori rende null: il gruppo normale non diventa un gruppo di grassi', () => {
    expect(leggiFattori({ items: ['carote', 'biete'] })).toBeNull();
    expect(leggiFattori(null)).toBeNull();
    expect(leggiFattori({ fattori: {} })).toBeNull();
  });

  /**
   * ⛔ **Un peso illeggibile si scarta, non diventa zero.** `Number('')` è 0, e con un peso a zero la
   * proporzione fa una divisione per zero o una quantità infinita — cioè un numero assurdo dentro il
   * piatto di una persona invece di un cambio che non si fa.
   */
  it('⛔ i pesi illeggibili, negativi o a zero si scartano', () => {
    const f = leggiFattori({
      fattori: { riferimento: 'olio', pesi: { olio: 100, burro: 'boh', panna: 0, ghee: -5, margarina: '122' } },
    })!;
    expect(Object.keys(f.pesi).sort()).toEqual(['margarina', 'olio']);
    expect(f.pesi.margarina).toBe(122); // una stringa numerica sì: la scrive un campo di testo
  });

  it('⚠️ e se non resta nessun peso valido il gruppo non porta fattori', () => {
    expect(leggiFattori({ fattori: { riferimento: 'olio', pesi: { burro: 'boh' } } })).toBeNull();
  });
});

describe('⛔ trovare il peso di un alimento', () => {
  it('per parola, non per sottostringa', () => {
    expect(pesoDi(F, 'panna fresca')).toBe(285);
    expect(pesoDi(F, 'burro')).toBe(120);
    expect(pesoDi(F, 'mascarpone')).toBe(212);
  });

  it('⚠️ un alimento che il gruppo non conosce non ha peso', () => {
    expect(pesoDi(F, 'carote')).toBeNull();
    expect(pesoDi(F, 'olio di semi')).toBeNull(); // Nocanty non l'ha messo: non si indovina
  });

  /**
   * ⛔ **Non c'è nessuna «riga più specifica»: il confronto è per NOME ESATTO.** Il commento della
   * prima stesura prometteva una precedenza che l'implementazione non ha — e non deve avere, perché
   * la precedenza è esattamente quello che faceva prendere a «burro di arachidi» il peso del burro.
   * Riscritto in revisione, 25/8: il test dice quello che il codice fa.
   */
  it('⛔ ogni riga vale solo per il suo nome: «olio» non copre «olio di cocco»', () => {
    const f = leggiFattori({ fattori: { riferimento: 'olio', pesi: { olio: 100, 'olio di cocco': 101 } } })!;
    expect(pesoDi(f, 'olio di cocco')).toBe(101);
    expect(pesoDi(f, 'olio')).toBe(100);
    // ⛔ E un nome che nessuna riga nomina non eredita niente da nessuno.
    expect(pesoDi(f, 'olio di semi')).toBeNull();
    expect(pesoDi(f, 'olio di cocco vergine')).toBeNull();
  });
});

describe('⛔ la conversione: il caso che ha fatto nascere il lavoro', () => {
  /**
   * ⛔ **70 g di panna → 25 g di olio.** È il numero che Nocanty ha scritto nella sua risposta, e il
   * cambio che prima veniva proposto a 70 → 70, portando un piatto da 500 kcal a ~890.
   */
  it('⛔ 70 g di panna fresca diventano 25 g di olio, non 70', () => {
    expect(quantitaEquivalente(70, pesoDi(F, 'panna fresca')!, pesoDi(F, 'olio extravergine di oliva')!)).toBe(25);
  });

  /** ⛔ E nell'altro verso, che è l'altro modo di sbagliare: un piatto molto più povero del piano. */
  it('⛔ e 25 g di olio tornano 71 g di panna: la conversione regge nei due sensi', () => {
    expect(quantitaEquivalente(25, pesoDi(F, 'olio extravergine di oliva')!, pesoDi(F, 'panna fresca')!)).toBe(71);
  });

  it('⚠️ burro → olio: 60 g diventano 50', () => {
    expect(quantitaEquivalente(60, 120, 100)).toBe(50);
  });

  it('⚠️ fra due alimenti con lo stesso peso la quantità non cambia', () => {
    expect(quantitaEquivalente(40, 100, 100)).toBe(40);
  });

  /**
   * ⚠️ **Si arrotonda, e sotto il grammo si tiene 1**: «0 g di olio» vorrebbe dire togliere
   * l'ingrediente senza dirlo, che è un cambio diverso da quello concordato.
   */
  it('⚠️ non scende mai a zero', () => {
    expect(quantitaEquivalente(1, 285, 100)).toBe(1);
  });

  it('⚠️ e numeri assurdi non producono una quantità: non si scrive niente', () => {
    expect(quantitaEquivalente(0, 100, 100)).toBeNull();
    expect(quantitaEquivalente(70, 0, 100)).toBeNull();
    expect(quantitaEquivalente(70, 100, Number.NaN)).toBeNull();
  });
});

describe('⛔ le coppie che in cucina non reggono', () => {
  /**
   * ⛔ Nocanty, 24/8: *«escludere dal cambio automatico diretto la coppia Panna → Olio EVO nelle
   * preparazioni culinarie come vellutate o salse, dove la sostituzione altera radicalmente la
   * consistenza e la riuscita del piatto»*. Venticinque grammi di olio in una vellutata sono
   * aritmeticamente giusti e culinariamente un altro piatto.
   */
  it('⛔ panna → olio in una vellutata NON si fa da sola', () => {
    expect(coppiaDaNonPermettere('panna fresca', 'olio extravergine di oliva', 'Vellutata di zucca')).toBe(true);
  });

  it('⛔ e nemmeno in una salsa', () => {
    expect(coppiaDaNonPermettere('panna fresca', 'olio evo', 'Salsa ai funghi')).toBe(true);
  });

  /** ⚠️ La controprova: nello stesso piatto, nell'altro verso, la consistenza non si rovina. */
  it('⚠️ ma olio → panna nella stessa vellutata sì: è la direzione che conta', () => {
    expect(coppiaDaNonPermettere('olio extravergine di oliva', 'panna fresca', 'Vellutata di zucca')).toBe(false);
  });

  /** ⚠️ E fuori da quelle preparazioni il cambio passa: la regola è sul piatto, non sulla coppia. */
  it('⚠️ panna → olio in un piatto che non è una salsa passa', () => {
    expect(coppiaDaNonPermettere('panna fresca', 'olio evo', 'Filetto di vitello ai funghi')).toBe(false);
  });

  it('⚠️ e due grassi che non sono cremoso→olio non sono toccati dalla regola', () => {
    expect(coppiaDaNonPermettere('burro', 'margarina', 'Vellutata di zucca')).toBe(false);
  });

  it('⚠️ senza nome del piatto non si inventa niente', () => {
    expect(coppiaDaNonPermettere('panna fresca', 'olio evo', '')).toBe(false);
  });
});

describe('⛔ Strada B dove c’è il numero, Strada A dove non c’è', () => {
  /**
   * ⛔ La scelta di Nocanty: *«Strada B per il gruppo "Oli e grassi da condimento" e Strada A
   * (gestione manuale con inoltro al nutrizionista) per tutte le altre categorie di grassi più
   * complesse o disomogenee»*. Il default sicuro è **non proporre niente** senza un numero.
   */
  it('⛔ un grasso con il peso dichiarato è Strada B', () => {
    expect(nelGruppoDeiGrassi(F, 'burro')).toBe(true);
  });

  it('⛔ un grasso SENZA peso non è Strada B: si passa la mano', () => {
    expect(nelGruppoDeiGrassi(F, 'olio di semi')).toBe(false);
    expect(nelGruppoDeiGrassi(F, 'strutto')).toBe(false);
  });

  it('⚠️ e senza il gruppo affatto, niente conversione', () => {
    expect(nelGruppoDeiGrassi(null, 'burro')).toBe(false);
  });
});

describe('⚠️ le costanti che il resto del codice cerca per nome', () => {
  it('il gruppo si chiama come l’ha chiamato Nocanty', () => {
    expect(GRUPPO_GRASSI).toBe('Oli e grassi da condimento');
  });

  /**
   * ⛔ **0,20, chiesto da lui**, perché il blocco di sicurezza — scattando — ripiega su **pari
   * grammatura**, cioè sull'errore che questo lavoro toglie.
   *
   * ⚠️ E la misura che accompagna la regola: con i numeri di oggi **non morde**. Il rapporto più
   * basso è olio ← panna, 100/285 = 0,35, che passava già con 0,33. Serve per i valori che Nocanty
   * aggiungerà, e questo test lo dice invece di lasciarlo credere attivo.
   */
  it('⛔ la tolleranza con il fattore è 0,20', () => {
    expect(TOLLERANZA_CON_FATTORE).toBe(0.2);
  });

  it('⚠️ e oggi nessuna coppia della tabella ci arriva: il rapporto più basso è 0,35', () => {
    const pesi = Object.values(F.pesi);
    const minimo = Math.min(...pesi) / Math.max(...pesi);
    expect(Number(minimo.toFixed(2))).toBe(0.35);
    expect(minimo).toBeGreaterThan(TOLLERANZA_CON_FATTORE);
  });
});

/**
 * ⛔ **LA RETE CHE NON DIPENDE DALLA TABELLA** — il difetto trovato dalla revisione del 25/8.
 *
 * «È un grasso?» era risposto dalla tabella dei pesi stessa. Con il gruppo rinominato, rimesso in
 * bozza o non ancora seminato, *nessuno* dei due alimenti risultava un grasso e il codice tornava a
 * **pari grammatura senza inoltro e senza avviso** — cioè il difetto originale intatto, proprio nel
 * momento in cui la tabella era in manutenzione.
 */
describe('⛔ «sembra un grasso» anche senza la tabella', () => {
  it('⛔ senza fattori una coppia di grassi NON diventa pari grammatura: si passa la mano', () => {
    expect(comeConvertire(null, 'panna fresca', 'burro')).toEqual({ modo: 'passa_la_mano' });
  });

  it('⛔ e basta che UNO dei due sia un grasso', () => {
    expect(comeConvertire(F, 'olio di semi', 'carote')).toEqual({ modo: 'passa_la_mano' });
    expect(comeConvertire(F, 'carote', 'strutto')).toEqual({ modo: 'passa_la_mano' });
  });

  it('⚠️ le verdure restano a pari grammatura: la stragrande maggioranza dei cambi non si tocca', () => {
    expect(comeConvertire(F, 'carote', 'biete')).toEqual({ modo: 'pari' });
    expect(comeConvertire(null, 'carote', 'biete')).toEqual({ modo: 'pari' });
  });

  it('⛔ con tutti e due i pesi si converte, e i pesi tornano nel verso giusto', () => {
    expect(comeConvertire(F, 'panna fresca', 'olio extravergine di oliva')).toEqual({
      modo: 'converti',
      pesoDa: 285,
      pesoA: 100,
    });
  });

  /**
   * ⛔ **La direzione della proporzione, provata sul risultato.** `pesoDa` e `pesoA` scambiati fanno
   * 70 g di panna → **200 g di olio** invece di 25: un numero che nessuno rilegge e che triplica i
   * grassi del piatto. Il test guarda i due campi *e* il numero che ne esce.
   */
  it('⛔ pesoDa è quello di partenza, non quello di arrivo', () => {
    const m = comeConvertire(F, 'panna fresca', 'olio evo');
    expect(m.modo).toBe('converti');
    if (m.modo !== 'converti') return;
    expect(quantitaEquivalente(70, m.pesoDa, m.pesoA)).toBe(25);
  });

  it('⚠️ e «burro di arachidi» non eredita il peso del burro: è un altro alimento', () => {
    expect(pesoDi(F, 'burro di arachidi')).toBeNull();
    expect(sembraUnGrasso('burro di arachidi')).toBe(true); // ma si riconosce lo stesso: si passa la mano
    expect(comeConvertire(F, 'burro di arachidi', 'olio evo')).toEqual({ modo: 'passa_la_mano' });
  });

  it('⚠️ la rete riconosce i grassi per parola, non per pezzo di parola', () => {
    expect(sembraUnGrasso('olio extravergine')).toBe(true);
    expect(sembraUnGrasso('panna da cucina')).toBe(true);
    expect(sembraUnGrasso('petto di pollo')).toBe(false);
    expect(sembraUnGrasso('burrata')).toBe(false); // «burro» ⊄ «burrata»: è per parola
  });
});
