/**
 * Un importo in euro scritto a mano → centesimi, o `null` se non è un importo (19/10/2026).
 *
 * ⚠️ Il punto è ambiguo: «217.25» è un decimale scritto all'inglese, «1.217,25» un separatore delle
 * migliaia. Togliere sempre i punti trasformava «217.25» in 21.725 € — su una finestra che registra
 * un bonifico. Regola: se c'è una virgola, i punti sono migliaia; se non c'è, l'ultimo punto seguito
 * da una o due cifre è il decimale.
 */
export function centesimiDaTesto(testo: string): number | null {
  const t = testo.trim().replace(/\s+/g, '').replace(/€/g, '');
  if (!t) return null;
  let normale: string;
  if (t.includes(',')) normale = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normale = t.replace(/\./g, '');
  else normale = t;
  if (!/^\d+(\.\d{1,2})?$/.test(normale)) return null;
  return Math.round(parseFloat(normale) * 100);
}
