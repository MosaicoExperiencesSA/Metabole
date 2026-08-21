import { EU_ALLERGEN_CODES, allergenLabel } from '../catalog/allergens';
import { expandExclusion, hitsExclusion } from './exclusions';
import { decisioneLattosio, usaDelattosati } from './lattosio';
import { Substitution } from './pasto-giornata';
import { SUBSTITUTION_MAP } from './sostituzioni-sicure';

/**
 * LE ESCLUSIONI DI UNA CLIENTE, IN UN POSTO SOLO — e la valutazione di una ricetta contro di esse.
 *
 * ## Perché esiste questo file (21/8, il caso Sonia)
 *
 * Sonia (6 allergie: crostacei, pesce, solfiti, lupini, molluschi, soia) non riceveva **nessun
 * menu**. La riga della segnalazione diceva perché: la giornata composta conteneva «Polpo grigliato»
 * e «Bresaola», cioè due piatti che lei non può mangiare — e `evaluateMeals`, che è il punto
 * obbligato prima di servire, fermava **tutta** l'erogazione (`return []`).
 *
 * ⛔ Il difetto non era il blocco: il blocco ha fatto il suo mestiere. Era **dove si sceglie**. Il
 * pool da cui il motore pesca i piatti (`buildScoringContext`) era filtrato **solo** per i divieti
 * di dieta di Vera, con tanto di commento: «le ricette vietate escono dal pool, così non vengono
 * nemmeno prese in considerazione». Le allergie e le intolleranze della cliente in quel filtro non
 * c'erano: entravano solo nel veto finale. Quindi il motore pescava il polpo per un'allergica ai
 * molluschi, e poi si puniva da solo — mentre nel pool c'erano altri piatti.
 *
 * ⚠️ **E il rimedio a mano non poteva funzionare.** La nutrizionista ha dato una sostituzione la
 * mattina del 21/8 e «non è stata comunque applicata»: con **zero giornate erogate** non c'è nessun
 * piatto su cui applicarla, e la composizione successiva ricadeva sul piatto dopo. Un piatto per
 * volta contro un pool intero.
 *
 * ## La regola
 *
 * Le esclusioni si costruiscono **una volta sola** (`esclusioniDi`) e la valutazione di una ricetta
 * è **una funzione sola** (`valutaRicetta`), usata da tutti e due i punti:
 *
 *  · a monte, per **non proporre** le ricette che poi vieteremmo;
 *  · a valle, in `evaluateMeals`, per **non servirle** — perché il pool non è l'unica strada da cui
 *    un piatto arriva in una giornata (le ricette semplici, gli scambi, le giornate riparate).
 *
 * ⚠️ Due copie di questa logica sono la cosa peggiore che possa capitare qui: il filtro toglierebbe
 * un insieme di piatti e la guardia ne vieterebbe un altro, e la differenza fra i due sarebbe una
 * cliente ferma senza che nessuno capisca perché. Per questo il file è puro e non tocca il database:
 * chi legge il profilo lo passa, e i test lo chiamano con un oggetto.
 */

/** Un termine escluso, con la sua causa e se è di sicurezza (cioè se blocca). */
export interface EsclusioneAttiva {
  keyword: string;
  /** La causa, scritta come la legge una persona: `allergia: molluschi`, `lattosio`, `non gradito`. */
  reason: string;
  /** Vero per allergie e intolleranze: senza sostituzione sicura il piatto non si serve. */
  blocking: boolean;
}

export interface EsclusioniCliente {
  excluded: EsclusioneAttiva[];
  /** Intollerante al lattosio E non allergica al latte: si usano i delattosati (`lattosio.ts`). */
  delattosati: boolean;
  /** I codici UE dichiarati: si confrontano coi tag allergene confermati sulla ricetta. */
  codiciAllergene: Set<string>;
  /** Vero se non c'è niente da controllare: chi chiama può saltare tutto il giro. */
  vuoto: boolean;
}

/** Il minimo del profilo che serve. Volutamente non è il tipo di Prisma: questo file è puro. */
export interface ProfiloConEsclusioni {
  allergies?: string[] | null;
  intolerances?: string[] | null;
  dislikedFoods?: string[] | null;
}

/** Il minimo della ricetta che serve. `allergens` sono i codici UE confermati dal nutrizionista. */
export interface RicettaDaValutare {
  id: string;
  name: string;
  ingredients: unknown;
  allergens?: string[] | null;
}

/**
 * Costruisce l'elenco delle esclusioni attive di una cliente.
 *
 * ⚠️ **L'ordine non è estetico**: le allergie per prime, così se lo stesso ingrediente ricade sotto
 * due esclusioni il motivo scritto sul pasto e nella segnalazione è quello che pesa di più.
 *
 * `extraDisliked` sono i termini vietati **sulla dieta** (Vera §6.2): non bloccano mai, si
 * sostituiscono, perché un divieto di catalogo non è una condizione clinica della cliente.
 */
export function esclusioniDi(
  profilo: ProfiloConEsclusioni | null | undefined,
  extraDisliked: string[] = [],
): EsclusioniCliente {
  const pulisci = (v: string[] | null | undefined): string[] =>
    (v ?? []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);

  const allergie = pulisci(profilo?.allergies);
  const intolleranze = pulisci(profilo?.intolerances);
  const nonGraditi = [...new Set([...pulisci(profilo?.dislikedFoods), ...pulisci(extraDisliked)])];

  if (!allergie.length && !intolleranze.length && !nonGraditi.length) {
    return { excluded: [], delattosati: false, codiciAllergene: new Set(), vuoto: true };
  }

  const excluded: EsclusioneAttiva[] = [];
  for (const a of allergie) {
    for (const kw of expandExclusion(a)) excluded.push({ keyword: kw, reason: `allergia: ${a}`, blocking: true });
  }
  for (const intol of intolleranze) {
    for (const kw of expandExclusion(intol)) excluded.push({ keyword: kw, reason: intol, blocking: true });
  }
  // Cibi non graditi: espansi per CATEGORIA (es. "frutta secca"/"legumi" → noci, ceci…), così
  // un'esclusione generica intercetta i singoli alimenti. Non bloccano mai (solo sostituzione).
  for (const d of nonGraditi) {
    for (const kw of expandExclusion(d)) excluded.push({ keyword: kw, reason: 'non gradito', blocking: false });
  }

  return {
    excluded,
    delattosati: usaDelattosati({ intolerances: intolleranze, allergies: allergie }),
    codiciAllergene: new Set(allergie.filter((a) => EU_ALLERGEN_CODES.includes(a))),
    vuoto: false,
  };
}

/**
 * Valuta UNA ricetta contro le esclusioni: cosa si può sostituire, e cosa invece la vieta.
 *
 * ⛔ Un **tag allergene** che scatta blocca e basta: dice che il piatto contiene l'allergene, non
 * quale ingrediente — quindi non c'è niente da sostituire. Non si richiede `allergensReviewed`: un
 * tag che c'è è un'informazione comunque, e pretendere la conferma vorrebbe dire ignorare l'avviso
 * proprio sulle ricette che nessuno ha ancora guardato.
 */
export function valutaRicetta(
  r: RicettaDaValutare,
  e: EsclusioniCliente,
): { violations: string[]; subs: Substitution[] } {
  const violations: string[] = [];
  const subs: Substitution[] = [];
  if (e.vuoto) return { violations, subs };

  const perTag = e.codiciAllergene.size
    ? (r.allergens ?? []).find((a) => e.codiciAllergene.has(a))
    : undefined;
  if (perTag) violations.push(`${r.name}: contiene ${allergenLabel(perTag)} (allergene dichiarato)`);

  const ings = ((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').filter(Boolean);
  for (const ing of ings) {
    const low = ing.toLowerCase();
    for (const ex of e.excluded) {
      // ⚠️ Il confronto passa da `hitsExclusion` come tutti gli altri: un `includes` a mano qui
      // dentro faceva sì che «mandorla» non combaciasse con «mandorle» (nona copia, trovata il 20/8).
      if (!hitsExclusion(low, [ex.keyword])) continue;
      /**
       * REGOLA DEL LATTOSIO (11/8), prima della mappa generica.
       *
       * Per un'intollerante al lattosio **senza** allergia al latte: i formaggi stagionati non si
       * toccano (lattosio in milligrammi), tutto il resto passa alla versione **delattosata** invece
       * che alla bevanda vegetale. Il `continue` sul caso «tieni» è la parte che conta: senza,
       * l'ingrediente ricadrebbe nella mappa generica e il parmigiano diventerebbe «parmigiano ben
       * stagionato» — una sostituzione che sostituisce una cosa con se stessa.
       */
      if (ex.reason !== 'non gradito' && e.delattosati) {
        const scelta = decisioneLattosio(ing);
        if (scelta?.azione === 'tieni') continue;
        if (scelta?.azione === 'sostituisci') {
          subs.push({ from: ing, to: scelta.con, reason: ex.reason });
          break;
        }
      }
      const repl = SUBSTITUTION_MAP[ex.keyword] ?? SUBSTITUTION_MAP[low];
      if (repl) {
        subs.push({ from: ing, to: repl, reason: ex.reason });
      } else if (ex.blocking) {
        violations.push(`${r.name}: incompatibile con "${ex.reason}"`);
      }
      break; // un solo match per ingrediente
    }
  }
  return { violations, subs };
}

/**
 * Le ricette che NON si possono servire a questa cliente: quelle con almeno una violazione.
 *
 * È il filtro a monte. ⚠️ Le ricette solo **sostituibili** restano dentro: il piatto si eroga con la
 * sostituzione annotata, ed è quello che la cliente si aspetta di ricevere.
 */
export function ricetteNonSicure(
  ricette: readonly RicettaDaValutare[],
  e: EsclusioniCliente,
): Map<string, string> {
  const fuori = new Map<string, string>();
  if (e.vuoto) return fuori;
  for (const r of ricette) {
    const { violations } = valutaRicetta(r, e);
    if (violations.length) fuori.set(r.id, violations[0]);
  }
  return fuori;
}
