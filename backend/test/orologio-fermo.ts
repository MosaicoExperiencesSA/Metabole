/**
 * ⛔ **FERMARE L'OROLOGIO IN UN TEST, IN UN MODO SOLO.**
 *
 * Un test il cui esito dipende da **che ora è** deve dire che ora è. Prima del 23/8 non lo diceva
 * quasi nessuno, e la suite era verde 22 ore su 24: fra la mezzanotte e le 02:00 italiane il giorno
 * di Roma e quello UTC non coincidono, e quattro file cadevano — due dei quali perché il **prodotto**
 * era rotto, non il test.
 *
 * ⚠️ **L'elenco `TIMER_VERI` è la parte che si sbaglia**, ed è il motivo per cui questo file esiste
 * invece di tre copie. Falsificando anche `setTimeout`, una suite che aspetta una promessa dietro un
 * timer si blocca fino al limite di jest — e una suite in timeout assomiglia moltissimo a una che ha
 * trovato un difetto: si va a cercare nel posto sbagliato. Qui si falsifica **solo `Date`**.
 */

/** I timer che restano veri: si falsifica solo l'orologio, non il tempo. */
export const TIMER_VERI = [
  'nextTick', 'setImmediate', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'clearImmediate',
  'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'hrtime',
] as const;

/**
 * Ferma l'orologio a `istante` per tutti i test del gruppo in cui viene chiamata, e lo rimette vero
 * dopo ognuno.
 *
 * ⚠️ Va chiamata **dentro** un `describe` (o al primo livello di un file di test): registra un
 * `beforeEach` e un `afterEach`, quindi il posto in cui la si scrive è il perimetro che copre.
 */
export function conOrologioFermo(istante: Date): void {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: TIMER_VERI as never, now: istante });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
}
