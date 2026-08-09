/**
 * LEGGERE UNA DATA DETTA A PAROLE (richiesta di Simone del 10/8: «Gaia deve essere in grado di
 * modificare la data in maniera discorsiva»).
 *
 * Perché questa parte ha così tanti test: ogni ambiguità decisa male sposta l'inizio del percorso
 * di una persona di giorni, e nessuno rilegge la conferma parola per parola. Il modo in cui te ne
 * accorgi è che il menu arriva quando non lo aspetta — cioè troppo tardi per rimediare.
 *
 * `oggi` è iniettato: è l'unico modo di verificare «lunedì» senza aspettare lunedì, e di far girare
 * gli stessi test a Natale con lo stesso risultato.
 */

import {
  MAX_GIORNI_AVANTI,
  dataAParole,
  leggiData,
  rilevaIntentoDataInizio,
  testoConferma,
  verificaData,
} from './data-inizio-chat';

/** Mercoledì 12 agosto 2026. Scelto di mercoledì: così «lunedì» va avanti e «venerdì» pure. */
const OGGI = new Date('2026-08-12T00:00:00.000Z');

const leggi = (testo: string, oggi = OGGI) => leggiData(testo, oggi);

describe('rilevaIntentoDataInizio', () => {
  it.each([
    'posso cambiare la data di inizio?',
    'vorrei spostare l\'inizio del piano',
    'come faccio a modificare la data di partenza?',
    'volevo iniziare lunedì invece',
    'preferirei partire più tardi',
    'la data di inizio la posso scegliere io?',
  ])('riconosce «%s»', (testo) => {
    expect(rilevaIntentoDataInizio(testo)).toBe(true);
  });

  /**
   * Il riconoscimento è NARROW di proposito, come per le sostituzioni. Un intento generoso
   * dirotterebbe in un dialogo a domande chiuse conversazioni che parlano d'altro: la cliente
   * chiede «quando inizio a vedere i risultati?» e si sente rispondere «da quando vuoi partire?».
   * Non aver capito costa una frase; aver capito male costa la conversazione.
   */
  it.each([
    'quando inizio a vedere i risultati?',
    'oggi ho iniziato la giornata bene',
    'a che ora posso mangiare?',
    'vorrei cambiare la colazione',
    'quando si sblocca il prossimo menu?',
  ])('NON riconosce «%s»', (testo) => {
    expect(rilevaIntentoDataInizio(testo)).toBe(false);
  });
});

describe('leggiData', () => {
  it('data ISO scritta per esteso', () => {
    expect(leggi('metti 2026-09-15')).toBe('2026-09-15');
  });

  /**
   * IL GIORNO VIENE PRIMA DEL MESE. In Italia si scrive così, e leggere «15/9» all'americana non
   * darebbe un errore: darebbe una data valida a mesi di distanza, confermata da una cliente che
   * legge «15 settembre» nella risposta a parole e dice sì.
   */
  it('numerico italiano: il giorno prima del mese', () => {
    expect(leggi('il 15/9')).toBe('2026-09-15');
    expect(leggi('dal 3-9-2026')).toBe('2026-09-03');
    expect(leggi('1/9/26')).toBe('2026-09-01');
  });

  it('mese scritto a parole, «primo» compreso', () => {
    expect(leggi('il 15 settembre')).toBe('2026-09-15');
    expect(leggi('il primo settembre')).toBe('2026-09-01');
  });

  it('oggi, domani, dopodomani', () => {
    expect(leggi('domani')).toBe('2026-08-13');
    expect(leggi('dopodomani')).toBe('2026-08-14');
    expect(leggi('oggi')).toBe('2026-08-12');
    // «Subito» è una data, non un modo di dire: chi lo scrive vuole cominciare adesso.
    expect(leggi('vorrei partire subito')).toBe('2026-08-12');
  });

  it('«fra N giorni / settimane», anche col numero a parole', () => {
    expect(leggi('fra 3 giorni')).toBe('2026-08-15');
    expect(leggi('tra una settimana')).toBe('2026-08-19');
    expect(leggi('fra due settimane')).toBe('2026-08-26');
  });

  /** Il mese è un mese di CALENDARIO: «fra un mese» il 12 agosto è il 12 settembre, non +30 giorni. */
  it('«fra un mese» conta i mesi, non i trenta giorni', () => {
    expect(leggi('fra un mese')).toBe('2026-09-12');
  });

  /**
   * «Lunedì» detto di mercoledì è il lunedì che viene. E «lunedì» detto di LUNEDÌ è il lunedì
   * PROSSIMO, non oggi: chi dice il nome di un giorno intende un giorno che deve ancora venire —
   * per oggi avrebbe detto «oggi». Interpretarlo come oggi farebbe partire il piano il giorno
   * stesso, che è l'errore più difficile da rimediare (il menu è già in mano).
   */
  it('nome del giorno: sempre la prossima occorrenza', () => {
    expect(leggi('lunedì')).toBe('2026-08-17');
    expect(leggi('venerdì')).toBe('2026-08-14');
    // Lunedì 17 dice «lunedì» → il 24, non il 17.
    expect(leggi('lunedì', new Date('2026-08-17T00:00:00.000Z'))).toBe('2026-08-24');
  });

  /** Col numero accanto, vince il numero: è più preciso del nome del giorno. */
  it('«lunedì 31 agosto» usa il numero', () => {
    expect(leggi('lunedì 31 agosto')).toBe('2026-08-31');
  });

  it('«il 15» senza mese: questo mese se non è passato', () => {
    expect(leggi('il 15')).toBe('2026-08-15');
    // Il 3 è passato → il 3 del mese prossimo. Senza questa regola il flusso rifiuterebbe una
    // data che la cliente ha detto correttamente.
    expect(leggi('il 3')).toBe('2026-09-03');
  });

  /**
   * Fine anno: «il 3 gennaio» detto il 20 dicembre è dell'anno DOPO. Senza il rinvio dell'anno
   * sarebbe una data di dieci mesi fa, e Gaia risponderebbe «quel giorno è già passato» a una
   * cliente che ha detto una cosa giusta.
   */
  it('a dicembre, un mese di inizio anno è dell\'anno dopo', () => {
    expect(leggi('il 3 gennaio', new Date('2026-12-20T00:00:00.000Z'))).toBe('2027-01-03');
    expect(leggi('3/1', new Date('2026-12-20T00:00:00.000Z'))).toBe('2027-01-03');
  });

  it('l\'anno detto per esteso si rispetta', () => {
    expect(leggi('15/9/2027')).toBe('2027-09-15');
  });

  it.each([
    'non lo so',
    'quando vuoi tu',
    'appena posso',
    'dopo le vacanze',
    'boh',
  ])('non inventa niente su «%s»', (testo) => {
    expect(leggi(testo)).toBeNull();
  });

  /**
   * `Date.UTC(2027, 1, 31)` non dà errore: dà il **3 marzo**. Una data che nessuno ha detto,
   * plausibile, che passerebbe tutti i controlli a valle e finirebbe nella conferma a parole
   * («mercoledì 3 marzo») dove nessuno la collega al «31/2» scritto per sbaglio.
   */
  it('scarta le date impossibili invece di farle scivolare', () => {
    expect(leggi('31/2/2027')).toBeNull();
    expect(leggi('30 febbraio')).toBeNull();
    expect(leggi('il 31', new Date('2026-09-05T00:00:00.000Z'))).toBeNull();
  });
});

describe('verificaData', () => {
  it('oggi va bene, ieri no', () => {
    expect(verificaData('2026-08-12', OGGI)).toBeNull();
    expect(verificaData('2026-08-11', OGGI)).toBe('passata');
  });

  it(`oltre ${MAX_GIORNI_AVANTI} giorni è troppo lontana`, () => {
    const limite = new Date(OGGI.getTime() + MAX_GIORNI_AVANTI * 86_400_000).toISOString().slice(0, 10);
    const oltre = new Date(OGGI.getTime() + (MAX_GIORNI_AVANTI + 1) * 86_400_000).toISOString().slice(0, 10);
    expect(verificaData(limite, OGGI)).toBeNull();
    expect(verificaData(oltre, OGGI)).toBe('troppo_lontana');
  });
});

describe('i testi', () => {
  /**
   * La data si rilegge sempre A PAROLE, mai come `2026-09-15`. È l'unica difesa che ha la cliente
   * contro un errore di lettura: «lunedì 17 agosto» si riconosce sbagliato a occhio, una data in
   * cifre no.
   */
  it('dataAParole scrive giorno della settimana, numero e mese', () => {
    expect(dataAParole('2026-09-15')).toBe('martedì 15 settembre');
  });

  it('la conferma nomina inizio E sblocco, e chiede sì/no', () => {
    const t = testoConferma('2026-09-15', '2026-09-13', 'Giulia');
    expect(t).toContain('Giulia');
    expect(t).toContain('martedì 15 settembre');
    expect(t).toContain('domenica 13 settembre');
    expect(t.toLowerCase()).toContain('confermi');
  });
});
