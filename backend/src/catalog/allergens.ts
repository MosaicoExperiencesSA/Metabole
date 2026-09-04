import { chiaveCombacia } from '../menu/exclusions';

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
  /**
   * ⛔ **QUATTRO PAROLE NON BASTAVANO, e il difetto era invisibile** (Simone, 24/8).
   *
   * Erano `solfiti`, `solfito`, `vino`, `aceto di vino`. La guida della capo nutrizionista ne nomina
   * una dozzina di portatori veri — e su una ricetta con l'uvetta, i gamberi o il dado da brodo a chi
   * tagga **non veniva proposto niente**. Non è un piatto sbagliato servito in automatico: è un tag
   * che manca in silenzio, su 3111 ricette da rivedere, e che quindi lo mette solo chi se lo ricorda
   * a memoria.
   *
   * ⛔ **«Suggeriscono e basta» NON È VERO, e va saputo prima di allungare questo elenco.**
   * `engine-rules.service.ts` scrive i tag suggeriti su **ogni ricetta appena generata**
   * (`allergensReviewed: false`), e il motore blocca su un tag anche non confermato. Quindi una
   * parola di troppo qui **non** è «una proposta da togliere con un clic»: è un piatto che sparisce
   * dal catalogo di chi ha quell'allergia. L'ho scritto al contrario nella prima stesura, e l'ha
   * smontato la revisione del 24/8 misurandolo.
   *
   * ⚠️ Per i **solfiti** la conseguenza è chiusa in `esclusioni-della-cliente.ts`: dove la regola per
   * ingrediente sa cosa sostituire, il tag non blocca da solo. Per gli altri tredici allergeni no —
   * quindi qui si è larghi sui solfiti e si resta stretti sul resto.
   *
   * ⚠️ **Non è lo stesso elenco delle ESCLUSIONI** (`menu/exclusions.ts`), e non deve diventarlo: là
   * ogni parola toglie un piatto dal piatto di una persona, qui ogni parola accende un suggerimento.
   * Due domande diverse, due liste.
   */
  { code: 'solfiti', label: 'Anidride solforosa e solfiti', keywords: [
    'solfiti', 'solfito', 'anidride solforosa',
    // Vini e derivati (150-400 mg/l).
    // ⚠️ `aceto` da solo: è il portatore più comune del catalogo, e «aceto di mele» — che la tabella
    // nomina esplicitamente — non veniva suggerito da nessuna delle due voci lunghe.
    'vino', 'aceto', 'aceto di vino', 'aceto balsamico', 'marsala', 'spumante', 'prosecco', 'sidro',
    // ⛔ `birra` TOLTA il 24/8: non è un derivato del vino e non sta in nessuna categoria della
    // tabella del 13/8. Era l'unica parola dell'elenco senza una riga a monte che la sostenesse.
    // Frutta essiccata: la categoria col limite più alto della tabella (2000 mg/kg).
    'uvetta', 'uva passa', 'uva sultanina', 'albicocche secche', 'prugne secche', 'fichi secchi',
    'frutta disidratata', 'frutta essiccata',
    // Ortaggi e funghi conservati (100-500 mg/kg) e patate trasformate (400).
    'pomodori secchi', 'funghi secchi', 'sottaceti', 'giardiniera', 'patate disidratate', 'purè di patate',
    // Prodotti della pesca: crostacei (150-300) e pesce essiccato o salato (200), più le conserve.
    'gamberi', 'gamberetti', 'mazzancolle', 'scampi', 'baccalà', 'stoccafisso', 'tonno in scatola',
    // Insaccati e macinato confezionato.
    'salsiccia', 'wurstel', 'salame', 'mortadella', 'macinato confezionato',
    // Salse e dadi pronti (la senape è a 250-500 mg/kg, ed è anche un allergene UE per conto suo).
    'dado da brodo', 'dado vegetale', 'maionese', 'ketchup', 'senape',
    // Succhi da concentrato (350 mg/l).
    'succo concentrato', 'succo da concentrato',
  ] },
  { code: 'lupini', label: 'Lupini', keywords: ['lupini', 'lupino'] },
  { code: 'molluschi', label: 'Molluschi', keywords: ['calamar', 'cozze', 'vongol', 'polpo', 'seppia', 'ostrich', 'capesant', 'moscardin', 'mollusch', 'totano'] },
];

const ALLERGEN_LABEL = new Map(EU_ALLERGENS.map((a) => [a.code, a.label]));
export const allergenLabel = (code: string) => ALLERGEN_LABEL.get(code) ?? code;
export const EU_ALLERGEN_CODES = EU_ALLERGENS.map((a) => a.code);

/**
 * Estrae i nomi degli ingredienti da `Recipe.ingredients`.
 *
 * ⚠️ **Ri-esportata da `catalog/elenco-ingredienti.ts` col nome italiano.** Questa lettura era una
 * delle quattro in giro per `src`, ed era fra le due che facevano bene: la forma `['ceci','rucola']`
 * la gestiva. Il nome inglese resta perché lo importano in sei posti.
 */
import { nomiIngredienti } from './elenco-ingredienti';

export const ingredientNames = nomiIngredienti;

/**
 * ⛔ **LE OMONIME VALGONO ANCHE QUI** — 24/8.
 *
 * `menu/exclusions.ts` ha `PAROLE_CHE_NON_SONO` da giorni, e la riga di riferimento è proprio
 * `vino: ['bovino', …]`: uno stracetto di **bovino** magro non c'entra niente coi solfiti del vino.
 * Questa strada la ignorava, e con `name.includes(kw)` proponeva `solfiti` su ogni piatto di bovino.
 *
 * ⚠️ **Non era «una proposta di troppo»**: i tag suggeriti vengono **scritti** sulle ricette generate,
 * e da lì bloccano. Cioè ogni ricetta col bovino sarebbe sparita dal catalogo di chi dichiara i
 * solfiti. Due liste che rispondono alla stessa domanda e una sola sa le omonime era il difetto —
 * adesso la lista è una.
 */
/**
 * ⛔ **LA SECONDA COPIA DI «QUESTA CHIAVE VALE?» NON C'È PIÙ — 4/9 sera, e con un numero davanti.**
 *
 * Qui viveva una copia della funzione di `menu/exclusions.ts` che conosceva le parole omonime e le
 * frasi, e **non** `SOLO_A_INIZIO_PAROLA`. Cioè la regola scritta il 4/9 per «grana» e «grano»
 * valeva per le esclusioni della cliente e non per i tag allergene — che però **vengono scritti**
 * sulle ricette, e da lì tolgono il piatto.
 *
 * ⛔ **Misurato con `npm run diag:chiave-doppia` sul catalogo vero: 190 ricette su 23 726**, tutte
 * con il tag scritto e tutte con la spunta di conferma. Otto coppie, e Simone le ha lette una per
 * una: **tutte e otto «no»**.
 *
 *     melograno     → glutine   63     dorata (zucca)  → pesce   17
 *     melagrana     → latte     58     sgranato        → latte    6
 *     sgranati      → latte     43     melograna       → latte    1
 *     (edamame)                        sgranocchiate   → glutine  1
 *                                      corata (di coniglio) → pesce 1
 *
 * ⚠️ Diciassette piatti di **carne** risultavano contenere **pesce** perché la zucca è «dorata», e
 * quarantatré piatti di **edamame** risultavano contenere **latte** perché i fagioli sono
 * «sgranati». Non era una proposta di troppo: era una riga scritta che li toglieva dal piatto di
 * chi ha quell'allergia.
 *
 * ⚠️ E non c'era niente da decidere di nuovo: `grana`, `grano` e `orata` stanno in
 * `SOLO_A_INIZIO_PAROLA` **dal 4/9**. Quelle 190 ricette stavano pagando una decisione già presa,
 * che una porta sola non leggeva.
 */

/**
 * Suggerisce gli allergeni presenti dagli ingredienti. Ritorna, per ogni allergene
 * rilevato, i termini che l'hanno fatto scattare (per far capire al nutrizionista il perché).
 * ⚠️ È un suggerimento **che però viene scritto** sulle ricette generate: vedi la nota sui solfiti.
 */
export function suggestAllergens(ingredients: unknown): { allergen: string; label: string; matched: string[] }[] {
  const names = ingredientNames(ingredients).map((n) => n.toLowerCase());
  const out: { allergen: string; label: string; matched: string[] }[] = [];
  for (const a of EU_ALLERGENS) {
    const matched: string[] = [];
    for (const name of names) {
      for (const kw of a.keywords) {
        if (chiaveCombacia(name, kw)) {
          matched.push(name);
          break;
        }
      }
    }
    if (matched.length) out.push({ allergen: a.code, label: a.label, matched: [...new Set(matched)] });
  }
  return out;
}
