/**
 * TOGLIERE UN GIORNO DAL MENU, E FAR SCORRERE INDIETRO QUELLI DOPO — logica pura.
 *
 * Richiesta di Simone del 7/9: «per ogni giorno di menu dobbiamo mettere la ✕ in un angolino in
 * modo che admin e nutrizionista possano cancellare un giorno; se è in mezzo scorrono i successivi
 * in riempimento» · e, alla domanda su quali giorni, «da oggi in poi, oggi compreso».
 *
 * ## ⛔ Perché lo scorrimento non è un dettaglio di comodo: è la sola forma sicura
 *
 * `deliverIfEligible` **non cerca i buchi**: guarda l'**ultimo** giorno in calendario, esce se è
 * oltre oggi, e compone da lì in avanti. Quindi cancellare un giorno che ne lascia uno più avanti
 * apre un buco **permanente** — la cliente apre l'app in quella data e trova «menu in preparazione»,
 * per sempre, senza un errore da nessuna parte. È il difetto raccontato per esteso in
 * `una-porta-per-i-giorni.spec.ts`, vissuto dieci giorni in produzione su tre percorsi.
 *
 * ⚠️ Fin qui l'unica risposta era **cancellare tutta la coda** e ricomporla. Qui la risposta è
 * un'altra e la dà Simone: i giorni dopo **scalano di uno**, quindi il buco non si apre perché
 * non resta nessun vuoto in mezzo — e quello che si libera è l'**ultima** data, cioè esattamente
 * dove `deliverIfEligible` sa comporre. Il contenuto delle giornate seguenti non si butta: si
 * sposta.
 *
 * ## ⚠️ Si scorrono TUTTI i giorni dopo, buchi compresi — e la ragione è aritmetica
 *
 * Se il calendario ha già un vuoto (10, 11, 12, ⟂13, 14, 15) la tentazione è fermarsi al primo
 * salto. ⛔ Fermarsi **allarga** il buco: togliendo l'11 e spostando solo il 12 resterebbero
 * scoperti il 12 **e** il 13, cioè due giorni al posto di uno. Scorrendo tutto, il vuoto resta uno
 * e si sposta indietro di un giorno — e in fondo si libera una data, che è quello che serve.
 *
 * Un calendario con dei vuoti è già malato: questo modulo non lo cura e non lo peggiora.
 *
 * ## ⚠️ L'ordine degli spostamenti non è cosmesi
 *
 * `MenuDay` ha `@@unique([clientId, date])`. Gli spostamenti escono **in ordine di data crescente**
 * perché vanno applicati in quell'ordine: il primo prende la data appena liberata dalla
 * cancellazione, il secondo quella appena liberata dal primo, e così via. Applicati al contrario, o
 * tutti insieme, il database rifiuta il primo che incontra una data ancora occupata.
 *
 * ## Le date sono stringhe, di proposito
 *
 * `MenuDay.date` è una colonna `@db.Date`: un **valore-giorno**, non un istante. Qui si ragiona su
 * `AAAA-MM-DD` e si toglie un giorno con l'aritmetica UTC, dove l'ora legale non esiste. Passare
 * dai `Date` locali vorrebbe dire che l'ultima domenica di ottobre un giorno ne vale 23 ore, e uno
 * dei tre spostamenti cadrebbe sulla data sbagliata — una volta l'anno, su una cliente sola.
 */

/** Un giorno in calendario: quello che serve per decidere, e niente di più. */
export interface GiornoInCalendario {
  id: string;
  /** `AAAA-MM-DD`. */
  giorno: string;
}

/** Uno spostamento da applicare: quel giorno passa da `da` a `a`. */
export interface Spostamento {
  id: string;
  da: string;
  a: string;
}

export type EsitoTogli =
  | { si: false; perche: string }
  | {
      si: true;
      /** L'id della riga da cancellare. */
      idDaCancellare: string;
      /** Il giorno che sparisce, per il racconto e per l'audit. */
      giornoTolto: string;
      /** In ordine di data CRESCENTE: vanno applicati in quest'ordine. */
      spostamenti: Spostamento[];
      /**
       * L'ultima data del calendario, che dopo gli spostamenti resta vuota: è lì che il motore
       * ricomporrà. `null` quando non c'era nessun giorno dopo quello tolto — in quel caso il
       * calendario si accorcia e basta, che è la coda di sempre.
       */
      dataLiberata: string | null;
    };

/** `2026-09-07` → `2026-09-06`. Aritmetica UTC: sui valori-giorno l'ora legale non esiste. */
export function giornoPrimaDi(giorno: string): string {
  const [a, m, g] = giorno.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Cosa fare per togliere quel giorno.
 *
 * `calendario` sono **tutti** i giorni della cliente (l'ordine di partenza non conta: si ordina
 * qui). `oggi` è il giorno di Roma, e lo passa il chiamante — questo modulo non guarda l'orologio,
 * così le prove non aspettano la mezzanotte.
 */
export function toglieUnGiorno(input: {
  calendario: readonly GiornoInCalendario[];
  idDaTogliere: string;
  oggi: string;
}): EsitoTogli {
  const { calendario, idDaTogliere, oggi } = input;
  const ordinati = [...calendario].sort((x, y) => x.giorno.localeCompare(y.giorno));
  const tolto = ordinati.find((g) => g.id === idDaTogliere);
  if (!tolto) return { si: false, perche: 'Questo giorno non è più in calendario: forse è già stato tolto.' };

  /**
   * ⛔ **Un giorno già vissuto non si fa scorrere.** Spostare indietro i giorni successivi
   * riscriverebbe date che la cliente ha già aperto, valutato e su cui ha fatto la spesa: lo storico
   * smetterebbe di dire cosa ha mangiato davvero. Oggi sì — l'ha deciso Simone il 7/9 — e con
   * l'avvertenza scritta accanto al pulsante: se ha già aperto l'app stamattina, quel menu le
   * sparisce sotto gli occhi.
   */
  if (tolto.giorno < oggi) {
    return { si: false, perche: 'I giorni passati non si tolgono: sposterebbero indietro giornate che la cliente ha già vissuto.' };
  }

  const dopo = ordinati.filter((g) => g.giorno > tolto.giorno);
  return {
    si: true,
    idDaCancellare: tolto.id,
    giornoTolto: tolto.giorno,
    spostamenti: dopo.map((g) => ({ id: g.id, da: g.giorno, a: giornoPrimaDi(g.giorno) })),
    dataLiberata: dopo.length ? dopo[dopo.length - 1].giorno : null,
  };
}
