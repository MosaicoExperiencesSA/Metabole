/**
 * ⛔ **LA PORTA PER CAMBIARE LE ORE DEL DIGIUNO DI UNA CLIENTE** — un token, come le altre.
 *
 * ## Perché esiste
 *
 * Dal 25/8 la cliente può cambiare **le ore** una volta a settimana (richiesta della capo
 * nutrizionista, decisa da Simone), e la frase che legge quando non può le dice: *«se ti serve
 * prima, scrivilo alla tua nutrizionista: lo cambia lei»*.
 *
 * ⛔ Quella porta **non esisteva**. Dal 21/8 la tendina della finestra è fuori dalla scheda staff —
 * la finestra la *deriva* l'orologio della cliente — e in tutto il backend nessuno poteva cambiare
 * il protocollo di qualcun altro. Un limite senza la sua porta è un cancello chiuso, e qui sarebbe
 * stato un cancello chiuso **con una frase che fa credere il contrario**.
 *
 * ## Perché un token e non un import
 *
 * Stessa ragione di `SCRITTURA_RICETTA`, `SCRITTURA_KCAL` e le altre: importare `ProfileService` qui
 * trascinerebbe nel grafo di compilazione dei test di Vera mezza applicazione. Il servizio vero resta
 * quello, legato con `useExisting` in `VeraModule`.
 *
 * ⚠️ **E le regole non si duplicano.** Cosa succede quando si cambia una finestra — il piano
 * graduale, la finestra di oggi già aperta, i pasti da riderivare — vive in `decidiCambio`, e il
 * metodo qui sotto ci passa come ci passa la cliente. L'unica differenza è che questa porta chiede a
 * `decidiCambio` di non applicare i limiti: *è* il permesso che la regola della cliente promette.
 */

export interface EsitoScritturaDigiuno {
  ok: boolean;
  /** Perché no, in italiano e per una nutrizionista. Presente solo quando `ok` è falso. */
  perche: string;
  /** Da quando valgono le ore nuove: `domani` quando la finestra di oggi si era già aperta. */
  daQuando: 'oggi' | 'domani';
}

export interface ScritturaDigiuno {
  /**
   * Cambia il protocollo di una cliente **senza** i limiti che valgono per lei.
   *
   * ⚠️ Non lancia: rende un esito. Chi chiama è una chat, e a una nutrizionista che ha appena detto
   * «mettila a 16:8» si deve poter rispondere *perché* non si è potuto — non un errore rosso.
   */
  /**
   * ⛔ **`attoreId` NON è facoltativo per comodità: è chi ha agito.** Nella prima stesura Vera non
   * lo passava, e l'audit scriveva `actorId: <la cliente>` — cioè il registro raccontava che aveva
   * cambiato le sue ore da sola **proprio nel caso in cui non poteva farlo**. È il campo su cui si
   * fa una query quando qualcuno chiede «chi ha cambiato le ore di questa signora».
   */
  impostaPerStaff(
    clientUserId: string,
    dati: { protocollo: string },
    attoreId: string,
  ): Promise<EsitoScritturaDigiuno>;
}

export const SCRITTURA_DIGIUNO = 'VERA_SCRITTURA_DIGIUNO';
