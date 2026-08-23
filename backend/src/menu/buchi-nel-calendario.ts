/**
 * ⛔ **UN BUCO NEL CALENDARIO DEI MENU: come si riconosce.**
 *
 * Fra il primo e l'ultimo giorno in calendario, una data mancante è un buco: l'erogazione appende i
 * giorni uno dopo l'altro a partire dall'ultimo, quindi in mezzo non salta mai niente da sola.
 *
 * ⚠️ **«Da sola» è la parola giusta, e la prima stesura scriveva «consecutivi per costruzione» —
 * che è falso.** Il motore un salto lo fa: quando una cliente resta indietro (misure non inviate,
 * piano fermato) riprende da **oggi** (`firstNewDate = nextDate > today ? nextDate : today`), e i
 * giorni in mezzo non nascono mai. Quel salto però resta **dietro** al punto in cui riprende, quindi
 * guardando da oggi in avanti non produce falsi allarmi. È una premessa che regge per dove la si usa,
 * non una legge: scriverla come legge avrebbe fatto sbagliare il prossimo che allarga la finestra.
 *
 * Sta qui e non dentro lo script di diagnosi (`prisma/diag-buchi-nei-menu.ts`) per una ragione sola:
 * **un conteggio sbagliato risponderebbe «nessun buco»**, che è la risposta più tranquillizzante
 * possibile davanti al difetto che si sta cercando. Uno script senza test che dice «tutto a posto» è
 * peggio di nessuno script — chiude la domanda invece di aprirla. Qui i test ci sono.
 *
 * ⚠️ **I giorni in sospensione non sono buchi**: durante una vacanza l'erogazione si ferma di
 * proposito. Contarli riempirebbe l'elenco di righe innocenti, cioè lo renderebbe illeggibile — e un
 * elenco che grida su cose normali è un elenco che si impara a non aprire.
 */

const GIORNO = 86_400_000;

/** «Questo istante cade dentro una sospensione?» — la decide il chiamante, che ha le date. */
export type InSospensione = (istante: number) => boolean;

/**
 * Le date mancanti fra la prima e l'ultima, in millisecondi.
 *
 * @param giorni le date dei menu in calendario (mezzanotte UTC, come sono salvate). L'ordine non conta.
 * @param sospeso quali istanti sono coperti da una sospensione: quelli non sono buchi.
 */
export function buchiFra(giorni: readonly number[], sospeso: InSospensione = () => false): number[] {
  // ⚠️ Con zero o un giorno solo non c'è un «fra»: nessun buco possibile, e `Math.min` di un array
  // vuoto vale `Infinity` — cioè un ciclo che non finisce mai.
  if (giorni.length < 2) return [];

  const presenti = new Set(giorni);
  const primo = Math.min(...giorni);
  const ultimo = Math.max(...giorni);

  const buchi: number[] = [];
  for (let t = primo + GIORNO; t < ultimo; t += GIORNO) {
    if (!presenti.has(t) && !sospeso(t)) buchi.push(t);
  }
  return buchi;
}

/**
 * ⛔ **IL CASO CHE `buchiFra` DA SOLA NON PUÒ VEDERE: il buco che comincia OGGI.**
 *
 * `buchiFra` guarda **fra** il primo e l'ultimo giorno. Ma la diagnosi parte da oggi: se il giorno
 * cancellato è **oggi**, oggi non è «in mezzo», è il bordo — e la risposta era «nessun buco, niente
 * da riparare» proprio per la cliente che in quel momento apre l'app e trova «menu in preparazione»,
 * con l'erogazione ferma fino al suo ultimo giorno.
 *
 * ⚠️ **E serve sapere se il piano è partito**, altrimenti si grida su ogni cliente nuova. Il menu si
 * sblocca `menu_visible_days_before_start` giorni **prima** della partenza (due, oggi): per due
 * giorni una cliente ha solo giorni futuri e nessun menu per oggi, ed è giusto così — il suo piano
 * comincia giovedì. Dentro la finestra «da oggi in avanti» i due casi sono **indistinguibili**: la
 * differenza la fa solo la data di inizio, che quindi va passata. Senza, l'elenco metteva ogni
 * cliente nuova per due giorni in cima con la bandiera più grossa — cioè diventava l'elenco che si
 * impara a non aprire.
 *
 * ⚠️ Sta qui e non nello script per la stessa ragione di `buchiFra`: è la riga che decide **chi è
 * urgente**, e sbagliandola risponde «niente da riparare». Nello script non avrebbe test.
 */
export function senzaIlMenuDiOggi(
  giorni: readonly number[],
  oggi: number,
  opzioni: { sospeso?: InSospensione; inizioPiano?: number | null } = {},
): boolean {
  if (!giorni.length) return false;
  // Se l'ultimo giorno è oggi o prima, il motore riparte da solo al prossimo giro: non c'è niente
  // di rotto, c'è solo un ciclo da erogare.
  if (Math.max(...giorni) <= oggi) return false;
  if (giorni.includes(oggi)) return false;
  if ((opzioni.sospeso ?? (() => false))(oggi)) return false;
  // Piano non ancora partito (o data sconosciuta): non è un buco, è un'attesa.
  const inizio = opzioni.inizioPiano;
  if (inizio === null || inizio === undefined || inizio > oggi) return false;
  return true;
}
