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
 * ## ⛔ Cos'è cambiato il 21/8, e perché questo modulo si è quasi rovesciato
 *
 * La premessa qui sopra era: «il questionario la chiede, obbligatoria, a chi si iscrive oggi —
 * restano fuori le clienti di prima». **Non è più vera.** La domanda del questionario è sparita
 * insieme alla tendina dello staff: la finestra adesso la imposta la cliente trascinando il suo
 * orologio, e l'app gliela chiede al primo avvio.
 *
 * ⚠️ Lasciata com'era, la regola («in digiuno + finestra vuota») sarebbe diventata vera per **ogni
 * cliente appena iscritta**, la notte stessa. Un'attività che si apre per tutte non è un'attività:
 * è la colonna della coach che si riempie di righe da chiudere senza leggerle, e da lì in poi non
 * legge più nemmeno quelle vere. *Un avviso che compare sempre non è un avviso.*
 *
 * ## Le due condizioni, adesso
 *
 * 1. **Non ha ancora scelto** (`fastingSceltoIl` vuoto). ⚠️ È questo il campo, non `fastingWindow`:
 *    la finestra è *derivata* dall'orologio, e una cliente potrebbe averla vuota per un istante fra
 *    due scritture. `fastingSceltoIl` dice una cosa sola e non torna mai indietro: gliel'abbiamo
 *    chiesto e ha risposto.
 * 2. **L'app ha già avuto il suo tempo per chiederglielo**: `GIORNI_DI_GRAZIA` giorni da quando ha
 *    finito il questionario. Chi si è iscritta ieri non è un caso da telefonata — è una persona che
 *    non ha ancora aperto l'app. Chi digiuna da tre mesi senza aver mai scelto sì.
 *
 * ⛔ **`onboardingCompletedAt`, NON `createdAt` del profilo** (corretto in revisione, 21/8). La riga
 * del profilo nasce molto prima del questionario: all'assegnazione del lead a una coach, o
 * all'invito referral. Una lead assegnata il 1° agosto che paga e compila il 25 si sarebbe vista
 * aprire l'attività **la notte stessa**, con scritto «l'app gliela chiede da almeno tre giorni e lei
 * rimanda» — mentre si era iscritta la sera prima e poteva non aver mai aperto l'app. La grazia
 * ancorata alla data sbagliata non protegge nessuno, proprio nel percorso per cui è stata scritta.
 *
 * ⚠️ Per le clienti **di prima** non cambia niente: hanno finito il questionario mesi fa, la grazia è
 * passata da un pezzo, e l'attività si apre alla prima notte come prima.
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
 * ⛔ **QUANTO TEMPO SI LASCIA ALL'APP PRIMA DI DISTURBARE UNA PERSONA.**
 *
 * Tre giorni. Non è un numero magico: è la distanza fra «non ha ancora aperto l'app» e «l'app
 * gliel'ha chiesto e lei continua a rimandare». Sotto, l'attività direbbe alla coach di telefonare a
 * qualcuna che sta per farlo da sola; sopra, l'unica cosa che manca è una conversazione.
 *
 * ⚠️ È anche la stessa scadenza che l'attività si dà (`giornoPiu(today, 3)`): se un giorno una delle
 * due si muove, si guardino tutte e due.
 */
export const GIORNI_DI_GRAZIA = 3;

/** Millisecondi in un giorno — scritto una volta, invece di `1000 * 60 * 60 * 24` sparso. */
const UN_GIORNO = 24 * 60 * 60 * 1000;

/**
 * Va chiesta a questa cliente?
 *
 * ⚠️ Chi non è in digiuno non ha nessuna finestra da scegliere. Chi **ha già scelto** non si
 * ridisturba. E chi non ha ancora scelto ma si è iscritta l'altro ieri nemmeno: prima parla l'app.
 *
 * ⚠️ `questionarioFinitoIl` mancante = **non si chiede**. «Non lo so» deve costare meno di «ho
 * indovinato»: senza quella data non si può dire se la grazia è passata, e aprire l'attività lo
 * stesso vorrebbe dire far telefonare la coach su un dubbio. ⚠️ Ed è anche il caso di chi il
 * questionario non l'ha ancora finito: non c'è niente da chiederle, non ha ancora scelto niente.
 */
export function serveChiedereLaFinestra(
  pathType?: string | null,
  fastingSceltoIl?: Date | null,
  questionarioFinitoIl?: Date | null,
  adesso: Date = new Date(),
): boolean {
  if (pathType !== 'intermittent_fasting') return false;
  // Ha risposto: la domanda è stata fatta, com'è andata non è affare di questa attività.
  if (fastingSceltoIl) return false;
  const finito = questionarioFinitoIl instanceof Date ? questionarioFinitoIl.getTime() : NaN;
  if (!Number.isFinite(finito)) return false;
  return adesso.getTime() - finito >= GIORNI_DI_GRAZIA * UN_GIORNO;
}

/**
 * Il testo dell'attività.
 *
 * ⚠️ Dice **che cosa succede intanto**, e non solo che manca un dato: senza quella riga, una coach
 * che legge «manca la finestra» può crederla ferma o rotta, e allarmare la cliente per una cosa che
 * sta funzionando. Il difetto qui è una domanda mancata, non un guasto.
 */
export function testoFinestraMaiChiesta(
  nome?: string | null,
  /**
   * ⛔ **Cosa riceve INTANTO — e non è la stessa frase per tutte** (corretto in revisione, 21/8).
   *
   * Da quando l'attività nasce da `fastingSceltoIl` e non da `fastingWindow`, arriva anche a chi una
   * finestra ce l'ha: quella di prima dell'orologio. A lei il testo diceva «senza finestra il motore
   * non salta niente e riceve tutti i pasti della sua dieta» — e per una con `skip_all_but_dinner`
   * il motore ne salta quattro: **mangia una volta al giorno**. La coach le avrebbe telefonato con
   * in mano l'esatto contrario di quello che le succede nel piatto.
   */
  finestraInVigore?: string | null,
  /** Quella finestra a parole. Le etichette stanno in `menu/finestre-digiuno.ts`, tutte e otto. */
  finestraAParole?: string | null,
): { title: string; description: string } {
  const chi = (nome ?? '').trim() || 'la cliente';
  const haUnaFinestra = !!(finestraInVigore && finestraInVigore.trim());
  const intanto = haUnaFinestra
    ? '⚠️ Intanto NON è ferma e non è rotta, ma NON riceve tutti i pasti: le resta addosso la finestra '
      + `di prima dell'orologio — ${(finestraAParole ?? '').trim() || finestraInVigore} — e il motore `
      + 'la sta applicando. Guardala prima di telefonare: può essere molto più stretta di quello che '
      + 'lei si aspetta. '
    : '⚠️ Intanto NON è ferma e non è rotta — senza finestra il motore non salta niente e riceve tutti '
      + 'i pasti della sua dieta, che è il valore di scorta sensato. ';
  return {
    title: `Chiedi a ${chi} a che ora mangia nel digiuno`,
    description:
      'È in digiuno intermittente ma non ha mai impostato il suo orologio: l\'app glielo chiede da '
      + 'almeno tre giorni e lei rimanda. '
      + intanto
      + 'A che ora mangia lo sta decidendo un valore di scorta al posto suo. '
      + '⛔ Non lo puoi impostare tu: la finestra la sposta lei, trascinando l\'orologio in app (home → '
      + 'la scheda del digiuno). Quello che serve è la telefonata — a che ora le viene comodo mangiare, '
      + 'e perché sta rimandando. Poi guidala mentre lo fa. '
      + 'Se ne parlate e va bene così com\'è, segna l\'attività fatta: non te la ripropongo.',
  };
}
