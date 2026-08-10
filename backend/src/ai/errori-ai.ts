/**
 * GLI ERRORI DELL'AI, DETTI A UNA PERSONA — e la differenza fra «riprova» e «non serve riprovare».
 *
 * Il 12/8 il nutrizionista ha premuto «Genera» e si è trovato davanti a questo, in un riquadro rosso:
 *
 * > Generazione non riuscita: l'AI ha risposto 400 — {"type":"error","error":{"type":
 * > "invalid_request_error","message":"Your credit balance is too low to access the Anthropic API.
 * > Please go to Plans & Billing to u.
 *
 * JSON, in inglese, troncato a metà parola. Chi lo legge non ha modo di capire che deve ricaricare un
 * credito: quel testo non è scritto per lui, è scritto per chi ha fatto la chiamata. Un errore che non
 * dice cosa fare è un errore che diventa una telefonata.
 *
 * ## Due informazioni, non una
 *
 * Ogni fallimento porta **due** risposte diverse, e confonderle costa:
 *
 *  - **cosa dire** alla persona, in italiano e con la strada per uscirne;
 *  - **se ha senso riprovare.** Questa decide il comportamento del generatore: la funzione che genera
 *    un pasto riprova tre volte, il giro passa cinque pasti, il backoffice passa diciotto varianti.
 *    Col credito esaurito sono **270 chiamate** destinate tutte allo stesso rifiuto, e una barra che
 *    avanza per minuti facendo credere che stia succedendo qualcosa.
 *
 * Credito esaurito, chiave non valida e modello inesistente sono definitivi: cambiano solo se
 * qualcuno interviene. Un 429 o un timeout no — quelli passano da soli, e lì riprovare è giusto.
 *
 * ## Perché il credito si riconosce dal corpo e non dal codice
 *
 * Anthropic risponde **400** quando il credito è finito, non 402: dal solo stato non si distingue da
 * una richiesta malformata, che è un problema nostro e non suo. La frase nel corpo è l'unica cosa che
 * lo dice, quindi si guarda quella — e si accettano più formulazioni, perché il testo di un servizio
 * esterno non è un contratto e cambierà senza avvisarci.
 */

export interface ErroreAi {
  /** La frase da mostrare, in italiano. */
  messaggio: string;
  /** Vero se riprovare non può cambiare l'esito finché non intervieni. */
  fatale: boolean;
}

/** Formulazioni che significano «hai finito il credito» o «la fatturazione blocca la chiamata». */
const SENZA_CREDITO = /credit balance is too low|insufficient[_ ]quota|billing|payment required/i;

export function classificaErroreAi(status: number, body = '', modello?: string): ErroreAi {
  if (SENZA_CREDITO.test(body)) {
    return {
      // Il corpo grezzo non si allega: qui la frase dice già tutto, e il JSON accanto è solo rumore.
      messaggio: 'il credito dell\'AI è esaurito: ricaricalo su console.anthropic.com → Plans & Billing, poi riprova',
      fatale: true,
    };
  }
  if (status === 401 || status === 403) {
    return { messaggio: `chiave AI non valida o senza permessi${coda(body)}`, fatale: true };
  }
  if (status === 404) {
    return { messaggio: `modello non trovato${modello ? ` (${modello})` : ''}${coda(body)}`, fatale: true };
  }
  if (status === 429) {
    return { messaggio: `limite di richieste AI raggiunto, riprova tra poco${coda(body)}`, fatale: false };
  }
  return { messaggio: `l'AI ha risposto ${status}${coda(body)}`, fatale: false };
}

/**
 * Il corpo della risposta, accorciato. Si allega solo quando la frase da sola non basta a capire —
 * cioè in tutti i casi tranne il credito — perché su un errore inatteso quel pezzo di testo è l'unica
 * traccia che abbiamo per capirci qualcosa.
 */
const coda = (body: string) => (body ? ` — ${body.slice(0, 160)}` : '');
