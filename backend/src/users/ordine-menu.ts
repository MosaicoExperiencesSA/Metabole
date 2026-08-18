/**
 * LA RIPULITURA DELL'ORDINE DEL MENU — e perché non può essere quella delle altre preferenze.
 *
 * Difetti 1 e 3 del foglio `progetto/DIFETTI_Ordine_Menu.md` (18/8). Fino a oggi `menuOrder` passava
 * dalla stessa `clean` di scorciatoie, moduli e grafici:
 *
 *   const clean = (keys, max) => Array.from(new Set(keys.filter((k) => typeof k === 'string'))).slice(0, max);
 *
 * Il `Set` è **giusto per quelle**, e giusto anche per le rotte qui dentro: la stessa voce due volte
 * nel menu non ha senso. Ma dall'11/8 l'ordine del menu non è più una lista di sole rotte: i TITOLI
 * dei gruppi vivono nella stessa lista, riconoscibili dal prefisso `#gruppo…` (scelta giusta a suo
 * tempo — evitava di migrare le preferenze già salvate — ma il dedup non lo sapeva).
 *
 * ⚠️ IL DIFETTO CHE NE VIENE, ED È PERDITA DI DATI SILENZIOSA. Due gruppi chiamati tutti e due
 * «Vendite» producono due righe identiche:
 *
 *   ["#gruppot:Vendite", "/crm", "#gruppot:Vendite", "/lead"]
 *                               └─ il Set la butta via
 *   → ["#gruppot:Vendite", "/crm", "/lead"]
 *
 * I due gruppi diventano uno, con dentro le voci di entrambi, senza un errore e senza un avviso.
 * Chi l'ha subìto riprova pensando di aver sbagliato.
 *
 * ⚠️ Modulo **puro**: nessun database e nessun Nest, così la regola si prova per tabella. È lo
 * stesso motivo per cui è nato: quattro difetti sono stati lì una settimana perché nessuno dei due
 * lati aveva un test.
 */

/** Il prefisso comune ai tre marcatori (`#gruppo:`, `#gruppoc:`, `#gruppot:`). Una rotta comincia con `/`. */
export const PREFISSO_GRUPPO = '#gruppo';

/** ⚠️ Il tetto è sulla RIGA INTERA, marcatore compreso: è quello che il DTO può controllare. */
export const LUNGHEZZA_MASSIMA_RIGA = 64;

/** Quante righe può avere l'ordine salvato. Era già 80: qui si conserva. */
export const RIGHE_MASSIME = 80;

/**
 * Ripulisce l'ordine del menu.
 *
 * ⚠️ Il dedup vale SOLO per le rotte: due titoli uguali sono due gruppi che una persona ha voluto,
 * e toglierne uno le fonde le voci senza dirglielo. I marcatori passano sempre.
 *
 * ⚠️ Il `trim` non è pignoleria (difetto 3): senza, «Vendite » e «Vendite» sono due gruppi diversi
 * e niente lo dice — e con il difetto 1 di mezzo, quale dei due sopravviveva dipendeva da dove era
 * caduto lo spazio.
 *
 * ⚠️ E il taglio a 64 è **lato server**, dove conta: nell'editor la casella ha `maxLength={24}`, ma
 * il limite del browser non è un limite — vale per chi usa la schermata, non per chi parla con
 * l'API, e una chiamata diretta poteva salvare un titolo da cinquemila caratteri che la barra
 * laterale poi disegnava.
 */
export function puliscoOrdineMenu(
  righe: readonly unknown[],
  max = RIGHE_MASSIME,
  lunghezza = LUNGHEZZA_MASSIMA_RIGA,
): string[] {
  const viste = new Set<string>();
  const out: string[] = [];
  for (const r of righe ?? []) {
    if (typeof r !== 'string') continue;
    const s = r.trim();
    if (!s) continue;
    /**
     * ⚠️ Il taglio viene PRIMA del dedup, non dopo. Due rotte lunghe che differiscono solo dopo il
     * sessantaquattresimo carattere diventano la stessa riga una volta tagliate: deduplicarle prima
     * ne lascerebbe due identiche nella lista salvata.
     */
    const riga = s.slice(0, lunghezza);
    if (!riga.startsWith(PREFISSO_GRUPPO)) {
      if (viste.has(riga)) continue;
      viste.add(riga);
    }
    out.push(riga);
    if (out.length >= max) break;
  }
  return out;
}
