/**
 * «NELLA MEDITERRANEA NON DEVE COMPARIRE PIÙ IL TONNO» — il divieto che vale per una DIETA.
 *
 * §6.2 del passaggio di consegne, e l'unico pezzo di Vera che tocca la strada che porta il pasto nel
 * piatto di domani. Fino al 13/8 l'assistente riconosceva la frase e apriva una proposta, ma alla
 * fine rispondeva onestamente che non la sapeva applicare: **l'esclusione a livello di dieta non
 * esisteva**. Le primitive di `menu/exclusions.ts` sono agnostiche, ma ogni chiamante costruiva le
 * chiavi dal `ClientProfile` e da nient'altro.
 *
 * ## Dove vive
 *
 * In `ProductRule` (`{dietId, ruleCode, enabled, params}`), che esiste già ed è unica su
 * `[dietId, ruleCode]`: **nessuna migrazione**. ⚠️ Si legge **a parte** e non da
 * `dietRuleOverrides`, che tiene una mappa di numeri e booleani e scarterebbe una lista di parole.
 *
 * ## Le tre cose che non si negoziano
 *
 * 1. ⚠️ **Il divieto è una lista di TERMINI, non di ricette.** Vietare gli id delle ricette di oggi
 *    lascerebbe passare la ricetta col tonno pubblicata domani — ed è esattamente il difetto del
 *    dizionario che invecchia, già pagato una volta.
 * 2. ⚠️ **Si guarda il nome E gli ingredienti**, con le stesse parole di `expandExclusion`: «tonno»
 *    deve prendere anche «insalata di riso» che ha il tonno dentro, o il divieto è una decorazione.
 * 3. ⚠️ **Chi resta scoperta si salta e si segnala** (decisione di Simone, 13/8): la regola vale per
 *    tutte le altre, e chi rimarrebbe senza un pasto resta com'era e finisce in un elenco con nome e
 *    cognome. Applicarla lo stesso vorrebbe dire far scegliere a un ripiego muto cosa mangia una
 *    persona; bloccare tutto vorrebbe dire che una cliente con un catalogo povero ferma una regola
 *    giusta per le altre trecento.
 */
import { expandExclusion } from '../menu/exclusions';

/** Il codice della regola dentro `ProductRule`. Uno solo, e non uno per termine. */
export const RULE_CODE_ESCLUSIONI = 'diet_excluded_terms';

export interface RigaProductRule {
  ruleCode: string;
  enabled: boolean;
  params: unknown;
}

/**
 * I termini vietati su questa dieta, dalle righe di `ProductRule`.
 *
 * ⚠️ Le righe spente non contano: spegnere una regola è il modo di toglierla senza perdere la
 * traccia di chi l'aveva messa.
 */
export function terminiVietati(rows: readonly RigaProductRule[]): string[] {
  const out: string[] = [];
  for (const r of rows ?? []) {
    if (r.ruleCode !== RULE_CODE_ESCLUSIONI || !r.enabled) continue;
    const p = (r.params ?? {}) as { termini?: unknown };
    for (const t of Array.isArray(p.termini) ? p.termini : []) {
      const v = typeof t === 'string' ? t.trim().toLowerCase() : '';
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/** Tutte le parole da cercare: il termine più quelle che `expandExclusion` gli attacca dietro. */
export function paroleVietate(termini: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of termini) for (const p of expandExclusion(t)) if (p) out.add(p.toLowerCase());
  return [...out];
}

export interface RicettaDaFiltrare {
  id: string;
  name?: string | null;
  ingredients?: unknown;
}

/** Il testo in cui cercare: nome + ingredienti, come fa `menu/exclusions.ts` per le clienti. */
function testoDi(r: RicettaDaFiltrare): string {
  const ing = Array.isArray(r.ingredients)
    ? (r.ingredients as unknown[])
        .map((i) => (typeof i === 'string' ? i : ((i ?? {}) as { name?: string }).name ?? ''))
        .join(' ')
    : typeof r.ingredients === 'string'
      ? r.ingredients
      : '';
  return `${r.name ?? ''} ${ing}`.toLowerCase();
}

/** Gli id delle ricette che questa dieta non può più usare. */
export function ricetteVietate(ricette: readonly RicettaDaFiltrare[], termini: readonly string[]): Set<string> {
  const parole = paroleVietate(termini);
  const fuori = new Set<string>();
  if (!parole.length) return fuori;
  for (const r of ricette) {
    const testo = testoDi(r);
    if (parole.some((p) => testo.includes(p))) fuori.add(r.id);
  }
  return fuori;
}

export interface SlotScoperto {
  slot: string;
  rimaste: number;
}

/**
 * Cosa resterebbe di una giornata togliendo quelle ricette.
 *
 * ⚠️ Uno slot con **zero** ricette è una cliente senza quel pasto: è il caso in cui non si applica.
 * Uno slot con una sola ricetta non è scoperto, ma è fragile — si racconta, non si blocca.
 */
export function slotScoperti(
  slotPool: ReadonlyMap<string, ReadonlySet<string>>,
  vietate: ReadonlySet<string>,
): SlotScoperto[] {
  const out: SlotScoperto[] = [];
  for (const [slot, ricette] of slotPool) {
    let rimaste = 0;
    for (const id of ricette) if (!vietate.has(id)) rimaste++;
    if (rimaste === 0) out.push({ slot, rimaste });
  }
  return out;
}
