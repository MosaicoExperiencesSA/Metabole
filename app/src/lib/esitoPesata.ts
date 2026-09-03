/**
 * COSA SI DICE ALLA CLIENTE DOPO CHE HA SALVATO LE MISURE (16/8).
 *
 * `POST /me/measurements` rispondeva già due cose che **nessuna schermata leggeva**: i traguardi
 * appena raggiunti (`newMilestones`) e il fatto che quella pesata avesse fatto scattare il guardrail
 * del calo rapido (`rapidLossAlert`), che apre una segnalazione al nutrizionista. La cliente
 * salvava, la pagina si ricaricava, e non le veniva detto né che aveva raggiunto l'obiettivo né che
 * si era aperto un caso su di lei.
 *
 * È lo stesso difetto già pagato due volte in questo progetto — un dato che agisce e non si vede —
 * ma qui in una versione peggiore: il momento in cui una persona raggiunge l'obiettivo per cui sta
 * facendo tutto questo esiste in banca dati, e veniva buttato via.
 */

export type EsitoPesata =
  /**
   * Le sue pesate non stanno in piedi fra loro: la segnalazione è aperta e il fabbisogno è sospeso.
   * ⚠️ Ci si arriva **dopo** che le è stato chiesto «è giusto?» e lei ha risposto di sì — oppure
   * senza domanda, se la rotta di verifica non ha risposto. In tutt'e due i casi da qui in poi
   * qualcuno guarda quel numero, e lei deve saperlo prima che le arrivi un messaggio.
   */
  | { tipo: 'da-verificare' }
  /** La pesata ha fatto scattare il guardrail: è stata segnalata alla nutrizionista. */
  | { tipo: 'segnalata' }
  /** Traguardi appena raggiunti, con le parole del server. */
  | { tipo: 'traguardi'; etichette: string[] };

export interface Traguardo {
  type: string;
  label: string;
}

/**
 * Cosa mostrare, o `null` se non c'è niente da dire.
 *
 * ⚠️ **Se la pesata è stata segnalata, il traguardo aspetta.** «Obiettivo raggiunto! 🎉» accanto a
 * «abbiamo segnalato questa pesata alla tua nutrizionista» è una schermata che si contraddice da
 * sola — e delle due, quella che conta è la seconda: un calo così rapido da far scattare il
 * guardrail non è un traguardo da festeggiare, è una cosa che qualcuno deve guardare. Il traguardo
 * non si perde: è scritto in banca dati e si rivede nella sua pagina.
 *
 * ⚠️ Le etichette arrivano dal server e si mostrano com'è scritto lì. Riscriverle qui vorrebbe dire
 * due copie della stessa frase, e fra un anno due frasi diverse.
 */
export function esitoPesata(
  traguardi: readonly Traguardo[] | null | undefined,
  segnalata: boolean,
  daVerificare = false,
): EsitoPesata | null {
  /**
   * ⚠️ **Le pesate da verificare battono il calo rapido**, e il verso non è arbitrario: sopra
   * quelle soglie il calo rapido lato server viene **spento apposta** (`peso-incoerente.ts`), quindi
   * se arrivassero tutt'e due la seconda sarebbe un residuo. E delle due questa è quella vera: «il
   * tuo calo è più rapido del previsto» detto a chi ha digitato 113 al posto di 73 è una frase su un
   * corpo costruita su un numero sbagliato.
   */
  if (daVerificare) return { tipo: 'da-verificare' };
  if (segnalata) return { tipo: 'segnalata' };
  const etichette = (traguardi ?? []).map((t) => (t?.label ?? '').trim()).filter(Boolean);
  return etichette.length ? { tipo: 'traguardi', etichette } : null;
}
