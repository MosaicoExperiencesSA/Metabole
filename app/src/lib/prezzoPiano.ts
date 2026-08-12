/**
 * IL PREZZO CHE PAGHERÀ — non quello scritto sulla riga del piano.
 *
 * Decisione di Simone (12/8): «allineo tutti al prezzo che incassa».
 *
 * ## Il difetto da cui nasce
 *
 * Un piano ha due numeri: `priceCents` (il prezzo di vendita in promo) e `listPriceCents` (il
 * listino barrato). La regola è che **finché la promo è attiva** si vende a `priceCents`, e **quando
 * scade** si torna da sé al listino pieno, senza toccare il database.
 *
 * Il carrello quella regola la applica — è `commerce/prezzo-piano.ts`, lato server, ed è quella con
 * cui Stripe addebita. Il Negozio e la schermata del primo acquisto, invece, mostravano
 * `priceCents` **grezzo**. Con un listino presente e la promo scaduta: qui €249, allo scontrino €297.
 *
 * ⚠️ Oggi non si vede, perché nessun piano ha un listino valorizzato. Si accende con **un singolo
 * salvataggio** da Gestione Negozio, e chi lo farà non avrà nessun modo di sapere che sta armando
 * questo. Per quello si sistema adesso e non quando succede.
 *
 * Il server manda già `effectivePriceCents` insieme al resto (`listPlans`): qui si sceglie solo di
 * leggerlo. Il ripiego su `priceCents` serve alle risposte più vecchie, dove quel campo non c'era.
 */

export interface PianoConPrezzo {
  priceCents: number;
  /** Quello che il checkout addebiterà davvero. Lo calcola il server. */
  effectivePriceCents?: number | null;
  listPriceCents?: number | null;
  promoActive?: boolean | null;
}

/** Quanto pagherà. */
export function prezzoDaPagare(p: PianoConPrezzo): number {
  return typeof p.effectivePriceCents === 'number' ? p.effectivePriceCents : p.priceCents;
}

/**
 * Il prezzo **barrato** da mostrare accanto, o `null` se non c'è niente da barrare.
 *
 * ⚠️ Si barra solo quando la promo è **attiva**: a promo scaduta il listino non è più uno sconto
 * mancato, è il prezzo. Mostrarlo sbarrato vorrebbe dire vantare uno sconto che non si sta facendo.
 */
export function prezzoBarrato(p: PianoConPrezzo): number | null {
  if (!p.promoActive) return null;
  return typeof p.listPriceCents === 'number' && p.listPriceCents > prezzoDaPagare(p) ? p.listPriceCents : null;
}
