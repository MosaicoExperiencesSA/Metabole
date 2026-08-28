/**
 * DA DOVE VIENE `planStartDate` — un giorno scelto, o la scadenza di un altro piano.
 *
 * ⛔ **Il campo conteneva due cose diverse, e dal valore non si distinguevano.** È la voce
 * `data-inizio-giorno-o-istante`, aperta il 23/8 rinunciando a indovinarlo:
 *
 *  - **un giorno** — «comincio il 23» — scritto dal questionario, dalla matita della scheda, dalla
 *    chat con Gaia e da «Conosciamoci». Vale `toDateOnly`: mezzanotte UTC del giorno di Roma;
 *  - **un istante** — la scadenza del piano in corso, scritta dal ramo della coda
 *    dell'approvazione bonifico, perché un piano in coda parte quando finisce l'altro.
 *
 * ⛔ **L'euristica è stata provata e buttata**, ed è la ragione per cui esiste questo file. La prima
 * stesura del 23/8 distingueva i due casi guardando il valore: «mezzanotte UTC esatta = un giorno».
 * La revisione ha mostrato che `subscriptionEnd`, partendo da un giorno, produce **proprio**
 * mezzanotte UTC esatta — quindi l'euristica sbagliava sul caso più comune di tutti e faceva nascere
 * piani `active` con la partenza **nel futuro**: la forma ambigua che la voce 258 esiste per togliere
 * di mezzo, e per giunta invisibile a `promuoviCodeArrivate`, che cerca i `queued`.
 *
 * ⚠️ **La soluzione non è un'euristica migliore: è che il campo lo dica.** Una colonna accanto, non
 * due colonne di date — perché `planStartDate` la leggono venti punti, e sdoppiarla vorrebbe dire
 * venti letture da tenere d'accordo. Chi legge la data e non gliene importa continua a leggerla come
 * prima; chi deve *decidere* legge anche da dove viene.
 *
 * ## Cosa si chiude, coi numeri
 *
 * Fra la mezzanotte e le 02:00 italiane, una cliente che paga e ha scelto di cominciare **oggi**
 * nasceva `queued`: il suo giorno è mezzanotte UTC, cioè le 02:00 di Roma, quindi «nel futuro»
 * rispetto a un `now` che a Roma è già oggi. I menu le arrivavano alla passata notturna **dopo**,
 * un giorno intero più tardi. Due ore su ventiquattro, ma è la finestra in cui finiscono i pagamenti
 * di chi compra la sera tardi.
 *
 * ⚠️ **Le righe vecchie non hanno la provenienza**, e non si indovina: `null` vuol dire «non lo so»,
 * e su «non lo so» si tiene il comportamento di prima — il confronto fra istanti. Nessuna riga
 * cambia significato per una migrazione, e il difetto delle due ore si chiude man mano che le date
 * vengono riscritte. *Meglio un buco che si chiude da solo che un dato inventato all'indietro.*
 */

export const ORIGINE_INIZIO = {
  /** Un giorno scelto da qualcuno: vale dalle 00:00 di Roma di quel giorno. */
  GIORNO: 'giorno',
  /** La scadenza del piano in corso: è un istante, e vale a quell'ora esatta. */
  CODA: 'coda',
} as const;

export type OrigineInizio = (typeof ORIGINE_INIZIO)[keyof typeof ORIGINE_INIZIO];

/**
 * Vero **solo** quando sappiamo che è un giorno scelto.
 *
 * ⛔ `null`, `undefined` e qualunque valore sconosciuto rispondono **falso**, e non è pigrizia: chi
 * chiama usa la risposta per decidere se tradurre la data nel fuso di Roma, e tradurre un istante
 * lo anticipa di un'ora o due. *Su «non lo so» si tiene il comportamento di prima.*
 */
export function eGiornoScelto(origine: string | null | undefined): boolean {
  return origine === ORIGINE_INIZIO.GIORNO;
}

/** Come si legge in una diagnostica o in un audit, senza far aprire questo file. */
export function spiegaOrigine(origine: string | null | undefined): string {
  if (origine === ORIGINE_INIZIO.GIORNO) return 'giorno scelto';
  if (origine === ORIGINE_INIZIO.CODA) return 'scadenza del piano in corso';
  return 'non registrata (riga scritta prima del 28/8)';
}
