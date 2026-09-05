import { CHIAVE_ESCLUSIONE, EU_ALLERGENS, SENZA_PER_ALLERGENE, suggestAllergens } from './allergens';

export { CHIAVE_ESCLUSIONE, SENZA_PER_ALLERGENE };
import { nomiIngredienti } from './elenco-ingredienti';
import { chiaveCombacia, exclusionKeys, hitsExclusion } from '../menu/exclusions';

/**
 * ⛔ **IL VOCABOLARIO DEGLI ALLERGENI NON CONOSCE TALEGGIO, ROBIOLA, FONTINA — NÉ «SEPPIE».**
 *
 * Trovato il 4/9 misurando il cancello del regime, e non è un difetto del cancello: una cliente
 * allergica al latte può ricevere un piatto col taleggio, e una allergica ai molluschi un piatto
 * con le seppie (il gruppo «Molluschi» del catalogo le elenca; il vocabolario no).
 *
 * ## ⛔ ERANO due vocabolari, e divergevano — unificati il 5/9
 *
 * `EU_ALLERGENS` (`catalog/allergens.ts`) scrive i **tag** sulle ricette, con radici («formagg»).
 * `INTOLERANCE_MAP` (`menu/exclusions.ts`) toglie i piatti a chi ha dichiarato l'allergia, con
 * parole intere. Misurato il 5/9 sul catalogo vero: sul pesce 15 parole contro 67, **616 ricette**
 * con sardine, dentice, spigola, ricciola, rombo, cernia senza il tag `pesce`. Dal 5/9 i tag
 * leggono anche le parole delle esclusioni (`conLeEsclusioni` in `allergens.ts`): la tabella 3 di
 * questa diagnostica deve dire «solo nelle esclusioni → —» per ogni allergene, e una prova lo tiene
 * fermo. Il verso opposto (parole solo nei tag: «farina», «pan », «birra») resta dichiarato.
 *
 * ## ⚠️ Perché prima si misura
 *
 * Allargare il vocabolario cambia i menu di tutte le clienti che hanno dichiarato quell'allergia,
 * e riscrive i tag di chi ha quell'ingrediente. È la regola del 31/8 sui latti vegetali: si
 * accende con un numero davanti. `npm run diag:vocabolario-allergeni` fa tre conti, e il giudizio
 * sta qui e non nello script.
 */

/**
 * Le parole che il vocabolario NON conosceva fino al 5/9, come radici. ⚠️ Da quel giorno stanno
 * nel vocabolario (unificato): questa lista resta per la **misura** — la tabella 1 della
 * diagnostica dice quante ricette le hanno ancora senza il tag, cioè quanto manca alla riparazione
 * (`ripara:allergeni-mancanti`); a riparazione fatta deve dare zero.
 */
export const PAROLE_CANDIDATE: Readonly<Record<string, readonly string[]>> = {
  latte: [
    'taleggio', 'robiola', 'crescenza', 'fontina', 'asiago', 'emmental', 'emmenthal', 'caciott',
    'skyr', 'philadelphia', 'scamorz', 'burrata', 'provol', 'squacquerone', 'quark', 'montasio',
    'groviera', 'gruy', 'gouda', 'latticello', 'casein', 'formaggin', 'fiocchi di latte',
    /** ⛔ Non «edam»: sta dentro «edamame», che è soia. Una radice corta dentro una parola lunga è il difetto di «grana». */
  ],
  /** ⚠️ «seppie» non contiene «seppia»: la radice `seppi` prende seppia, seppie, seppioline. ⛔ NON `tellin`: sta dentro «tortellini» (trovato dalla tabella del 5/9). */
  molluschi: ['seppi', 'capasant', 'frutti di mare', 'lumach', 'fasolar', 'telline', 'cannolicch'],
  crostacei: ['frutti di mare', 'canocch', 'cicala di mare', 'granseol'],
};


export interface RicettaPerVocabolario {
  id: string;
  name: string;
  ingredients: unknown;
  allergens?: readonly string[] | null;
  active?: boolean;
}

export interface ContoParola {
  allergene: string;
  parola: string;
  /** Ricette con la parola dentro un ingrediente. */
  ricette: number;
  /** Di quelle, senza il tag: sono i piatti che arrivano a chi ha quell'allergia. */
  senzaTag: number;
  esempi: string[];
}

const MAX_ESEMPI = 3;

/** ⚠️ Stesso confronto della porta unica: la parola vale dove `chiaveCombacia` la accetterebbe. */
function ingredienteCon(nomi: readonly string[], parola: string): string | null {
  return nomi.find((n) => chiaveCombacia(n, parola)) ?? null;
}

/**
 * ⛔ **Quante ricette hanno la parola candidata e NON hanno il tag.** È il numero che decide:
 * misura i piatti che oggi arrivano a chi ha dichiarato quell'allergia.
 */
export function contaCandidati(ricette: readonly RicettaPerVocabolario[], candidati = PAROLE_CANDIDATE): ContoParola[] {
  const out: ContoParola[] = [];
  for (const [allergene, parole] of Object.entries(candidati)) {
    for (const parola of parole) {
      const riga: ContoParola = { allergene, parola, ricette: 0, senzaTag: 0, esempi: [] };
      for (const r of ricette) {
        const nomi = nomiIngredienti(r.ingredients).map((n) => n.toLowerCase());
        if (!ingredienteCon(nomi, parola)) continue;
        riga.ricette += 1;
        if (!(r.allergens ?? []).includes(allergene)) {
          riga.senzaTag += 1;
          if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(r.name);
        }
      }
      if (riga.ricette) out.push(riga);
    }
  }
  return out.sort((a, b) => b.senzaTag - a.senzaTag || b.ricette - a.ricette);
}

export interface ContoSenza {
  allergene: string;
  forma: string;
  /** Ricette con un ingrediente che dice «senza ‹allergene›» E il tag scritto. */
  colTagLoStesso: number;
  /** Di quelle, quante lo avrebbero comunque da un ALTRO ingrediente (il tag è giusto). */
  giustificate: number;
  esempi: string[];
}

/**
 * ⛔ **«Pasta senza glutine» che risulta col glutine.** Si contano le ricette con un ingrediente
 * «senza ‹allergene›» e il tag scritto — ⚠️ separando quelle in cui il tag viene comunque da un
 * **altro** ingrediente (pasta senza glutine + pangrattato normale: il tag è giusto, e toglierlo
 * sarebbe il falso negativo). Il numero che conta è la differenza.
 */
export function contaSenza(ricette: readonly RicettaPerVocabolario[], forme = SENZA_PER_ALLERGENE): ContoSenza[] {
  const out: ContoSenza[] = [];
  for (const [allergene, elenco] of Object.entries(forme)) {
    for (const forma of elenco) {
      const riga: ContoSenza = { allergene, forma, colTagLoStesso: 0, giustificate: 0, esempi: [] };
      for (const r of ricette) {
        const nomi = nomiIngredienti(r.ingredients).map((n) => n.toLowerCase());
        const conSenza = nomi.filter((n) => n.includes(forma));
        if (!conSenza.length || !(r.allergens ?? []).includes(allergene)) continue;
        riga.colTagLoStesso += 1;
        const altri = nomi.filter((n) => !n.includes(forma)).map((name) => ({ name }));
        if (suggestAllergens(altri).some((a) => a.allergen === allergene)) riga.giustificate += 1;
        else if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(r.name);
      }
      if (riga.colTagLoStesso) out.push(riga);
    }
  }
  return out.sort((a, b) => (b.colTagLoStesso - b.giustificate) - (a.colTagLoStesso - a.giustificate));
}


export interface Divergenza {
  allergene: string;
  /** Radici dei TAG che la porta delle esclusioni non prenderebbe (parola intera provata: radice + «a»/«e»/«o»/«i»). */
  soloNeiTag: string[];
  /** Parole delle ESCLUSIONI che il vocabolario dei tag non prenderebbe. */
  soloNelleEsclusioni: string[];
}

/**
 * ⛔ **QUANTO DIVERGONO I DUE VOCABOLARI**, allergene per allergene. Una parola in uno solo dei due
 * è un piatto che o porta il tag e arriva lo stesso, o viene tolto senza portare il tag: in tutti
 * e due i versi, due porte che rispondono diverso alla stessa domanda.
 */
export function divergenze(): Divergenza[] {
  const out: Divergenza[] = [];
  for (const def of EU_ALLERGENS) {
    const chiave = CHIAVE_ESCLUSIONE[def.code];
    if (!chiave) continue;
    const chiaviEscl = exclusionKeys([chiave]);
    const soloNeiTag = def.keywords.filter((kw) => {
      // Una radice si prova come parola: «formagg» → formaggio; «ricott» → ricotta.
      const forme = [kw, `${kw}a`, `${kw}o`, `${kw}e`, `${kw}i`, `${kw}io`];
      return !forme.some((f) => hitsExclusion(f, chiaviEscl));
    });
    // ⚠️ La chiave stessa («frutta a guscio») sta fra le parole espanse e non è un ingrediente: fuori.
    const soloNelleEsclusioni = [...chiaviEscl].filter((p) => p !== chiave && !def.keywords.some((kw) => chiaveCombacia(p, kw)));
    if (soloNeiTag.length || soloNelleEsclusioni.length) out.push({ allergene: def.code, soloNeiTag, soloNelleEsclusioni });
  }
  return out;
}

/**
 * ⛔ **QUANTO COSTA UNIFICARE**: per ogni parola che sta SOLO nelle esclusioni, quante ricette la
 * hanno in un ingrediente senza il tag. È il numero di tag che l'unificazione scriverebbe — e di
 * piatti che oggi passano la porta dei tag pur essendo tolti da quella delle esclusioni.
 */
export function contaDivergenzeSulCatalogo(ricette: readonly RicettaPerVocabolario[]): ContoParola[] {
  const candidati: Record<string, string[]> = {};
  for (const d of divergenze()) if (d.soloNelleEsclusioni.length) candidati[d.allergene] = d.soloNelleEsclusioni;
  return contaCandidati(ricette, candidati);
}
