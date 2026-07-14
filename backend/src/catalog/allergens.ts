/**
 * Allergeni UE (14) e dizionario per il PRE-TAG assistito delle ricette (R8).
 * Il dizionario SUGGERISCE i tag dagli ingredienti; il nutrizionista CONFERMA
 * (nessun auto-tag silenzioso). Un tag copre l'alimento e i suoi derivati
 * (es. `latte` include burro/formaggi/panna/yogurt).
 */
export interface AllergenDef {
  code: string;
  label: string;
  keywords: string[]; // termini (minuscolo) che, se presenti in un ingrediente, suggeriscono l'allergene
}

export const EU_ALLERGENS: AllergenDef[] = [
  { code: 'glutine', label: 'Glutine', keywords: ['glutine', 'grano', 'farina', 'frumento', 'pane', 'pasta', 'orzo', 'farro', 'avena', 'segale', 'seitan', 'couscous', 'bulgur', 'cracker', 'biscott', 'pizza', 'pangrattato', 'pan ', 'birra'] },
  { code: 'crostacei', label: 'Crostacei', keywords: ['gamber', 'mazzancoll', 'scampi', 'aragost', 'granchio', 'astice', 'crostace'] },
  { code: 'uova', label: 'Uova', keywords: ['uovo', 'uova', 'frittat', 'omelette', 'maionese', 'mering', 'albume', 'tuorlo'] },
  { code: 'pesce', label: 'Pesce', keywords: ['pesce', 'salmone', 'tonno', 'sgombro', 'aringa', 'branzino', 'orata', 'merluzzo', 'sogliola', 'trota', 'acciugh', 'alici', 'platessa', 'baccal', 'nasello'] },
  { code: 'arachidi', label: 'Arachidi', keywords: ['arachid'] },
  { code: 'soia', label: 'Soia', keywords: ['soia', 'tofu', 'tempeh', 'edamame', 'miso'] },
  { code: 'latte', label: 'Latte e derivati', keywords: ['latte', 'burro', 'formagg', 'mozzarell', 'cheddar', 'brie', 'feta', 'ricott', 'parmigian', 'grana', 'mascarpone', 'panna', 'yogurt', 'kefir', 'latticin', 'ghee', 'stracchino', 'gorgonzol', 'pecorino', 'caciocavallo', 'crema di formaggio'] },
  { code: 'frutta_a_guscio', label: 'Frutta a guscio', keywords: ['mandorl', 'noci', 'noce', 'nocciol', 'macadamia', 'anacard', 'pistacch', 'pinoli', 'pecan'] },
  { code: 'sedano', label: 'Sedano', keywords: ['sedano'] },
  { code: 'senape', label: 'Senape', keywords: ['senape'] },
  { code: 'sesamo', label: 'Sesamo', keywords: ['sesamo', 'tahini', 'tahin'] },
  { code: 'solfiti', label: 'Anidride solforosa e solfiti', keywords: ['solfiti', 'solfito', 'vino', 'aceto di vino'] },
  { code: 'lupini', label: 'Lupini', keywords: ['lupini', 'lupino'] },
  { code: 'molluschi', label: 'Molluschi', keywords: ['calamar', 'cozze', 'vongol', 'polpo', 'seppia', 'ostrich', 'capesant', 'moscardin', 'mollusch', 'totano'] },
];

const ALLERGEN_LABEL = new Map(EU_ALLERGENS.map((a) => [a.code, a.label]));
export const allergenLabel = (code: string) => ALLERGEN_LABEL.get(code) ?? code;
export const EU_ALLERGEN_CODES = EU_ALLERGENS.map((a) => a.code);

/** Estrae i nomi degli ingredienti da Recipe.ingredients (Json [{name,...}]). */
export function ingredientNames(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((i) => (i && typeof i === 'object' ? String((i as { name?: unknown }).name ?? '') : String(i)))
    .filter(Boolean);
}

/**
 * Suggerisce gli allergeni presenti dagli ingredienti. Ritorna, per ogni allergene
 * rilevato, i termini che l'hanno fatto scattare (per far capire al nutrizionista il perché).
 * È solo un suggerimento: la decisione finale è del nutrizionista.
 */
export function suggestAllergens(ingredients: unknown): { allergen: string; label: string; matched: string[] }[] {
  const names = ingredientNames(ingredients).map((n) => n.toLowerCase());
  const out: { allergen: string; label: string; matched: string[] }[] = [];
  for (const a of EU_ALLERGENS) {
    const matched: string[] = [];
    for (const name of names) {
      for (const kw of a.keywords) {
        if (name.includes(kw)) {
          matched.push(name);
          break;
        }
      }
    }
    if (matched.length) out.push({ allergen: a.code, label: a.label, matched: [...new Set(matched)] });
  }
  return out;
}
