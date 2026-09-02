/**
 * ⛔ **LA SUITE NEL FUTURO — perché il 2/9 alle quattro di notte è diventata rossa da sola.**
 *
 * `pause/primo-giorno-utile.spec.ts` chiedeva di aprire una pausa dall'1/9. Alla mezzanotte fra
 * l'1 e il 2 quella data è diventata passato, il servizio ha risposto «quel periodo è già passato»
 * — la risposta giusta a una domanda che le prove non volevano fare — e quattro prove sono cadute
 * **senza che nessuno avesse toccato una riga**.
 *
 * ⚠️ È una cosa che si può sapere PRIMA: basta far girare la suite con l'orologio spostato avanti.
 *
 *     AVANTI_GIORNI=120 npm run test:futuro
 *
 * ⚠️ **Non è una delle quattro modalità obbligatorie**, e non deve diventarlo: risponde a una
 * domanda diversa — non «funziona?» ma «funzionerà ancora fra tre mesi?» — e si lancia quando si
 * scrivono prove con date scritte a mano, o ogni tanto.
 *
 * ## ⛔ Perché è un Proxy e non una sottoclasse
 *
 * La prima stesura era `class Orologio extends Date`, e dava **due file rossi che rossi non
 * erano**: `expect(...).toBeInstanceOf(Date)` diceva «Expected constructor: ClockDate, Received
 * constructor: Date» in `profile/imposta-digiuno.spec.ts` e in `notifications`. Nessun difetto
 * dietro: la catena dei prototipi.
 *
 * I timer finti di jest (`@sinonjs/fake-timers`) prendono il `Date` che trovano globale, lo
 * chiamano `NativeDate`, e nel loro `mirrorDateProperties` fanno **`ClockDate.prototype =
 * NativeDate.prototype`**. Se sotto trovano una sottoclasse, `ClockDate.prototype` diventa il
 * prototipo della sottoclasse, e le date vere — quelle che `ClockDate` costruisce — smettono di
 * essere `instanceof Date`. Il prodotto era giusto, la misura era rotta.
 *
 * ⛔ **Un misuratore che inventa guasti è peggio di nessun misuratore, perché manda a cercare.**
 *
 * Un Proxy su `Date` non ha un prototipo suo: `Orologio.prototype` **è** `Date.prototype`. Quindi
 * i timer finti si costruiscono esattamente come si costruirebbero senza di noi, `instanceof`
 * torna, e le istanze sono date vere e non una sottospecie.
 *
 * ⚠️ E i timer restano veri: falsificando anche `setTimeout` una suite che aspetta una promessa si
 * blocca, e una suite in timeout assomiglia molto a una che ha trovato un difetto
 * (`test/orologio-fermo.ts`).
 *
 * ## ⛔ Il punto cieco, detto per intero
 *
 * Dove qualcuno ha già fermato l'orologio, il futuro **non si vede**: `jest.useFakeTimers` gira
 * dopo e vince, com'è giusto. ⛔ Non si dica però che «lì non c'era niente da misurare»: al 2/9
 * sono **454 prove su 6539**, in 18 file, e fra quelle ci sono le 49 di
 * `pause/primo-giorno-utile.spec.ts` — cioè **l'unico posto che si è davvero rotto da solo**, che
 * proprio per questo l'orologio adesso ce l'ha fermo. Quelle 454 restano da sorvegliare in un
 * altro modo (leggendo le date a mano quando si toccano quei file), non sono coperte da qui.
 *
 * ## ⚠️ Le due differenze da `Date` che restano, e sono volute
 *
 * · **`(new Date()).constructor` è il `Date` vero, non il Proxy** — un Proxy non può farsi
 *   costruttore delle istanze senza sostituire il prototipo, che è la cosa da cui questo file
 *   nasce. `instanceof`, `Object.prototype.toString`, `JSON.stringify`, `structuredClone` e
 *   `class X extends Date` tornano tutti giusti; è solo `x.constructor === Date` a dire `false`.
 *   Nel repo non lo chiede nessuno.
 * · **`Date.now` letto e poi sostituito**: `jest.spyOn(Date, 'now')` funziona (la spia scrive sul
 *   `Date` vero e da lì in poi è lei a rispondere), e non ricorre, perché lo spostamento chiama
 *   `NOW_VERO` catturato qui sotto e non `Date.now`. ⚠️ Ma una spia su `Date.now` **spegne lo
 *   spostamento** per quel test: è giusto così — chi mette una spia sull'orologio sta dicendo che
 *   ora è, e ha ragione lui.
 *
 * ## Cosa ha detto la misura (2/9)
 *
 * `AVANTI_GIORNI=120` e `AVANTI_GIORNI=400`, suite intera: **390 file, 6539 prove, tutte verdi**.
 * La dozzina di file «sospetti» — `privacy/cancellazione` con 21 date a mano, `agenda/calendario`
 * con 20, `common/il-giorno-a-mano` con 18 — non era malata: quelle date stanno dentro funzioni
 * pure o dati finti, non davanti a un `new Date()`. ⚠️ La classe che sembrava aperta era vuota, e
 * si è saputo **misurando**, non fermando dodici orologi a scatola chiusa.
 */
const REALE = Date;

/** ⚠️ Catturato **adesso**: se lo spostamento leggesse `Date.now` e qualcuno ci mettesse una spia,
 * la spia chiamerebbe l'originale che rileggerebbe la spia — stack esaurito, e il messaggio non
 * nomina né la spia né questo file. */
const NOW_VERO = REALE.now;

const GIORNI = leggiGiorni();
const AVANTI = GIORNI * 86_400_000;

/**
 * ⛔ **Quello che non si capisce si rifiuta, non si arrotonda a 90.**
 *
 * `Number(x) || 90` diceva 90 a `abc`, a `400giorni` e — peggio — a `0`, che è il giro di
 * controllo più utile che ci sia: «a spostamento zero la suite è verde?», cioè «il rosso è del
 * prodotto o del misuratore?». Un misuratore che misura una cosa diversa da quella che gli hai
 * chiesto, in silenzio, è peggio di uno che si rifiuta di partire.
 */
function leggiGiorni(): number {
  const scritto = process.env.AVANTI_GIORNI;
  if (scritto === undefined || scritto.trim() === '') return 90;
  const giorni = Number(scritto);
  if (!Number.isFinite(giorni)) {
    throw new Error(`AVANTI_GIORNI: «${scritto}» non è un numero di giorni.`);
  }
  if (Math.abs(giorni) > 36_500) {
    throw new Error(
      `AVANTI_GIORNI: ${giorni} giorni sono più di cent'anni, e le date diventano «Invalid Date» `
        + 'dappertutto — centinaia di prove rosse, nessuna per un difetto.',
    );
  }
  return giorni;
}

const adessoSpostato = (): number => NOW_VERO.call(REALE) + AVANTI;

/**
 * ⚠️ Si sposta **solo il presente**: il costruttore senza argomenti, `Date.now()` e `Date()`
 * chiamato senza `new`. `new Date('2026-09-01')` deve restare quel giorno lì, o le prove che si
 * scrivono la data a mano cambierebbero significato invece di cambiare presente.
 */
const Orologio = new Proxy(REALE, {
  construct: (vero, argomenti, chiamante) =>
    Reflect.construct(vero, argomenti.length === 0 ? [adessoSpostato()] : argomenti, chiamante),

  /** `Date()` senza `new` rende una stringa, e dev'essere lo stesso presente di `new Date()`. */
  apply: () => new REALE(adessoSpostato()).toString(),

  /** ⚠️ `=== NOW_VERO`: se qualcuno ci ha messo una spia, risponde la spia. */
  get: (vero, nome, ricevente) => {
    const valore: unknown = Reflect.get(vero, nome, ricevente);
    return nome === 'now' && valore === NOW_VERO ? adessoSpostato : valore;
  },

  /** ⚠️ Perché `Object.getOwnPropertyDescriptor(Date, 'now').value` e `Date.now` siano la stessa
   * funzione: erano due, ed è il genere di incoerenza su cui una libreria si impunta. */
  getOwnPropertyDescriptor: (vero, nome) => {
    const descrittore = Reflect.getOwnPropertyDescriptor(vero, nome);
    return nome === 'now' && descrittore?.value === NOW_VERO
      ? { ...descrittore, value: adessoSpostato }
      : descrittore;
  },
});

(globalThis as { Date: DateConstructor }).Date = Orologio;

/** ⚠️ `export {}` rende questo file un **modulo**: senza, `REALE`, `GIORNI` e `AVANTI` sarebbero
 * globali per tutto il progetto e chiunque scrivesse `const GIORNI` a livello di file si
 * troverebbe un «Cannot redeclare block-scoped variable» che nomina un file che non ha aperto. */
export {};
