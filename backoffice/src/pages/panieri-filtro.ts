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
  /**
   * ⛔ **Le due colonne del 4/9** (Simone: *«mi serve un altro filtro "Verificato" che nasconde le
   * verificate»*). Sono **due** e non una perché il terzo pulsante si **incrocia** con i primi due:
   * «solo attive» + «nascondi verificate» chiede le attive-non-verificate, che da `attivi` e
   * `verificate` presi separatamente non si ricava.
   */
  verificate: number;
  attiveVerificate: number;
}

/**
 * Lo stato dei pulsanti.
 *
 * ⚠️ **`nascondiVerificate` è un ASSE A PARTE**, non un terzo valore di `attive`/`bozze`: quelli
 * due dicono *quali piatti*, questo dice *quali di quelli*. Metterlo nella stessa terna avrebbe
 * voluto dire non poter più chiedere «le attive che mi mancano da verificare», che è la domanda per
 * cui il pulsante esiste.
 */
export interface Filtro {
  attive: boolean;
  bozze: boolean;
  nascondiVerificate: boolean;
}

export const NESSUN_FILTRO: Filtro = { attive: false, bozze: false, nascondiVerificate: false };

/** ⚠️ Vero quando i pulsanti non stanno chiedendo di nascondere niente: nessuno o tutti e due. */
export const mostraTutto = (f: Filtro): boolean => f.attive === f.bozze;

/**
 * Una ricetta passa il filtro? ⚠️ `attiva` e `verificata` sono campi del database, non etichette.
 *
 * ⚠️ **I due assi si applicano in fila**: prima si guarda se il piatto è del tipo che si sta
 * chiedendo, poi se la spunta lo esclude. `verificata` è opzionale perché una schermata che ancora
 * non lo manda non deve smettere di filtrare per stato — «non lo so» qui vale «non verificata», che
 * è il ripiego che **mostra di più**, e mostrare di più è l'errore innocuo dei due.
 */
export function passaIlFiltro(attiva: boolean, f: Filtro, verificata = false): boolean {
  if (f.nascondiVerificate && verificata) return false;
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
  /**
   * ⛔ **Il terzo pulsante toglie da OGNI conto, non da uno solo.** È la stessa regola dei primi
   * due, scritta in cima a questo file: un filtro che cambiasse l'elenco sotto e lasciasse i numeri
   * sopra farebbe leggere due verità diverse nella stessa schermata.
   *
   * ⚠️ E le parentesi spariscono anche qui: «quanti di questi arrivano davvero» è una domanda che
   * con un filtro acceso non si pone più.
   */
  if (f.nascondiVerificate) {
    const senzaSpunta = (tot: number, verificate: number) => Math.max(0, tot - verificate);
    if (mostraTutto(f)) {
      return { quanti: senzaSpunta(c.piatti, c.verificate), fraParentesi: senzaSpunta(c.attivi, c.attiveVerificate) };
    }
    if (f.attive) return { quanti: senzaSpunta(c.attivi, c.attiveVerificate), fraParentesi: null };
    /** Le bozze non verificate: tutte meno le attive, meno le verificate che non erano attive. */
    return {
      quanti: Math.max(0, (c.piatti - c.attivi) - (c.verificate - c.attiveVerificate)),
      fraParentesi: null,
    };
  }
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
  const perStato = mostraTutto(f)
    ? null
    : f.attive
      ? 'Stai guardando solo le ricette ATTIVE: i numeri qui sotto sono i piatti che il motore userebbe davvero, non quanti ce ne sono in paniere.'
      : 'Stai guardando solo le BOZZE: i numeri qui sotto sono i piatti che stanno nel paniere ma a nessuna cliente arrivano, finché qualcuno non li valida.';
  /** ⚠️ Le due frasi si sommano quando i due assi sono accesi tutti e due: sono due restrizioni. */
  const perSpunta = f.nascondiVerificate
    /** ⚠️ MAIUSCOLE e non asterischi, come le due frasi qui sopra: il banner non disegna il markdown. */
    ? 'Le ricette già VERIFICATE dalla nutrizionista sono nascoste: qui sotto c\'è quello che resta da guardare.'
    : null;
  return [perStato, perSpunta].filter(Boolean).join(' ') || null;
}
