/**
 * §16.7 — LE REGOLE DELLA PRENOTAZIONE, senza database.
 *
 * Tre decisioni di Simone (12/8) e una conseguenza scomoda di ognuna.
 */

/**
 * Fin quando la cliente può spostare o disdire da sola.
 *
 * Ventiquattr'ore, deciso il 12/8. Sotto quella soglia il pulsante sparisce e le si dice di
 * scrivere alla coach: non è un muro, è il punto in cui la decisione torna a una persona. Due ore
 * avrebbero lasciato il nutrizionista con un buco in agenda a metà mattina senza il tempo di
 * riempirlo; nessun limite avrebbe reso la sua giornata impossibile da programmare.
 */
export const ORE_PER_MODIFICARE = 24;

/** Quante ore mancano all'appuntamento. Negativo se è già passato. */
export const oreAll = (inizio: Date, adesso = new Date()): number =>
  (inizio.getTime() - adesso.getTime()) / 3_600_000;

export const siPuoModificare = (inizio: Date, adesso = new Date()): boolean =>
  oreAll(inizio, adesso) >= ORE_PER_MODIFICARE;

/**
 * La frase da dire quando è troppo tardi. Dice **quanto** manca, non solo che è tardi: «mancano
 * 3 ore» spiega da sé perché il pulsante non c'è, «non puoi più modificarlo» no.
 */
export function testoTroppoTardi(inizio: Date, adesso = new Date()): string {
  const ore = oreAll(inizio, adesso);
  if (ore < 0) return 'Quell\'appuntamento è già passato.';
  const quanto = ore < 1 ? 'meno di un\'ora' : `${Math.floor(ore)} or${Math.floor(ore) === 1 ? 'a' : 'e'}`;
  return (
    `Mancano ${quanto} all'appuntamento, e da qui si può spostare o disdire fino a ` +
    `${ORE_PER_MODIFICARE} ore prima. Scrivi alla tua coach: ci pensa lei. 💚`
  );
}

/** Una riga del carrello, come sta dentro `Order.items`. */
export interface RigaOrdine {
  productId?: string | null;
  qty?: number | null;
}

/**
 * Quante visite dà un ordine, dato quante ne dà ogni prodotto.
 *
 * ⚠️ Le quantità mancanti o storte valgono **1** e non 0: `items` è un JSON scritto anni fa da un
 * altro pezzo di codice, e leggere «zero visite» da un ordine che una visita l'ha pagata sarebbe il
 * modo peggiore di sbagliare — la cliente ha pagato e non può prenotare, senza nessun errore da
 * nessuna parte. Nel dubbio si concede, e il nutrizionista vede l'appuntamento in agenda.
 */
export function visiteConcesseDa(items: RigaOrdine[], visitePerProdotto: Map<string, number>): number {
  let totale = 0;
  for (const r of items ?? []) {
    if (!r?.productId) continue;
    const perUno = visitePerProdotto.get(r.productId) ?? 0;
    if (perUno <= 0) continue;
    const qta = Number.isFinite(Number(r.qty)) && Number(r.qty) > 0 ? Math.floor(Number(r.qty)) : 1;
    totale += perUno * qta;
  }
  return totale;
}

/**
 * Il credito: quante visite può ancora prenotare.
 *
 * ⚠️ Le visite ANNULLATE non consumano il credito. È la conseguenza diretta di «se il cliente
 * disdice lo slot torna libero»: se lo slot torna libero ma il diritto no, la cliente ha pagato una
 * visita e ne ha zero — e la disdetta diventa una trappola.
 */
export const creditoVisite = (concesse: number, prenotateNonAnnullate: number): number =>
  Math.max(0, concesse - prenotateNonAnnullate);
