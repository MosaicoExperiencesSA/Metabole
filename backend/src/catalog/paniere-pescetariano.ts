import { eCarne, ePesce } from './piatto-di-cosa';

/**
 * IL PANIERE PESCETARIANO SI DERIVA, NON SI SCRIVE — Fase 5 del piano panieri.
 *
 * Un paniere pescetariano di una famiglia è:
 *
 *     paniere VEGETARIANO della stessa famiglia  +  i piatti di PESCE di quello onnivoro
 *
 * ⚠️ **È un'assegnazione, non una generazione.** Non si scrive una ricetta nuova: si dice che una
 * ricetta che esiste già appartiene anche a questo paniere. Dei dieci panieri pescetariani, nove
 * erano vuoti — ed era atteso: nessuno li ha mai riempiti a mano, e riempirli a mano sarebbe stato
 * riscrivere piatti che ci sono.
 *
 * ⛔ **IL PESCE NON SI RICONOSCE CON UN ELENCO NUOVO.** `menu/exclusions.ts` ha già 67 termini per
 * «pesce» (erano 12 fino al 23/8), più crostacei e molluschi, ed è la stessa porta che tiene al
 * sicuro chi è allergico. Due elenchi di pesci sono due elenchi che un giorno divergono — e il
 * giorno che divergono, quello sbagliato è sempre quello che nessuno stava guardando.
 */

/** Cosa c'è dentro un piatto, dal punto di vista di chi mangia pesce ma non carne. */
export type Verdetto = 'pesce' | 'carne' | 'ne_carne_ne_pesce';

/**
 * ⛔ **Si guardano TUTTI gli ingredienti, non solo il principale.** Per la regola delle colazioni
 * conta di cosa *è* il piatto, e lì l'ingrediente principale è la domanda giusta. Qui la domanda è
 * un'altra — «questa persona può mangiarlo?» — e a quella risponde **qualunque** grammo di carne:
 * un risotto con una julienne di speck è un risotto, ma non è un piatto per una pescetariana.
 *
 * ⚠️ E la carne vince sul pesce: un piatto che ha tutti e due resta fuori. Non è un caso di scuola
 * — «mare e monti» esiste.
 */
export function verdettoPescetariano(nome: string, ingredienti: readonly string[]): Verdetto {
  const pezzi = [nome, ...ingredienti].filter((x) => typeof x === 'string' && x.trim() !== '');
  if (pezzi.some((p) => eCarne(p))) return 'carne';
  if (pezzi.some((p) => ePesce(p))) return 'pesce';
  return 'ne_carne_ne_pesce';
}

export interface RigaDiPaniere {
  slot: string;
  recipeId: string;
}

/**
 * Le righe del paniere pescetariano di una famiglia, derivate.
 *
 * ⚠️ Le ricette già presenti nel paniere pescetariano restano: la derivazione **aggiunge**, non
 * sostituisce. Il decimo paniere, quello non vuoto, è stato riempito da qualcuno e non si cancella
 * perché un conto automatico la pensa diversamente.
 *
 * ⛔ E i doppioni si tolgono qui, non nel database: la stessa ricetta può stare nel paniere
 * vegetariano e — per una variante diversa — anche in quello onnivoro. `@@unique` la fermerebbe con
 * un errore, cioè fermerebbe tutta la migrazione per una cosa che non è un problema.
 */
export function righeDerivate(opzioni: {
  giaNelPescetariano: readonly RigaDiPaniere[];
  dalVegetariano: readonly RigaDiPaniere[];
  dallOnnivoro: readonly RigaDiPaniere[];
  /** Il verdetto per una ricetta: lo decide chi chiama, che ha i nomi e gli ingredienti. */
  verdetto: (recipeId: string) => Verdetto;
}): { daAggiungere: RigaDiPaniere[]; scartatePerCarne: number } {
  const { giaNelPescetariano, dalVegetariano, dallOnnivoro, verdetto } = opzioni;
  const chiave = (r: RigaDiPaniere) => `${r.slot}|${r.recipeId}`;
  const viste = new Set(giaNelPescetariano.map(chiave));
  const daAggiungere: RigaDiPaniere[] = [];
  let scartatePerCarne = 0;

  const aggiungi = (r: RigaDiPaniere) => {
    const k = chiave(r);
    if (viste.has(k)) return;
    viste.add(k);
    daAggiungere.push(r);
  };

  /**
   * ⚠️ Il paniere vegetariano entra **tutto**, senza passare dal verdetto: quelle ricette sono già
   * state approvate come vegetariane da una nutrizionista, e rileggerle con un elenco di parole
   * vorrebbe dire far vincere le parole sulla firma di una persona. Se una di quelle è marcata male
   * il difetto è nel paniere vegetariano, e si corregge lì — non qui di sponda.
   */
  for (const r of dalVegetariano) aggiungi(r);

  for (const r of dallOnnivoro) {
    const v = verdetto(r.recipeId);
    if (v === 'carne') { scartatePerCarne += 1; continue; }
    // ⛔ Solo il pesce. Un piatto onnivoro senza né carne né pesce resta fuori: se fosse davvero
    // vegetariano starebbe nel paniere vegetariano, e se non c'è è perché nessuno l'ha detto.
    if (v !== 'pesce') continue;
    aggiungi(r);
  }

  return { daAggiungere, scartatePerCarne };
}
