/**
 * GLI STATI DI UN ABBONAMENTO — un nome per ogni domanda, invece di `'active'` scritto ottanta volte.
 *
 * Voce 258. Il 17/8 il censimento ha contato **una novantina di punti** che leggono
 * `status` su `Subscription`, e quasi tutti scrivono la stessa stringa: `'active'`. Ma non stanno
 * chiedendo la stessa cosa. Ce ne sono almeno quattro, diverse:
 *
 * | la domanda | esempio |
 * |---|---|
 * | chi sta erogando i menu **oggi**? | il motore, le notifiche, il congelamento |
 * | questa cliente **ha un piano**? | la lista clienti, la dashboard, la coda del nutrizionista |
 * | ha **già comprato** questo? | «non riproporglielo», il conto delle conversioni |
 * | c'è **qualcosa in ballo**? | prima di creare un secondo acquisto |
 *
 * Finché il piano in coda si scriveva `active`, le quattro domande avevano per caso la stessa
 * risposta e nessuno ha dovuto distinguerle. Dal momento in cui esiste `queued` non ce l'hanno più,
 * e il punto di questo file è che **la scelta si veda nel nome** di chi la fa: rileggendo una query
 * si capisce quale domanda sta facendo senza tenere a mente novanta casi.
 *
 * ⚠️ **Un piano in coda è un contratto** (decisione di Simone, 17/8): nelle schermate dello staff
 * conta come «ha un piano», perché la cliente ha pagato. **Non** conta per l'erogazione, perché non
 * è ancora cominciato. Tutto il resto discende da queste due frasi.
 *
 * ⚠️ Modulo **puro**: nessun Prisma, nessun Nest. Sono elenchi e una funzione, e si provano per
 * tabella.
 */

import { aGiorno, istanteDiPartenza } from '../common/date-only';

/**
 * ⚠️ **DUE DOMANDE DIVERSE, E VANNO TENUTE DIVERSE.**
 *
 * 1. **«che giorno è oggi»** → è il giorno di **Roma**. Con `setHours(0,0,0,0)` era quello del
 *    processo, cioè UTC su Render: fra mezzanotte e le 02:00 in Italia il server rispondeva ancora
 *    «ieri», e una cliente che apriva l'app all'una di notte del giorno in cui il piano parte si
 *    sentiva dire che un piano non c'è ancora.
 * 2. **«di che giorno è questa data salvata»** → resta com'era, **il giorno UTC**. Ed è una scelta,
 *    non una dimenticanza: `Subscription.startDate` non è una colonna DATE ma un `DateTime`, quindi
 *    in banca dati ci sono istanti veri, scritti da punti diversi in momenti diversi. Rileggerli in
 *    un altro fuso vorrebbe dire **spostare di un giorno i piani già venduti** che cadono fra le
 *    22:00 e le 24:00 UTC — una data di fine piano che si muove da sola, su un contratto pagato,
 *    senza che nessuno l'abbia chiesto. Quanti siano si misura con `npm run diag:giorno-piani`
 *    prima di decidere; finché non è misurato non si tocca.
 *
 * Il difetto vero era il numero 1, ed è quello che si corregge qui.
 */
const oggiGiorno = (d: Date): number => aGiorno(d).getTime();
/** Il giorno di una data SALVATA: si continua a leggerlo in UTC (vedi sopra). */
const giornoDelDato = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export type StatoAbbonamento = 'pending' | 'active' | 'queued' | 'cancelled' | 'expired';

/**
 * CHI EROGA OGGI. ⚠️ Solo `active`, e il piano in coda **non c'è**: non è ancora cominciato, e
 * mettercelo vorrebbe dire generare i menu di un piano che parte fra tre settimane.
 *
 * ⚠️ Lo stato da solo non basta a dire «sta erogando»: ci vogliono anche le date, e quella è
 * `staErogando` in `abbonamento-in-corso.ts`. Questo elenco serve alle QUERY, che restringono in
 * banca dati e poi lasciano decidere a quella funzione.
 */
export const STATI_CHE_EROGANO: readonly StatoAbbonamento[] = ['active'];

/**
 * «HA UN PIANO». ⚠️ Include la coda, ed è la decisione di Simone del 17/8: un piano che parte il 25
 * è un contratto firmato: la cliente ha pagato. Una lista staff che la mostra «senza piano» perché
 * il suo comincia lunedì racconta una cosa falsa a chi deve chiamarla.
 */
export const STATI_CON_UN_PIANO: readonly StatoAbbonamento[] = ['active', 'queued'];

/**
 * «HA GIÀ COMPRATO». Comprende quello che c'è stato e non c'è più: serve a non riproporre un
 * prodotto già acquistato e a contare le conversioni. ⚠️ `cancelled` **no**: un acquisto annullato o
 * rimborsato non è un acquisto, ed è la sola ragione per cui questo elenco non è «tutto tranne
 * pending».
 */
export const STATI_GIA_COMPRATO: readonly StatoAbbonamento[] = ['active', 'queued', 'expired'];

/**
 * «C'È GIÀ QUALCOSA IN BALLO». Attivo, in coda, o in attesa di pagamento: la domanda di chi sta per
 * creare un secondo acquisto, o per mandare un messaggio del tipo «vuoi cominciare?».
 *
 * ⚠️ Nel codice di prima questa domanda si riconosce perché era già scritta
 * `status: { in: ['active', 'pending'] }` — chi l'ha scritta aveva capito che «attivo» da solo non
 * bastava. `queued` va aggiunto lì, non altrove.
 */
export const STATI_QUALCOSA_IN_BALLO: readonly StatoAbbonamento[] = ['active', 'queued', 'pending'];

/** VIVI: tutto tranne annullato e scaduto. La scala completa la usa `pickMainSubscription`. */
export const STATI_VIVI: readonly StatoAbbonamento[] = ['pending', 'active', 'queued'];

/**
 * IL PIANO IN CODA, nelle due forme in cui può presentarsi.
 *
 * ⚠️ Esiste perché la migrazione è additiva e le righe vecchie **restano come sono**: un piano messo
 * in fila prima di oggi è ancora scritto `active` con `startDate` nel futuro. Per un pezzo di tempo
 * — finché quelle righe non finiscono o non le si sistema — le due forme convivono, e leggerne una
 * sola vorrebbe dire chiudere il difetto per i piani nuovi e lasciarlo aperto per quelli di prima,
 * che sono esattamente quelli su cui il difetto è successo.
 *
 * `oggi` si passa per poter collaudare senza aspettare domani.
 */
export function eInCodaPerStato(s: { status: string; startDate: Date | null }, oggi: Date): boolean {
  if (s.status === 'queued') return true;
  if (s.status !== 'active' || !s.startDate) return false;
  return giornoDelDato(s.startDate) > oggiGiorno(oggi);
}

/**
 * ⚠️ Uno stato `queued` con la data d'inizio ARRIVATA è un piano che avrebbe già dovuto partire: è
 * il lavoro giornaliero di promozione in ritardo, o mai girato. Chi eroga non deve indovinare —
 * questa funzione dice che c'è, e chi la chiama decide se aspettare o dirlo.
 */
export function codaInRitardo(s: { status: string; startDate: Date | null }, oggi: Date): boolean {
  if (s.status !== 'queued' || !s.startDate) return false;
  return giornoDelDato(s.startDate) <= oggiGiorno(oggi);
}

/**
 * LO STATO CHE DEVE AVERE UN PIANO PAGATO CON QUESTA DATA D'INIZIO.
 *
 * ⚠️ Esiste per una ragione sola: **i punti che scrivono sono cinque**, e prima del 19/8 ognuno
 * decideva per sé. L'approvazione del bonifico, la matita della scheda cliente, l'allineamento dal
 * profilo, la data spostata in chat con Gaia e l'attivazione di «Conosciamoci» scrivevano tutti
 * `active`, anche con la partenza fra tre settimane — ed è da lì che nasceva la parola che dice due
 * cose. Adesso la domanda «attivo o in coda?» ha una risposta sola, e chi scrive la chiama.
 *
 * ⚠️ Il confronto è sull'**istante**, non sul giorno: una coda che parte alla scadenza del piano in
 * corso eredita l'ora di quella scadenza, e per quel poco di giornata che resta il piano vecchio sta
 * ancora erogando. Con un confronto per giorno i due si sovrapporrebbero per qualche ora, che è
 * esattamente lo stato che questa voce serve a togliere di mezzo.
 *
 * ⚠️ Senza data d'inizio il piano è attivo: `startDate` nulla vuol dire «già cominciato», ed è come
 * si comportano già `staErogando` e `filtroClienteConPianoAttivo`. Due regole diverse sullo stesso
 * campo nullo sono il modo in cui questi difetti nascono.
 */
export function statoPerInizio(inizio: Date | null | undefined, oggi: Date = new Date()): 'active' | 'queued' {
  return inizio && inizio.getTime() > oggi.getTime() ? 'queued' : 'active';
}

/**
 * ⛔ **LO STESSO, MA QUANDO LA DATA D'INIZIO È UN GIORNO E NON UN ISTANTE** (23/8).
 *
 * `statoPerInizio` confronta due istanti, e sopra c'è scritto perché: la coda che parte alla
 * scadenza del piano in corso eredita **l'ora** di quella scadenza, e per quel poco di giornata che
 * resta il piano vecchio sta ancora erogando.
 *
 * ⚠️ Ma **quattro dei cinque punti che scrivono non le passano un istante**: le passano un giorno,
 * nella forma in cui questo progetto scrive i giorni — `toDateOnly`, cioè la mezzanotte **UTC** del
 * giorno di Roma. E la mezzanotte UTC del 23 agosto sono le **02:00 italiane del 23**: fra la
 * mezzanotte e le due, una data d'inizio di **oggi** risultava «nel futuro» e il piano veniva
 * scritto `queued`.
 *
 * Conseguenza: la cliente che sceglie «comincio oggi» — in fondo al questionario, dalla matita
 * della scheda, dal pulsante nel profilo o dicendolo a Gaia — nelle due ore dopo mezzanotte non
 * riceveva i menu fino alla passata notturna successiva, cioè **un giorno intero dopo**. È lo stesso
 * difetto che la voce 258 dichiarava chiuso, sopravvissuto per le due ore in cui i due giorni non
 * coincidono: la correzione era giusta e la porta era una sola, ma le si passava la cosa sbagliata.
 *
 * ⚠️ Un giorno non è un istante finché non si dice **in che fuso comincia**: lo dice
 * `istanteDiPartenza`, la stessa porta con cui il resto del prodotto risponde a «quand'è che
 * comincia il 23?». Poi la domanda torna a essere quella di sopra, e la risposta la dà una
 * funzione sola.
 *
 * ⛔ **SI CHIAMA SOLO DOVE SI SA DI AVERE UN GIORNO**, e il nome lo dice apposta. I quattro punti
 * che la usano lo sanno: il questionario, la matita della scheda, la chat con Gaia e «Conosciamoci»
 * ricevono tutti una data scelta come giorno.
 *
 * ⛔ Il **quinto** — l'approvazione del bonifico — **non la chiama**, e non è una dimenticanza: lì
 * la data viene da `clientProfile.planStartDate`, che contiene due cose diverse (il giorno scelto
 * dalla cliente, oppure la scadenza del piano in corso, scritta dal ramo della coda) e dal valore
 * non si distinguono — `subscriptionEnd` produce mezzanotte UTC **esatta**, identica a un
 * valore-giorno. Una versione di stamattina le distingueva a occhio, e su quella scadenza faceva
 * nascere piani `active` con la partenza **nel futuro**: la forma ambigua che la voce 258 esiste per
 * togliere di mezzo, per giunta invisibile a `promuoviCodeArrivate`, che cerca i `queued`. Il
 * difetto che resta lì è scritto in un test e nella voce `data-inizio-giorno-o-istante`: si chiude
 * facendo dire al campo da dove viene, non indovinandolo.
 *
 * ⚠️ Su un valore che ha un'ora dentro — `@IsDateString` la ammette — `istanteDiPartenza` lo rende
 * com'è, e qui si torna al confronto fra istanti: il comportamento di prima, che su un istante è
 * quello giusto. È una rete per il chiamante che si sbaglia, non il modo in cui si decide.
 */
export function statoPerGiornoDiInizio(
  giorno: Date | null | undefined,
  oggi: Date = new Date(),
): 'active' | 'queued' {
  if (!giorno) return 'active';
  return statoPerInizio(istanteDiPartenza(giorno), oggi);
}
