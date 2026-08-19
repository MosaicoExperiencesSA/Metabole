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
export function daQuandoSiPuoRifare(oggi: Date = new Date()): Date {
  return new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate()));
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
