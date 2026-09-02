/**
 * ⛔ **IL CONFRONTO PRIMA/DOPO, CON LE DUE SPONDE COSTRUITE DALLA STESSA PORTA.**
 *
 * `npm run panieri:confronta` risponde alla domanda che decide se accendere il paniere: *ogni
 * ricetta che una cliente può ricevere oggi, la può ricevere anche domani?* Il 2/9 ha risposto
 * **«119 varianti perderebbero almeno una ricetta, NON spostare l'interruttore»** — e non era vero.
 *
 * ## Il difetto, che stava nel misuratore
 *
 * Lo script costruiva le due sponde in due modi diversi:
 *
 * · **le giornate** con `poolPerSlot`, che dall'1/9 chiama `allargaAiGemelli`: spuntino e merenda
 *   sono un paniere solo, quindi ognuna delle due chiavi si porta dentro anche le ricette
 *   dell'altra;
 * · **il paniere** con un ciclo scritto a mano sulle appartenenze, **senza** quell'allargamento.
 *
 * Risultato: il lato «giornate» aveva 168 piatti sotto `morning_snack` e 168 sotto
 * `afternoon_snack`, il lato «paniere» ne aveva 84 e 84, e il confronto vedeva sparire ~80 ricette
 * per chiave — su tutte le famiglie insieme. Con l'interruttore su `paniere` il pool passa da
 * `poolPerSlot`, cioè dalla stessa porta, e i gemelli si allargano identici.
 *
 * ⚠️ **Questo NON vuol dire che tutte le perdite di quel tabulato fossero finte, e non va detto.**
 * `allargaAiGemelli` arricchisce i pasti che il pool **ha già**; non ne inventa. Se un paniere non
 * contiene **nessuna** ricetta con `mealSlot = afternoon_snack`, quella chiave nel pool non esiste
 * e una cliente che nella sua giornata ha la merenda non ha da dove pescarla: è una perdita vera.
 * Il confronto corretto distingue i due casi — è tutto quello che sa fare, e va rilanciato per
 * saperlo, non dedotto. ⛔ Nel tabulato del 2/9 c'era anche «2 su `dinner`», che i gemelli non
 * spiegano in nessun modo: qualcosa da guardare c'è.
 *
 * ⚠️ **La correzione non è aggiungere una chiamata: è togliere a chi chiama la possibilità di
 * dimenticarla.** Le due sponde si costruiscono qui dentro, dalla stessa funzione, e uno script che
 * volesse sbagliarle in modo diverso non ha più dove farlo. Un confronto le cui due metà si
 * costruiscono in due posti è un confronto che prima o poi misura due cose diverse — ed è il
 * quarto falso allarme della settimana, tutti nati così.
 *
 * ⛔ **E il criterio che dice che questa correzione non ha reso cieco il misuratore**: una perdita
 * vera su un pasto **senza gemelli** deve continuare a comparire. Se sparisse anche quella, non
 * avrei corretto il confronto: l'avrei spento.
 */
import { poolPerSlot, type Appartenenza } from './pool-del-paniere';

/** Le ricette che una variante avrebbe oggi e non avrebbe leggendo dal paniere, per pasto. */
export interface Perdita {
  slot: string;
  mancanti: string[];
}

export interface EsitoConfronto {
  perse: Perdita[];
  /** Quante ricette il paniere **aggiunge**: il guadagno atteso, non un allarme. */
  guadagnate: number;
}

/**
 * Confronta il pool di oggi con quello di domani.
 *
 * ⚠️ `esiste` serve a non contare come perse le ricette **cancellate dal catalogo**: la chiave
 * esterna del paniere le rifiuta di proposito, e contarle qui farebbe sembrare rotta la migrazione
 * proprio per la cosa che è venuta a chiudere.
 */
export function confrontaLePoole(
  righeDelleGiornate: readonly Appartenenza[],
  righeDelPaniere: readonly Appartenenza[],
  esiste: (recipeId: string) => boolean,
): EsitoConfronto {
  const daGiornate = poolPerSlot(righeDelleGiornate);
  const daPaniere = poolPerSlot(righeDelPaniere);

  const perse: Perdita[] = [];
  for (const [slot, ids] of daGiornate) {
    const la = daPaniere.get(slot) ?? new Set<string>();
    const mancanti = [...ids].filter((id) => esiste(id) && !la.has(id));
    if (mancanti.length) perse.push({ slot, mancanti });
  }

  let guadagnate = 0;
  for (const [slot, ids] of daPaniere) {
    const qua = daGiornate.get(slot) ?? new Set<string>();
    guadagnate += [...ids].filter((id) => !qua.has(id)).length;
  }

  return { perse, guadagnate };
}

/** Quante ricette perde in tutto una variante. */
export const quantePerse = (e: EsitoConfronto): number =>
  e.perse.reduce((n, p) => n + p.mancanti.length, 0);
