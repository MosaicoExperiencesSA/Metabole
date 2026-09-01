/**
 * TOGLIERE RICETTE DAL POOL — una regola sola, e vale per tutti i motivi.
 *
 * ⛔ **La regola non è «togli»: è «togli, MA non svuotare un pasto»** (decisione di Simone, 13/8).
 * Uno slot che resterebbe a zero si tiene com'era, e chi lo toglieva lo dice nel log. Svuotarlo
 * vorrebbe dire una giornata senza un pasto, e a fermare una giornata dev'essere la guardia — che
 * sa dire cosa e perché — non un pool azzerato in silenzio.
 *
 * ⚠️ Fino all'1/9 quella regola stava scritta **due volte**, dentro `buildScoringContext`: una per
 * i divieti di dieta e una per le esclusioni della cliente. Con il filtro sulle ricette spente
 * sarebbero state tre, e tre copie di una regola sono tre occasioni perché una cambi da sola. Il
 * ciclo è qui; **il messaggio resta a chi chiama**, perché il motivo per cui una ricetta esce è
 * l'unica cosa che davvero cambia fra i tre casi — e un log che non dice il motivo non serve.
 */

/**
 * L'elenco di chi esce: un `Set` di id, **oppure** una `Map` che all'id associa il motivo.
 *
 * ⚠️ Le due forme esistono davvero: `ricetteVietate` e `ricetteSpente` rendono un insieme,
 * `ricetteNonSicure` una mappa id → violazione, perché quel motivo poi finisce nel log. Chiedere
 * qui l'una o l'altra costringerebbe un chiamante a convertire — e una conversione che serve solo
 * a far contento un tipo è il posto dove un giorno si perde il motivo.
 */
export interface ElencoDiId {
  readonly size: number;
  has(id: string): boolean;
}

/**
 * Toglie `fuori` da ogni slot del pool, **in loco**, e restituisce gli slot che sono stati
 * risparmiati perché sarebbero rimasti vuoti.
 *
 * ⚠️ Chi chiama **deve** dire nel log quelli che tornano indietro: sono i pasti in cui la regola
 * non si applica, cioè esattamente i casi che qualcuno deve andare a guardare.
 */
export function togliDalPool(
  pool: Map<string, Set<string>>,
  fuori: ElencoDiId,
): { slot: string; erano: number }[] {
  const risparmiati: { slot: string; erano: number }[] = [];
  if (!fuori.size) return risparmiati;
  for (const [slot, ids] of pool) {
    const restano = new Set([...ids].filter((id) => !fuori.has(id)));
    if (restano.size > 0) pool.set(slot, restano);
    else risparmiati.push({ slot, erano: ids.size });
  }
  return risparmiati;
}

/**
 * LE RICETTE SPENTE DEL POOL — §2.4 del piano panieri, chiuso l'1/9.
 *
 * ⛔ Il pool chiedeva le ricette **per id e basta**, senza `active`. Una ricetta archiviata a mano,
 * o una bozza che l'agente notturno ha scritto e che nessuno ha ancora guardato — che nasce spenta
 * **apposta**, perché la validazione è il momento in cui una persona la vede — arrivava nel piatto
 * di una cliente. In catalogo erano 3566, e 2730 di quelle erano già dentro un paniere.
 *
 * ⚠️ **Non si è filtrato nella query.** Chiedere `active: true` al database sarebbe stata una
 * parola sola, ma avrebbe lasciato gli id spenti dentro `slotPool` **senza** la loro riga in
 * `recipes`: la composizione avrebbe scelto un id di cui non conosce né kcal né macro, e il difetto
 * sarebbe uscito come una giornata sbilanciata, mesi dopo, senza niente che lo colleghi a qui. Le
 * ricette si leggono tutte e si tolgono dal pool, come per i divieti e le esclusioni.
 *
 * ⚠️ E si toglie **dopo aver contato**: `npm run diag:spente` dice cella per cella cosa resta.
 * Il giorno che l'ha chiuso diceva 27 celle su 38 toccate e **nessuna** sotto soglia.
 *
 * ⚠️ **La base personale lo faceva già, e nella query** (`personal-base.service.ts`: `active: true`
 * dentro la `where`). Era il «due porte che rispondono alla stessa domanda in due modi diversi» del
 * §2.4: ora rispondono uguale. ⛔ Ma con due meccanismi diversi, e non è una svista — quella
 * **elenca** cosa è disponibile e di una ricetta esclusa non le serve più niente; questa **compone
 * una giornata** e di ogni id del pool deve conoscere kcal e macro. Chi un giorno le uniformasse
 * «per pulizia» riaprirebbe esattamente il difetto che questa nota descrive.
 */
export function ricetteSpente(ricette: readonly { id: string; active: boolean }[]): Set<string> {
  const fuori = new Set<string>();
  for (const r of ricette) {
    /**
     * ⛔ **UN `active` CHE NON C'È NON È UN `active` FALSO: È UNA LETTURA SBAGLIATA, E SI GRIDA.**
     *
     * Se questa funzione trattasse il campo mancante come «spenta», un doppio di Prisma che non lo
     * rende — cioè quasi tutti i finti scritti prima dell'1/9 — farebbe uscire dal pool **ogni**
     * ricetta, lo slot resterebbe vuoto, la regola qui sopra lo risparmierebbe, e il pool tornerebbe
     * identico a prima: **i test passerebbero senza esercitare niente**. È l'ottava volta che un
     * doppio che risponde diversamente dal database vero copre proprio il codice che dovrebbe
     * provare. Trattarlo come «attiva» sarebbe lo stesso male al contrario, in silenzio.
     *
     * ⚠️ In produzione non può scattare: la query del pool chiede `active` nella `select`. Se un
     * giorno qualcuno lo toglie da lì, questo errore lo dice subito — che è il punto.
     */
    if (typeof r.active !== 'boolean') {
      throw new Error(
        `ricetteSpente: la ricetta ${r.id} arriva senza \`active\`. Chi legge il pool deve chiederlo `
        + 'nella `select` (e un finto Prisma deve renderlo, come fa il database vero).',
      );
    }
    if (!r.active) fuori.add(r.id);
  }
  return fuori;
}
