/**
 * QUALI PASTI CHIEDE IL POPUP «Com'è andata ieri?».
 *
 * ⚠️ Prima li prendeva da `/me/menu`, cioè dal MENU del giorno: chiedeva le stelle di tutti i piatti
 * di ieri, **anche di quelli già votati**. Il server ha da sempre la rotta giusta,
 * `GET /me/ratings/pending`, che torna i pasti degli ultimi tre giorni ancora **senza** valutazione —
 * e nessuno la chiamava (trovata il 16/8 in un giro sistematico sulle rotte `/me/*`, voce 253).
 *
 * Si vedeva su due strade: chi valuta un piatto da un'altra schermata se lo ritrova nel popup, e chi
 * apre l'app da un **secondo dispositivo** ricomincia da capo, perché il «già visto» di oggi vive nel
 * `localStorage` di quel telefono, mentre le valutazioni stanno sul server.
 *
 * ⚠️ Il filtro sul giorno resta: la rotta torna tre giorni, il popup ne chiede **uno**. Portare in
 * primo piano anche l'altro ieri non è una correzione, è una domanda in più a una persona che ne
 * aspettava una — e va decisa, non fatta di straforo.
 *
 * Modulo puro: qui non si chiama niente, così la regola si prova per tabella.
 */

export interface PastoDaValutare {
  /** `YYYY-MM-DD`, come lo scrive il server. */
  date: string;
  slot: string;
  recipeId: string;
  name: string;
}

/**
 * I pasti da mettere nel popup, dato quello che il server dice ancora da valutare.
 *
 * ⚠️ Lo stesso piatto due volte nello stesso giorno si chiede **una volta sola**: la valutazione è
 * unica per (cliente, ricetta, giorno) — chiederla due volte vorrebbe dire far rispondere due volte
 * per scrivere una riga sola, e la seconda risposta cancellerebbe la prima senza dirlo.
 */
export function valutazioniDaChiedere(
  pending: readonly PastoDaValutare[] | null | undefined,
  giorno: string,
): PastoDaValutare[] {
  const visti = new Set<string>();
  const out: PastoDaValutare[] = [];
  for (const p of pending ?? []) {
    if (!p?.recipeId || !p.date) continue;
    if (p.date.slice(0, 10) !== giorno) continue;
    if (visti.has(p.recipeId)) continue;
    visti.add(p.recipeId);
    out.push(p);
  }
  return out;
}
