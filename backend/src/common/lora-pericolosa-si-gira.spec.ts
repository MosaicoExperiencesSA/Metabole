/**
 * ⛔ **LA SUITE DEVE GIRARE ANCHE ALL'ORA IN CUI SI ROMPE — e questo test lo tiene fermo.**
 *
 * ## Il difetto che questo file chiude
 *
 * Fino al 23/8 la suite del backend era **verde 22 ore su 24 e rossa 2**: fra la mezzanotte e le
 * 02:00 italiane (l'01:00 in ora solare) il giorno di Roma e il giorno UTC non coincidono, e quattro
 * file di test cadevano. Nessuno se ne accorgeva perché nessuno lancia i test all'una di notte, e la
 * CI gira all'ora vera come tutti.
 *
 * ⛔ Ma il conto vero è peggiore di quattro file di test. Girando la suite a quell'ora sono venuti
 * fuori **due difetti di prodotto** e **un test verde per la ragione sbagliata**:
 *
 *  · la finestra di blocco della data d'inizio, dichiarata di 24 ore, ne durava **22**: contava fino
 *    alla mezzanotte UTC invece che a quella di Roma. Sbagliava nel verso che costa — l'app diceva
 *    «si può» nelle ultime due ore utili — e mentiva anche sul numero di ore mostrato alla cliente;
 *  · `statoPerInizio` riceveva un **giorno** da quattro dei cinque punti che scrivono, e lo
 *    confrontava come un **istante**: fra mezzanotte e le due, «comincio oggi» nasceva `queued` e i
 *    menu arrivavano un giorno dopo. È il difetto che la voce 258 dichiarava chiuso, sopravvissuto
 *    nelle due ore in cui i due giorni divergono;
 *  · il dedup «una notifica al giorno» era provato con una riga finta **senza data**, e passava solo
 *    perché `Intl.DateTimeFormat.format(undefined)` formatta *adesso*.
 *
 * ⚠️ Cioè: l'ora scomoda non trovava dei test rotti — trovava del **prodotto** rotto, che di giorno
 * si comporta bene. È il difetto di famiglia di questo progetto in forma temporale: qualcosa che
 * dichiara di sapere una cosa che non sa, per due ore al giorno.
 *
 * ## Perché serve un test e non basta averli corretti
 *
 * Perché la regola vale finché qualcuno la gira. Come `il-giorno-si-chiede.spec.ts` guarda i
 * sorgenti per impedire che il difetto del fuso rientri da un file nuovo, questo guarda **la CI e
 * l'orologio**: se il passo notturno sparisce, o l'orologio finto smette di essere finto all'ora
 * giusta, si rompe qui — non fra sei mesi, all'una di notte, addosso a qualcun altro.
 *
 * ⛔ **E i controlli qui dentro sono stati mutati uno per uno**, perché la prima stesura di questo
 * file era verde su tre mutazioni su cinque: confrontava stringhe, e una riga commentata via o una
 * proprietà tolta la lasciavano indifferente. Un guardiano che non distingue il caso che deve
 * vietare è peggio di nessun guardiano, perché **dichiara** di guardare. Adesso le proprietà che
 * contano si chiedono al codice (`oraPericolosa`, `iGiorniDivergono`, `TIMER_VERI`) e solo la forma
 * del file si legge dal sorgente — dopo aver tolto i commenti.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { iGiorniDivergono, oraPericolosa } from '../../test/ora-pericolosa';
import { TIMER_VERI } from '../../test/orologio-fermo';

/** La radice del backend: questo file sta in `src/common/`. */
const BACKEND = join(__dirname, '..', '..');
const RADICE = join(BACKEND, '..');
const OROLOGIO = join(BACKEND, 'test', 'orario-pericoloso.ts');

/**
 * ⚠️ **Stringa vuota, non `undefined`.** `oraPericolosa` ha `process.env.ORA_FINTA` come valore di
 * default del secondo argomento: passando `undefined` il default scatta lo stesso, e questi test
 * misuravano l'ora scelta **da chi li stava lanciando** invece di quella calcolata. Si vedeva solo
 * girando `ORA_FINTA=… npm run test:notte`, cioè esattamente lo strumento che questa consegna
 * aggiunge — e il guardiano è diventato il primo a inciamparci.
 */
const SENZA_OVERRIDE = '';

/** Toglie commenti e stringhe: qui sotto le formule vietate COMPAIONO, spiegate nei commenti. */
function soloCodice(sorgente: string): string {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

describe('⛔ la suite si gira anche all\'ora pericolosa', () => {
  it('⛔ esiste `npm run test:notte`, e usa l\'orologio finto', () => {
    const pkg = JSON.parse(readFileSync(join(BACKEND, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:notte']).toBeDefined();
    expect(pkg.scripts['test:notte']).toContain('orario-pericoloso');
  });

  /**
   * ⚠️ **E la CI si legge senza i commenti.** La prima stesura guardava il file grezzo: commentando
   * via il passo — che è il modo naturale in cui uno lo toglierebbe «per un attimo» — questo test
   * restava verde, e dichiarava di tenere fermo un passo che non c'era più. Trovato in revisione,
   * ed è la stessa mutazione che aveva già battuto il controllo qui sotto.
   */
  it('⛔ e la CI lo lancia: una verifica che si ricorda a mano non è una verifica', () => {
    const ci = readFileSync(join(RADICE, '.github', 'workflows', 'ci.yml'), 'utf8')
      .split('\n')
      .filter((r) => !r.trimStart().startsWith('#'))
      .join('\n');
    expect(ci).toMatch(/npm run test:notte/);
    // ⚠️ E che non sia spento con un `if: false`, che è l'altro modo di toglierlo senza toglierlo.
    expect(ci).not.toMatch(/if:\s*'?false'?/);
  });

  /**
   * ⛔ **E LA PROVA CHE L'OROLOGIO NOTTURNO STIA DAVVERO SPOSTANDO L'ORA.**
   *
   * ⚠️ Questo è il controllo che mancava, ed è quello che conta più di tutti: gli altri guardano la
   * **forma** del file dell'orologio — che ci sia una `useFakeTimers` fuori dagli hook, che
   * `doNotFake` sia quello giusto — ma nessuno guardava il valore di `now`. Sostituendolo con l'ora
   * vera, `npm run test:notte` diventava un doppione esatto di `npm test` e **tutto restava verde**,
   * guardiano compreso: la CI avrebbe continuato a dire due volte la stessa cosa, e il quinto file
   * col difetto del fuso si sarebbe scritto lo stesso. Trovato in revisione.
   *
   * ⚠️ Quando la suite gira normalmente questo test non ha niente da dire e lo dichiara: non finge
   * una verifica che in quel giro non può fare.
   */
  it('⛔ sotto `test:notte` i due giorni divergono DAVVERO (e sotto `test` non si finge)', () => {
    const setup: string[] = ((global as unknown as { __OROLOGIO_NOTTURNO__?: boolean }).__OROLOGIO_NOTTURNO__
      ? ['acceso']
      : []) as string[];
    if (!setup.length) {
      // Giro normale: l'orologio notturno non è caricato, e non c'è niente da controllare.
      expect(iGiorniDivergono(oraPericolosa(new Date(), SENZA_OVERRIDE))).toBe(true);
      return;
    }
    // Giro notturno: «adesso» deve essere già dentro la fascia.
    expect(iGiorniDivergono(new Date())).toBe(true);
  });

  /**
   * ⛔ **L'ISTANTE SCELTO DEVE CADERE DAVVERO NELLA FASCIA CHE DIVIDE I DUE GIORNI.**
   *
   * ⚠️ Qui non si confronta una stringa: si **chiede alla funzione** e si calcola. Un test che
   * controllasse che nel sorgente c'è scritto `22:30` sarebbe verde anche se il fuso dell'azienda
   * cambiasse, o se l'ora venisse spostata «per fare prima». La domanda vera è una sola — a
   * quell'istante il giorno di Roma e quello UTC sono diversi? — e si può fare al fuso invece che a
   * memoria.
   *
   * ⚠️ E si fa su **quattro giorni dell'anno**, non su uno: in ora solare la fascia è larga un'ora
   * invece di due, e un istante scelto male sarebbe stato dentro d'estate e fuori d'inverno — cioè
   * un guardiano che smette di guardare in ottobre.
   */
  it.each([
    ['piena estate', '2026-08-22T12:00:00.000Z'],
    ['pieno inverno', '2027-01-14T12:00:00.000Z'],
    ['il giorno in cui finisce l\'ora legale', '2026-10-25T12:00:00.000Z'],
    ['il giorno in cui comincia', '2027-03-28T12:00:00.000Z'],
  ])('⛔ %s: l\'ora scelta è una in cui il giorno di Roma e quello UTC NON coincidono', (_, quando) => {
    const istante = oraPericolosa(new Date(quando), SENZA_OVERRIDE);
    expect(iGiorniDivergono(istante)).toBe(true);
  });

  /**
   * ⛔ **E l'ora finta sposta l'ORA, non il calendario.**
   *
   * La prima stesura fissava una data assoluta (`2026-08-22T22:30:00.000Z`). Questa suite ha dentro
   * dei test con date scritte a mano che scadono — voce `test-che-scadono-il-2-settembre` — quindi
   * dal 2 settembre `npm test` sarebbe stato rosso e `npm run test:notte` verde: il passo che serve
   * a distinguere «rotta a tutte le ore» da «rotta solo di notte» avrebbe detto il contrario del
   * vero, e per sempre.
   */
  it('⛔ l\'ora pericolosa è quella di OGGI: stesso giorno, ora diversa', () => {
    const riferimento = new Date('2029-05-17T14:22:33.000Z'); // un giorno qualunque, lontano
    const istante = oraPericolosa(riferimento, SENZA_OVERRIDE);
    const giornoARoma = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
    expect(giornoARoma(istante)).toBe(giornoARoma(riferimento));
    expect(istante.getTime()).not.toBe(riferimento.getTime());
  });

  /** ⚠️ E `ORA_FINTA` vince, perché è la manopola con cui si va a vedere un altro giorno. */
  it('⚠️ `ORA_FINTA` sovrascrive, e una data illeggibile si dice invece di essere ignorata', () => {
    expect(oraPericolosa(new Date(), '2027-01-14T22:30:00.000Z').toISOString()).toBe(
      '2027-01-14T22:30:00.000Z',
    );
    expect(() => oraPericolosa(new Date(), 'ieri sera')).toThrow(/ORA_FINTA/);
  });

  /**
   * ⛔ **L'orologio si falsifica PRIMA che i moduli vengano caricati.**
   *
   * La prima versione lo faceva solo dentro `beforeEach`, cioè dopo l'import del file di test: le
   * costanti calcolate a livello di modulo restavano sull'ora vera, e la misura contava **8 suite
   * rotte invece di 4**. Una misura sbagliata è peggio di nessuna misura, perché manda a correggere
   * codice che funziona.
   *
   * ⚠️ **Si guarda il codice senza i commenti, e senza rientro.** Le due mutazioni che la prima
   * stesura di questo controllo non vedeva: la riga spostata dentro `beforeEach` (che con un `.trim()`
   * risultava identica a quella giusta) e la riga **commentata via** (che senza `soloCodice` si
   * continuava a trovare nel sorgente).
   */
  it('⛔ `useFakeTimers` sta anche FUORI dagli hook, non solo dentro `beforeEach`', () => {
    const righe = soloCodice(readFileSync(OROLOGIO, 'utf8')).split('\n');
    expect(righe.some((r) => r.startsWith('jest.useFakeTimers('))).toBe(true);
  });

  /**
   * ⚠️ **E i timer restano veri.** Falsificando anche `setTimeout`, ogni suite che aspetta una
   * promessa dietro un timer si bloccherebbe fino al limite di jest — e una suite in timeout
   * assomiglia moltissimo a una che ha trovato un difetto, il che riporta al punto di sopra.
   *
   * ⚠️ Si guarda **dentro `doNotFake`**, non nel file: la prima stesura cercava i nomi ovunque, e
   * restava verde anche togliendo l'intera proprietà purché i nomi restassero in un commento.
   */
  it('⚠️ si falsifica solo `Date`: i timer non si toccano', () => {
    // Il valore vero, non la sua forma scritta: togliere un nome dall'elenco si vede da qui.
    for (const timer of ['setTimeout', 'setInterval', 'nextTick', 'setImmediate']) {
      expect(TIMER_VERI as readonly string[]).toContain(timer);
    }
    // E che l'orologio della suite notturna usi PROPRIO quell'elenco, invece di una copia sua.
    expect(soloCodice(readFileSync(OROLOGIO, 'utf8'))).toMatch(/doNotFake\s*:\s*TIMER_VERI/);
  });

  /** ⚠️ E la prova che il filtro dei commenti non nasconde il codice vero. */
  it('⚠️ `soloCodice` toglie i commenti e lascia il codice', () => {
    expect(soloCodice('/* jest.useFakeTimers(X); */\nconst y = 1;')).not.toMatch(/useFakeTimers/);
    expect(soloCodice('// jest.useFakeTimers(X);')).not.toMatch(/useFakeTimers/);
    expect(soloCodice('jest.useFakeTimers(X); // spiegazione')).toMatch(/useFakeTimers/);
  });
});
