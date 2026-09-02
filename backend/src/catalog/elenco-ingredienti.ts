/**
 * ⛔ **«QUESTA RICETTA DICE COSA CI VA DENTRO?» — in un posto solo.**
 *
 * Il 2/9, guardando le sei ricette di pesce, è saltata fuori `6a5666fd` «Branzino al forno con
 * verdure rosse e limone»: **attiva**, dentro un paniere, e con l'elenco ingredienti **vuoto**.
 *
 * ⚠️ Non è solo una cliente che riceve un piatto che non può cucinare. È che **tutto il lavoro
 * sui panieri guarda gli ingredienti**: il controllo del generatore (`engine-rules`) scarta un
 * piatto fuori regime leggendo l'elenco, `suggestAllergens` deduce gli allergeni dall'elenco, le
 * esclusioni della cliente cercano nel nome **e** nell'elenco. Con l'elenco vuoto quei controlli
 * non dicono «attenzione»: dicono **«ok»**, che è la risposta peggiore.
 *
 * ⛔ **«Vuoto» sono tre cose diverse**, e la terza è quella che inganna: `null`, `[]`, e un elenco
 * che c'è ma dentro non ha nemmeno un nome — `[{ qty: 100, unit: 'g' }]`. Da fuori quella ricetta
 * sembra compilata, e `ingredients.length` risponde 1. In una colonna `Json` non validata ci si
 * finisce senza accorgersene.
 */

/** Com'è messo l'elenco ingredienti di una ricetta. `ok` = c'è almeno un nome leggibile. */
export type StatoElenco = 'assente' | 'vuoto' | 'senza nomi' | 'ok';

/**
 * ⚠️ Un valore che non è un array è `assente`, non «rotto»: la colonna è `Json`, e un oggetto o una
 * stringa lì dentro non è un elenco di ingredienti in nessun senso utile. Chi legge deve sapere
 * solo una cosa — se può fidarsi di quello che ci trova.
 */
export function statoElenco(ingredienti: unknown): StatoElenco {
  if (!Array.isArray(ingredienti)) return 'assente';
  if (ingredienti.length === 0) return 'vuoto';
  return nomiIngredienti(ingredienti).length === 0 ? 'senza nomi' : 'ok';
}

/**
 * I nomi leggibili dentro un elenco ingredienti — la forma in cui li vogliono `eCarneIngrediente`,
 * `ePesce`, `classifica` e `suggestAllergens`.
 *
 * ⛔ **La forma buona è `[{name, qty, unit}]`, ma in catalogo c'è anche `['ceci', 'rucola']`** — e
 * fingere che non ci sia costa caro: la prima stesura di questo modulo leggeva solo `{name}`, e nel
 * generatore avrebbe buttato come «senza ingredienti» cinque piatti perfettamente validi per pasto,
 * scrivendo pure nel log una frase falsa. La forma stringa la gestivano già
 * `vera/dizionario-invecchiato.ts` e `catalog/allergens.ts`: **erano loro ad avere ragione**, e
 * adesso la funzione è questa, una sola, e quei due la importano.
 *
 * ⚠️ **Scarta i vuoti e gli spazi**, perché un `name: '  '` che arriva fino a un riconoscitore non
 * è un ingrediente: è un buco che fa contare una riga in più a chi conta le righe.
 */
export function nomiIngredienti(ingredienti: unknown): string[] {
  if (!Array.isArray(ingredienti)) return [];
  return ingredienti
    .map((i) => (typeof i === 'string' ? i : ((i ?? {}) as { name?: unknown }).name))
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((n) => n.trim());
}
