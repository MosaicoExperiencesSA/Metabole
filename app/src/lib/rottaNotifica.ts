/**
 * DOVE PORTA UNA NOTIFICA — una regola sola, per due strade che ci arrivano.
 *
 * Richieste di Simone (12/8): «la notifica di un messaggio in chat, se ci clicca il nutrizionista o
 * la coach, deve venir portata nella chat della persona» e «ovviamente se clicco sulla notifica mi
 * porti nella chat specifica».
 *
 * Le notifiche si toccano da **due** posti: l'elenco dentro l'app e la push sulla schermata di
 * blocco. Sono due eventi diversi, con due sorgenti diverse — la riga salvata e i `data` di
 * Firebase — ma la domanda che pongono è la stessa, e se la risposta stesse in due funzioni un
 * giorno divergerebbero: la push porterebbe alla scheda e la lista alla chat, e nessuno saprebbe
 * quale delle due è quella giusta.
 *
 * ⚠️ Il server manda **i fatti**, non l'indirizzo. Lo stesso avviso ha rotte diverse a seconda di
 * chi lo riceve — la scheda di una cliente è `/clienti/:id` per la coach e `/pazienti/:id` per la
 * nutrizionista — e le rotte le conosce l'app, non il backend. Vedi `dati-push.ts` lato server.
 */

/** Quello che serve per scegliere la schermata, comunque sia arrivato. */
export interface DatiNotifica {
  threadId?: string | null;
  clientId?: string | null;
  visitId?: string | null;
  /** `coach` | `nutritionist` | `ai`: serve alla CLIENTE, che non naviga per thread. */
  counterpart?: string | null;
}

/**
 * @param schedaCliente Radice della scheda per QUESTO ruolo: `/clienti` per la coach,
 *   `/pazienti` per la nutrizionista. Le due app condividono le pagine, non le rotte.
 */
export function rottaDaNotifica(dati: DatiNotifica | null | undefined, schedaCliente?: string): string | null {
  if (!dati) return null;
  // La conversazione vince sulla scheda: chi apre l'avviso di un messaggio vuole leggerlo, non
  // consultare una cartella. Il `threadId` c'è solo sulle notifiche di chat, quindi non serve
  // indovinare dal tipo.
  if (dati.threadId) return `/chat/${dati.threadId}`;
  // Un appuntamento porta in agenda, che è dove si vede quando e con chi.
  if (dati.visitId) return '/agenda';
  if (dati.clientId && schedaCliente) return `${schedaCliente}/${dati.clientId}`;
  return null;
}

/**
 * I `data` di una push arrivano da Firebase come mappa di stringhe, e su alcune piattaforme il
 * corpo utile sta annidato sotto `data`. Si accettano tutte e due le forme invece di fidarsi:
 * sbagliare qui vuol dire un tocco che non porta da nessuna parte, e nessun errore da nessuna parte.
 */
/**
 * La stessa domanda, dal lato della CLIENTE.
 *
 * ⚠️ Non naviga per `threadId`: la sua app non ha una schermata per conversazione, ha **una** chat
 * con una linguetta per interlocutore (`/assistente?who=…`). Riusare la rotta dello staff qui
 * porterebbe a un indirizzo che non esiste, e il tocco finirebbe sulla home senza dire perché.
 */
export function rottaClienteDaNotifica(dati: DatiNotifica | null | undefined): string | null {
  if (!dati) return null;
  if (dati.counterpart === 'coach' || dati.counterpart === 'nutritionist') {
    return `/assistente?who=${dati.counterpart}`;
  }
  if (dati.threadId || dati.counterpart === 'ai') return '/assistente';
  // Un appuntamento è in agenda: per lei si chiama Calendario.
  if (dati.visitId) return '/calendario';
  return null;
}

export function datiDallaPush(payload: unknown): DatiNotifica {
  const p = (payload ?? {}) as Record<string, unknown>;
  const interno = (p.data ?? p) as Record<string, unknown>;
  const stringa = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    threadId: stringa(interno.threadId),
    clientId: stringa(interno.clientId),
    visitId: stringa(interno.visitId),
    counterpart: stringa(interno.counterpart),
  };
}
