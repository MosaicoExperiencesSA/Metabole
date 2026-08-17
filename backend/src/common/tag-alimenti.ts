/**
 * QUANDO IN UN TAG SOLO CI FINISCONO DUE ALIMENTI — caso Jolanda Todde, 17/8.
 *
 * Il questionario chiede i cibi non graditi con un campo **a tag**: una voce per alimento. Ma chi
 * lo compila scrive di getto, e in scheda a Jolanda è arrivata **una voce sola**, `"Carne .ceci"`.
 * Da lì in poi non ha escluso più niente: la stringa `carne .ceci` non compare nel nome né negli
 * ingredienti di nessun piatto, quindi né la carne né i ceci sono mai usciti dai suoi menu, e il
 * giorno dopo le è arrivata un'insalata di ceci.
 *
 * Il lato **lettura** è già chiuso (`expandExclusion` prova a spezzare un termine che non
 * riconosce, e questo vale subito anche sulle schede già sporche). Questo modulo è l'altra metà,
 * quella di **scrittura**: un dato scritto bene non ha bisogno di essere indovinato dopo, e in
 * scheda si legge «carne» e «ceci» invece di una voce che sembra un errore di battitura.
 *
 * ## ⚠️ La riga che conta: NON si spezza sugli spazi
 *
 * «Frutta a guscio», «insalata russa», «latte di mandorla», «olio di semi» sono **un alimento
 * solo**. Spezzarli sugli spazi trasformerebbe un'esclusione dichiarata in una molto più larga —
 * «frutta a guscio» diventerebbe «frutta», e toglierebbe alla cliente tutta la frutta — cioè un
 * danno fatto mentre si crede di star correggendo qualcosa. Qui stanno soltanto i segni che
 * separano e basta, più la «e» come parola intera.
 *
 * Vive in `common/` e non dentro `menu/exclusions.ts` per la stessa ragione di `nomi-alimento.ts`
 * (§16.9): a interrogarlo non è solo il motore dei menu — lo fa il questionario, lo fa il profilo
 * dell'app — e importare un file di `menu/` da lì sarebbe stato il primo passo verso una seconda
 * copia leggermente diversa.
 */

/** I segni con cui una persona separa due alimenti in un campo che ne aspettava uno. */
export const SEPARATORI_ALIMENTI = /\s*(?:[,;./|+&\n]|\s\be\b\s)\s*/;

/** Vero se in questa voce c'è più di un alimento. */
export const haPiuAlimenti = (termine: string): boolean =>
  (termine ?? '').split(SEPARATORI_ALIMENTI).filter((p) => p.trim().length >= 2).length > 1;

/**
 * Spezza le voci che ne contengono più d'una, tiene l'ordine e toglie i doppioni.
 *
 * ⚠️ Il confronto per i doppioni è sulla forma minuscola, ma **si salva quella scritta**: la scheda
 * la legge una persona, e «Ceci» scritto con la maiuscola è come l'ha scritto lei.
 */
export function spezzaTagAlimenti(termini: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const visti = new Set<string>();
  for (const raw of termini ?? []) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    // Una voce senza separatori esce identica: la stragrande maggioranza passa di qui.
    const pezzi = v.split(SEPARATORI_ALIMENTI).map((p) => p.trim()).filter((p) => p.length >= 2);
    for (const p of pezzi.length > 1 ? pezzi : [v]) {
      const chiave = p.toLowerCase();
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      out.push(p);
    }
  }
  return out;
}
