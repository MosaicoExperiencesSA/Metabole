/**
 * QUALI MENU SI RIFANNO QUANDO UN DIVIETO ENTRA IN VIGORE — e quali no.
 *
 * Decisione di Simone (13/8): «si rifanno solo i giorni futuri non ancora visti». È la stessa regola
 * dell'annulla. ⚠️ Fino al 26/8 il dato letto era `MenuDay.viewedAt`, che dice un'altra cosa
 * («gliel'abbiamo mostrato nella lista»): adesso decide `apertoDallaClienteIl`, scritto dall'app
 * quando la cliente sta guardando **quel** giorno. Vedi `siPuoCancellare` qui sotto.
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
 * una cliente) e i colpiti di una dieta includevano oggi, i colpiti degli spuntini partivano da
 * domani. Su una cliente che non aveva ancora aperto il menu di oggi la
 * conseguenza era visibile: toglierle lo spuntino non lo toglieva oggi, vietarle un alimento sì.
 * Nessuno dei due era scritto come scelta — erano due `where` scritti in momenti diversi.
 *
 * ⚠️ Il confine è **la mezzanotte di oggi**, non «adesso»: `MenuDay.date` è una data senza ora, e
 * confrontarla con l'istante corrente fa sparire la giornata di oggi appena passa mezzanotte —
 * cioè sempre. È lo stesso errore che il progetto ha già pagato altrove sui confronti fra date.
 *
 * ⚠️ E resta la regola vera, che questo confine **non** tocca: un giorno **già aperto** non si rifà
 * mai, perché magari ci ha già fatto la spesa. Quella domanda la risponde `siPuoCancellare`, non il
 * calendario — e dove la risposta è «non lo so», non si tocca lo stesso.
 */
import { aGiorno } from '../common/date-only';

export function daQuandoSiPuoRifare(oggi: Date = new Date()): Date {
  // Il giorno di Roma: era il giorno UTC, e all'una di notte diceva «ieri» — cioè apriva a rifare
  // una giornata che la cliente ha già davanti.
  return aGiorno(oggi);
}

/**
 * ⛔ **«QUESTO GIORNO SI PUÒ ANCORA CANCELLARE?» — e la risposta cambia il 26/8** (voce
 * `visto-non-vuol-dire-aperto`, strada 2 scelta da Simone il 25/8).
 *
 * ## Cosa c'era, e perché non funzionava
 *
 * `if (g.viewedAt) return false`. Sembrava la regola giusta — «un menu già letto resta suo» — e
 * leggeva un campo che dice **un'altra cosa**: `getMenu` rende all'app gli ultimi trenta giorni
 * **visibili**, futuri compresi, e subito dopo li segna tutti come visti. Bastava che una cliente
 * aprisse l'app una volta perché **tutto il suo futuro** risultasse letto. ⛔ Conseguenza: il
 * rifacimento dei giorni già preparati era di fatto morto. La nutrizionista dettava «niente pesce»
 * e leggeva «nei giorni già preparati non ce n'era: non ho toccato niente» **mentre il branzino era
 * nel menu di domani**. La frase era falsa e non lo sembrava — il modo peggiore in cui una funzione
 * può essere rotta.
 *
 * ## La regola nuova, in una riga: **si tocca solo quello che SAPPIAMO non essere stato aperto**
 *
 * ⚠️ E «sappiamo» è la parola che regge tutto. Il segnale vero lo manda l'app quando la cliente
 * apre **quel** giorno; finché il suo telefono non l'ha mandato mai, `apertoDallaClienteIl` nullo
 * vuol dire **«non lo so»**, non «non l'ha aperto». Trattare quel nulla come un no vorrebbe dire
 * cambiare il menu di domani a chi ha una versione vecchia dell'app e l'ha già letto e ci ha fatto
 * la spesa — cioè fare, in nome della correzione, il danno che la regola esisteva per impedire.
 * `apertureTracciate` è il dato che lo distingue: si scrive alla nascita della giornata.
 *
 * ⛔ **E «non lo so» non è «no»: è un TERZO stato, e va detto a voce.** Se sparisse dentro un
 * booleano, chi legge riceverebbe di nuovo «non ce n'era» al posto di «non lo posso sapere» — la
 * stessa frase falsa, con un campo nuovo sotto. È il motivo per cui `codaDaRifare` ha quattro esiti
 * e non tre, e per cui queste due domande hanno due funzioni invece di una.
 *
 * ⚠️ **`viewedAt` non si guarda più qui**, e non è stato tolto: continua a voler dire «gliel'abbiamo
 * mostrato», che è vero e che altri leggono. Due domande, due campi.
 *
 * ⚠️ **Il degrado è dalla parte giusta**: chi non ha ancora l'app nuova si comporta come ieri —
 * niente si rifà da solo, e la coach lo fa a mano dalla scheda. Si perde un automatismo, non un
 * menu.
 */
export interface Aperture {
  apertoDallaClienteIl?: Date | null;
  apertureTracciate?: boolean;
}

/** L'ha aperto **davvero**: il suo telefono ce l'ha detto per quel giorno. */
export function laClienteLHaAperto(g: Aperture): boolean {
  return !!g.apertoDallaClienteIl;
}

/**
 * Di questo giorno **non possiamo saperlo**: quando è stato composto la sua app non mandava ancora
 * il segnale. ⚠️ Non vuol dire «non l'ha aperto» — vuol dire che la domanda non ha risposta.
 */
export function nonSappiamoSeLHaAperto(g: Aperture): boolean {
  return !g.apertureTracciate;
}

/**
 * ⛔ **L'UNICA risposta a «questo giorno lo posso cancellare?»** — e sono due no diversi che qui
 * collassano apposta, perché la conseguenza è la stessa (non si tocca). ⚠️ Chi deve **spiegare
 * perché** non guarda questo booleano: guarda l'esito di `codaDaRifare`, che i due no li tiene
 * separati fino alla frase.
 */
export function siPuoCancellare(g: Aperture): boolean {
  return !laClienteLHaAperto(g) && !nonSappiamoSeLHaAperto(g);
}

/** Dal confine di `daQuandoSiPuoRifare` in avanti — la giornata di oggi compresa. */
export function daOggiInPoi(g: { date: Date }, oggi: Date = new Date()): boolean {
  return new Date(g.date).getTime() >= daQuandoSiPuoRifare(oggi).getTime();
}

/**
 * ⛔ **LA STESSA REGOLA DI `siPuoCancellare`, SCRITTA COME `where`** — per le query che non possono
 * caricare tutto e filtrare in memoria.
 *
 * ⚠️ È l'**unica** seconda forma della regola, e vive **qui accanto** apposta: due `where` sparsi
 * nei servizi sono il modo in cui una regola cambia in un posto e resta vecchia negli altri.
 * `una-regola-una-riga.spec.ts` tiene ferme le due forme insieme, campo per campo.
 *
 * ⚠️ **Non è il filtro di chi cancella.** Chi cancella deve vedere anche i giorni che NON può
 * toccare — sono quelli che decidono dove finisce la coda — e infatti `codaDaRifare` vuole il
 * calendario intero. Questo `where` serve a chi deve solo **contare** quanti se ne potrebbero
 * rifare (`RegistroService.menuDaRifare`) o a chi scrive su un giorno preciso e vuole sbagliare
 * verso il «non scrivo» (`scriviGiornataDettata`).
 */
export const CHE_SI_POSSONO_RIFARE = { apertureTracciate: true, apertoDallaClienteIl: null } as const;

export interface GiornoDaValutare extends Aperture {
  id: string;
  clientId: string;
  date: Date;
  /** Lo snapshot dei pasti: `[{slot, recipeId, name, kcal}]`. */
  meals: unknown;
}

/**
 * ⛔ **I CAMPI CHE SERVONO A DECIDERE, SCRITTI UNA VOLTA SOLA.**
 *
 * ⚠️ Le query che caricano i giorni passano da `as never` — il client Prisma generato in sandbox non
 * conosce le colonne nuove finché non gira `prisma generate`, e quel cast **spegne ogni controllo
 * sul contenuto del `select`**. Copiato in cinque punti, bastava dimenticarne uno perché
 * `apertureTracciate` arrivasse `undefined` e quel giorno diventasse «non lo so» per sempre, senza
 * un errore. Scritto qui una volta, i cinque punti non possono più divergere e
 * `una-regola-una-riga.spec.ts` controlla che i campi siano esattamente quelli che le decisioni
 * leggono.
 */
export const CAMPI_DEL_GIORNO = {
  id: true,
  clientId: true,
  date: true,
  apertoDallaClienteIl: true,
  apertureTracciate: true,
  meals: true,
} as const;

/** Gli id delle ricette dentro lo snapshot di un giorno, comunque sia fatto. */
export function ricetteDelGiorno(meals: unknown): string[] {
  if (!Array.isArray(meals)) return [];
  return (meals as unknown[])
    .map((m) => ((m ?? {}) as { recipeId?: unknown }).recipeId)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);
}

/**
 * I giorni **colpiti** da un divieto: futuri e che contengono almeno una ricetta vietata.
 *
 * ⛔ **NON dice se si possono rifare, e fino al 26/8 lo diceva.** Chiedeva anche `siPuoRifare`, e le
 * due domande insieme producevano la bugia peggiore del giro: nel giorno del rilascio nessun giorno
 * è ancora «tracciato», quindi i colpiti erano **zero** e chi chiama leggeva «non ce n'era» —
 * testualmente la frase che questa modifica esiste per togliere. Le due domande adesso stanno in due
 * posti: «è colpito?» qui, «lo posso cancellare?» dentro `codaDaRifare`, che sa anche dire **«non lo
 * so»**.
 *
 * @param oggi la data di riferimento (iniettabile: un test non deve dipendere da che giorno è).
 */
export function giorniColpitiDaiVietati(
  giorni: readonly GiornoDaValutare[],
  vietate: ReadonlySet<string>,
  oggi: Date,
): GiornoDaValutare[] {
  if (!vietate.size) return [];
  return giorni.filter((g) => daOggiInPoi(g, oggi) && ricetteDelGiorno(g.meals).some((id) => vietate.has(id)));
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
 * ## ⚠️ E i giorni che NON si possono cancellare tagliano la coda: si parte dopo l'ultimo
 *
 * Un giorno già aperto resta suo — magari ci ha fatto la spesa — e un giorno di cui **non sappiamo**
 * vale uguale: nel dubbio si tiene fermo. Nessuno dei due si può cancellare, e nessuno dei due si
 * può lasciare **dentro** la coda: resterebbe lui l'ultimo in calendario e il buco si riaprirebbe
 * identico. Quindi la coda parte **dal primo giorno colpito che sta dopo l'ultimo intoccabile**.
 *
 * ⚠️ **I colpiti che restano prima non si cancellano, e si dicono.** È il caso normale, non un
 * angolo: lei ha aperto il menu di oggi che contiene il piatto vietato, domani ce l'ha anche —
 * domani si rifà, oggi no. Contarli e tacerli farebbe leggere «fatto» a chi ha ancora il piatto
 * vietato nel piatto di stasera: `lasciatiIndietro` esiste per questo.
 *
 * ⚠️ Se **nessun** colpito sta dopo l'ultimo intoccabile non si cancella niente, e i due «no» si
 * separano: **`bloccata`** quando il giorno che blocca lei l'ha aperto davvero, **`non_lo_so`**
 * quando semplicemente non possiamo saperlo. ⛔ Collassarli in uno solo è come sono nati i difetti
 * di questo file: «non ce n'era» detto al posto di «non lo posso sapere».
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
  /** Nessun giorno colpito: non c'è niente da cancellare, e stavolta è vero per tutti i giorni. */
  | { esito: 'niente' }
  /**
   * Da cancellare, tutti insieme: è una coda vera. ⚠️ `lasciatiIndietro` sono i giorni colpiti che
   * stanno **prima** e che non si toccano (già aperti, o non sappiamo): chi racconta l'esito li deve
   * nominare, altrimenti dice «fatto» a chi ha ancora il piatto vietato davanti.
   */
  | { esito: 'coda'; giorni: GiornoDaValutare[]; daQuando: Date; lasciatiIndietro: number }
  /** Non si cancella niente: il giorno che blocca la cliente **l'ha aperto davvero**. */
  | { esito: 'bloccata'; daQuando: Date; apertoIl: Date }
  /**
   * Non si cancella niente e **non è un no**: del giorno che blocca non possiamo sapere se l'ha
   * aperto (app vecchia, o giornata composta prima che il suo telefono mandasse il segnale). ⛔ Chi
   * racconta questo esito deve dire «non lo so», mai «non ce n'era».
   */
  | { esito: 'non_lo_so'; daQuando: Date; dalGiorno: Date };

export function quanteDaRifare(coda: CodaDaRifare): number {
  return coda.esito === 'coda' ? coda.giorni.length : 0;
}

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

  const quando = (g: { date: Date }) => new Date(g.date).getTime();
  const colpiti = tuttiIGiorni.filter(colpito);
  if (!colpiti.length) return { esito: 'niente' };
  const primoColpito = Math.min(...colpiti.map(quando));

  /**
   * ⚠️ Gli intoccabili si cercano su **tutto** il calendario passato, non solo fra i colpiti: quello
   * che chiude la coda può benissimo essere un giorno che col divieto non c'entra niente.
   */
  const intoccabili = tuttiIGiorni.filter((g) => !siPuoCancellare(g));
  const ultimoIntoccabile = intoccabili.length ? Math.max(...intoccabili.map(quando)) : -Infinity;

  const daRifare = colpiti.filter((g) => quando(g) > ultimoIntoccabile);
  if (!daRifare.length) {
    /**
     * ⚠️ **Il giorno che blocca è il più VICINO fra quelli in mezzo**, non il primo che capita
     * nell'array: l'ordine con cui arrivano i giorni dipende dalla query, e la data che si mostra a
     * chi legge dev'essere sempre la stessa.
     *
     * ⚠️ E fra i due «no» vince **`bloccata`**: «questo menu ce l'ha già in mano» è un fatto, «non lo
     * so» è l'assenza di un fatto — chi deve decidere se premere «Rigenera menu» ha bisogno di
     * sapere quale dei due sta leggendo.
     */
    const inMezzo = intoccabili.filter((g) => quando(g) >= primoColpito);
    const aperti = inMezzo.filter(laClienteLHaAperto).map(quando);
    if (aperti.length) {
      return { esito: 'bloccata', daQuando: new Date(primoColpito), apertoIl: new Date(Math.min(...aperti)) };
    }
    return { esito: 'non_lo_so', daQuando: new Date(primoColpito), dalGiorno: new Date(Math.min(...inMezzo.map(quando))) };
  }

  const daQuando = new Date(Math.min(...daRifare.map(quando)));
  const coda = tuttiIGiorni.filter((g) => quando(g) >= daQuando.getTime());
  return { esito: 'coda', giorni: coda, daQuando, lasciatiIndietro: colpiti.length - daRifare.length };
}

/**
 * La stessa domanda quando i giorni sono di **più clienti** insieme — è il caso della regola di
 * dieta, che tocca tutte le clienti di quella dieta in un colpo solo.
 *
 * ⚠️ La coda si calcola **per persona**: una data unica per tutte sarebbe la data della cliente
 * colpita per prima, e alle altre cancellerebbe giornate che nessun divieto tocca. E una bloccata
 * **non blocca le altre**: chi ha un giorno già aperto in mezzo resta indietro da sola, e viene
 * contata a parte perché qualcuno possa guardarla.
 *
 * ⚠️ **Tre elenchi e non due**: `nonSapute` sono le clienti di cui non possiamo sapere se hanno
 * aperto (app vecchia). Metterle insieme alle bloccate direbbe al capo una cosa falsa — «il menu le
 * è già arrivato» — su una persona di cui non sappiamo niente. È lo stesso errore, un piano più su.
 */
export function codePerCliente(
  tuttiIGiorni: readonly GiornoDaValutare[],
  colpito: Colpito,
): { daCancellare: GiornoDaValutare[]; bloccate: string[]; nonSapute: string[]; lasciatiIndietro: number } {
  const perCliente = new Map<string, GiornoDaValutare[]>();
  for (const g of tuttiIGiorni) {
    const suoi = perCliente.get(g.clientId);
    if (suoi) suoi.push(g);
    else perCliente.set(g.clientId, [g]);
  }

  const daCancellare: GiornoDaValutare[] = [];
  const bloccate: string[] = [];
  const nonSapute: string[] = [];
  /**
   * ⚠️ **I colpiti rimasti indietro si sommano anche qui** (26/8, in revisione): `codaDaRifare` li
   * conta e questa funzione li buttava via, quindi la regola di dieta non poteva dire «per alcune la
   * giornata più vicina col piatto vietato resta» mentre la chat lo diceva. Due punti che rispondono
   * alla stessa domanda, e uno dei due aveva perso il dato per strada.
   */
  let lasciatiIndietro = 0;
  for (const [clientId, suoi] of perCliente) {
    const esito = codaDaRifare(suoi, colpito);
    if (esito.esito === 'coda') {
      daCancellare.push(...esito.giorni);
      lasciatiIndietro += esito.lasciatiIndietro;
    } else if (esito.esito === 'bloccata') bloccate.push(clientId);
    else if (esito.esito === 'non_lo_so') nonSapute.push(clientId);
  }
  return { daCancellare, bloccate, nonSapute, lasciatiIndietro };
}
