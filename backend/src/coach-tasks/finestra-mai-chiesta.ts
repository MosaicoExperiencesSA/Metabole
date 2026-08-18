/**
 * LA DOMANDA CHE NON È MAI STATA FATTA — la finestra del digiuno.
 *
 * ## Il caso (17-18/8, voce 256)
 *
 * Una cliente ha `pathType: intermittent_fasting` e `fastingWindow` **vuota**. Il primo script che
 * l'ha trovata gridava «dovrebbe ricevere tutti e cinque i pasti»: era un falso positivo mio, e va
 * detto perché cambia tutto il resto. Senza finestra il motore non salta niente e le arriva il 16:8
 * classico, che è il valore di scorta sensato. **Il motore non è rotto.**
 *
 * ⚠️ Il difetto è un altro, e più difficile da vedere: la finestra decide **quali pasti mangia**, e
 * per lei l'ha decisa un valore di scorta. La domanda non le è mai stata fatta.
 *
 * Il questionario la fa, obbligatoria, da quando esiste (`onboarding.questions.ts`, `showIf` sul
 * digiuno): chi si iscrive oggi la sceglie. Restano fuori le clienti **di prima**, e per loro non
 * c'è una schermata che possa rimediare — perché non è un dato mancante da riempire, è **una
 * conversazione da avere**.
 *
 * ## Perché un'attività della coach e non un messaggio automatico
 *
 * Si poteva far chiedere a Gaia. Ma «quali pasti preferisci saltare?» arrivato da solo, a freddo,
 * a una persona che sta già mangiando in un certo modo da mesi, è una domanda che si risponde male:
 * la risposta giusta dipende da come sta, da com'è andata finora, da cosa le hanno detto in visita.
 * È esattamente il tipo di domanda che merita una persona. E il progetto ha già il posto dove le
 * cose che una persona deve fare diventano lavoro: le attività della coach.
 *
 * ⚠️ Si chiede **una volta sola** (`refId` fisso): se la coach la segna fatta e la finestra resta
 * vuota, vuol dire che ne hanno parlato e va bene così — riproporla ogni notte trasformerebbe
 * l'attività in rumore, e un avviso che compare sempre non è un avviso.
 */

/** Il tipo dell'attività: è anche metà della chiave di unicità (`clientId + kind + refId`). */
export const TIPO_FINESTRA_MAI_CHIESTA = 'finestra_digiuno_mai_chiesta';

/**
 * ⚠️ Fisso, e non la data o l'id del piano. `clientId + kind + refId` è la chiave di unicità: con
 * un riferimento che cambia, l'attività rinascerebbe a ogni piano nuovo su una domanda che è già
 * stata fatta.
 */
export const RIFERIMENTO_UNICO = 'unica';

/**
 * Va chiesta a questa cliente?
 *
 * Solo se è in digiuno **e** la finestra è vuota. ⚠️ Chi non è in digiuno non ha nessuna finestra da
 * scegliere, e una `fastingWindow` valorizzata è una scelta già fatta — da lei o da chi la segue.
 */
export function serveChiedereLaFinestra(
  pathType?: string | null,
  fastingWindow?: string | null,
): boolean {
  if (pathType !== 'intermittent_fasting') return false;
  return !fastingWindow || !fastingWindow.trim();
}

/**
 * Il testo dell'attività.
 *
 * ⚠️ Dice **che cosa succede intanto**, e non solo che manca un dato: senza quella riga, una coach
 * che legge «manca la finestra» può crederla ferma o rotta, e allarmare la cliente per una cosa che
 * sta funzionando. Il difetto qui è una domanda mancata, non un guasto.
 */
export function testoFinestraMaiChiesta(nome?: string | null): { title: string; description: string } {
  const chi = (nome ?? '').trim() || 'la cliente';
  return {
    title: `Chiedi a ${chi} quali pasti salta nel digiuno`,
    description:
      'È in digiuno intermittente ma la finestra non è mai stata impostata: la domanda del questionario ' +
      'è arrivata dopo di lei. ⚠️ Intanto NON è ferma e non è rotta — senza finestra il motore non salta ' +
      'niente e riceve tutti i pasti della sua dieta, che è il valore di scorta sensato. Ma quali pasti ' +
      'mangia lo sta decidendo quel valore di scorta al posto suo. Sentitela e impostala dalla scheda ' +
      '(Modifica → «Pasti che salta»), oppure può sceglierla lei dal Profilo dell\'app. ' +
      'Se ne parlate e va bene com\'è, segna l\'attività fatta: non te la ripropongo.',
  };
}
