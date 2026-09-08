/**
 * ⛔ **CHI HA FIRMATO QUEL TAG — e se l'ha firmato PRIMA che ci fosse.**
 *
 * ## Il fatto, 8/9
 *
 * Il ritiro dei tag del sorgo soffiato ha recuperato **12 ricette su 78**. Le altre 66 sono rimaste
 * con il glutine sbagliato, e `ritira-i-tag.ts` le ha lasciate stare per la sua regola più
 * importante: *«un tag su una ricetta che qualcuno ha guardato non si tocca — quello che c'è scritto
 * è suo»*. È la regola giusta. Ma poggia tutta su una parola: **«guardato»**.
 *
 * E «guardato», in questo progetto, vuol dire `allergensReviewed === true`. Quel campo diventa vero
 * in **cinque** modi, e solo il primo è una persona che guarda quella ricetta:
 *
 *  1. `setRecipeAllergens` — una per una, riquadro aperto. Registro: `catalog.recipe.allergens.set`,
 *     una riga **per ricetta**, con chi e quando. ⛔ **Questa è una firma.**
 *  2. `confermaAllergeniInBlocco` — la spunta in blocco del 19/8. Registro:
 *     `catalog.recipe.allergens.bulk`, **una riga per tutto il blocco**, e nella riga ci sono i
 *     numeri ma **non gli id**: si sa che qualcuno ha confermato quattromila ricette, non quali.
 *     ⚠️ È un gesto umano vero, ma per la singola ricetta è **muto**.
 *  3. `reviewDietAllergens` (motore) — «segna verificati gli allergeni di tutta la dieta». Registro:
 *     `engine_rule.review.allergens` sulla **dieta**: le ricette si ritrovano passando dai giorni.
 *  4. `prisma/approve-diets.ts` — `updateMany({ where: { allergensReviewed: false } })`, cioè
 *     **tutto il catalogo in un colpo**. ⛔ **Nessuna riga di registro. Nessuna persona.**
 *  5. `prisma/pubblica-tutto.ts` — stessa cosa, per le ricette di ogni dieta pubblicata. ⛔ Anche
 *     questo senza registro.
 *
 * ⛔ **Quindi «quello che c'è scritto è suo» può essere falso due volte**, e in due modi diversi:
 *  · **di chi** — la spunta l'ha messa uno script di allestimento, non una persona (4 e 5);
 *  · **di quando** — la persona ha firmato *prima* che l'agente aggiungesse quel tag. La sua firma
 *    sta sotto una lista che nel frattempo è cambiata: non ha mai visto la riga che stiamo
 *    proteggendo in suo nome.
 *
 * ## Cosa fa questo modulo, e cosa NON fa
 *
 * ⚠️ **Non toglie niente e non decide niente: misura.** Serve a rispondere alla domanda che Simone
 * ha in mano — *«il lavoro vale 66 ricette o sei?»* — prima di scrivere qualunque script che tocchi
 * un dato clinico. Le date ci sono già tutte nel registro: si tratta solo di leggerle nell'ordine
 * giusto.
 *
 * ⚠️ **E in dubbio non assolve.** Quando il registro non basta a dire chi ha firmato, il verdetto è
 * «non si sa», mai «si può togliere»: su un allergene l'incertezza sta dalla parte di chi lo ha.
 */

/**
 * Cosa il registro riesce a dire di una ricetta rimasta col tag.
 *
 * ⚠️ I due `blocco…` sono cose diverse apposta: `bloccoCerto` sono i blocchi in cui questa ricetta
 * c'era **di sicuro** (è la capofila: `entityId` della riga di registro), `bloccoDopoIlTag` dice
 * soltanto che *un* blocco è passato dopo — e questa ricetta poteva esserci dentro o no.
 */
export interface FirmeDiUnaRicetta {
  recipeId: string;
  ricetta: string;
  /** Quando la propagazione ha messo quel tag: l'ultima volta, se è successo più di una volta. */
  taggata: Date;
  /** Firme che si sanno essere di QUESTA ricetta: `allergens.set`, o la revisione della sua dieta. */
  firmePropria: readonly Date[];
  /** Blocchi di cui questa ricetta è la capofila nel registro: dentro c'era di sicuro. */
  bloccoCerto: readonly Date[];
  /** È passato un blocco di conferma dopo il tag — senza sapere se questa ricetta c'era dentro. */
  bloccoDopoIlTag: boolean;
  /** Il campo che il ritiro legge come «qualcuno l'ha guardata». */
  reviewed: boolean;
}

export type Verdetto =
  /** ⛔ Una persona ha firmato DOPO che il tag c'era: quel tag l'ha visto. Non si tocca. */
  | 'firmata_dopo_il_tag'
  /** ⛔ Ha firmato PRIMA: il tag le è arrivato addosso dopo. Non l'ha mai visto nessuno. */
  | 'firmata_prima_del_tag'
  /** ⚠️ Nessuna firma sua, ma un blocco è passato dopo: poteva esserci dentro. Non si sa. */
  | 'forse_in_un_blocco'
  /** ⛔ `reviewed` è vero e nel registro non c'è niente che lo giustifichi: è di uno script. */
  | 'nessuna_firma_nel_registro'
  /** La ricetta non è nemmeno segnata come guardata: non è questo il motivo per cui il tag è restato. */
  | 'non_e_segnata_guardata';

export interface EsitoFirma {
  recipeId: string;
  ricetta: string;
  verdetto: Verdetto;
  /** La firma che decide il verdetto, quando ce n'è una. */
  quando?: Date;
}

/**
 * ⛔ **Il giudizio, e l'ordine conta.** Prima si guarda se esiste una firma *di questa ricetta* dopo
 * il tag: se c'è, è finita, quel tag è stato guardato. Solo dopo si scende nei casi in cui il
 * registro dice sempre meno.
 */
export function chiHaFirmato(f: FirmeDiUnaRicetta): EsitoFirma {
  const base = { recipeId: f.recipeId, ricetta: f.ricetta };
  if (!f.reviewed) return { ...base, verdetto: 'non_e_segnata_guardata' };

  const sue = [...f.firmePropria, ...f.bloccoCerto].sort((a, b) => a.getTime() - b.getTime());
  const dopo = sue.filter((d) => d.getTime() > f.taggata.getTime());
  if (dopo.length) return { ...base, verdetto: 'firmata_dopo_il_tag', quando: dopo[0] };

  /**
   * ⚠️ **Una firma prima del tag non è una firma su quel tag.** `setRecipeAllergens` riscrive la
   * lista intera: se dopo quella firma la propagazione ha aggiunto una riga, la lista di oggi non è
   * quella che la persona ha approvato. ⛔ E vale anche nel verso peggiore: se la persona quel tag
   * lo aveva **tolto**, la propagazione gliel'ha rimesso la notte dopo — e il registro la racconta
   * uguale, perché una riga di propagazione esiste solo quando qualcosa è stato davvero aggiunto.
   */
  if (sue.length) return { ...base, verdetto: 'firmata_prima_del_tag', quando: sue[sue.length - 1] };

  if (f.bloccoDopoIlTag) return { ...base, verdetto: 'forse_in_un_blocco' };
  return { ...base, verdetto: 'nessuna_firma_nel_registro' };
}

/** Le parole con cui ogni verdetto si legge in un tabulato: il conto da solo non dice niente. */
export const PAROLE_DEL_VERDETTO: Record<Verdetto, string> = {
  firmata_dopo_il_tag: 'una persona ha guardato quella ricetta DOPO: il tag è suo, non si tocca',
  firmata_prima_del_tag: 'ha firmato PRIMA che il tag ci fosse: quel tag non l\'ha visto nessuno',
  forse_in_un_blocco: 'nessuna firma sua, ma un blocco è passato dopo: poteva esserci dentro',
  nessuna_firma_nel_registro: 'segnata guardata, ma nel registro non c\'è nessuno: è di uno script',
  non_e_segnata_guardata: 'non è segnata come guardata: il tag è restato per un altro motivo',
};

/**
 * ⛔ **QUANTE SPUNTE NON HA MESSO NESSUNO.** Il conto che dice se `allergensReviewed` è ancora una
 * firma: le ricette segnate guardate, meno quelle che il registro sa spiegare. La differenza è
 * arrivata da `approve-diets.ts` o `pubblica-tutto.ts`, che non lasciano traccia.
 *
 * ⚠️ È una **stima per eccesso del noto**, quindi per difetto del buco: i blocchi possono
 * sovrapporsi (la stessa ricetta confermata due volte conta due), quindi il numero vero di spunte
 * senza nessuno dietro è **almeno** questo. Un conto che sbaglia deve sbagliare dalla parte che non
 * rassicura.
 */
export function spunteSenzaNessuno(input: {
  segnateGuardate: number;
  firmeUnaPerUna: number;
  confermateInBlocco: number;
  confermateDalMotore: number;
}): { spiegate: number; senzaNessuno: number } {
  const spiegate = input.firmeUnaPerUna + input.confermateInBlocco + input.confermateDalMotore;
  return { spiegate, senzaNessuno: Math.max(0, input.segnateGuardate - spiegate) };
}
