import { chiaveAlimento, combaciaAlimento } from '../common/nomi-alimento';

/**
 * ⛔ **I GRASSI NON SI CAMBIANO A PARI GRAMMATURA** — e adesso ci sono i numeri per non farlo.
 *
 * ## Il difetto, misurato
 *
 * Gaia propone i cambi di ingrediente **alla stessa quantità**: 70 g di carote → 70 g di biete. Sulle
 * verdure va bene. Sui grassi no: nel collaudo del 9 agosto, su una cliente vera, ha proposto **70 ml
 * di panna fresca → 70 g di olio evo**. Il piatto era da 500 kcal; con quel cambio diventa ~890,
 * cioè **+77%**, su una cliente in deficit. Nella direzione opposta il difetto è lo stesso al
 * rovescio — chi cambia l'olio con la panna si ritrova un piatto molto più povero del piano.
 *
 * ⚠️ **Il controllo che c'era è cieco proprio lì.** `grammaturaAmmessa` rifiuta una quantità sotto un
 * terzo o sopra il triplo di quella di partenza: guarda il **rapporto fra le quantità**, non le
 * calorie. 70 → 70 è un rapporto di 1, e passa senza dire niente.
 *
 * ⛔ **E il codice non poteva calcolarselo**: degli ingredienti conosce nome, quantità e unità, e in
 * tutto il prodotto non esiste nessuna tabella di composizione degli alimenti. O il numero lo dà un
 * nutrizionista, o i grassi escono dai cambi automatici. Non c'è una terza strada che non passi dal
 * costruire una banca dati alimentare — che è un lavoro suo, e non è questo.
 *
 * ## La risposta di Nocanty (24/8), che è quella che questo file esegue
 *
 * *«Confermo la proposta: Strada B per il gruppo "Oli e grassi da condimento" (che copre la quasi
 * totalità dei casi) e Strada A (gestione manuale con inoltro al nutrizionista) per tutte le altre
 * categorie di grassi più complesse o disomogenee.»*
 *
 * I **pesi** sono «i grammi di alimento necessari per ottenere la stessa quantità di lipidi contenuta
 * in 100 g di olio EVO» (fonte **CREA / USDA**). Da lì la conversione è una proporzione:
 * `qtaA = qtaDa × pesoA / pesoDa`. Con i suoi numeri, 70 g di panna (285) diventano **25 g di olio**
 * (100), e le calorie del piatto restano quelle del piano.
 *
 * ⚠️ **I numeri non stanno qui**: stanno sul gruppo di equivalenza, nel campo `members` che è già
 * JSON (nessuna migrazione), e da lì li mantiene lui dal backoffice. Questo file sa **leggerli e
 * applicarli**, non conoscerli — un numero clinico scritto in un file di codice è un numero che per
 * cambiarlo serve un rilascio.
 */

/**
 * Il nome del gruppo che porta i pesi. ⚠️ È quello che ha nominato Nocanty, non uno inventato da noi:
 * il gruppo è **suo**, e il codice lo cerca per nome perché è l'unica cosa che i due lati condividono.
 */
export const GRUPPO_GRASSI = 'Oli e grassi da condimento';

/**
 * ⚠️ **La tolleranza inferiore scende a 0,20 dove il peso è dichiarato** — chiesto da Nocanty:
 * *«per evitare che l'uso di panna più magra o mascarpone attivi il blocco di sicurezza
 * riproponendo l'errore di pari grammatura, vi suggerisco di ampliare la tolleranza inferiore a
 * 0,20 per tutti i prodotti in cui il numero di equivalenza è esplicitamente dichiarato»*.
 *
 * ⛔ Il punto è che il blocco, scattando, **ripiega su pari grammatura** — cioè esattamente
 * sull'errore che questo lavoro toglie. Un limite di sicurezza che, quando morde, riporta al difetto
 * è peggio di nessun limite.
 *
 * ⚠️ **Con i numeri di oggi non morde**, misurato: il rapporto più basso è olio (100) ← panna (285),
 * cioè **0,35**, che passava già con 0,33. Serve per i valori che Nocanty aggiungerà — panna leggera,
 * mascarpone magro — e resta scritto qui perché nessuno lo tolga credendolo inutile.
 */
export const TOLLERANZA_CON_FATTORE = 0.2;

/** Quello che il gruppo porta dentro `members.fattori`. */
export interface FattoriGrassi {
  /** L'alimento a cui tutti i pesi sono riferiti (per Nocanty: l'olio EVO). */
  riferimento: string;
  /** Nome → grammi equivalenti a 100 g del riferimento. */
  pesi: Record<string, number>;
  /** Da dove vengono i numeri. Si scrive accanto al gruppo: fra sei mesi si sa chi li ha dati. */
  fonte?: string;
}

/**
 * Legge i pesi dal `members` di un gruppo, o `null` se non ce ne sono.
 *
 * ⚠️ **Un peso illeggibile si scarta invece di diventare zero**: `Number('')` è 0, e un peso a zero
 * farebbe una divisione per zero o una quantità infinita. Qui entra solo un numero finito e
 * positivo — tutto il resto è come se non fosse stato scritto, che è la verità.
 */
export function leggiFattori(members: unknown): FattoriGrassi | null {
  const f = (members as { fattori?: unknown } | null)?.fattori as
    | { riferimento?: unknown; pesi?: unknown; fonte?: unknown }
    | undefined;
  if (!f || typeof f !== 'object') return null;
  const riferimento = typeof f.riferimento === 'string' ? f.riferimento.trim() : '';
  if (!riferimento) return null;
  const grezzi = (f.pesi ?? {}) as Record<string, unknown>;
  const pesi: Record<string, number> = {};
  for (const [nome, valore] of Object.entries(grezzi)) {
    const n = typeof valore === 'number' ? valore : Number(valore);
    if (Number.isFinite(n) && n > 0 && nome.trim()) pesi[nome.trim()] = n;
  }
  if (!Object.keys(pesi).length) return null;
  return { riferimento, pesi, ...(typeof f.fonte === 'string' && f.fonte.trim() ? { fonte: f.fonte.trim() } : {}) };
}

/**
 * ⛔ **IL PESO SI TROVA PER NOME ESATTO, non per parola** — riscritto in revisione, 25/8.
 *
 * La prima stesura usava `combaciaAlimento(nome, riga)`, cioè «ogni parola della riga sta nel nome
 * dell'ingrediente». Sembra prudente e fa il contrario: una riga **corta** cattura cibi più lunghi e
 * completamente diversi. Misurato dalla revisione sui nomi veri del catalogo:
 *  · `burro di arachidi` prendeva il peso di **«burro» (120)**. Trenta grammi di burro d'arachidi
 *    hanno ~15 g di lipidi; il codice scriveva **25 g di olio** = 25 g di lipidi, cioè **+67% sui
 *    grassi**, più sette grammi di proteine buttati via. Stessa cosa per «burro di macadamia» e
 *    «burro vegetale»;
 *  · `burro chiarificato` prendeva 120 invece di 100, pur essendo il ghee.
 *
 * ⚠️ Il riquadro della prima stesura si difendeva dal caso «pepe ⊂ peperoni» — riga più **lunga** del
 * nome — e il difetto vero era l'opposto. Qui il rischio non è un piatto sbagliato: è una
 * **quantità** sbagliata in un piatto giusto, che nessuno rilegge.
 *
 * ✅ Adesso il confronto è sulla **chiave dell'alimento** (`chiaveAlimento`, la stessa forma stabile
 * che il progetto usa per confrontare i nomi in colonna): «Olio EVO», «olio evo» e «OLIO  EVO» sono
 * lo stesso, «burro di arachidi» e «burro» no. ⛔ E un nome che il gruppo non conosce **non ha
 * peso**, quindi si passa la mano: è la Strada A, ed è il verso giusto in cui sbagliare.
 */
export function pesoDi(fattori: FattoriGrassi, nome: string): number | null {
  const chiave = chiaveAlimento(nome);
  if (!chiave) return null;
  for (const [riga, peso] of Object.entries(fattori.pesi)) {
    if (chiaveAlimento(riga) === chiave) return peso;
  }
  return null;
}

/**
 * ⛔ **QUESTO SEMBRA UN GRASSO?** — la rete che non dipende dalla tabella.
 *
 * ⛔ Il difetto che chiude, trovato dalla revisione del 25/8: «è un grasso?» era risposto **dalla
 * tabella dei pesi stessa**. Se il gruppo non si trovava — rinominato dal backoffice, rimesso in
 * bozza per correggerlo, seed non ancora girato — allora *nessuno* dei due alimenti risultava un
 * grasso, e il codice tornava a **pari grammatura senza inoltro e senza avviso**: 70 ml di panna →
 * 70 g di burro, cioè il difetto originale intatto, proprio nel momento in cui la tabella era in
 * manutenzione. Il «default sicuro» che il commento prometteva non esisteva nel caso che conta.
 *
 * ✅ Questa lista è la rete: **riconosce i grassi anche senza la tabella**. Se qualcosa qui dentro
 * entra in un cambio e i pesi non ci sono, non si converte e non si indovina — si passa la mano.
 *
 * ⚠️ Non è un elenco di equivalenze e non decide **cosa** si può scambiare con cosa: dice solo
 * «attenzione, qui le calorie ballano». Sbagliare per eccesso costa una richiesta sul tavolo della
 * nutrizionista; sbagliare per difetto costa 400 kcal nel piatto di una cliente in deficit.
 */
const SEMBRA_UN_GRASSO = [
  'olio', 'burro', 'panna', 'margarina', 'strutto', 'lardo', 'ghee', 'mascarpone',
  'maionese', 'besciamella', 'crema di formaggio', 'sugna',
  // ⚠️ «evo» da solo: è il nome che il gruppo seminato «Oli/grassi» usa per l'olio extravergine
  // (`seed.ts`), e la rete non lo riconosceva. Buco trovato in revisione, 25/8.
  'evo',
];

export function sembraUnGrasso(nome: string): boolean {
  const parole = new Set(chiaveAlimento(nome).split(' '));
  return SEMBRA_UN_GRASSO.some((g) => chiaveAlimento(g).split(' ').every((p) => parole.has(p)));
}

/**
 * La quantità del sostituto che porta **la stessa quantità di lipidi** di quella di partenza.
 *
 * `qtaA = qtaDa × pesoA / pesoDa`. Con i numeri di Nocanty: 70 g di panna (285) → olio (100) fa
 * `70 × 100 / 285 = 24,6` → **25 g**, che è il numero che lui stesso ha scritto nell'esempio.
 *
 * ⚠️ **Si arrotonda all'intero**, perché è quello che finisce nel piatto di una persona: «24,56 g di
 * olio» non è una misura, è una finta precisione. Sotto il grammo si tiene **1**: scrivere «0 g»
 * vorrebbe dire togliere l'ingrediente senza dirlo.
 */
export function quantitaEquivalente(qtaDa: number, pesoDa: number, pesoA: number): number | null {
  if (![qtaDa, pesoDa, pesoA].every((n) => Number.isFinite(n) && n > 0)) return null;
  return Math.max(1, Math.round((qtaDa * pesoA) / pesoDa));
}

/**
 * ⛔ **LE COPPIE CHE IN CUCINA NON REGGONO** — Nocanty, 24/8:
 *
 * *«È opportuno escludere dal cambio automatico diretto la coppia Panna → Olio EVO (e altri oli da
 * condimento) nelle preparazioni culinarie come vellutate o salse, dove la sostituzione altera
 * radicalmente la consistenza e la riuscita del piatto.»*
 *
 * ⚠️ **Questa non è una regola numerica e non sta sul gruppo**: i numeri li mantiene lui, la resa in
 * cucina è una regola di prodotto e sta nel codice, con la sua frase accanto. Venticinque grammi di
 * olio in una vellutata sono aritmeticamente giusti e culinariamente un altro piatto.
 *
 * ⚠️ Il piatto si riconosce dal **nome**, che è l'unica cosa che il sistema ha: non c'è un campo
 * «tipo di preparazione» su `Recipe`. È un riconoscimento **grossolano e dichiarato** — se il nome
 * non dice «vellutata» il cambio passa — e sbaglia dalla parte giusta: nel dubbio si converte, e la
 * nutrizionista vede il cambio in scheda con lo stato «da verificare».
 */
const PREPARAZIONI_DELICATE = /vellutat|crema di|salsa|salse|besciamell|carbonar|risott|mousse|panna cotta/i;

/** Da un latticino cremoso a un olio: è la direzione che rovina il piatto. */
const CREMOSI = ['panna', 'mascarpone', 'ricotta', 'yogurt', 'besciamella'];
const OLII = ['olio', 'burro chiarificato', 'ghee'];

const eUnoDi = (nome: string, elenco: string[]): boolean =>
  elenco.some((x) => combaciaAlimento(nome, x));

export function coppiaDaNonPermettere(da: string, a: string, nomePiatto: string): boolean {
  if (!PREPARAZIONI_DELICATE.test(nomePiatto ?? '')) return false;
  return eUnoDi(da, CREMOSI) && eUnoDi(a, OLII);
}

/**
 * ⛔ **QUESTO ALIMENTO È UN GRASSO CHE IL GRUPPO CONOSCE?**
 *
 * È la domanda che separa la **Strada B** dalla **Strada A**. Se il gruppo dei grassi lo nomina —
 * cioè se Nocanty gli ha dato un peso — il cambio si fa con la proporzione.
 *
 * ⚠️ **Questa NON è la domanda di sicurezza**, e confonderle è stato il difetto: dice «lo so
 * convertire», non «attenzione, qui le calorie ballano». La seconda la risponde `sembraUnGrasso`, e
 * chi deve decidere se un cambio si può fare chiama `comeConvertire`, che le usa tutte e due.
 */
export function nelGruppoDeiGrassi(fattori: FattoriGrassi | null, nome: string): boolean {
  return !!fattori && pesoDi(fattori, nome) !== null;
}

/**
 * ⛔ **COME SI CONVERTE QUESTA COPPIA — l'unico punto che decide.**
 *
 * Tre risposte, e la terza è quella che prima non esisteva davvero:
 *  · `pari` → nessuno dei due è un grasso: stessa quantità, come sempre. È la stragrande maggioranza
 *    dei cambi (verdure, cereali, proteine) e su quelli la pari grammatura regge;
 *  · `converti` → tutti e due hanno un peso dichiarato: `qtaDa × pesoA / pesoDa`. È la **Strada B**
 *    che Nocanty ha scelto per il gruppo dei condimenti;
 *  · `passa_la_mano` → almeno uno dei due **sembra un grasso** e i due pesi non ci sono tutti e due.
 *    È la **Strada A**: non si propone niente e decide la nutrizionista.
 *
 * ⛔ **Il difetto che questa funzione chiude** (revisione del 25/8). Prima la domanda «è un grasso?»
 * era risposta **dalla tabella dei pesi stessa**: `nelGruppoDeiGrassi` è falso anche quando il
 * gruppo non c'è. Quindi se il gruppo veniva rinominato dal backoffice, rimesso in bozza per
 * correggere un numero, o il seed non era ancora girato, *nessuno* dei due alimenti risultava un
 * grasso e il codice tornava a **pari grammatura senza inoltro e senza avviso**: 70 ml di panna →
 * 70 g di burro, cioè il difetto originale intatto, proprio nel momento in cui la tabella era in
 * manutenzione. Il «default sicuro» che i commenti promettevano non esisteva nel caso che conta.
 *
 * ⚠️ `sembraUnGrasso` non dipende dal database: è la rete che regge **anche** quando la tabella non
 * si trova. Sbagliare per eccesso costa una richiesta sul tavolo della nutrizionista; sbagliare per
 * difetto costa 400 kcal nel piatto di una cliente in deficit.
 */
export type ModoConversione =
  | { modo: 'pari' }
  | { modo: 'converti'; pesoDa: number; pesoA: number }
  | { modo: 'passa_la_mano' };

export function comeConvertire(
  fattori: FattoriGrassi | null,
  da: string,
  a: string,
): ModoConversione {
  const pesoDa = fattori ? pesoDi(fattori, da) : null;
  const pesoA = fattori ? pesoDi(fattori, a) : null;
  if (pesoDa !== null && pesoA !== null) return { modo: 'converti', pesoDa, pesoA };
  if (sembraUnGrasso(da) || sembraUnGrasso(a)) return { modo: 'passa_la_mano' };
  return { modo: 'pari' };
}
