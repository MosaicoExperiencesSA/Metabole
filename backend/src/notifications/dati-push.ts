/**
 * I DATI CHE VIAGGIANO CON LA PUSH — quelli che dicono al telefono **dove andare** quando la
 * notifica viene toccata.
 *
 * Richiesta di Simone (12/8): «ovviamente se clicco sulla notifica mi porti nella chat specifica».
 *
 * ## Perché non si manda un indirizzo già fatto
 *
 * La tentazione è mettere qui `/chat/<threadId>` e farla finita. Ma la stessa notizia ha
 * **indirizzi diversi a seconda di chi la riceve**: la scheda di una cliente è `/clienti/:id` per
 * la coach e `/pazienti/:id` per la nutrizionista, e l'app della cliente ha un impianto di rotte
 * suo. Il server finirebbe per conoscere le rotte di tre interfacce, e il giorno che una cambia
 * l'unico modo di accorgersene sarebbe un tocco che non porta da nessuna parte.
 *
 * Quindi qui viaggiano **i fatti** — di che notizia si tratta, di chi parla, quale conversazione —
 * e l'indirizzo lo compone chi le rotte le ha davvero (`rottaDaNotifica` nell'app). È la stessa
 * regola per cui il testo del pallino rosso lo decide il server e il disegno lo fa il telefono:
 * ognuno decide quello che sa.
 *
 * ## ⚠️ FCM accetta SOLO stringhe
 *
 * `data` di Firebase è una mappa stringa→stringa: un numero o un `null` infilato lì dentro fa
 * fallire l'invio **intero**, e il fallimento si vede solo nei log del server. Per questo si passa
 * da qui invece di girare il payload così com'è: si prendono le chiavi che servono, e solo se sono
 * stringhe vere.
 */

/**
 * Le chiavi del payload che il telefono usa per decidere dove andare. Tutto il resto resta nella
 * riga in app: la push porta il minimo per aprire la schermata giusta, non una copia della notizia.
 *
 * ⚠️ Nessun contenuto sanitario: `title` e `body` della push sono già scritti per essere letti
 * sulla schermata di blocco, e qui non si aggiunge niente che non sia un identificativo.
 */
const CHIAVI_UTILI = ['kind', 'threadId', 'clientId', 'visitId', 'counterpart'] as const;

export function datiPush(type: string, payload?: Record<string, unknown>): Record<string, string> {
  const dati: Record<string, string> = { type };
  for (const chiave of CHIAVI_UTILI) {
    const valore = payload?.[chiave];
    if (typeof valore === 'string' && valore.length > 0) dati[chiave] = valore;
  }
  return dati;
}
