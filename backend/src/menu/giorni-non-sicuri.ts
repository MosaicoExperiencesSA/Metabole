import { EsclusioniCliente, RicettaDaValutare, valutaRicetta } from './esclusioni-della-cliente';

/**
 * **QUALI GIORNATE GIÀ SCRITTE NON REGGONO PIÙ IL CONTROLLO DI OGGI.**
 *
 * Serve dopo una correzione che cambia cosa è sicuro: `MenuDay` è uno **snapshot** e l'upsert ha
 * `update: {}`, quindi una giornata già in calendario non si corregge da sola — resta com'era il
 * giorno in cui è stata composta, con il codice di allora.
 *
 * ⛔ Le domande sono **due**, e la seconda è quella che il 31/8 nessuno faceva:
 *
 *  1. il piatto **si potrebbe servire?** (`violations`) — la giornata col gamberone di una allergica
 *     ai crostacei;
 *  2. se il piatto si serve **con una sostituzione**, quella sostituzione **è scritta sul pasto?**
 *     (`subs`) — la merenda con le albicocche secche di una allergica ai solfiti, entrata da una
 *     porta che le sostituzioni non le calcolava. Il piatto era ammissibile; quello che mancava era
 *     la riga che dice alla cliente cosa non mettere.
 *
 * ⚠️ Non guarda le date e non decide se un giorno si può cancellare: quella è la porta unica di
 * `vera/menu-da-rifare.ts` (`codaDaRifare`), e resta l'unica a saperlo.
 */

/** Un pasto dello snapshot, per quel poco che serve qui. */
export interface PastoScritto {
  slot?: string;
  recipeId?: string;
  name?: string;
  substitutions?: { from?: string; to?: string; reason?: string }[];
}

export interface PastoDaSistemare {
  slot: string;
  recipeId: string;
  /** Come lo legge una persona: la violazione, o la sostituzione che manca. */
  motivo: string;
}

const pasti = (meals: unknown): PastoScritto[] =>
  Array.isArray(meals) ? (meals as PastoScritto[]).filter((m) => !!m && typeof m === 'object') : [];

/**
 * I pasti di una giornata che oggi non passerebbero.
 *
 * @param meals lo snapshot `MenuDay.meals`.
 * @param ricette le ricette nominate, per id: servono nome, ingredienti e **tag allergene**.
 */
export function pastiDaSistemare(
  meals: unknown,
  ricette: ReadonlyMap<string, RicettaDaValutare>,
  e: EsclusioniCliente,
): PastoDaSistemare[] {
  if (e.vuoto) return [];
  const fuori: PastoDaSistemare[] = [];
  for (const m of pasti(meals)) {
    const id = typeof m.recipeId === 'string' ? m.recipeId : '';
    const r = id ? ricette.get(id) : undefined;
    if (!r) continue;
    const { violations, subs } = valutaRicetta(r, e);
    const slot = typeof m.slot === 'string' ? m.slot : '?';
    if (violations.length) {
      fuori.push({ slot, recipeId: id, motivo: violations[0] });
      continue;
    }
    /**
     * ⛔ **SOLO LE SOSTITUZIONI DI SICUREZZA**, cioè quelle che nascono da un'allergia o da
     * un'intolleranza. `valutaRicetta` ne produce anche per i cibi **non graditi** (`cipolla →
     * porro`), e contarle qui sarebbe un disastro silenzioso: basta che una cliente scriva
     * «cipolla» fra i non graditi dopo che il calendario è composto perché ogni sua giornata
     * risulti «da rifare» e la coda si porti via l'intero futuro — per una preferenza di gusto,
     * sotto un cartello che dice «sicurezza». Trovato in revisione il 31/8, prima di girarlo.
     */
    const diSicurezza = subs.filter((s) => s.reason !== 'non gradito');
    if (!diSicurezza.length) continue;
    const scritte = new Map(
      (m.substitutions ?? [])
        .map((s) => [String(s?.from ?? '').toLowerCase().trim(), String(s?.to ?? '').toLowerCase().trim()] as const)
        .filter(([from]) => !!from),
    );
    /**
     * Due modi di non andare bene, e il secondo non è teorico: la mappa dei solfiti è cambiata più
     * volte, e una riga scritta con la mappa vecchia («vino → vino analcolico» dove oggi la regola
     * dice «si toglie») ha il `from` giusto e manda in tavola il sostituto sbagliato. Quello che la
     * cliente mangia è il `to`.
     */
    const mancante = diSicurezza.find((s) => !scritte.has(String(s.from ?? '').toLowerCase().trim()));
    const diversa = diSicurezza.find((s) => {
      const scritta = scritte.get(String(s.from ?? '').toLowerCase().trim());
      return scritta !== undefined && scritta !== String(s.to ?? '').toLowerCase().trim();
    });
    if (mancante) {
      fuori.push({
        slot,
        recipeId: id,
        motivo: `${r.name}: manca la sostituzione «${mancante.from} → ${mancante.to}» (${mancante.reason})`,
      });
    } else if (diversa) {
      fuori.push({
        slot,
        recipeId: id,
        motivo: `${r.name}: la sostituzione scritta per «${diversa.from}» non è più quella giusta (oggi: «${diversa.to}»)`,
      });
    }
  }
  return fuori;
}
