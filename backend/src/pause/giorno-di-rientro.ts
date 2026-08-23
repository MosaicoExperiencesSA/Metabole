import { aGiorno, giornoDelDato } from '../common/date-only';

/**
 * ⛔ **QUANDO RIPRENDE LA DIETA** — una porta sola, e la ragione per cui esiste.
 *
 * ## Le due convenzioni, e perché non sono la stessa
 *
 * Una sospensione ha due date, e fin qui la seconda voleva dire due cose diverse a seconda di chi
 * la guardava:
 *
 *  - **quella salvata** (`event.end_date`, `pause_request.end_date`) è l'**ultimo giorno sospeso**:
 *    `activePausePeriod` la include (`endDate >= oggi`), `daysInclusive` la conta, e la scadenza
 *    del piano slitta di quei giorni lì. Tutte le pause già in corso sulle clienti vere sono
 *    scritte così;
 *  - **quella che si scrive e si legge** — la casella in back office, il Calendario in app,
 *    l'elenco in scheda — è il **primo giorno di dieta**: «riprende il 24» (decisione di Simone,
 *    23/8). È la domanda che si fa davvero una persona davanti a quella casella: *da quando
 *    rimangia?*, non *qual è l'ultimo giorno in cui non mangia*.
 *
 * ⛔ **La convenzione salvata NON si cambia, e non è pigrizia.** Spostare `end_date` di un giorno
 * in tabella vorrebbe dire una migrazione su righe **vive**: clienti che in questo momento sono in
 * pausa, con la scadenza del piano già allungata di quei giorni. Se la migrazione sbaglia di uno,
 * qualcuna resta un giorno senza menu — o ne riceve uno durante la vacanza — e non se ne accorge
 * nessuno finché non scrive. Il guadagno sarebbe zero: la domanda «quando riprende?» ha bisogno di
 * **una risposta sola**, non di una colonna diversa.
 *
 * Quella risposta sola è questo file. Chi vuole sapere quando riprende chiama `giornoDiRientro`;
 * chi vuole scrivere una sospensione che riprende il giorno X chiama `ultimoGiornoSospeso`. Nessuno
 * somma o sottrae 86.400.000 per conto suo: è così che due punti dello stesso prodotto cominciano a
 * dare due risposte.
 *
 * ## Il giorno si legge in UTC
 *
 * `startDate`/`endDate` sono colonne `DATE`: dentro c'è la mezzanotte UTC del giorno di Roma, che è
 * come le scrive `toDateOnly`. Si rileggono con `giornoDelDato`, che è la porta per «di che giorno
 * è questa data salvata» — vedi il riquadro in `date-only.ts`. Rileggerle nel fuso di Roma le
 * sposterebbe di un giorno.
 *
 * ⚠️ **«Oggi» invece è l'altra porta**: `aGiorno`, cioè il giorno di **Roma**. Le due non sono
 * intercambiabili, ed è scritto nello stesso riquadro: «di che giorno è questa data salvata?» si
 * legge in UTC, «che giorno è oggi?» si legge nel fuso dell'azienda. Fra mezzanotte e le due del
 * mattino leggere «oggi» in UTC risponde **ieri**, e una finestra di rientro che si apre un giorno
 * dopo è un menu che non arriva.
 */

const GIORNO = 86_400_000;

/** Il periodo sospeso, come sta scritto in tabella (`endDate` = ultimo giorno sospeso). */
export interface PeriodoSospeso {
  startDate: Date;
  endDate: Date;
}

/**
 * ⚠️ **Le due date ci sono e si leggono?**
 *
 * In tabella sono obbligatorie, quindi qui non dovrebbe passare mai niente di rotto. Esiste lo
 * stesso perché la risposta di questo file decide se **sospendere l'erogazione o riprenderla**: su
 * un dato illeggibile la cosa giusta è tenere la sospensione, non far esplodere l'apertura
 * dell'app né — peggio — far ripartire i menu per errore.
 *
 * ⛔ Ma non si degrada in silenzio: chi chiama **scrive nei log** prima di fermarsi
 * (`feedback-errori-nei-log`, «un catch muto è un mistero»). Questa funzione dice solo se il dato
 * si legge; cosa farne, e cosa raccontare, lo decide chi la chiama.
 */
export function periodoLeggibile(periodo: Partial<PeriodoSospeso> | null | undefined): periodo is PeriodoSospeso {
  const ok = (d: unknown): boolean => d instanceof Date && Number.isFinite(d.getTime());
  return Boolean(periodo) && ok(periodo?.startDate) && ok(periodo?.endDate);
}

/**
 * Il **primo giorno di dieta** dopo la sospensione: il giorno dopo l'ultimo giorno sospeso.
 *
 * È quello che l'operatrice scrive nella casella «Riprende il» e quello che la cliente legge nel
 * banner: se la sospensione è scritta «al 23», qui esce il **24**.
 */
export function giornoDiRientro(periodo: PeriodoSospeso): Date {
  return new Date(giornoDelDato(periodo.endDate).getTime() + GIORNO);
}

/**
 * L'inverso: da «riprende il 24» all'ultimo giorno sospeso (il 23), che è quello che si salva.
 *
 * ⚠️ Non controlla che il rientro sia dopo la partenza — lo fa chi chiama, che sa dire alla persona
 * *quale* delle due caselle ha sbagliato.
 */
export function ultimoGiornoSospeso(giornoDiRientro: Date): Date {
  return new Date(giornoDelDato(giornoDiRientro).getTime() - GIORNO);
}

/** Quanti giorni di dieta salta questa sospensione (inclusivi, come li conta `pause.service`). */
export function giorniSospesi(periodo: PeriodoSospeso): number {
  const da = giornoDelDato(periodo.startDate).getTime();
  const a = giornoDelDato(periodo.endDate).getTime();
  return Math.floor((a - da) / GIORNO) + 1;
}

/**
 * ⛔ **LA FINESTRA DI RIENTRO** — l'anticipo con cui il menu del rientro arriva in mano.
 *
 * Richiesta di Simone (23/8), ed è la stessa regola con cui parte un piano nuovo: *il primo menu si
 * eroga con un giorno d'anticipo*. All'inizio del percorso l'anticipo è di due giorni
 * (`menu_visible_days_before_start`) e serve a fare la spesa; qui è di uno
 * (`menu_visible_days_before_return`), perché la cliente sta rientrando da una vacanza e la spesa
 * la fa comunque.
 *
 * Concretamente: sospensione fino al 23, rientro il 24, anticipo 1 → **il 23** le si chiede la
 * pesata e le si eroga il menu **del 24**. Il 23 è ancora un giorno sospeso: il menu che riceve non
 * è di oggi, è di domani. Chi eroga deve saperlo, ed è per questo che qui non si torna un `boolean`
 * ma **il giorno da erogare**.
 *
 * `null` = fuori finestra, la sospensione vale ancora piena.
 */
export function rientroInArrivo(
  periodo: PeriodoSospeso,
  oggi: Date,
  anticipoGiorni: number,
): Date | null {
  const rientro = giornoDiRientro(periodo);
  const anticipo = Math.max(0, Math.floor(anticipoGiorni));
  const siApre = rientro.getTime() - anticipo * GIORNO;
  return aGiorno(oggi).getTime() >= siApre ? rientro : null;
}
