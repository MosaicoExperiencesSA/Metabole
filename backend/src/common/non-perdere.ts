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
 * - **Allergie**: la CLIENTE non le tocca da nessuna parte. Fino al 13/8 non le toccava nemmeno lo
 *   staff — le scriveva solo questo upsert; da allora una nutrizionista può correggerle dalla
 *   scheda, col permesso «Modifica allergie». Ma è **un'altra persona**: se il questionario le
 *   cancella, lei non ha nessun modo di rimetterle da sé, e nessuno sa che sono sparite. Unione,
 *   mai sottrazione.
 * - **Intolleranze**: la cliente le vede in sola lettura nel Profilo e non le modifica. Dalla
 *   scheda dello staff sì che si modificano (stanno in `PROFILE_FIELDS`), ma anche qui è **un'altra
 *   persona**, e nessuno saprebbe di doverlo fare. Stesso trattamento.
 * - **Cibi non graditi**: quelli li gestisce **lei**, dal Profilo dell'app. Lì il questionario è un
 *   editor legittimo e quello che manda vale — ma se **non manda niente**, non si tocca niente.
 *
 * Il criterio quindi non è «chi può scrivere questo campo», è: **se lo cancelliamo per sbaglio, la
 * cliente se ne accorge e lo rimette?** Per i cibi non graditi sì. Per le altre due no.
 *
 * ⚠️ Conseguenza da conoscere: dal questionario **un'allergia non si toglie più**. Toglierla è una
 * correzione su un dato sanitario, e dal 13/8 la fa una nutrizionista dalla scheda cliente, col
 * permesso «Modifica allergie» — che è la strada giusta, e finora non esisteva affatto. Quando un reinvio prova a togliere qualcosa,
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
