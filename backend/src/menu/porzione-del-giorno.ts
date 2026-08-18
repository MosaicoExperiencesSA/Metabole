/**
 * LA SCHEDA DELLA RICETTA CON LE GRAMMATURE DI **QUESTA** CLIENTE — voce 255, coda della strada C.
 *
 * ## Il buco che chiude
 *
 * Dal 18/8 le porzioni si scalano sul fabbisogno (`porzione-scalata.ts`): la cliente in digiuno
 * legge «Pranzo 891 kcal» e il pasto è cresciuto di ×1,8. Ma `GET /recipes/:id` risponde con la
 * ricetta di **catalogo**, che non sa di quale giorno si stia parlando: apriva la scheda e trovava
 * gli ingredienti per 500 kcal. Due numeri che si contraddicono sotto gli occhi della stessa
 * persona, e nessun modo di capire quale sia quello giusto. Fino a oggi il buco lo turava una
 * **frase** («pesa gli ingredienti per 1,8 volte»), cioè un conto a mano chiesto a chi sta
 * cucinando.
 *
 * ## ⚠️ Perché la scalatura la fa il SERVER e non l'app
 *
 * La regola di arrotondamento è già scritta una volta — `quantitaScalata` — ed è quella che usa la
 * **lista della spesa**. Riscriverla nell'app vorrebbe dire due risposte alla stessa domanda: il
 * giorno che la nutrizionista chiede di arrotondare i pezzi, la lista della spesa e la scheda
 * ricetta direbbero due numeri diversi per lo stesso piatto. È la lezione del 17/8, e qui costa una
 * riga rispettarla.
 *
 * ## ⚠️ E perché il fattore NON arriva dall'app, anche se ce l'ha
 *
 * L'app conosce `porzione`: gliel'ha mandato `/me/menu`. Accettarlo come parametro sarebbe comodo e
 * sbagliato — vorrebbe dire che **il telefono decide quanto cibo** compare nella scheda. Qui
 * arrivano solo il **giorno** e lo **slot**, cioè *cosa sto guardando*; il fattore si rilegge dallo
 * snapshot di quella cliente, che è l'unico posto dove è stato deciso.
 *
 * ## ⚠️ Il passaggio di consegne fra le due versioni dell'app (la parte che si dimentica)
 *
 * Il backend si aggiorna col deploy, l'app solo con la pubblicazione o l'OTA: per giorni le due
 * versioni convivono. Se la scalatura fosse automatica, l'app **vecchia** riceverebbe le grammature
 * già scalate continuando a dire «pesa gli ingredienti per 1,8 volte» — e la cliente peserebbe
 * ×3,24. Per questo la scheda si scala **solo se il chiamante lo chiede** (`?giorno=&slot=`): chi
 * non sa di poterlo chiedere continua a ricevere il catalogo, e la sua frase resta vera.
 */
import { ingredientiEffettivi } from './ingredienti-effettivi';
import type { MealSnapshot, IngredienteRicetta, Substitution } from './pasto-giornata';
import { PORZIONE_DA_DIRE, quantitaScalata } from './porzione-scalata';

/** Quello che la scheda ricetta ha bisogno di sapere di questo pasto, in questo giorno. */
export interface PorzioneDelGiorno {
  /** Il moltiplicatore applicato al piatto. Sempre sopra `PORZIONE_DA_DIRE`: sotto, si tace. */
  fattore: number;
  /**
   * Le sostituzioni concordate su QUESTO pasto. ⚠️ Servono perché la scheda mostri quello che c'è
   * nel piatto e non quello che c'è nel catalogo: senza, la cliente che ha concordato «carote →
   * biete» apre la ricetta e trova ancora le carote (revisione del 18/8 sera).
   */
  sostituzioni?: Substitution[];
  /** Le kcal che la cliente ha ricevuto (già scalate), dallo snapshot. */
  kcal?: number;
  /** Le kcal della porzione di catalogo. */
  kcalBase?: number;
}

/**
 * «Questo fattore non cambia niente di quello che la cliente legge.»
 *
 * ⚠️ La soglia è `PORZIONE_DA_DIRE` e **non** un `> 1` qualunque: è la stessa che decide se sotto il
 * nome del piatto compare la riga «porzione più abbondante». Se qui fosse più bassa, la scheda
 * mostrerebbe grammature diverse da quelle di catalogo su un piatto che il menu non ha segnalato:
 * ingredienti che cambiano senza che nessuno abbia detto perché.
 */
const nonCambiaNiente = (f: unknown): boolean =>
  !(typeof f === 'number' && Number.isFinite(f) && f > PORZIONE_DA_DIRE);

/**
 * Il fattore di porzione di un piatto dentro una giornata già scritta, o `null`.
 *
 * ⚠️ **Tre esiti, non due**, e il terzo è il silenzio: se la giornata non contiene quel piatto — o
 * lo contiene due volte con fattori diversi e non è stato detto in quale pasto — si torna `null`,
 * cioè «non lo so», e la scheda resta quella di catalogo. Indovinare qui vorrebbe dire scrivere una
 * grammatura sbagliata sotto il nome di un piatto vero.
 *
 * @param meals   lo snapshot `MenuDay.meals` (arriva da Prisma come `Json`: si accetta `unknown`)
 * @param recipeId la ricetta che si sta aprendo
 * @param slot     il pasto, quando chi apre lo sa (dalla scheda del menu). Facoltativo: dalla home
 *                 la ricetta si apre con `?ricetta=&giorno=` e lo slot lì non c'è.
 */
export function porzioneDelGiorno(
  meals: unknown,
  recipeId: string,
  slot?: string,
): PorzioneDelGiorno | null {
  const pasto = pastoDelGiorno(meals, recipeId, slot);
  if (!pasto || nonCambiaNiente(pasto.porzione)) return null;
  return {
    fattore: pasto.porzione as number,
    kcal: pasto.kcal,
    kcalBase: pasto.kcalBase,
    sostituzioni: pasto.substitutions,
  };
}

/**
 * Il pasto di quella giornata, quale che sia la sua porzione — o `null` se non si può dire quale.
 *
 * ⚠️ **Serve separato da `porzioneDelGiorno`**, e il motivo è un caso che la prima versione perdeva:
 * un piatto **non scalato** può avere lo stesso delle **sostituzioni** concordate in chat. Chiedendo
 * solo la porzione si tornava `null`, e la scheda mostrava le carote a chi aveva concordato le
 * biete. La porzione e le sostituzioni sono due cose diverse: qui si trova il pasto, poi ognuna
 * decide per sé.
 */
export function pastoDelGiorno(meals: unknown, recipeId: string, slot?: string): MealSnapshot | null {
  if (!Array.isArray(meals) || !recipeId) return null;
  const candidati = (meals as MealSnapshot[]).filter(
    (m) => m && m.recipeId === recipeId && (!slot || m.slot === slot),
  );
  if (!candidati.length) return null;
  // ⚠️ Lo stesso piatto in due pasti dello stesso giorno con DUE fattori diversi (il tetto dello
  // spuntino è più basso di quello dei principali: succede davvero), o con sostituzioni diverse.
  // Senza lo slot non si può scegliere, e sceglierne uno a caso vuol dire mostrare il pasto
  // dell'altro: meglio «non lo so».
  const impronte = new Set(
    candidati.map((m) => `${nonCambiaNiente(m.porzione) ? 1 : m.porzione}|${JSON.stringify(m.substitutions ?? [])}`),
  );
  if (impronte.size > 1) return null;
  return candidati[0];
}

/**
 * Gli ingredienti con la porzione applicata.
 *
 * ⚠️ Passa dalla **stessa** `quantitaScalata` della lista della spesa: quantità a peso all'intero,
 * il resto con un decimale — «1,5 uova» esce così com'è, perché arrotondarlo di nascosto è una
 * decisione della nutrizionista e non è stata presa (vedi `DECISIONE_Porzioni_Scalate_Strada_C.md`).
 * ⚠️ Un ingrediente **senza quantità** resta senza quantità: moltiplicare un vuoto darebbe uno zero,
 * e «0 g di olio» è un'istruzione, non un dato mancante.
 *
 * ⚠️ E prima si applicano le **sostituzioni concordate** (`ingredientiEffettivi`): la scheda deve
 * mostrare quello che c'è nel piatto di questa cliente, non quello che c'è nel catalogo. Fino alla
 * revisione del 18/8 sera chi aveva concordato «carote → biete» apriva la ricetta e trovava ancora
 * le carote, scalate.
 */
export function ingredientiScalati(
  ingredients: unknown,
  fattore: number,
  sostituzioni?: Substitution[],
): IngredienteRicetta[] | null {
  if (!Array.isArray(ingredients)) return null;
  // ⚠️ PRIMA le sostituzioni, POI la scalatura: si scala quello che c'è nel piatto. Invertendo,
  // si scalerebbe un ingrediente che quella cliente non ha più.
  const effettivi = ingredientiEffettivi(ingredients as IngredienteRicetta[], { substitutions: sostituzioni }, {
    // ⚠️ `salta`: il cambio di PIATTO scrive una sostituzione col nome della ricetta, e qui
    // diventerebbe un ingrediente col nome del piatto stesso, in fondo alla lista.
    seNonTrovato: 'salta',
  });
  return effettivi.map((ing) => {
    const qta = quantitaScalata(ing?.qty, fattore, ing?.unit);
    return qta === null ? ing : { ...ing, qty: qta };
  });
}
