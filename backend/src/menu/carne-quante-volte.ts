/**
 * QUANTE VOLTE A SETTIMANA LA CARNE — la regola flexitariana (§6 del piano panieri).
 *
 * Decisione di Simone (1/9): **due volte a settimana**. Il flexitariano pesca dal paniere onnivoro,
 * ma la carne è limitata — è quello che distingue «Flessibile» da «onnivoro», e senza questa regola
 * le due cose sono la stessa e la famiglia non ha un senso suo.
 *
 * ⚠️ **La settimana è una finestra SCORREVOLE, non il calendario.** Con la settimana di calendario
 * una cliente potrebbe ricevere carne il sabato e la domenica, poi di nuovo lunedì e martedì:
 * quattro volte in quattro giorni, e tutte e due le settimane rispettate. Chi mangia conta i giorni,
 * non le caselle del calendario.
 *
 * ⛔ **E il tetto NON è un divieto assoluto**: se dentro la banda kcal non resta nessuna giornata
 * senza carne, la giornata si compone lo stesso e lo si dichiara. È la stessa rete della coppia
 * pranzo/cena e della finestra del digiuno — una regola alimentare sforata è un difetto da
 * guardare, una cliente senza cena è un guasto.
 */

/** Zero vuol dire **nessun limite**, non «mai carne»: è il valore di chi la regola non ce l'ha. */
export const NESSUN_LIMITE = 0;

/** Quanti giorni indietro si guarda. Una settimana, ed è la finestra che conta per chi mangia. */
export const GIORNI_DELLA_FINESTRA = 7;

/**
 * Quante volte si può ancora avere carne, guardando indietro di una settimana.
 *
 * `giornateConCarne` sono le date (o le posizioni) in cui la cliente ha già ricevuto carne, e
 * `oggi` è la giornata che si sta componendo. Si contano solo quelle **dentro la finestra**.
 *
 * ⚠️ Torna `Infinity` quando il limite non c'è: chi chiama scrive `restanti > 0` e non deve sapere
 * che esiste un caso «nessun limite».
 */
export function carneRestante(
  giornateConCarne: readonly number[],
  oggi: number,
  tettoASettimana: number,
): number {
  if (!tettoASettimana || tettoASettimana <= NESSUN_LIMITE) return Infinity;
  const dentro = giornateConCarne.filter((g) => oggi - g < GIORNI_DELLA_FINESTRA && oggi - g >= 0);
  return Math.max(0, tettoASettimana - dentro.length);
}

/**
 * ⚠️ **Il piatto ha carne?** Si guarda **tutti** gli ingredienti, non l'ingrediente principale: un
 * risotto con una julienne di speck è un risotto, ma per chi conta le volte della carne è una
 * volta. È la stessa domanda — e la stessa risposta — della derivazione pescetariana, e infatti
 * chiama la stessa porta.
 */
export { verdettoPescetariano as diCosaEIlPiatto } from '../catalog/paniere-pescetariano';
