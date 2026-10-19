/**
 * QUANTO DI UN MESE È GIÀ STATO PAGATO (19/10/2026) — puro.
 *
 * Simone, 19/10, dopo aver registrato 99,90 € a MariaStella: *«le ho pagate a stella ma non le ha
 * scalate»*. Compensi mostrava il MATURATO del mese e basta: un pagamento non cambiava niente, e la
 * pagina continuava a dire «99,90» come se fossero ancora da dare.
 *
 * I pagamenti non sono legati a un mese: un bonifico è una cifra. Per dire quanto di OTTOBRE è
 * pagato si coprono i mesi **dal più vecchio**: prima si saldano i debiti più antichi, poi i nuovi.
 * È la stessa regola del portafoglio (il prelevabile è «mesi chiusi meno pagato»): un pagamento
 * copre prima il passato, e quello che avanza va sul mese in corso.
 *
 * ⚠️ Un mese negativo (più storni che provvigioni) abbassa il cumulato, e quindi lascia più pagato
 * per i mesi dopo: è giusto, quei soldi la persona li ha restituiti.
 */
export interface Pagato {
  maturatoCents: number;
  pagatoCents: number;
  daPagareCents: number;
}

/**
 * @param mesi maturato per mese `YYYY-MM` (tutti i mesi della persona, non solo quello guardato)
 * @param pagatoTotaleCents somma dei pagamenti fatti alla persona
 * @param periodo il mese guardato, o `null` per «Tutto»
 */
export function pagatoNelPeriodo(mesi: Map<string, number>, pagatoTotaleCents: number, periodo: string | null): Pagato {
  const pagato = Math.max(0, pagatoTotaleCents);
  if (periodo === null) {
    const maturato = [...mesi.values()].reduce((a, b) => a + b, 0);
    const coperto = Math.min(pagato, Math.max(0, maturato));
    return { maturatoCents: maturato, pagatoCents: coperto, daPagareCents: Math.max(0, maturato) - coperto };
  }
  let prima = 0;
  for (const [mese, cents] of mesi) if (mese < periodo) prima += cents;
  const maturato = mesi.get(periodo) ?? 0;
  const coperto = Math.min(Math.max(0, pagato - prima), Math.max(0, maturato));
  return { maturatoCents: maturato, pagatoCents: coperto, daPagareCents: Math.max(0, maturato) - coperto };
}
