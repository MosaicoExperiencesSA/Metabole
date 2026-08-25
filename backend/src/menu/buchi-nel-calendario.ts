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

/**
 * ⛔ **LE DATE CHE L'EROGAZIONE DEVE COMPORRE: prima i buchi, poi il seguito.**
 *
 * Richiesta di Simone, 25/8: *«i buchi si riempiono con le nuove»*. Fino a oggi l'erogazione
 * appendeva i giorni **dopo l'ultimo** (`ultimo + 1`), quindi:
 *  · un buco in mezzo **non si richiudeva mai**: quel giorno la cliente vedeva «menu in
 *    preparazione» per sempre;
 *  · e se il buco era tale che l'ultimo giorno restava **oltre oggi**, l'erogazione si fermava del
 *    tutto — *«non riceve più niente finché quella data non passa»* — perché il buffer in avanti
 *    guarda la **data più alta**, non quante giornate ci sono davvero.
 *
 * ✅ Adesso le giornate nuove vanno **nei buchi**, in ordine di data, e solo quando i buchi sono
 * finiti si riprende ad accodare. Non è una riparazione a parte: è la stessa erogazione di sempre
 * che sceglie date diverse, quindi non rimescola niente e non tocca un giorno già scritto — che è la
 * ragione per cui la voce diceva *«la riparazione non è automatica di proposito»*. Qui non si
 * cancella nulla: si scrive solo dove non c'è niente.
 *
 * ⚠️ **I giorni in sospensione restano vuoti**, e non sono buchi: durante una vacanza l'erogazione
 * si ferma di proposito, e riempirli vorrebbe dire regalare giornate di piano.
 */
/**
 * Quanti giorni di calendario si è disposti a scorrere prima di dire basta. Dieci anni: nessun piano
 * vero ci arriva, e una data di partenza sbagliata (un `NaN`, un inizio piano nel 1970, una vacanza
 * che non finisce mai) non diventa un ciclo che non finisce.
 */
const TETTO_GIORNI_GUARDATI = 3650;

export function dateDaComporre(opzioni: {
  /** Le date già in calendario (mezzanotte UTC). */
  presenti: readonly number[];
  /** Da dove si comincia a guardare: di norma il massimo fra oggi e l'inizio del piano. */
  da: number;
  /** Quante giornate compone questa erogazione. */
  quante: number;
  /** L'ultimo giorno del piano, oltre il quale non si compone. `null` = nessun limite. */
  finePiano?: number | null;
  sospeso?: InSospensione;
}): number[] {
  const { presenti, da, quante, finePiano = null } = opzioni;
  const sospeso = opzioni.sospeso ?? (() => false);
  if (!Number.isFinite(quante) || quante < 1) return [];

  const gia = new Set(presenti);
  const fuori: number[] = [];
  /**
   * ⚠️ **Il tetto è quante giornate servono, non quanti giorni si guardano.** Il ciclo scorre le
   * date una per una finché non ne ha trovate abbastanza; il limite di sicurezza qui sotto esiste
   * perché una data di partenza sbagliata (un `NaN`, un piano con l'inizio nel 1970) non diventi un
   * ciclo che non finisce mai — e allora si esce con quello che si è trovato, che è meno di quello
   * che serviva ma non è un'applicazione ferma.
   */
  let t = da;
  for (let i = 0; fuori.length < quante && i < TETTO_GIORNI_GUARDATI; i += 1, t += GIORNO) {
    if (finePiano !== null && t > finePiano) break;
    if (gia.has(t) || sospeso(t)) continue;
    fuori.push(t);
  }
  return fuori;
}

/**
 * ⛔ **QUANTE GIORNATE HA DAVANTI DI SEGUITO, da oggi — senza saltare buchi.**
 *
 * È la domanda che il buffer in avanti faceva male in due modi diversi:
 *  · guardava `ultimo.date > oggi`, cioè **la data più alta**: una riga in fondo al calendario
 *    valeva come «ha il menu», e l'erogazione si fermava del tutto finché quella data non passava;
 *  · e contare le giornate **sparse** non basta: chi ha oggi e poi un giorno fra tre settimane ne ha
 *    due, ma domani non ha niente. La domanda vera è *«fino a quando può aprire l'app e trovare il
 *    menu?»*, e la risposta si ferma al primo buco.
 *
 * ⚠️ **I giorni in sospensione contano come coperti**: durante una vacanza il menu non c'è di
 * proposito, e trattarli da buco farebbe erogare in mezzo alle ferie.
 *
 * ⚠️ La cadenza di sempre non cambia, misurata: dopo un'erogazione di due giorni ne ha due di
 * seguito e ci si ferma; il giorno dopo ne resta uno e se ne compongono altri due. È esattamente
 * quello che faceva la regola vecchia quando il calendario era intero.
 */
export function giornateDiSeguito(
  presenti: readonly number[],
  oggi: number,
  sospeso: InSospensione = () => false,
): number {
  return corsaDiGiornate(presenti, oggi, sospeso).quante;
}

/**
 * ⛔ **LA CORSA DELLE GIORNATE DAVANTI: quante sono e DOVE FINISCE.**
 *
 * `giornateDiSeguito` risponde alla prima metà; questa risponde a tutte e due, e la prima la chiama.
 * La seconda metà serve al **cancello delle misure**, che deve sapere dove finisce il ciclo in
 * corso: la data più alta del calendario non lo dice più, perché fra oggi e quella data ci può
 * essere un buco — ed è esattamente il caso in cui il cancello, misurato, si apriva da solo.
 *
 * ⚠️ `ultima` è `null` quando **oggi stesso** manca: non c'è nessuna corsa, e chi legge deve
 * trattarlo come «il ciclo è finito», non come «finisce oggi».
 */
export function corsaDiGiornate(
  presenti: readonly number[],
  oggi: number,
  sospeso: InSospensione = () => false,
): { quante: number; ultima: number | null } {
  const gia = new Set(presenti);
  let quante = 0;
  let ultima: number | null = null;
  /**
   * ⚠️ **La rete si conta sui GIRI, non sulle giornate trovate** — corretto dalla revisione
   * avversariale del 25/8, che l'ha misurato: con `sospeso` sempre vero `quante` non cresce **mai**,
   * il `break` non scatta e il ciclo passava i 200.000 giri. Il commento diceva «rete: un calendario
   * assurdo non deve diventare un ciclo infinito» e la rete non c'era: proteggeva dai giorni
   * *presenti*, non da quelli *scavalcati*. È lo stesso tetto che `dateDaComporre` ha già, e lì era
   * fatto giusto — due punti che rispondono alla stessa domanda e non si somigliavano.
   */
  for (let t = oggi, giri = 0; giri < TETTO_GIORNI_GUARDATI; t += GIORNO, giri += 1) {
    if (gia.has(t)) {
      quante += 1;
      ultima = t;
    }
    // ⚠️ Un giorno sospeso non è una giornata, ma nemmeno un buco: si scavalca senza contarlo.
    else if (!sospeso(t)) break;
  }
  return { quante, ultima };
}
