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
  const giorno = (d: Date): number => {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return giorno(s.startDate) > giorno(oggi);
}

/**
 * ⚠️ Uno stato `queued` con la data d'inizio ARRIVATA è un piano che avrebbe già dovuto partire: è
 * il lavoro giornaliero di promozione in ritardo, o mai girato. Chi eroga non deve indovinare —
 * questa funzione dice che c'è, e chi la chiama decide se aspettare o dirlo.
 */
export function codaInRitardo(s: { status: string; startDate: Date | null }, oggi: Date): boolean {
  if (s.status !== 'queued' || !s.startDate) return false;
  const giorno = (d: Date): number => {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return giorno(s.startDate) <= giorno(oggi);
}
