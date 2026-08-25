import { aGiorno } from '../common/date-only';
import { statoSupervisione, type ProfiloDaSupervisionare, type StatoSupervisione } from './via-libera-clinico';

/**
 * ⛔ **CHI È IN PERCORSO SUPERVISIONATO NON DEVE RESTARE SUL TAVOLO DI NESSUNO.**
 *
 * ## Il difetto, come si è visto
 *
 * Il 23/8, chiudendo il via libera clinico, sono venute fuori due cose che nessuno aveva deciso:
 *
 *  · una cliente in screening che **nessuno ha mai guardato** riceve i menu lo stesso. Il cancello
 *    sull'erogazione non è mai esistito: il blocco viveva solo nella card dell'app, e quella card
 *    compariva **di rado proprio perché i menu c'erano** (`menuStatus` risponde `available` appena
 *    trova un menu visibile, e il ramo del percorso supervisionato viene dopo). Quindi: mangia, e
 *    nessuno la sta guardando;
 *  · dopo il «può proseguire», il motore restava comunque **muto** — `checkGuardrails` leggeva
 *    `screeningFlag` da solo, che nessuno riazzera mai — quindi ogni variazione continuava a
 *    passare da una persona, per sempre.
 *
 * ⚠️ Le due sbagliano in versi opposti, ed è la ragione per cui non le ho decise io: un cancello
 * chiuso di troppo costa a una cliente **tutto il servizio**; un cancello aperto di troppo vuol dire
 * una persona con farmaci o patologie dichiarate che mangia un piano che nessun clinico ha guardato.
 *
 * ## La risposta di Simone (25/8)
 *
 * *«Se il cliente è supervisionato va mandata notifica a Lucia di controllarlo ogni 7 giorni
 * attraverso Vera. Se dichiara patologie il nutrizionista dalla scheda decide se fissare un
 * appuntamento ed entro quando; se dice, esempio, appuntamento il mese prossimo, nel frattempo il
 * paziente procede.»* E sul motore: *«il motore prosegue facendo un promemoria ogni 7 giorni a Lucia
 * di controllare la situazione»*.
 *
 * ⛔ Cioè: **non si chiude niente**. Il percorso va avanti, e il rimedio al «nessuno la sta
 * guardando» non è fermare la cliente — è **far arrivare la domanda a chi deve rispondere**, e
 * continuare a farla arrivare finché non risponde. Un promemoria che si dà una volta sola è un
 * promemoria che si perde nella giornata in cui è arrivato.
 *
 * ## Quello che questo file fa, e quello che NON fa
 *
 * Risponde a una domanda sola: *per questa cliente, oggi, va aperto un promemoria?* È **puro** —
 * niente database, niente orologio se non quello che gli si passa — così la regola si prova sui
 * giorni invece che sperare che il caso li produca.
 *
 * ⚠️ **Non decide chi lo riceve** (quello lo sa `apriRichiestaVera`, che manda alla nutrizionista
 * assegnata o al capo se non c'è) e **non tocca l'erogazione**: nessun menu si ferma qui.
 */

/**
 * Ogni quanti giorni si ripete. ⚠️ Il valore vero sta in `config_param`
 * (`supervision_reminder_days`, regola di casa: le soglie non si scrivono nel codice); questo è il
 * ripiego quando il parametro manca, ed è il numero che ha detto Simone.
 */
export const PROMEMORIA_OGNI_GIORNI = 7;

/** Il tipo della richiesta su Vera: serve a riconoscerla fra le altre. */
export const TIPO_PROMEMORIA = 'supervisione_da_guardare';

const GIORNO = 86_400_000;

/**
 * ⛔ **LA CHIAVE DELL'IDEMPOTENZA È LA FINESTRA, non il giorno.**
 *
 * `supervisione:<clientId>:<numero della finestra>`. La finestra si conta in blocchi di N giorni da
 * quando la sorveglianza è cominciata, quindi:
 *  · il cron può girare due volte la stessa notte, o riprendere dopo un guasto, e la domanda resta
 *    **una**;
 *  · e la settimana dopo la chiave cambia, quindi il promemoria **torna** — che è tutto il punto:
 *    una domanda a cui nessuno ha risposto deve ripresentarsi, non spegnersi.
 *
 * ⚠️ Non si usa la data di oggi come chiave: con «ogni 7 giorni» significherebbe una chiave nuova
 * ogni notte, cioè sette domande a settimana sullo stesso paziente.
 *
 * ⛔ **E dentro la chiave c'è anche il PASSO** — corretto in revisione, 25/8. Il numero di finestra
 * dipende dal passo, quindi cambiando `supervision_reminder_days` le finestre si rinumerano e le
 * chiavi **collidono con quelle già usate**. Misurato: una cliente sorvegliata dal 1/7 con passo 3
 * accumula le chiavi `…:0`…`…:9` in un mese; portando il passo a 7 — cioè proprio l'operazione che
 * il parametro esiste per permettere — le finestre da 4 a 9 ricadono su chiavi già esistenti, e
 * `apriRichiestaVera` cerca la chiave **senza filtro sullo stato**: anche una riga chiusa la blocca.
 * Risultato: **circa quaranta giorni consecutivi senza nessun promemoria** su una cliente che
 * nessuno ha mai valutato, e ogni notte l'esito diceva «già aperta». Cioè la sorveglianza smetteva
 * in silenzio raccontando di aver guardato. Nel verso opposto (7 → 3) si aprivano **due domande
 * sulla stessa persona nella stessa notte**.
 */
export function chiaveDelPromemoria(clientId: string, passo: number, finestra: number): string {
  return `supervisione:${clientId}:${passo}:${finestra}`;
}

/** Quello che serve sapere di una cliente per decidere. */
export interface ClienteDaSorvegliare {
  clientId: string;
  nome?: string | null;
  /** Da quando è in percorso supervisionato: la registrazione, o la prima volta che l'abbiamo vista. */
  da: Date | null | undefined;
  profilo: ProfiloDaSupervisionare;
}

export interface EsitoPromemoria {
  /** `null` = niente da fare oggi. */
  chiave: string | null;
  /** Quale finestra: `0` è la prima, cioè il giorno stesso in cui comincia la sorveglianza. */
  finestra: number;
  /** Da quanti giorni aspetta una decisione. Serve al testo: «da 21 giorni» pesa diverso da «da 7». */
  giorniInAttesa: number;
  stato: StatoSupervisione;
}

/**
 * Va aperto un promemoria per questa cliente, oggi?
 *
 * ⛔ **Solo per chi aspetta ancora una decisione**, e non per chiunque sia supervisionata: con «Può
 * proseguire» la decisione c'è, ed è definitiva — continuare a chiedere a Lucia di guardare una
 * cosa già guardata è il modo più rapido di farle ignorare tutti i promemoria, compresi quelli che
 * contano. ⚠️ Con «serve visita entro il 30» invece il promemoria **resta**: la decisione è presa ma
 * la visita no, e il giorno in cui scade il percorso si ferma davvero.
 *
 * @param ogniGiorni il parametro `supervision_reminder_days`. Un valore assurdo (zero, negativo,
 *   non finito) ricade sul default invece di produrre una divisione per zero o un promemoria al
 *   giorno: una soglia sbagliata in tabella non deve diventare rumore addosso a una persona.
 */
export function promemoriaDovuto(
  c: ClienteDaSorvegliare,
  oggi: Date,
  ogniGiorni: number = PROMEMORIA_OGNI_GIORNI,
): EsitoPromemoria {
  const stato = statoSupervisione(c.profilo, oggi);
  const vuoto: EsitoPromemoria = { chiave: null, finestra: 0, giorniInAttesa: 0, stato };

  if (!stato.supervisionata) return vuoto;
  // ⚠️ Il via libera è una decisione presa: qui non c'è più niente da chiedere.
  if (stato.motivo === 'via_libera') return vuoto;

  const passo = Number.isFinite(ogniGiorni) && ogniGiorni > 0 ? Math.floor(ogniGiorni) : PROMEMORIA_OGNI_GIORNI;

  /**
   * ⚠️ **`aGiorno` e non `giornoDelDato`**, corretto in revisione il 25/8. `ClientProfile.createdAt`
   * è un `DateTime @default(now())`, cioè un **istante vero** e non una colonna DATE: la doctrine di
   * `date-only.ts` riserva `giornoDelDato` ai giorni **salvati**, e leggere un istante con quella
   * porta vuol dire prendere il giorno UTC. Per una cliente registrata fra le 22:00 e le 24:00 UTC
   * il conto dei giorni — e quindi il confine della finestra, e il «da N giorni» che legge la
   * nutrizionista — erano sbagliati di uno.
   *
   * ⚠️ **Senza data di inizio si comincia oggi**, invece di saltarla. Una cliente il cui profilo non
   * porta la data della registrazione è esattamente quella di cui sappiamo meno: escluderla dalla
   * sorveglianza perché le manca un campo sarebbe il verso sbagliato in cui sbagliare. La prima
   * finestra è la 0, e da lì in poi si conta normalmente.
   */
  const inizio = c.da ? aGiorno(c.da).getTime() : aGiorno(oggi).getTime();
  const giorniInAttesa = Math.max(0, Math.floor((aGiorno(oggi).getTime() - inizio) / GIORNO));
  const finestra = Math.floor(giorniInAttesa / passo);

  return { chiave: chiaveDelPromemoria(c.clientId, passo, finestra), finestra, giorniInAttesa, stato };
}

/**
 * ⛔ **IL TESTO CHE LUCIA LEGGE — e dice cosa deve fare, non solo che c'è qualcosa.**
 *
 * Una domanda che dice «c'è una cliente in screening» è una notifica; una che dice **da quanti
 * giorni aspetta, cosa può decidere e cosa succede se non decide** è una cosa che si può chiudere in
 * trenta secondi. La differenza fra le due è se il promemoria viene lavorato o archiviato.
 *
 * ⚠️ **Dice anche che la cliente sta mangiando.** È l'informazione che cambia l'urgenza in tutte e
 * due le direzioni, e proprio quella che nessuno aveva: fino al 25/8 il prodotto lasciava credere
 * che un percorso supervisionato senza decisione fosse fermo. Non lo era.
 *
 * ⚠️ **Niente asterischi qui dentro**, e non è pignoleria: l'elenco delle domande aperte in
 * `Vera.tsx` stampa `{r.testo}` **grezzo**, quindi «riceve i menu» fra asterischi si leggerebbe con
 * gli asterischi addosso. Dove serve peso si usano le maiuscole e le «virgolette», come fanno tutte
 * le altre frasi che si leggono senza renderer. Lo tiene fermo la guardia del 22/8
 * (`asterischi-solo-dove-si-disegnano.spec.ts`), che ha bocciato la prima stesura di questo file.
 */
export function testoDelPromemoria(c: ClienteDaSorvegliare, e: EsitoPromemoria): string {
  const chi = c.nome?.trim() ? c.nome.trim() : 'Una cliente';
  const da = e.giorniInAttesa >= 1 ? ` (da ${e.giorniInAttesa} giorni)` : '';

  if (e.stato.motivo === 'visita_scaduta') {
    return (
      `${chi} è in percorso supervisionato e la visita andava fatta entro il ` +
      `${scritta(e.stato.visitaEntro)}: il termine è passato e da allora NON riceve più i menu. ` +
      'Guarda la sua scheda e decidi: «Può proseguire», oppure una nuova data entro cui fare la visita.'
    );
  }
  if (e.stato.motivo === 'visita_da_fare') {
    return (
      `${chi} è in percorso supervisionato e la visita va fatta entro il ${scritta(e.stato.visitaEntro)}. ` +
      'Nel frattempo riceve i menu regolarmente. Se la visita è stata fatta, segna la decisione dalla ' +
      'sua scheda; se la data non va più bene, spostala — dal giorno dopo il termine i menu si fermano.'
    );
  }
  return (
    `${chi} è in percorso supervisionato (ha dichiarato farmaci o condizioni in registrazione) e ` +
    `nessuno l'ha ancora valutata${da}. ⚠️ Nel frattempo RICEVE I MENU: il percorso non è fermo. ` +
    'Dalla sua scheda puoi scrivere «Può proseguire», oppure «Serve una visita» indicando entro ' +
    'quando — fino a quel giorno continua a mangiare, dal giorno dopo si ferma.'
  );
}

/** `2026-09-01` → `01/09/2026`, come tutte le altre date che si leggono. */
function scritta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC' });
}
