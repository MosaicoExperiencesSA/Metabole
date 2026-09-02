/**
 * ⛔ **I DUE PULSANTI DEI PANIERI — «solo attive» e «solo in bozza».**
 *
 * Richiesta di Simone (2/9): «due pulsanti: mostra solo attive e mostra solo in bozza… e ovviamente
 * se entrambi disattivato mostra tutto».
 *
 * ⚠️ **Il filtro vale per tutta la pagina, non solo per l'elenco che si apre.** La matrice dei
 * panieri scrive `84 (60)` — 84 piatti, 60 che il motore userebbe davvero: un filtro che cambiasse
 * l'elenco sotto e lasciasse i numeri sopra farebbe leggere due verità diverse nella stessa
 * schermata, ed è il modo più veloce per non fidarsi più di nessuna delle due.
 *
 * ⛔ **Entrambi accesi = entrambi spenti = tutto.** Non è una scorciatoia: «attive» e «bozze» sono
 * le uniche due possibilità, quindi la loro unione È il totale. Un terzo stato che mostra meno di
 * quello che chiedono i due pulsanti accesi sarebbe una bugia.
 */

/** Quanti piatti ci sono, e quanti di quelli il motore userebbe davvero. */
export interface Conteggio {
  piatti: number;
  attivi: number;
}

/** Lo stato dei due pulsanti. */
export interface Filtro {
  attive: boolean;
  bozze: boolean;
}

export const NESSUN_FILTRO: Filtro = { attive: false, bozze: false };

/** ⚠️ Vero quando i pulsanti non stanno chiedendo di nascondere niente: nessuno o tutti e due. */
export const mostraTutto = (f: Filtro): boolean => f.attive === f.bozze;

/** Una ricetta passa il filtro? ⚠️ `attiva` è il campo del database, non un'etichetta. */
export function passaIlFiltro(attiva: boolean, f: Filtro): boolean {
  if (mostraTutto(f)) return true;
  return attiva ? f.attive : f.bozze;
}

/**
 * Cosa scrivere in una cella della matrice.
 *
 * ⚠️ Col filtro acceso il numero **fra parentesi sparisce**, e deve sparire: `60 (60)` non aggiunge
 * niente e fa pensare a due misure diverse che tornano per caso. Le parentesi rispondono alla
 * domanda «quanti di questi arrivano davvero?», che con un filtro acceso non si pone più.
 */
export function numeriDaMostrare(c: Conteggio, f: Filtro): { quanti: number; fraParentesi: number | null } {
  if (mostraTutto(f)) return { quanti: c.piatti, fraParentesi: c.attivi };
  if (f.attive) return { quanti: c.attivi, fraParentesi: null };
  /**
   * ⛔ **`Math.max(0, …)`, e non è prudenza inutile.** I due numeri arrivano da due conteggi
   * distinti dell'API: se un giorno divergessero, «−3 piatti in bozza» sarebbe un numero che non
   * vuol dire niente scritto dove qualcuno decide cosa mangiano le clienti. Meglio zero, che è
   * falso in modo innocuo, che un negativo, che manda a cercare un guasto inesistente.
   */
  return { quanti: Math.max(0, c.piatti - c.attivi), fraParentesi: null };
}

/** ⚠️ La frase che dice cosa si sta guardando: senza, un filtro acceso è un numero sbagliato. */
export function comeSiLegge(f: Filtro): string | null {
  if (mostraTutto(f)) return null;
  return f.attive
    ? 'Stai guardando solo le ricette ATTIVE: i numeri qui sotto sono i piatti che il motore userebbe davvero, non quanti ce ne sono in paniere.'
    : 'Stai guardando solo le BOZZE: i numeri qui sotto sono i piatti che stanno nel paniere ma a nessuna cliente arrivano, finché qualcuno non li valida.';
}
