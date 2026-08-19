import { nomeDentro } from './nome-dentro-la-domanda';

const pezzo = (d: string, n: string) => nomeDentro(d, n, 'pezzo_di_parola');
const intere = (d: string, n: string) => nomeDentro(d, n, 'parole_intere');

describe('il nome dentro la domanda — com\'è oggi', () => {
  it('trova il nome dentro la frase: è la ragione per cui la ricerca funziona sulle domande vere', () => {
    expect(pezzo('vorrei sapere del riso basmati', 'riso basmati')).toBe(true);
  });

  /** ⚠️ E lo stesso meccanismo che la fa funzionare la fa sbagliare: sono la stessa riga. */
  it('⚠️ ma trova anche «mela» dentro «melanzane» e «riso» dentro «risotto»', () => {
    expect(pezzo('quante calorie hanno le melanzane', 'mela')).toBe(true);
    expect(pezzo('il risotto quanto pesa', 'riso')).toBe(true);
    expect(pezzo('il panettone', 'pane')).toBe(true);
    expect(pezzo('la melagrana', 'mela')).toBe(true);
  });
});

describe('il nome dentro la domanda — a parole intere', () => {
  it('⚠️ «mela» non è più dentro «melanzane»: è il difetto che si chiude', () => {
    expect(intere('quante calorie hanno le melanzane', 'mela')).toBe(false);
    expect(intere('il risotto quanto pesa', 'riso')).toBe(false);
    expect(intere('il panettone', 'pane')).toBe(false);
    expect(intere('la melagrana', 'mela')).toBe(false);
  });

  it('la mela vera continua a trovarsi, in mezzo, in fondo e in cima', () => {
    expect(intere('quante calorie ha la mela rossa', 'mela')).toBe(true);
    expect(intere('quante calorie ha la mela', 'mela')).toBe(true);
    expect(intere('mela e pera', 'mela')).toBe(true);
    expect(intere('e la mela', 'mela')).toBe(true);
  });

  it('funziona anche sui nomi di più parole', () => {
    expect(intere('vorrei sapere del riso basmati grazie', 'riso basmati')).toBe(true);
  });

  /**
   * ⚠️ IL COSTO VERO, e questo test esiste perché avevo scritto la ragione sbagliata.
   *
   * Avevo scritto «a parole intere si perdono i plurali». **È falso**, e si vede scrivendolo:
   * «melanzana» non è dentro «melanzane», perché finiscono diverse — quel caso oggi non funziona
   * comunque. Il pezzo di parola aiuta solo quando la parola della domanda **allunga il nome della
   * riga in fondo**: «pomodorini» contiene «pomodori». È lo stesso identico meccanismo che fa
   * trovare «mela» dentro «melanzane», e da fuori non si distinguono.
   */
  it('⚠️ il pezzo di parola salva e sbaglia con LA STESSA regola', () => {
    // salva:
    expect(pezzo('quante calorie hanno i pomodorini', 'pomodori')).toBe(true);
    expect(intere('quante calorie hanno i pomodorini', 'pomodori')).toBe(false);
    // sbaglia:
    expect(pezzo('quante calorie hanno le melanzane', 'mela')).toBe(true);
    expect(intere('quante calorie hanno le melanzane', 'mela')).toBe(false);
  });

  /** ⚠️ E il plurale che credevo di perdere non si perde, perché oggi non lo trova nessuno. */
  it('⚠️ il plurale NON è il costo: oggi «melanzana» non combacia con «melanzane» in nessun modo', () => {
    expect(pezzo('quante calorie hanno le melanzane', 'melanzana')).toBe(false);
    expect(intere('quante calorie hanno le melanzane', 'melanzana')).toBe(false);
    expect(pezzo('le melanzane', 'melanzane')).toBe(true);
    expect(intere('quante calorie hanno le melanzane', 'melanzane')).toBe(true);
  });

  /**
   * ⚠️ SI CONTROLLANO TUTTE LE OCCORRENZE, non la prima. Trovato scrivendo il test: fermandosi alla
   * prima, «la melanzana e la mela» direbbe «no» — perché la prima «mela» è dentro «melanzana» — e
   * si perderebbe la mela vera che viene dopo.
   */
  it('⚠️ la seconda occorrenza vale quanto la prima', () => {
    expect(intere('la melanzana e la mela', 'mela')).toBe(true);
    expect(intere('la mela e la melanzana', 'mela')).toBe(true);
  });

  it('il vuoto non trova niente', () => {
    expect(intere('', 'mela')).toBe(false);
    expect(intere('la mela', '')).toBe(false);
  });
});
