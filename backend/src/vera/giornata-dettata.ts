/**
 * «DETTA LE COMBINAZIONI E CREA MENU SPECIFICI» — la giornata dettata a parole (voce 241).
 *
 * Risposta di Simone (14/8) sulla variante di piano: «la nutrizionista o detta le nuove
 * combinazioni e crea dei menu specifici guidata da Vera, oppure sceglie una diversa dieta». La
 * seconda strada è fatta (il cambio dieta); questa è la prima, e Simone ha scelto la **lettura B**:
 * si detta a parole e il sistema traduce. Decisione in `progetto/DECISIONE_Menu_Dettati.md`.
 *
 * ## ⚠️ Il rischio della B, e come si chiude
 *
 * «Pasta al pomodoro» può essere cinque ricette con calorie molto diverse. Sceglierne una da soli
 * **non produce nessun errore**: produce una giornata diversa da quella che ha dettato, con dentro
 * duecento calorie che nessuno ha deciso. La regola che questo progetto applica ovunque vale anche
 * qui — **non si indovina mai**:
 *
 * | quante ricette combaciano | cosa succede |
 * |---|---|
 * | una | si propone, con le sue kcal |
 * | più d'una | si **chiede**, mettendole in fila con le calorie |
 * | nessuna | si dice, e si offre di dettarla come ricetta nuova (azione 4, che esiste già) |
 *
 * Così il caso facile resta un giro solo — che è il motivo per cui la B è stata scelta — e quello
 * ambiguo diventa una domanda invece di una scommessa.
 *
 * Modulo **puro**: qui non si legge e non si scrive niente. Il pool lo passa chi chiama (e sono
 * sempre e solo i piatti approvati per QUELLA cliente), la giornata la scrive il servizio.
 */
import { chiaveAlimento, combaciaAlimento } from '../common/nomi-alimento';
import { SLOT_LABEL } from '../common/slot-pasto';

/** Sopra questo scostamento dal target non si scrive (decisione di Simone: si ferma e lo dice). */
export const TOLLERANZA_KCAL_PCT = 15;

export interface RigaDettata {
  slot: string;
  /** Quello che ha scritto lei per quel pasto, ripulito dal nome del pasto. */
  testo: string;
}

export interface RicettaCandidata {
  recipeId: string;
  nome: string;
  kcal: number;
  slot: string;
  /**
   * ⛔ **LE SOSTITUZIONI DI INGREDIENTE CHE QUESTO PIATTO PORTA CON SÉ** — 2/9, voce 953.
   *
   * `valutaRicetta` non risponde solo «sì o no»: su un piatto che si può servire **cambiando un
   * ingrediente** rende le righe che dicono alla cliente cosa mettere al posto di cosa. La giornata
   * dettata dalla nutrizionista non le calcolava affatto, e il pasto nasceva senza.
   */
  sostituzioni?: unknown[];
}

export interface RigaAbbinata extends RigaDettata {
  /** `una` = si propone · `molte` = si chiede · `nessuna` = si dice. */
  esito: 'una' | 'molte' | 'nessuna';
  candidate: RicettaCandidata[];
}

/** Come si scrive un pasto in italiano → lo slot. È l'inverso di `SLOT_LABEL`, più i sinonimi. */
const SLOT_DA_PAROLA: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SLOT_LABEL).map(([slot, label]) => [label, slot])),
  'spuntino del mattino': 'morning_snack',
  'spuntino mattina': 'morning_snack',
  'merenda pomeriggio': 'afternoon_snack',
  'merenda del pomeriggio': 'afternoon_snack',
  'seconda colazione': 'morning_snack',
};

/** `colazione:` / `Pranzo -` / `CENA :` all'inizio della riga. */
const INIZIO_RIGA = /^\s*([a-zà-ÿ' ]{4,28}?)\s*[:\-–]\s*(.*)$/iu;

/**
 * Dal testo dettato alle righe, una per pasto.
 *
 * ⚠️ Una riga che non nomina un pasto si **salta**: attribuirla all'ultimo nominato vorrebbe dire
 * scrivere un pasto che nessuno ha dettato. ⚠️ Un pasto ripetuto vince l'**ultimo**: chi si corregge
 * dettando lo fa scrivendo di nuovo, ed è l'unica lettura che non tradisce l'intenzione.
 */
export function leggiGiornataDettata(testo: string): RigaDettata[] {
  const perSlot = new Map<string, string>();
  for (const riga of (testo ?? '').split(/[\n;]+/)) {
    const m = INIZIO_RIGA.exec(riga.trim());
    if (!m) continue;
    const nome = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const slot = SLOT_DA_PAROLA[nome];
    const contenuto = m[2].trim();
    if (!slot || !contenuto) continue;
    perSlot.set(slot, contenuto);
  }
  // L'ordine è quello della giornata, non quello in cui li ha dettati: chi rilegge l'anteprima
  // legge una giornata, non un elenco di appunti.
  const ordine = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  return [...perSlot.entries()]
    .sort((a, b) => ordine.indexOf(a[0]) - ordine.indexOf(b[0]))
    .map(([slot, t]) => ({ slot, testo: t }));
}

/** Le parole «piene» di una frase: quelle che portano il significato del piatto. */
function paroleUtili(testo: string): string[] {
  const scarta = new Set(['al', 'alla', 'ai', 'con', 'e', 'di', 'del', 'della', 'dei', 'in', 'la', 'il', 'lo', 'le', 'i', 'gli', 'un', 'una', 'da']);
  return (testo ?? '')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1 && !scarta.has(p.toLowerCase()))
    .filter((p) => !!chiaveAlimento(p));
}

/**
 * Ogni riga dettata contro il pool della cliente.
 *
 * ⚠️ Si cerca **solo dentro lo slot dettato**: la colazione non può finire a cena perché il nome
 * combacia. ⚠️ Il confronto è **per parola con la radice** (`combaciaAlimento`), mai per
 * sottostringa: «pepe» ⊂ «peperoni» è la trappola già pagata in questo progetto.
 *
 * Una ricetta è candidata se contiene **tutte** le parole piene della frase: «pasta al pomodoro»
 * prende «Pasta al pomodoro integrale» ma non «Pasta al pesto». Chiedere di più (l'ordine, la
 * frase intera) vorrebbe dire non trovare mai niente; chiedere di meno vorrebbe dire trovare tutto.
 */
export function abbinaRighe(righe: readonly RigaDettata[], pool: readonly RicettaCandidata[]): RigaAbbinata[] {
  return (righe ?? []).map((riga) => {
    const parole = paroleUtili(riga.testo);
    const candidate = parole.length
      ? pool.filter((r) => r.slot === riga.slot && parole.every((p) => combaciaAlimento(r.nome, p)))
      : [];
    return {
      ...riga,
      candidate,
      esito: candidate.length === 0 ? 'nessuna' : candidate.length === 1 ? 'una' : 'molte',
    };
  });
}

export interface SceltaGiornata {
  slot: string;
  recipeId: string;
  nome: string;
  kcal: number;
  /** ⚠️ Viaggiano dalla candidata fino alla scrittura: vedi `RicettaCandidata.sostituzioni`. */
  sostituzioni?: unknown[];
}

export interface ContoGiornata {
  kcal: number;
  /** Scostamento dal target in percentuale (negativo = sotto). `null` senza target. */
  scostamentoPct: number | null;
  /** `null` = non si può giudicare, ed è diverso da «va bene». */
  dentroTolleranza: boolean | null;
}

/**
 * Il totale della giornata contro il target.
 *
 * ⚠️ Senza target `dentroTolleranza` è **null**, non `true`: «non lo so» non è «va bene», ed è la
 * stessa distinzione che regge il resto del progetto. Chi chiama deve poter dire «il target non
 * c'è» invece di far passare una giornata come approvata da un controllo che non è stato fatto.
 */
export function contaGiornata(scelte: readonly SceltaGiornata[], targetKcal: number | null): ContoGiornata {
  const kcal = (scelte ?? []).reduce((n, s) => n + (Number.isFinite(s.kcal) ? s.kcal : 0), 0);
  if (!targetKcal || targetKcal <= 0) return { kcal, scostamentoPct: null, dentroTolleranza: null };
  const scostamentoPct = Math.round(((kcal - targetKcal) / targetKcal) * 1000) / 10;
  return { kcal, scostamentoPct, dentroTolleranza: Math.abs(scostamentoPct) <= TOLLERANZA_KCAL_PCT };
}
