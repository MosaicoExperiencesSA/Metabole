/**
 * ⛔ **QUANDO UNA RICETTA CAMBIA PASTO, I PANIERI DEVONO SEGUIRLA.**
 *
 * Simone, 4/9: *«se sposto una ricetta da colazione a cena e salvo non la sposta»*.
 *
 * ## Perché succedeva, e perché non si vedeva
 *
 * `Recipe.mealSlot` e `PaniereRicetta.slot` sono **due colonne diverse**, e devono esserlo: la
 * prima dice che pasto è quel piatto, la seconda in quale **cella** di quale paniere sta. Ma
 * `updateRecipe` scriveva solo la prima. Risultato: la scheda diceva «cena» e il piatto restava
 * nella cella della colazione — cioè **il motore continuava a servirlo a colazione**, e chi aveva
 * appena salvato aveva davanti la prova che il salvataggio era andato.
 *
 * ⚠️ È la stessa famiglia di difetti di questa settimana: un campo che risulta compilato mentre la
 * conseguenza non è avvenuta. Nessun errore, nessuna riga rossa.
 *
 * ## ⛔ E qui NON si cancella niente per punizione
 *
 * La prima stesura del 4/9 faceva un'altra cosa: se il pasto nuovo era colazione, spuntino o
 * merenda e il piatto era di carne o pesce, **toglieva tutte le righe**. Una revisione avversariale
 * l'ha smontata prima della consegna, e aveva ragione: una tendina premuta per sbaglio su una
 * ricetta presente in dodici panieri cancellava dodici righe, **rimettere «cena» non le riportava
 * indietro**, e per ricostruirle bisognava riaggiungerle a mano o rilanciare il riempimento. Una
 * distruzione irreversibile senza conferma, come conseguenza di un clic.
 *
 * ⚠️ Adesso quel caso **si rifiuta alla porta**: `updateRecipe` non salva affatto e dice perché.
 * Nessun dato distrutto, e la regola è chiusa davvero invece che pagata coi panieri.
 *
 * ⚠️ Modulo **puro**: qui si decide, non si scrive. Chi scrive è `updateRecipe`.
 */
import { slotCapofila } from '../common/slot-pasto';

export interface RigaDiPaniere {
  id: string;
  paniereId: string;
  slot: string;
}

export interface CosaFare {
  /** Le righe che cambiano cella: stesso paniere, slot nuovo. */
  daSpostare: string[];
  /**
   * Le righe che si tolgono, e c'è **un caso solo**: nel paniere esiste già una riga a quello slot,
   * e spostare la seconda romperebbe l'unicità `(paniere, ricetta, slot)`. Non è una perdita —
   * quella ricetta in quella cella c'è già.
   */
  daTogliere: string[];
  /** Quante erano già al posto giusto: si contano per non promettere uno spostamento che non c'è. */
  giaAPosto: number;
}

/**
 * Cosa fare delle righe di paniere di una ricetta che passa a `slotNuovo`.
 *
 * ⚠️ **Non c'è più un parametro «vietato»**: il caso «in quel pasto non ci può stare» non arriva
 * qui, perché `updateRecipe` rifiuta il salvataggio prima. Vedi il cappello del file.
 */
export function cosaFareDelleRighe(righe: readonly RigaDiPaniere[], slotNuovo: string): CosaFare {
  const destinazione = slotCapofila(slotNuovo);
  const fuoriPosto = righe.filter((r) => slotCapofila(r.slot) !== destinazione);
  const giaAPosto = righe.length - fuoriPosto.length;

  /**
   * ⚠️ **L'unicità è `(paniere, ricetta, slot)`**: se nello stesso paniere una riga sta già alla
   * destinazione, la seconda non ci si può spostare — si toglie. Senza questo controllo lo
   * spostamento fallirebbe a metà, con alcune righe mosse e altre no, e nessuno saprebbe quali.
   */
  const occupati = new Set(righe.filter((r) => slotCapofila(r.slot) === destinazione).map((r) => r.paniereId));
  const daSpostare: string[] = [];
  const daTogliere: string[] = [];
  for (const r of fuoriPosto) {
    if (occupati.has(r.paniereId)) daTogliere.push(r.id);
    else { daSpostare.push(r.id); occupati.add(r.paniereId); }
  }
  return { daSpostare, daTogliere, giaAPosto };
}

/**
 * La frase per chi ha appena salvato. ⚠️ `null` quando non è successo niente: un avviso che dice
 * «spostate 0 righe» insegna a non leggere gli avvisi.
 */
export function raccontaSpostamento(nome: string, pasto: string, esito: CosaFare): string | null {
  if (!esito.daSpostare.length && !esito.daTogliere.length) return null;
  const pezzi: string[] = [];
  if (esito.daSpostare.length) {
    pezzi.push(`spostata in ${esito.daSpostare.length} panier${esito.daSpostare.length === 1 ? 'e' : 'i'}`);
  }
  /** ⚠️ Niente asterischi in queste frasi: finiscono in un banner che NON disegna il markdown. */
  if (esito.daTogliere.length) {
    pezzi.push(`tolta da ${esito.daTogliere.length} panier${esito.daTogliere.length === 1 ? 'e' : 'i'} dove c'era già a quel pasto`);
  }
  return `«${nome}» adesso è ${pasto}: ${pezzi.join('; ')}.`;
}

/**
 * ⛔ **Il rifiuto, quando in quel pasto il piatto non ci può stare.**
 *
 * ⚠️ Dice **come si fa** ad ottenere quello che si voleva, non solo che non si può: un divieto
 * senza una via d'uscita si aggira, e si aggira male.
 */
export const perchePerNonSiPuoSpostare = (nome: string, pasto: string, motivo: string): string =>
  `«${nome}» non si può spostare a ${pasto}: ${motivo}\n\n`
  + 'Il pasto non è stato cambiato e i panieri sono rimasti come sono. Se il piatto è davvero da '
  + 'quel pasto, togli prima la carne o il pesce dagli ingredienti (e dal nome).';
