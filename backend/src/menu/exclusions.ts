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
const DERIVATI_LATTE = [
  'latte', 'yogurt', 'formaggio', 'formaggi', 'burro', 'panna', 'mozzarella', 'ricotta',
  'parmigiano', 'grana', 'mascarpone', 'stracchino', 'scamorza', 'pecorino', 'gorgonzola',
  'caciocavallo', 'cheddar', 'brie', 'feta', 'kefir', 'latticini', 'ghee', 'burrata', 'provola',
];

export const INTOLERANCE_MAP: Record<string, string[]> = {
  /**
   * ⚠️ «latte» MANCAVA da questa mappa, e la conseguenza l'ha vista una cliente vera l'8/8/2026.
   *
   * Giusy ha `allergies: ['latte']`. `expandExclusion('latte')` restituiva la sola parola
   * «latte», e il confronto cerca quella parola nel nome dell'alimento: «burro» non contiene
   * «latte», quindi **il burro passava il filtro degli allergeni** e Gaia gliel'ha proposto come
   * sostituto della panna. L'ha fermata lei, dicendo no.
   *
   * C'era la chiave `lattosio` e c'era `latticini`, ma non `latte` — cioè proprio il termine con
   * cui l'allergene si chiama nell'elenco UE e con cui il questionario lo salva.
   */
  latte: DERIVATI_LATTE,
  lattosio: DERIVATI_LATTE,
  latticini: DERIVATI_LATTE,
  glutine: ['pane', 'pasta', 'farro', 'orzo', 'couscous', 'grano', 'seitan', 'pizza', 'cracker', 'frumento', 'segale', 'bulgur', 'pangrattato'],
  'frutta secca': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'arachidi', 'pinoli', 'macadamia', 'pecan'],
  'frutta a guscio': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'pinoli', 'macadamia', 'pecan'],
  legumi: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'fave', 'lupini', 'borlotti', 'cannellini', 'cicerchie', 'edamame'],
  uova: ['uovo', 'uova', 'frittata', 'maionese', 'albume', 'tuorlo', 'omelette'],
  pesce: ['pesce', 'tonno', 'salmone', 'branzino', 'orata', 'merluzzo', 'sgombro', 'acciughe', 'alici', 'trota', 'sogliola', 'baccal'],
  crostacei: ['gambero', 'gamberi', 'scampi', 'aragosta', 'granchio', 'mazzancolle', 'astice'],
  molluschi: ['calamari', 'cozze', 'vongole', 'polpo', 'seppia', 'ostriche', 'capesante', 'totano'],
  soia: ['soia', 'tofu', 'edamame', 'tempeh', 'miso'],
  sesamo: ['sesamo', 'tahini'],
  arachidi: ['arachidi', 'burro di arachidi'],
  /**
   * ⚠️ I QUATTRO ALLERGENI UE CHE NON C'ERANO (aggiunti il 12/8).
   *
   * `sedano`, `senape`, `solfiti` e `lupini` sono opzioni del questionario
   * (`onboarding.questions.ts`) e non comparivano né qui né fra gli alias: sulla strada testuale
   * valevano solo come parola letterale.
   *
   * Per sedano e senape la parola letterale funziona quasi sempre — negli ingredienti si scrivono
   * col loro nome — ma i **lupini** stanno già dentro la chiave `legumi`, quindi chi dichiarava
   * l'allergia ai lupini non li escludeva se il piatto li elencava come «lupini» in un contesto
   * diverso, e soprattutto non aveva nessuna espansione propria.
   */
  sedano: ['sedano', 'sedano rapa'],
  senape: ['senape', 'mostarda'],
  lupini: ['lupini', 'lupino', 'farina di lupino'],
  /**
   * ⛔ SOLFITI: qui c'è solo la parola, ed è voluto.
   *
   * I solfiti non si scrivono quasi mai negli ingredienti: stanno nel vino, nell'aceto balsamico,
   * nella frutta secca disidratata, in certi salumi e conserve. Scrivere quell'elenco a mano vuol
   * dire decidere quali piatti togliere dal piatto di una cliente — e in eccesso si sbaglia
   * facilmente, togliendone troppi.
   *
   * ⚠️ **L'elenco lo deve dare la nutrizionista (Nocanty), non chi scrive il codice.** Finché non
   * c'è, meglio una copertura dichiarata e incompleta che una inventata: la strada codificata (tag
   * allergene sulla ricetta, `catalog/allergens.ts`) copre comunque i solfiti quando le ricette
   * hanno i tag revisati.
   */
  solfiti: ['solfiti', 'solfito', 'anidride solforosa'],
};

/**
 * Alias con cui lo stesso allergene arriva scritto diversamente: dal questionario in italiano,
 * dagli import in inglese, o come plurale.
 *
 * Non è pignoleria: Giusy ha `intolerances: ['lactose']`, non «lattosio». Una chiave che la mappa
 * non riconosce si comporta esattamente come un'esclusione che non c'è — e non produce nessun
 * errore, quindi nessuno se ne accorge finché non lo racconta una cliente.
 */
const ALIAS: Record<string, string> = {
  lactose: 'lattosio',
  milk: 'latte',
  dairy: 'latticini',
  'latte e derivati': 'latte',
  gluten: 'glutine',
  eggs: 'uova',
  egg: 'uova',
  fish: 'pesce',
  soy: 'soia',
  soya: 'soia',
  shellfish: 'crostacei',
  crustaceans: 'crostacei',
  molluscs: 'molluschi',
  mollusks: 'molluschi',
  nuts: 'frutta a guscio',
  'tree nuts': 'frutta a guscio',
  peanuts: 'arachidi',
  peanut: 'arachidi',
  sesame: 'sesamo',
  'frutta con guscio': 'frutta a guscio',
  latticini_: 'latticini',
  mustard: 'senape',
  celery: 'sedano',
  sulphites: 'solfiti',
  sulfites: 'solfiti',
  lupin: 'lupini',
};

/**
 * Espande un termine escluso (intolleranza o cibo non gradito) nelle sue parole chiave:
 * se è una categoria nota (es. "frutta secca", "legumi") restituisce categoria + membri
 * (noci, mandorle, …), altrimenti solo il termine stesso. Usato per intolleranze E dislikedFoods.
 */
/**
 * ⚠️ GLI UNDERSCORE DEL QUESTIONARIO (12/8).
 *
 * Il questionario salva `frutta_a_guscio` — con gli underscore — e la mappa conosce
 * `'frutta a guscio'` con gli spazi. `expandExclusion('frutta_a_guscio')` restituiva quindi
 * `['frutta_a_guscio']`: una stringa che non compare in nessun nome di piatto e in nessun
 * ingrediente. **Sulla strada testuale quell'allergia non escludeva niente.**
 *
 * È lo stesso difetto che l'8/8 ha fatto proporre il burro a una cliente allergica al latte, ed è
 * la lezione già scritta sopra: una chiave che la mappa non riconosce si comporta come
 * un'esclusione che non c'è, e non produce nessun errore.
 *
 * Si normalizza qui invece di aggiungere l'alias `frutta_a_guscio` a mano, così il difetto **non
 * si ripresenta con la prossima opzione che nasce con l'underscore**: aggiungerne una al
 * questionario non richiede di ricordarsi anche di questo file.
 */
function senzaUnderscore(t: string): string {
  return t.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function expandExclusion(term: string): string[] {
  const grezzo = (term ?? '').toLowerCase().trim();
  if (!grezzo) return [];
  // Prima l'alias (`lactose` → `lattosio`), poi la mappa. Il termine originale resta sempre fra
  // le parole chiave: se la mappa non lo conosce, almeno la parola scritta dalla cliente vale.
  // ⚠️ `latticini_` è un alias vero con l'underscore in fondo: si guarda la forma grezza PRIMA di
  // normalizzare, o quella chiave smetterebbe di funzionare.
  const conSpazi = senzaUnderscore(grezzo);
  const t = ALIAS[grezzo] ?? ALIAS[conSpazi] ?? (INTOLERANCE_MAP[conSpazi] ? conSpazi : grezzo);
  const members = INTOLERANCE_MAP[t];
  return members ? [...new Set([grezzo, t, ...members])] : [grezzo];
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
