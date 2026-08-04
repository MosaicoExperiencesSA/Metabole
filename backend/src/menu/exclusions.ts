/**
 * Regole di esclusione degli alimenti, condivise tra il motore di composizione e la
 * diagnostica. Stanno qui e non dentro `menu.service.ts` per una ragione precisa: la
 * diagnostica deve calcolare le esclusioni ESATTAMENTE come le calcola il motore, altrimenti
 * i suoi conteggi (quante alternative restano davvero a una cliente) sarebbero una stima e
 * non una misura. Il file non dipende da Nest né da Prisma, quindi è importabile anche dagli
 * script `prisma/` eseguiti con ts-node.
 */

// Mappa CATEGORIA generica → parole chiave negli ingredienti. Serve sia per allergie/
// intolleranze sia per i cibi "non graditi": una categoria generica ("frutta secca",
// "legumi", "latticini") deve intercettare i singoli alimenti (noci, ceci, formaggio…),
// altrimenti un'esclusione generica non prende i piatti che li contengono.
export const INTOLERANCE_MAP: Record<string, string[]> = {
  lattosio: ['latte', 'yogurt', 'formaggio', 'burro', 'panna', 'mozzarella', 'ricotta', 'parmigiano'],
  latticini: ['latte', 'yogurt', 'formaggio', 'burro', 'panna', 'mozzarella', 'ricotta', 'parmigiano', 'stracchino', 'scamorza', 'mascarpone'],
  glutine: ['pane', 'pasta', 'farro', 'orzo', 'couscous', 'grano', 'seitan', 'pizza', 'cracker'],
  'frutta secca': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'arachidi'],
  legumi: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'fave', 'lupini', 'borlotti', 'cannellini', 'cicerchie', 'edamame'],
  uova: ['uovo', 'uova', 'frittata', 'maionese'],
  pesce: ['pesce', 'tonno', 'salmone', 'branzino', 'orata', 'merluzzo', 'sgombro', 'acciughe'],
  crostacei: ['gambero', 'gamberi', 'scampi', 'aragosta', 'granchio', 'mazzancolle'],
  soia: ['soia', 'tofu', 'edamame'],
};

/**
 * Espande un termine escluso (intolleranza o cibo non gradito) nelle sue parole chiave:
 * se è una categoria nota (es. "frutta secca", "legumi") restituisce categoria + membri
 * (noci, mandorle, …), altrimenti solo il termine stesso. Usato per intolleranze E dislikedFoods.
 */
export function expandExclusion(term: string): string[] {
  const t = (term ?? '').toLowerCase().trim();
  if (!t) return [];
  const members = INTOLERANCE_MAP[t];
  return members ? [t, ...members] : [t];
}

/** Tutte le parole chiave escluse a partire dai termini grezzi del profilo. */
export function exclusionKeys(terms: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const t of terms) for (const kw of expandExclusion(t ?? '')) if (kw) out.add(kw);
  return out;
}

/**
 * Testo su cui si applica il confronto: nome del piatto + nomi degli ingredienti. Il motore
 * cerca le parole chiave qui dentro, quindi la diagnostica deve costruirlo allo stesso modo.
 */
export function recipeHaystack(name: string | null | undefined, ingredients: unknown): string {
  const ing = ((ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' ');
  return `${name ?? ''} ${ing}`.toLowerCase();
}

/** Vero se il piatto contiene almeno una delle parole chiave escluse. */
export function hitsExclusion(haystack: string, keys: Iterable<string>): string | null {
  for (const k of keys) if (k && haystack.includes(k)) return k;
  return null;
}
