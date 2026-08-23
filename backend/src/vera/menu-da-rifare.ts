/**
 * QUALI MENU SI RIFANNO QUANDO UN DIVIETO ENTRA IN VIGORE — e quali no.
 *
 * Decisione di Simone (13/8): «si rifanno solo i giorni futuri non ancora visti». È la stessa regola
 * dell'annulla, e `MenuDay.viewedAt` esiste dalla Consegna 1 esattamente per questo.
 *
 * ⚠️ **Un menu già letto resta suo.** Rifare un giorno che una cliente ha già aperto — magari dopo
 * aver fatto la spesa — è la cosa che fa scrivere «l'app è impazzita». Il confine non è «da domani»:
 * è «da quello che non ha ancora aperto».
 *
 * ⚠️ **Si toccano solo i giorni che contengono davvero il piatto vietato.** Buttare via tutti i
 * giorni futuri della dieta sarebbe più semplice da scrivere e molto peggio da subire: si
 * rimescolerebbero menu che non c'entrano niente, per una regola su un solo alimento.
 */

/**
 * DA QUANDO UN MENU SI PUÒ ANCORA RIFARE — **la giornata di oggi compresa** (19/8, decisione di
 * Simone: «meglio rifare la giornata di oggi»).
 *
 * ⚠️ Esisteva scritta in **tre posti**, e in uno dei tre il confine era diverso: `menuDaRifare` (per
 * una cliente) e `giorniDaRifare` (per una dieta) includevano oggi, `giorniDaRifarePerPasti` (per
 * gli spuntini) partiva da domani. Su una cliente che non aveva ancora aperto il menu di oggi la
 * conseguenza era visibile: toglierle lo spuntino non lo toglieva oggi, vietarle un alimento sì.
 * Nessuno dei due era scritto come scelta — erano due `where` scritti in momenti diversi.
 *
 * ⚠️ Il confine è **la mezzanotte di oggi**, non «adesso»: `MenuDay.date` è una data senza ora, e
 * confrontarla con l'istante corrente fa sparire la giornata di oggi appena passa mezzanotte —
 * cioè sempre. È lo stesso errore che il progetto ha già pagato altrove sui confronti fra date.
 *
 * ⚠️ E resta la regola vera, che questo confine **non** tocca: un giorno **già aperto** non si rifà
 * mai, perché magari ci ha già fatto la spesa. `viewedAt` è quello che decide, non il calendario.
 */
import { aGiorno } from '../common/date-only';

export function daQuandoSiPuoRifare(oggi: Date = new Date()): Date {
  // Il giorno di Roma: era il giorno UTC, e all'una di notte diceva «ieri» — cioè apriva a rifare
  // una giornata che la cliente ha già davanti.
  return aGiorno(oggi);
}

/** «Questo giorno si può ancora rifare?» — mai aperto, e non passato. La risposta è una sola. */
export function siPuoRifare(g: { date: Date; viewedAt?: Date | null }, oggi: Date = new Date()): boolean {
  if (g.viewedAt) return false;
  return new Date(g.date).getTime() >= daQuandoSiPuoRifare(oggi).getTime();
}

export interface GiornoDaValutare {
  id: string;
  clientId: string;
  date: Date;
  viewedAt?: Date | null;
  /** Lo snapshot dei pasti: `[{slot, recipeId, name, kcal}]`. */
  meals: unknown;
}

/** Gli id delle ricette dentro lo snapshot di un giorno, comunque sia fatto. */
export function ricetteDelGiorno(meals: unknown): string[] {
  if (!Array.isArray(meals)) return [];
  return (meals as unknown[])
    .map((m) => ((m ?? {}) as { recipeId?: unknown }).recipeId)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);
}

/**
 * I giorni da rifare: futuri, **non ancora aperti**, e che contengono almeno una ricetta vietata.
 *
 * @param oggi la data di riferimento (iniettabile: un test non deve dipendere da che giorno è).
 */
export function giorniDaRifare(
  giorni: readonly GiornoDaValutare[],
  vietate: ReadonlySet<string>,
  oggi: Date,
): GiornoDaValutare[] {
  if (!vietate.size) return [];
  // ⚠️ «Si può ancora rifare?» ha **una** risposta: `siPuoRifare`. Qui si aggiunge solo la seconda
  // domanda, che è di questa funzione e non delle altre: «contiene davvero il piatto vietato?».
  return giorni.filter((g) => siPuoRifare(g, oggi) && ricetteDelGiorno(g.meals).some((id) => vietate.has(id)));
}

/** Quante persone diverse tocca. È il numero da confrontare col tetto, non quello dei giorni. */
export function clientiColpiti(giorni: readonly GiornoDaValutare[]): string[] {
  return [...new Set(giorni.map((g) => g.clientId))];
}

// ─────────────────────────────────────── e adesso: QUALI si possono cancellare ──────────

/**
 * ⛔ **SI PUÒ CANCELLARE SOLO UNA CODA. UN GIORNO IN MEZZO NON TORNA PIÙ.**
 *
 * ## Il fatto, misurato nel motore (23/8)
 *
 * «Rifare un giorno», in tutto il progetto, vuol dire **cancellarlo** e lasciare che l'erogazione lo
 * ricomponga. Ma `MenuService.deliverIfEligible` non cerca i buchi: guarda **l'ultimo giorno in
 * calendario** e fa due cose sole —
 *
 *  · se quell'ultimo giorno è **oltre oggi**, esce e non eroga niente (è il buffer che impedisce di
 *    generare cicli all'infinito);
 *  · altrimenti compone **da lì in avanti**.
 *
 * ⛔ Quindi qualunque giorno cancellato che ne lasci uno **più avanti** è un buco **permanente**: la
 * cliente apre l'app in quella data e trova «menu in preparazione», e nessun giro successivo lo
 * riempirà mai. Non c'è un errore, non c'è un log, non c'è una segnalazione: c'è una persona che
 * quel giorno non sa cosa mangiare.
 *
 * ⚠️ E il caso peggiore non è nemmeno il buco: se il giorno rimasto in fondo è **oltre oggi**,
 * l'erogazione si ferma **del tutto** finché quella data non passa. Cancellare due giorni su tre può
 * quindi bloccare l'intero calendario per una settimana.
 *
 * ## La regola che ne esce
 *
 * Si sceglie il **primo** giorno colpito e si cancella **da lì in poi, tutto** — anche le giornate
 * innocenti che stanno dopo. ⚠️ Il prezzo è che qualche menu che andava bene viene rimescolato. È un
 * prezzo, e si paga volentieri: un menu rimescolato è un fastidio, un giorno che non torna più è una
 * persona senza cena.
 *
 * ## ⚠️ E se dentro la coda c'è un giorno GIÀ APERTO, non si tocca niente
 *
 * Un giorno letto resta suo — magari ci ha fatto la spesa — quindi non si può cancellare; ma se sta
 * **dopo** quello colpito resta lui l'ultimo, e il buco si riaprirebbe identico. In quel caso questa
 * funzione dice **`bloccata`**, e sta al chiamante dirlo a chi sta guardando invece di fingere di
 * aver fatto. Fingere è il difetto da cui nasce tutto questo file.
 *
 * ## ⚠️ Chi chiama deve passare TUTTI i giorni, non solo i candidati
 *
 * `tuttiIGiorni` deve contenere **ogni** giorno della cliente da `daQuandoSiPuoRifare` in avanti:
 * quelli già aperti compresi, e quelli che col divieto non c'entrano niente. Passare solo i candidati
 * — la query filtrata, che è quello che facevano tutti e tre i punti rotti — vuol dire calcolare una
 * «coda» che coda non è, e il buco resta esattamente dov'era.
 *
 * ⛔ **Per questo i colpiti arrivano come PREDICATO e non come secondo elenco.** La prima stesura
 * prendeva due array, e chi ne passava due che non c'entravano niente l'uno con l'altro — un elenco
 * di colpiti che non stanno dentro `tuttiIGiorni` — otteneva una coda **vuota** con esito «fatto»:
 * la risposta più tranquillizzante possibile davanti al difetto esatto che questa funzione esiste per
 * chiudere. Con un predicato i colpiti sono un sottoinsieme **per costruzione**, e quel modo di
 * sbagliare non esiste più. Le regole che si possono solo rispettare valgono più di quelle scritte.
 */
export type CodaDaRifare =
  /** Nessun giorno colpito: non c'è niente da cancellare. */
  | { esito: 'niente' }
  /** Da cancellare, tutti insieme: è una coda vera. */
  | { esito: 'coda'; giorni: GiornoDaValutare[]; daQuando: Date }
  /** Dentro la coda c'è un giorno già aperto: non si cancella niente, e si dice perché. */
  | { esito: 'bloccata'; daQuando: Date; apertoIl: Date };

/** «Questo giorno è colpito dalla decisione?» — la seconda domanda, che cambia da azione ad azione. */
export type Colpito = (g: GiornoDaValutare) => boolean;

export function codaDaRifare(tuttiIGiorni: readonly GiornoDaValutare[], colpito: Colpito): CodaDaRifare {
  /**
   * ⛔ **UNA CLIENTE PER VOLTA, e qui si urla invece di indovinare** (24/8, in revisione).
   *
   * La coda si taglia per **data**, non per persona: passando i giorni di più clienti insieme, il
   * primo colpito di Anna fisserebbe la data e nella coda finirebbero i giorni di **Bea** da lì in
   * poi — cancellati a una che non c'entra niente; oppure un giorno già arrivato a Bea manderebbe in
   * `bloccata` la coda di Anna. ⚠️ È l'errore che costa di più fra quelli possibili qui, e
   * `codePerCliente` sta due funzioni sotto e si chiama quasi uguale: la distanza fra i due nomi è
   * molto minore della distanza fra le due conseguenze.
   *
   * Si solleva invece di correggere in silenzio: un raggruppamento fatto di nascosto renderebbe le
   * due funzioni intercambiabili, e allora tanto varrebbe averne una sola.
   */
  if (new Set(tuttiIGiorni.map((g) => g.clientId)).size > 1) {
    throw new Error('codaDaRifare: giorni di più clienti insieme. La coda è di una persona sola — usa `codePerCliente`.');
  }

  const colpiti = tuttiIGiorni.filter(colpito);
  if (!colpiti.length) return { esito: 'niente' };

  const quando = Math.min(...colpiti.map((g) => new Date(g.date).getTime()));
  const daQuando = new Date(quando);
  const coda = tuttiIGiorni.filter((g) => new Date(g.date).getTime() >= quando);

  /**
   * ⚠️ Il giorno aperto **più vicino**, non il primo che capita nell'array: l'ordine con cui arrivano
   * i giorni dipende dalla query, e la data che si mostra a chi legge dev'essere sempre la stessa.
   */
  const aperti = coda.filter((g) => g.viewedAt).map((g) => new Date(g.date).getTime());
  if (aperti.length) return { esito: 'bloccata', daQuando, apertoIl: new Date(Math.min(...aperti)) };

  return { esito: 'coda', giorni: coda, daQuando };
}

/**
 * La stessa domanda quando i giorni sono di **più clienti** insieme — è il caso della regola di
 * dieta, che tocca tutte le clienti di quella dieta in un colpo solo.
 *
 * ⚠️ La coda si calcola **per persona**: una data unica per tutte sarebbe la data della cliente
 * colpita per prima, e alle altre cancellerebbe giornate che nessun divieto tocca. E una bloccata
 * **non blocca le altre**: chi ha un giorno già aperto in mezzo resta indietro da sola, e viene
 * contata a parte perché qualcuno possa guardarla.
 */
export function codePerCliente(
  tuttiIGiorni: readonly GiornoDaValutare[],
  colpito: Colpito,
): { daCancellare: GiornoDaValutare[]; bloccate: string[] } {
  const perCliente = new Map<string, GiornoDaValutare[]>();
  for (const g of tuttiIGiorni) {
    const suoi = perCliente.get(g.clientId);
    if (suoi) suoi.push(g);
    else perCliente.set(g.clientId, [g]);
  }

  const daCancellare: GiornoDaValutare[] = [];
  const bloccate: string[] = [];
  for (const [clientId, suoi] of perCliente) {
    const esito = codaDaRifare(suoi, colpito);
    if (esito.esito === 'coda') daCancellare.push(...esito.giorni);
    else if (esito.esito === 'bloccata') bloccate.push(clientId);
  }
  return { daCancellare, bloccate };
}
