import { controllaIban, normalizzaIban } from './iban';

/**
 * ⚠️ GLI IBAN DI PROVA SONO COSTRUITI, NON INVENTATI.
 *
 * Quelli validi qui sotto hanno la cifra di controllo calcolata davvero (sono gli esempi ufficiali
 * ISO/SWIFT, che non appartengono a nessun conto). Un IBAN «plausibile» scritto a mano avrebbe una
 * probabilità su 97 di passare il mod-97: un test che sembra verificare e in realtà tira a
 * indovinare è peggio di nessun test.
 */
const VALIDI = [
  'IT60X0542811101000000123456', // Italia, l'esempio classico
  'DE89370400440532013000',
  'FR1420041010050500013M02606',
  'GB29NWBK60161331926819',
  'ES9121000418450200051332',
  'NL91ABNA0417164300',
];

describe('controllaIban — la cifra di controllo, non la lunghezza', () => {
  it.each(VALIDI)('%s è valido', (i) => {
    expect(controllaIban(i)).toEqual({ valido: true, iban: i });
  });

  it('accetta come lo scrivono le persone: spazi, minuscole, trattini', () => {
    expect(controllaIban('it60 x054 2811 1010 0000 0123 456')).toEqual({
      valido: true,
      iban: 'IT60X0542811101000000123456',
    });
    expect(normalizzaIban(' de89-3704 0044 0532 0130 00 ')).toBe('DE89370400440532013000');
  });

  it('⚠️ una cifra sbagliata NON passa — è il refuso che il vecchio controllo lasciava andare', () => {
    // Stessa lunghezza, stessa forma: per il controllo «fra 15 e 34 caratteri» era perfetto.
    const sbagliato = 'IT60X0542811101000000123457';
    expect(sbagliato.length).toBe(27);
    expect(controllaIban(sbagliato).valido).toBe(false);
  });

  it('⚠️ due cifre invertite NON passano', () => {
    const invertito = 'IT60X0542811101000000123465';
    expect(invertito.length).toBe(27);
    expect(controllaIban(invertito).valido).toBe(false);
  });

  it('la O al posto dello zero non passa (ed è l’errore che si fa davvero)', () => {
    expect(controllaIban('IT6OX0542811101000000123456').valido).toBe(false);
  });

  it('un IBAN italiano di lunghezza sbagliata lo dice, e dice quanto dovrebbe essere', () => {
    const e = controllaIban('IT60X05428111010000001234');
    expect(e.valido).toBe(false);
    expect(e.valido === false && e.perche).toContain('27 caratteri');
  });

  it('un paese che non abbiamo in tabella passa col solo mod-97 (non si rifiuta per ignoranza)', () => {
    // Tunisia: non è nell'elenco delle lunghezze, ma la cifra di controllo torna.
    expect(controllaIban('TN5910006035183598478831').valido).toBe(true);
  });

  it('forma sbagliata: lo dice in modo che si possa correggere', () => {
    expect(controllaIban('').valido).toBe(false);
    const e = controllaIban('6012345678901234567890');
    expect(e.valido === false && e.perche).toContain('due lettere del paese');
  });

  it('non basta essere lungo: il vecchio controllo accettava questo', () => {
    const finto = 'IT00AAAAAAAAAAAAAAAAAAAAAAA';
    expect(finto.length).toBeGreaterThanOrEqual(15);
    expect(finto.length).toBeLessThanOrEqual(34);
    expect(controllaIban(finto).valido).toBe(false);
  });

  it('il mod-97 non arrotonda: un IBAN lungo al massimo si calcola giusto', () => {
    // Malta, 31 caratteri: il numero da dividere ha 62 cifre. Se il conto si facesse in un
    // `Number` solo, qui comincerebbe a sbagliare in silenzio.
    expect(controllaIban('MT84MALT011000012345MTLCAST001S').valido).toBe(true);
  });
});
