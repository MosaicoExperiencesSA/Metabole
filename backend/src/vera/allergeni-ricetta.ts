/**
 * GLI ALLERGENI DELLA RICETTA NUOVA, PROPOSTI IN CHAT — voce 227.
 * Foglio: `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`.
 *
 * Approvare una ricetta la **accende**, ma non conferma gli allergeni: `allergensReviewed` resta
 * `false` e `collegaRicetta` continua a rifiutarsi di metterla in una giornata. È giusto che siano
 * due responsabilità diverse — ma oggi il capo lo scopre **dal fatto che la ricetta non compare da
 * nessuna parte**. Qui la domanda gliela si fa subito, dove sta già decidendo.
 *
 * ⚠️ LA REGOLA CHE GOVERNA OGNI SCELTA DI QUESTO FILE: `suggestAllergens` cerca parole negli
 * ingredienti, e **può non vederci qualcosa**. Quindi un allergene che il capo nomina si prende
 * anche se non era fra i suggeriti — al contrario di `allargaFamiglia`, che tiene solo i nomi che
 * aveva proposto lui. Non è un'incoerenza: lì il rischio era simmetrico, qui no.
 * **Aggiungere un allergene di troppo costa una ricetta in meno; dimenticarne uno costa una
 * cliente.** Fra i due errori si sceglie sempre lo stesso.
 *
 * Modulo **puro**: qui non si legge e non si scrive niente. Il dizionario è quello del catalogo
 * (`catalog/allergens.ts`), lo stesso che usa la scheda: due dizionari sarebbero due risposte
 * diverse alla stessa domanda, date nella stessa applicazione.
 */
import { allergenLabel, EU_ALLERGENS } from '../catalog/allergens';

export type EsitoAllergeni =
  /** «sì»: valgono quelli che ha appena letto. */
  | { tipo: 'tutti' }
  /** «nessuno»: questa ricetta non ne ha. */
  | { tipo: 'nessuno' }
  /** Ha riscritto la lista: questa SOSTITUISCE i suggeriti. */
  | { tipo: 'elenco'; codici: string[] }
  /** Ha detto sì E ne ha nominati altri: questi si AGGIUNGONO ai suggeriti. */
  | { tipo: 'aggiungi'; codici: string[] };

const SI = /^(?:si|ok|okay|va bene|vabene|confermo|conferma|giusto|approv|perfetto|esatto|certo|d accordo|daccordo)\b/;
// ⚠️ Senza `\b` in coda: «nessuno» finisce con una lettera, e un confine di parola dopo «nessun»
// non c'è. Con `\b` questa riga leggeva «nessun allergene» e non leggeva «nessuno».
const NESSUNO = /^(?:nessun|niente|nulla|non ne ha|non ce ne sono|zero)/;
/** Le parole con cui si **aggiunge** invece di riscrivere: «anche», «aggiungi», «più». */
const AGGIUNTA = /\b(?:anche|aggiung|in piu|piu la|piu il|piu lo|piu i|piu gli|piu le|metti(?:ci)?)\b/;

/** Minuscolo, senza accenti, senza apostrofi, senza punteggiatura finale. */
function normalizzaFrase(frase: string): string {
  return (frase ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[?!.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Come si scrive un allergene quando lo si cerca in una frase: etichetta, codice, parole-chiave. */
function modiDiDirlo(a: (typeof EU_ALLERGENS)[number]): string[] {
  return [normalizzaFrase(a.label), a.code.replace(/_/g, ' '), ...a.keywords.map((k) => k.trim())];
}

/**
 * I codici nominati nella frase, **nell'ordine dei 14 allergeni UE** e senza doppioni.
 *
 * ⚠️ L'ordine è quello di `EU_ALLERGENS` e non quello in cui li ha detti: è lo stesso ordine con cui
 * compaiono in scheda, e una lista che cambia ordine fra chat e pagina è una lista che sembra
 * diversa quando è uguale.
 */
function codiciNominati(t: string): string[] {
  return EU_ALLERGENS.filter((a) => modiDiDirlo(a).some((m) => m.length > 2 && t.includes(m))).map((a) => a.code);
}

/**
 * Cosa ha risposto il capo.
 *
 * ⚠️ L'ordine di lettura è la sicurezza di questa funzione. «Sì, aggiungi anche il sesamo» si può
 * sbagliare in due modi, tutti e due gravi e in versi opposti: leggerlo come «sì» perde il sesamo,
 * leggerlo come elenco perde **tutti** quelli suggeriti. Per questo la frase che afferma E nomina
 * qualcosa esce come `aggiungi`, e l'unione la fa chi chiama.
 *
 * ⚠️ `null` è una risposta: una frase che non nomina niente di riconoscibile **non diventa
 * «nessuno»**. «Non lo so» e «non ne ha» sono due cose diverse, e la seconda apre il piatto a tutte.
 */
export function leggiAllergeni(frase: string): EsitoAllergeni | null {
  const t = normalizzaFrase(frase);
  if (!t) return null;

  const codici = codiciNominati(t);
  const afferma = SI.test(t);

  if (codici.length) return { tipo: afferma || AGGIUNTA.test(t) ? 'aggiungi' : 'elenco', codici };
  if (afferma) return { tipo: 'tutti' };
  if (NESSUNO.test(t)) return { tipo: 'nessuno' };
  return null;
}

export interface Suggerimento {
  allergen: string;
  label: string;
  /** Gli ingredienti che l'hanno fatto scattare. */
  matched: string[];
}

/**
 * I suggeriti, con il **perché** accanto a ciascuno.
 *
 * ⚠️ La parola dell'ingrediente non è un ornamento: è quello che permette al capo di accorgersi che
 * il suggerimento è sbagliato («Glutine — da "pane"» su una ricetta dove il pane non c'è più). Un
 * elenco di codici senza il perché si conferma senza guardarlo.
 */
export function raccontaSuggerimenti(suggeriti: readonly Suggerimento[]): string {
  if (!suggeriti?.length) {
    return 'Dagli ingredienti non leggo **nessun allergene**. ⚠️ Vuol dire che non ne ho trovati, non che non ce ne siano: guarda tu.';
  }
  return suggeriti.map((s) => `• **${s.label}** — da «${s.matched.join('», «')}»`).join('\n');
}

/** L'elenco che sto per scrivere, a parole. I codici non si mostrano: chi conferma legge parole. */
export function raccontaScelti(codici: readonly string[]): string {
  if (!codici?.length) return 'nessun allergene';
  return codici.map((c) => allergenLabel(c)).join(', ');
}
