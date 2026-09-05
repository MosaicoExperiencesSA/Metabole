import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { ALLERGENE_SOLFITI, decisioneSolfiti } from './solfiti';

/**
 * ⛔ **«QUESTO TAG ALLERGENE TOGLIE IL PIATTO?» — UNA DOMANDA, UNA RISPOSTA.**
 *
 * Nasce il 5/9 da una divergenza misurata, non immaginata. Il giro di riparazione di quella sera ha
 * scritto **3080 tag `solfiti`** su ricette vecchie (dado vegetale, aceto di mele, uva passa, tonno
 * in scatola): erano la decisione del 24/8 — «quattro parole non bastavano» — applicata finalmente
 * anche al catalogo di prima. Da lì è saltato fuori che lo stesso tag veniva giudicato da **due
 * porte con due regole diverse**:
 *
 * · la **composizione dei menu** (`esclusioni-della-cliente.ts`) dal 24/8 NON blocca sul tag
 *   `solfiti`: per chi li dichiara guarda gli **ingredienti**, perché per i solfiti esiste una
 *   regola che sa quale ingrediente è e cosa metterci al posto (`solfiti.ts`);
 * · la **base personale** (`personal-base.service.ts`) scartava su qualunque tag, solfiti compresi.
 *   Risultato: per una cliente che dichiara i solfiti la base personale contava «non sicure» proprio
 *   le ricette che il motore le avrebbe servite con la sostituzione — e con abbastanza ricette così
 *   scattava l'avviso «poche ricette sicure» su una cliente che ne aveva.
 *
 * ⚠️ **Simone, 5/9: «allinea subito le due porte».** Il giudizio sta qui, e tutte e due lo chiamano.
 *
 * ## ⚠️ Perché l'eccezione vale SOLO per i solfiti
 *
 * Non è una gradazione di gravità: è che per i solfiti — e solo per loro — esiste una tabella per
 * ingrediente che dice cosa mettere al posto di cosa (guida della capo nutrizionista, 21/8). Su
 * «contiene glutine» quella tabella non c'è: il tag dice che il piatto contiene l'allergene e non
 * quale ingrediente, quindi lì blocca e basta. La stessa frase sta in `esclusioni-della-cliente.ts`
 * dal 24/8, e questo modulo la rende una riga di codice sola invece che due.
 *
 * ## ⛔ E il ripiego: dove non abbiamo saputo dire niente, il tag torna a vincere
 *
 * Se la ricetta porta il tag `solfiti` e **nessun** ingrediente ha una decisione — è il caso del tag
 * messo a mano dalla nutrizionista su un ingrediente che il nostro elenco non nomina — allora lei sa
 * una cosa che noi non sappiamo, e il piatto si toglie.
 */

/**
 * I codici UE fra le allergie dichiarate. ⚠️ Era scritto uguale in tre posti (`esclusioni-della-
 * cliente.ts`, `personal-base.service.ts`, e la terza copia nel motore): sta qui una volta.
 */
export const codiciAllergeneDichiarati = (allergie: readonly string[]): string[] =>
  [...new Set(allergie.map((a) => String(a ?? '').toLowerCase().trim()))].filter((a) => EU_ALLERGEN_CODES.includes(a));

/**
 * ⛔ **I codici che il tag da solo basta a bloccare.** Tutti, tranne i solfiti quando la cliente li
 * dichiara: per quelli decide la tabella per ingrediente, e il ripiego qui sotto.
 */
export const codiciCheBloccanoDalTag = (codici: Iterable<string>, dichiaraSolfiti: boolean): string[] =>
  [...codici].filter((c) => !(c === ALLERGENE_SOLFITI && dichiaraSolfiti));

/**
 * ⛔ **Il ripiego del tag solfiti**: la cliente li dichiara, la ricetta porta il tag, e passando per
 * gli ingredienti non si è saputo dire niente — né una sostituzione né un «fuori». Allora blocca.
 */
export const ilTagSolfitiRipiega = (
  dichiaraSolfiti: boolean,
  tagRicetta: readonly string[] | null | undefined,
  haViolazioni: boolean,
  haSostituzioni: boolean,
): boolean => dichiaraSolfiti && !haViolazioni && !haSostituzioni && (tagRicetta ?? []).includes(ALLERGENE_SOLFITI);

export interface RicettaDaScartare {
  allergens?: readonly string[] | null;
  /** I nomi degli ingredienti: servono **solo** per i solfiti, e solo se la cliente li dichiara. */
  ingredienti: readonly string[];
}

export type EsitoScarto =
  | { scarta: false }
  /** ⛔ Il piatto non si serve a questa cliente, e il perché è dicibile. */
  | { scarta: true; codice: string; perche: 'tag' | 'ingrediente_senza_sostituto' | 'tag_senza_ingrediente' };

/**
 * ⛔ **LA DOMANDA INTERA**, per chi conta le ricette sicure di una cliente (la base personale) e per
 * chiunque debba dire «questo piatto si serve, sì o no» senza calcolare le sostituzioni.
 *
 * ⚠️ Chi **compone i menu** non chiama questa: chiama `valutaRicetta`, che oltre a rispondere
 * costruisce le sostituzioni da scrivere sul pasto. Le due strade usano le stesse tre funzioni qui
 * sopra, e una prova (`tag-che-scarta.spec.ts`) le confronta sugli stessi dati — perché due porte
 * che rispondono diverso alla stessa domanda è il difetto che questo file esiste per chiudere.
 */
export function tagCheScarta(
  ricetta: RicettaDaScartare,
  codici: Iterable<string>,
  dichiaraSolfiti: boolean,
): EsitoScarto {
  const tag = ricetta.allergens ?? [];
  const daGuardare = codiciCheBloccanoDalTag(codici, dichiaraSolfiti);
  const perTag = tag.find((a) => daGuardare.includes(a));
  if (perTag) return { scarta: true, codice: perTag, perche: 'tag' };

  if (!dichiaraSolfiti) return { scarta: false };

  /**
   * ⚠️ Stesso ordine del motore: prima si guarda se un ingrediente **cambierebbe il piatto**
   * (crostacei, insaccati: non si sostituiscono, il piatto esce), poi se qualcuno si sostituisce o
   * si toglie — e in quel caso il piatto resta, con la sostituzione annotata.
   */
  let qualcosaDaFare = false;
  for (const ing of ricetta.ingredienti) {
    const scelta = decisioneSolfiti(ing);
    if (scelta?.azione === 'fuori') return { scarta: true, codice: ALLERGENE_SOLFITI, perche: 'ingrediente_senza_sostituto' };
    if (scelta) qualcosaDaFare = true;
  }
  if (ilTagSolfitiRipiega(dichiaraSolfiti, tag, false, qualcosaDaFare)) {
    return { scarta: true, codice: ALLERGENE_SOLFITI, perche: 'tag_senza_ingrediente' };
  }
  return { scarta: false };
}
