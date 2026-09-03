/**
 * ⛔ **LE QUATTRO CORTESIE della pagina «frasi che non ho capito».**
 *
 * Su venticinque frasi in novanta giorni, quattro erano queste: «ok», «ok ciao», «Quale?», «ok
 * annulla tutto». ⚠️ Sembrano le meno importanti e sono quelle che fanno sembrare l'agente stupido:
 * *«ok» che riceve «non ci arrivo» è la risposta che una persona racconta agli altri.*
 */
import { diceDiFermarsi, leggiCortesia, rispostaCortesia } from './cortesie';

describe('le quattro frasi vere della pagina', () => {
  it('⛔ «ok» è una presa d\'atto, non un «non ci arrivo»', () => {
    expect(leggiCortesia('ok')).toBe('presa-atto');
  });

  /** ⛔ Il saluto vince sulla presa d'atto: «ok ciao» è un congedo, non un «va bene». */
  it('⛔ «ok ciao» è un congedo', () => {
    expect(leggiCortesia('ok ciao')).toBe('saluto');
  });

  it('⛔ «Quale?» è una domanda senza contesto, non una frase incomprensibile', () => {
    expect(leggiCortesia('Quale?')).toBe('quale');
  });

  /** ⚠️ La quarta la prende la regola larga, non questa: vedi il blocco in fondo. */
  it('⛔ «ok annulla tutto» dice di fermarsi', () => {
    expect(diceDiFermarsi('ok annulla tutto')).toBe(true);
  });
});

describe('le altre forme che arrivano da una tastiera vera', () => {
  it.each([
    ['ok.', 'presa-atto'], ['OK!!', 'presa-atto'], ['va bene', 'presa-atto'],
    ['perfetto', 'presa-atto'], ['capito', 'presa-atto'], ['ricevuto', 'presa-atto'],
    ['ciao', 'saluto'], ['a domani', 'saluto'], ['buonanotte', 'saluto'],
    ['grazie ciao', 'saluto'], ['ci sentiamo', 'saluto'],
    ['grazie', 'grazie'], ['grazie mille', 'grazie'], ['ok grazie', 'grazie'],
    ['chi?', 'quale'], ['cosa?', 'quale'], ['come', 'quale'],
  ])('⚠️ «%s» → %s', (frase, atteso) => {
    expect(leggiCortesia(frase)).toBe(atteso);
  });

  /** ⚠️ Le emoji ai due capi non cambiano la frase: «ok 👍» è «ok». */
  it('⚠️ un pollice in su non spiazza', () => {
    expect(leggiCortesia('ok 👍')).toBe('presa-atto');
    expect(leggiCortesia('👍')).toBeNull(); // ⚠️ da sola non è una cortesia riconosciuta: si dirà «non ci arrivo»
  });
});

describe('⛔ quello che NON deve prendere', () => {
  /**
   * ⛔ **L'errore che costa.** «ok» dentro un'istruzione è un intercalare: prenderlo vorrebbe dire
   * mangiarsi l'istruzione e rispondere «va bene» a una regola che non è stata scritta. È
   * `capisci` a togliere il saluto davanti, non questo modulo.
   */
  it.each([
    'ok togli il tonno',
    'ok, a Giulia niente formaggi molli',
    'va bene ma togli il pesce',
    'grazie, adesso togli il tonno a Giulia',
    'ciao Vera, hai la lista dei formaggi molli?',
    'quale formaggio posso dare a Giulia?',
    'perfetto il menu di Giulia ma togli il tonno',
  ])('⛔ «%s» NON è una cortesia', (frase) => {
    expect(leggiCortesia(frase)).toBeNull();
  });

  /** ⚠️ E una frase lunga non lo è mai, qualunque cosa contenga. */
  it('⚠️ una frase lunga non è una cortesia', () => {
    expect(leggiCortesia('ok '.repeat(30))).toBeNull();
  });

  it('⚠️ il vuoto non è una cortesia', () => {
    for (const f of ['', '   ', '...', '?']) expect(leggiCortesia(f)).toBeNull();
  });
});

describe('⛔ «fermati» vale OVUNQUE, le cortesie solo da sole', () => {
  /**
   * ⛔ **La frase vera che l'ha insegnato**: «lascia stare, ti chiamo Lucia». Whole-phrase sarebbe
   * scivolata fino a far proporre a Vera di ribattezzarsi — difetto trovato in revisione, e c'è
   * una prova nel servizio che lo tiene fermo.
   */
  it.each(['annulla', 'annulla tutto', 'lascia stare, ti chiamo Lucia', 'no ferma tutto per favore'])(
    '⛔ «%s» dice di fermarsi',
    (frase) => { expect(diceDiFermarsi(frase)).toBe(true); },
  );

  it('⚠️ e una frase normale no', () => {
    expect(diceDiFermarsi('a Giulia niente formaggi molli')).toBe(false);
    expect(diceDiFermarsi('ok')).toBe(false);
  });
});

describe('le risposte', () => {
  /**
   * ⛔ **Chi scrive «ok» a vuoto crede che qualcosa sia in sospeso.** Un «va bene» e basta la
   * lascerebbe convinta di aver confermato qualcosa: dirle che non c'era niente è l'unica risposta
   * che le fa capire cos'è successo.
   */
  it('⛔ la presa d\'atto dice che non c\'era niente in sospeso', () => {
    expect(rispostaCortesia('presa-atto')).toContain('non c\'era niente in sospeso');
  });

  /** ⛔ E «Quale?» non è «non ci arrivo»: la frase è chiarissima, è il contesto che manca. */
  it('⛔ a «Quale?» si risponde che manca il contesto, non che non si è capito', () => {
    const r = rispostaCortesia('quale');
    expect(r).toContain('non so a cosa ti riferisci');
    expect(r).not.toContain('non ci arrivo');
  });

  /** ⚠️ Ognuna dice anche come si riparte, tranne il congedo: uno schermo vuoto è gentile e inutile. */
  it.each(['presa-atto', 'grazie', 'quale'] as const)('⚠️ «%s» dice come si riparte', (c) => {
    expect(rispostaCortesia(c)).toContain('Giulia Rossi');
  });

  it('⚠️ il congedo non promette un «a presto» che non decide lei', () => {
    expect(rispostaCortesia('saluto')).not.toMatch(/a presto/i);
  });

  /** ⚠️ Niente markdown: le risposte di Vera si leggono anche fuori dalla chat. */
  it.each(['presa-atto', 'saluto', 'grazie', 'quale'] as const)('⚠️ «%s» non ha markdown', (c) => {
    expect(rispostaCortesia(c)).not.toMatch(/\*\*|__|`/);
  });
});
