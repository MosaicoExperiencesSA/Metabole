/**
 * IL QUESTIONARIO PUÒ AGGIUNGERE, NON PUÒ CANCELLARE.
 *
 * ## Il difetto
 *
 * Il questionario si salva con un `upsert`, e **un upsert è replace, non merge**: il ramo `update`
 * riscrive i campi con quello che è arrivato. Se il DTO non porta `allergies`, la riga diventa
 * `allergies: []` — e le allergie della cliente **spariscono**. Nessun errore, nessuna traccia.
 *
 * Non è un caso di laboratorio. Il questionario si rifà (è la ragione per cui esiste il ramo
 * `update`), nessun campo di quella pagina è obbligatorio, e un'app vecchia manda solo i campi che
 * conosce. Basta un reinvio che salta la pagina delle allergie.
 *
 * ⚠️ È la terza volta che lo stesso `upsert` perde qualcosa: l'8/8 il **consenso sanitario** (sei
 * clienti bloccate al carrello, senza via d'uscita), l'11/8 il **tipo di dieta** (spostato due
 * volte dallo staff e tornato indietro due volte, in silenzio). Le due volte precedenti si è
 * sistemato il campo che era saltato fuori. Questa volta la regola sta fuori, in una funzione, così
 * vale anche per il prossimo campo.
 *
 * ## La regola, e perché è asimmetrica
 *
 * Non si cancella quello che la cliente **non può rimettere da sola**.
 *
 * - **Allergie e intolleranze**: in tutta l'app e in tutto il backoffice **un solo punto** le
 *   scrive, ed è questo. Non stanno nel DTO della PATCH cliente, non in `PROFILE_FIELDS`, non nel
 *   DTO dello staff. Se il questionario le cancella, sono cancellate e basta: nessuna schermata
 *   permette di rimetterle. Quindi qui si fa **unione**, mai sottrazione.
 * - **Cibi non graditi**: quelli sì che li gestisce lei, dal Profilo. Lì il questionario è un
 *   editor legittimo e quello che manda vale — ma se **non manda niente**, non si tocca niente.
 *
 * ⚠️ Conseguenza da conoscere: dal questionario **un'allergia non si toglie più**. Toglierla è una
 * correzione su un dato sanitario, e la fa una nutrizionista — che è già la regola dichiarata
 * altrove, solo che finora era aggirabile per sbaglio. Quando un reinvio prova a togliere qualcosa,
 * `perse` lo dice: si scrive nell'audit e si risponde alla cliente, invece di sparire nei due sensi.
 */

/** Confronto tollerante: la stessa allergia scritta con un'altra maiuscola è la stessa allergia. */
const chiave = (v: string): string => v.trim().toLowerCase();

export interface EsitoUnione<T> {
  /** Il valore da scrivere. */
  valori: T[];
  /** Quello che il nuovo invio avrebbe tolto, e che invece è stato tenuto. Vuoto = niente da dire. */
  perse: T[];
}

/**
 * Unione fra quello che c'era e quello che arriva: si aggiunge, non si toglie mai.
 *
 * L'ordine è «prima i vecchi, poi i nuovi»: quello che la cliente aveva già dichiarato resta in
 * cima, e quello che aggiunge oggi va in fondo. Chi legge la scheda vede la stessa cosa di ieri più
 * la novità, invece di un elenco rimescolato.
 */
export function unioneSenzaPerdere(
  precedenti: string[] | null | undefined,
  nuovi: string[] | null | undefined,
): EsitoUnione<string> {
  const vecchi = (precedenti ?? []).filter(Boolean);
  const arrivati = (nuovi ?? []).filter(Boolean);
  const chiaviArrivate = new Set(arrivati.map(chiave));

  const valori = [...vecchi];
  for (const n of arrivati) if (!valori.some((v) => chiave(v) === chiave(n))) valori.push(n);

  return { valori, perse: vecchi.filter((v) => !chiaviArrivate.has(chiave(v))) };
}

/**
 * Per i campi che la cliente **può** rimettere da sola: se l'invio non porta il campo, si lascia
 * stare quello che c'è.
 *
 * ⚠️ `undefined` e `[]` sono cose diverse, ed è tutto il punto: `undefined` è «di questo non ti ho
 * detto niente», `[]` è «non ne ho nessuno». Il primo non deve toccare la riga, il secondo sì. Se
 * si trattassero uguali si tornerebbe al difetto di partenza.
 */
export function soloSeMandato<T>(inviato: T[] | null | undefined): T[] | undefined {
  return inviato == null ? undefined : inviato;
}
