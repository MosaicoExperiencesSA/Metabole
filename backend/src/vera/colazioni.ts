/**
 * COLAZIONI DOLCI E SALATE — la proposta del sistema, la conferma di Lucia.
 *
 * Decisione: `progetto/Decisioni_Simone_20260813.md` §12. Nasce dall'azione 3 di Vera («a colazione
 * qualcosa di salato»): oggi niente nel catalogo dice se una ricetta è dolce o salata, e senza quel
 * dato l'unica risposta onesta dell'assistente è «questo non lo so ancora fare».
 *
 * ## La convenzione
 *
 * Due tag su `Recipe.tags`: `piatto:dolce` e `piatto:salato`. **Un tag scritto = una persona ha
 * confermato.** La proposta di questo modulo non si salva da nessuna parte: si ricalcola al volo,
 * e la conferma è il tag. È lo stesso patto di `allergensReviewed` — una ricetta non revisionata
 * non è considerata classificata.
 *
 * ## ⚠️ Propone, non indovina
 *
 * La proposta esiste solo se gli indizi vanno TUTTI da una parte. Se nome e ingredienti dicono cose
 * diverse («torta salata»: 'torta' è dolce, 'salato' è salato), o non dicono niente, la ricetta
 * resta senza proposta e la decide una persona. Le parole che vivono in colazioni dolci E salate —
 * ricotta, pane, yogurt, pancake — sono fuori da entrambe le liste, di proposito: una parola
 * ambigua in una lista è una proposta sbagliata che sembra sicura.
 *
 * ## ⚠️ Chi non è classificato non partecipa
 *
 * Quando l'azione si accenderà, una colazione senza tag non entra nel giro «salato». Meglio un menu
 * con meno scelta che una colazione sbagliata: è la stessa regola delle ricette senza
 * `allergensReviewed`, che non sono considerate sicure.
 */

export const TAG_DOLCE = 'piatto:dolce';
export const TAG_SALATO = 'piatto:salato';

export type TipoColazione = 'dolce' | 'salato';

/**
 * Gli indizi. Solo parole FORTI: chi compare qui decide una proposta, quindi ogni voce larga è una
 * proposta sbagliata in serie. Le voci di una parola si confrontano come PREFISSO di parola
 * (vedi `trovati`), quelle con lo spazio come sottostringa: è quello che tiene «insalata» fuori
 * da 'salat'. «Pesca» resta fuori lista comunque: come prefisso prenderebbe «pescato».
 */
export const INDIZI_SALATO: readonly string[] = [
  'uovo', 'uova', 'albume', 'frittata', 'omelette',
  'prosciutto', 'bresaola', 'tacchino', 'speck', 'salmone', 'tonno', 'sgombro',
  'formaggio', 'parmigiano', 'grana padano', 'feta', 'hummus', 'acciug', 'alici',
  'avocado', 'pomodor', 'olive', 'rucola', 'salat',
];

export const INDIZI_DOLCE: readonly string[] = [
  'marmellat', 'confettur', 'miele', 'cioccolat', 'cacao', 'nutella',
  'biscott', 'croissant', 'brioche', 'cornett', 'torta', 'torte', 'crostat', 'plumcake', 'muffin',
  'granola', 'muesli', 'porridge', 'zucchero', 'vaniglia', 'cannella', 'sciroppo',
  'frutti di bosco', 'banan', 'fragol', 'mirtill', 'albicocc', 'uvetta', 'datter', 'dolce', 'dolci',
];

const minuscolo = (v: string | null | undefined): string => (v ?? '').toLowerCase().trim();

/**
 * ⚠️ Come si confronta. Le voci di UNA parola valgono come PREFISSO DI PAROLA: 'salat' prende
 * «salato», «salata», «salate» ma NON «insalata», che con la sottostringa nuda sarebbe diventata
 * una colazione salata. Le voci con lo spazio («frutti di bosco») restano sottostringa sul testo
 * intero. È il motivo per cui il difetto «torta salata → dolce» non si ripresenta: 'salata' ora
 * combacia, il conflitto con 'torta' scatta, e la proposta non parte.
 */
const trovati = (testo: string, indizi: readonly string[]): string[] => {
  const parole = testo.split(/[^a-zàèéìòù]+/i).filter(Boolean);
  return indizi.filter((voce) =>
    voce.includes(' ') ? testo.includes(voce) : parole.some((p) => p.startsWith(voce)),
  );
};

export interface PropostaColazione {
  /** `null` = nessuna proposta: indizi assenti o in conflitto. Decide una persona. */
  proposta: TipoColazione | null;
  /** Le parole che l'hanno decisa (o che si contraddicono): si mostrano, non si nascondono. */
  indizi: string[];
}

/**
 * La proposta per una ricetta, da nome e nomi degli ingredienti.
 *
 * ⚠️ Il conflitto NON si risolve contando: tre indizi dolci e uno salato restano un conflitto.
 * «Quasi sicuramente dolce» è il tipo di quasi che su un catalogo da migliaia di righe diventa
 * una colazione sbagliata al giorno.
 */
export function classificaColazione(nome: string, ingredienti: readonly string[]): PropostaColazione {
  const testo = [nome, ...ingredienti].map(minuscolo).filter(Boolean).join(' | ');
  /**
   * ⚠️ I COMPOSTI NON PARLANO DEL PIATTO (13/8 sera, visto in produzione appena aperta la pagina):
   * «mais dolce» aveva proposto DOLCI le acciughe marinate. In «mais dolce», «patata dolce»,
   * «burro salato» l'aggettivo descrive l'ingrediente, non la colazione: si toglie prima di
   * cercare gli indizi, lasciando il sostantivo.
   */
  const pulito = testo.replace(
    /\b(mais|patat[ae]|paprika|peperon[ei]|burro|arachidi|pistacchi|nocciole|mandorl[ae])\s+(?:dolc|salat)[a-zà-ù]*/g,
    '$1',
  );
  const salato = trovati(pulito, INDIZI_SALATO);
  const dolce = trovati(pulito, INDIZI_DOLCE);
  if (salato.length > 0 && dolce.length === 0) return { proposta: 'salato', indizi: salato };
  if (dolce.length > 0 && salato.length === 0) return { proposta: 'dolce', indizi: dolce };
  return { proposta: null, indizi: [...salato, ...dolce] };
}

/** Cosa ha confermato una persona, leggendo i tag. Tutti e due i tag = dato sporco, vale nessuno. */
export function tipoConfermato(tags: readonly string[] | null | undefined): TipoColazione | null {
  const t = tags ?? [];
  const dolce = t.includes(TAG_DOLCE);
  const salato = t.includes(TAG_SALATO);
  if (dolce && salato) return null;
  if (dolce) return 'dolce';
  if (salato) return 'salato';
  return null;
}

/** I tag della ricetta dopo la scelta. `null` toglie la classificazione, e non tocca gli altri tag. */
export function tagsDopoScelta(tags: readonly string[] | null | undefined, tipo: TipoColazione | null): string[] {
  const senza = (tags ?? []).filter((t) => t !== TAG_DOLCE && t !== TAG_SALATO);
  if (tipo === 'dolce') senza.push(TAG_DOLCE);
  if (tipo === 'salato') senza.push(TAG_SALATO);
  return senza;
}

/** I nomi degli ingredienti, dal Json `[{name, qty, unit}]` di `Recipe.ingredients`. */
export function nomiIngredienti(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((i) => (i && typeof i === 'object' && typeof (i as { name?: unknown }).name === 'string' ? (i as { name: string }).name : ''))
    .filter(Boolean);
}
