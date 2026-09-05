import { allergenLabel } from '../catalog/allergens';

/**
 * ⛔ **RITIRARE I TAG VENUTI DA UNA RIGA SBAGLIATA — il gesto inverso dell'agente alimenti.**
 *
 * Simone, 5/9, sull'agente: *«direttamente, valgono subito»* — la riga che l'AI scrive in tabella è
 * usata la notte stessa, e i suoi allergeni arrivano alle ricette che hanno quell'ingrediente. La
 * consegna lo diceva: il costo di quella decisione è che **un allergene sbagliato, una volta
 * propagato, resta sulle ricette anche dopo che la riga è stata corretta**. Aggiungere è facile,
 * togliere no — e senza il gesto inverso «valgono subito» diventa «valgono per sempre».
 *
 * Questo modulo è quel gesto. Non indovina niente: legge il **registro** che la propagazione scrive
 * (`catalog.recipe.allergens.dalla_tabella`, una riga per ricetta con allergene, ingrediente e riga
 * di origine) e ricostruisce esattamente cosa era stato aggiunto **da quell'alimento**.
 *
 * ## ⚠️ Le tre cose che non fa, e perché
 *
 * · **Non toglie un tag che la ricetta avrebbe comunque.** Se «pesto pronto» aveva dato `latte` a una
 *   ricetta che contiene anche il parmigiano, il tag resta: la deduzione dalle parole lo scrive lo
 *   stesso, e toglierlo sarebbe un falso negativo — il verso in cui si sbaglia addosso a una persona
 *   allergica. Chi chiama passa `dedottoDalleParole` per ogni ricetta e questo modulo ci si ferma.
 * · **Non toglie un tag che UN ALTRO ALIMENTO della tabella giustifica ancora** (revisione del 5/9,
 *   ed è il rilievo più grave che è uscito). La propagazione scrive **una sola** origine per
 *   allergene e ricetta (`tagDallaTabella` salta i doppioni): «Lasagne pronte» con besciamella e
 *   pesto, tutte e due dichiarate `latte` in tabella, hanno nel registro il solo pesto. Né
 *   «besciamella» né «pesto» sono parole del vocabolario, quindi `dedottoDalleParole` non basta:
 *   disfare il pesto toglierebbe `latte` a un piatto con la besciamella dentro. Chi chiama passa
 *   `datoDaAltri` — quello che la tabella direbbe **senza** la riga che si sta disfacendo.
 * · **Non tocca le ricette toccate a mano** — né quelle confermate una per una
 *   (`catalog.recipe.allergens.set`) né quelle spuntate **in blocco**, che il registro segna con una
 *   riga sola per tutto il blocco e che si riconoscono da `allergensReviewed`.
 * · **Non tocca `allergensReviewed`.** Vale la stessa ragione di `ripara:allergeni-mancanti`:
 *   azzerarla toglierebbe il piatto dalle basi personali di tutte, che è un danno più grande
 *   dell'errore che si sta correggendo.
 */

export interface RigaDiRegistro {
  /** `entityId` della riga di audit: la ricetta. */
  recipeId: string;
  /** Cosa la propagazione aveva aggiunto a quella ricetta. */
  aggiunti: { allergen: string; ingrediente: string; alimento: string }[];
}

export interface RicettaOggi {
  id: string;
  name: string;
  allergens: readonly string[];
  /** ⛔ Gli allergeni che la deduzione dalle parole darebbe **comunque** a questa ricetta. */
  dedottoDalleParole: readonly string[];
  /**
   * ⛔ Gli allergeni che **altre righe** della tabella alimenti danno ancora a questa ricetta, cioè
   * quelli che resterebbero anche togliendo di mezzo l'alimento che si sta disfacendo.
   */
  datoDaAltri?: readonly string[];
  /** Registro `catalog.recipe.allergens.set`: qualcuno ha scelto i tag a mano. */
  toccataAMano?: boolean;
}

export interface TagDaRitirare {
  recipeId: string;
  ricetta: string;
  allergen: string;
  label: string;
  /** Da quale ingrediente era arrivato: serve a chi legge il tabulato per capire se è giusto. */
  ingrediente: string;
}

export interface TagTenuto {
  recipeId: string;
  ricetta: string;
  allergen: string;
  perche: 'dedotto_dalle_parole' | 'dato_da_un_altro_alimento' | 'toccata_a_mano' | 'non_c_e_piu';
}

export interface EsitoRitiro {
  daRitirare: TagDaRitirare[];
  tenuti: TagTenuto[];
  /** Quante ricette cambierebbero davvero. */
  ricette: number;
}

/**
 * ⛔ **Cosa si toglie e cosa si tiene**, dato l'alimento da disfare, le righe del registro e lo
 * stato di oggi delle ricette. ⚠️ Ogni tag tenuto esce con il **motivo**: un tabulato che dice solo
 * «tolti 12 su 40» lascia chi legge a chiedersi cosa sia successo agli altri 28.
 */
export function tagDaRitirare(
  alimento: string,
  registro: readonly RigaDiRegistro[],
  ricette: ReadonlyMap<string, RicettaOggi>,
): EsitoRitiro {
  const daRitirare: TagDaRitirare[] = [];
  const tenuti: TagTenuto[] = [];
  const visti = new Set<string>();
  for (const riga of registro) {
    const r = ricette.get(riga.recipeId);
    for (const a of riga.aggiunti) {
      if (a.alimento !== alimento) continue;
      const chiave = `${riga.recipeId}|${a.allergen}`;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      if (!r || !r.allergens.includes(a.allergen)) {
        tenuti.push({ recipeId: riga.recipeId, ricetta: r?.name ?? riga.recipeId, allergen: a.allergen, perche: 'non_c_e_piu' });
        continue;
      }
      if (r.toccataAMano) {
        tenuti.push({ recipeId: r.id, ricetta: r.name, allergen: a.allergen, perche: 'toccata_a_mano' });
        continue;
      }
      if (r.dedottoDalleParole.includes(a.allergen)) {
        tenuti.push({ recipeId: r.id, ricetta: r.name, allergen: a.allergen, perche: 'dedotto_dalle_parole' });
        continue;
      }
      if (r.datoDaAltri?.includes(a.allergen)) {
        tenuti.push({ recipeId: r.id, ricetta: r.name, allergen: a.allergen, perche: 'dato_da_un_altro_alimento' });
        continue;
      }
      daRitirare.push({ recipeId: r.id, ricetta: r.name, allergen: a.allergen, label: allergenLabel(a.allergen), ingrediente: a.ingrediente });
    }
  }
  return { daRitirare, tenuti, ricette: new Set(daRitirare.map((t) => t.recipeId)).size };
}

/**
 * Gli allergeni che restano su **una** ricetta dopo il ritiro.
 *
 * ⛔ **Il `recipeId` è il primo argomento, e non è una cortesia** (revisione del 5/9): la prima
 * stesura filtrava per solo allergene, e chi le avesse passato l'elenco intero invece della fetta di
 * quella ricetta avrebbe tolto a **ogni** piatto l'unione di tutti i tag ritirati ovunque. Un refuso
 * di una riga, un allergene perso su piatti che non c'entravano niente. Adesso la fetta la fa il
 * modulo, e passargli tutto è la cosa giusta da fare.
 */
export function allergeniDopoIlRitiro(
  recipeId: string,
  attuali: readonly string[],
  daTogliere: readonly TagDaRitirare[],
): string[] {
  const togli = new Set(daTogliere.filter((t) => t.recipeId === recipeId).map((t) => t.allergen));
  return attuali.filter((a) => !togli.has(a));
}
