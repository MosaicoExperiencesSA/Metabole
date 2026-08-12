/**
 * «GESTITO» È UN RINVIO, NON UNA CHIUSURA.
 *
 * Decisione di Simone (12/8), dopo la domanda «la coda del nutrizionista mi viene un dubbio, quella
 * della coach invece?».
 *
 * ## Il difetto
 *
 * I pulsanti della coach — al contrario di quelli del nutrizionista, che per un periodo non hanno
 * fatto niente — instradano davvero: `gestito` toglie l'alert dalla sua lista, `inoltrato` lo passa
 * al manager, e l'alert si **chiude da solo** quando la condizione smette di valere.
 *
 * Il problema stava altrove. `handled` conta fra gli stati «non chiusi», quindi il ricalcolo
 * notturno non ne crea uno nuovo — giustamente, sarebbe un doppione — ma **nessun codice riapriva
 * mai un alert gestito**. Una coach che segnava «gestito» su una cliente che non fa check-in, e
 * quella continuava a non farne, non lo rivedeva **mai più**: spariva dalla sua lista, spariva da
 * quella del manager, e restava lì.
 *
 * Il rischio non era il rumore. Era il silenzio su chi sta scivolando via — cioè esattamente la
 * persona per cui gli alert esistono.
 *
 * ## La regola
 *
 * Dopo `SOGLIA_GIORNI_DEFAULT` giorni, un alert gestito **la cui condizione vale ancora** torna
 * `open`. Sette giorni perché è il tempo perché un intervento della coach produca un effetto
 * visibile — un check-in, una pesata, una risposta: se in una settimana non è successo niente, quel
 * «gestito» non ha gestito niente.
 *
 * ## ⚠️ Torna solo se la condizione vale ANCORA
 *
 * È la riga che separa un promemoria utile da una persecuzione. Se la cliente nel frattempo ha fatto
 * il check-in, l'alert non è più fra i «desiderati» e viene chiuso dalla via normale: riaprirlo a
 * tempo scaduto vorrebbe dire rimettere in lista un problema che non c'è più, e insegnare alla coach
 * che quella lista si può ignorare.
 *
 * ## ⚠️ Si RIAPRE la riga, non se ne crea una nuova
 *
 * Stesso id, stessa storia, `handledAt` azzerato. Una riga nuova perderebbe da quando il problema è
 * aperto — che è il dato che dice se è una distrazione o un abbandono — e lascerebbe in tabella una
 * scia di doppioni «gestiti» che nessuno guarda più.
 *
 * ## ⚠️ `inoltrato` non si tocca
 *
 * Un alert inoltrato è sulla lista di qualcun altro, che lo sta guardando adesso. Riaprirlo dopo
 * sette giorni vorrebbe dire rimandarlo alla coach mentre il manager ci sta lavorando: due persone
 * sullo stesso problema, ognuna convinta che sia dell'altra.
 */

/** Dopo quanti giorni un «gestito» che non ha risolto niente torna in lista. Deciso da Simone. */
export const SOGLIA_GIORNI_DEFAULT = 7;

/** Il parametro che permette di cambiarla senza un rilascio. */
export const PARAMETRO_SOGLIA = 'alert_gestito_giorni';

const GIORNO_MS = 86_400_000;

export interface AlertRinviabile {
  id: string;
  type: string;
  status: string;
  handledAt: Date | null;
}

/**
 * Gli alert gestiti che devono tornare in lista.
 *
 * @param desiderati I tipi la cui condizione vale ANCORA adesso.
 */
export function daRiaprire(
  alerts: AlertRinviabile[],
  desiderati: Set<string>,
  sogliaGiorni = SOGLIA_GIORNI_DEFAULT,
  adesso: Date = new Date(),
): string[] {
  // Una soglia a zero o negativa vorrebbe dire «riapri subito», cioè un pulsante «gestito» che non
  // gestisce niente: nel dubbio si torna al valore deciso invece di trasformare la lista in un muro.
  const giorni = Number.isFinite(sogliaGiorni) && sogliaGiorni > 0 ? sogliaGiorni : SOGLIA_GIORNI_DEFAULT;
  const limite = adesso.getTime() - giorni * GIORNO_MS;

  return alerts
    .filter((a) => a.status === 'handled')
    // La condizione deve valere ancora: se è passata, ci pensa la chiusura normale.
    .filter((a) => desiderati.has(a.type))
    /**
     * ⚠️ `handledAt` mancante = **gestito prima che questa colonna esistesse**, quindi da chissà
     * quando. Riaprirlo subito riverserebbe in lista, tutto insieme, l'arretrato di mesi, il giorno
     * del rilascio. Si aspetta un giro: la migrazione lo valorizza a `updated_at`, che è la data
     * più vicina al vero che abbiamo. Qui resta la difesa per le righe che sfuggissero.
     */
    .filter((a) => (a.handledAt ? a.handledAt.getTime() <= limite : false))
    .map((a) => a.id);
}
