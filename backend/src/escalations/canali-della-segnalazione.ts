/**
 * ⛔ **CHI VA DISTURBATO FUORI DALL'APP — e perché la riga in app non passa di qui.**
 *
 * `apri-segnalazione.ts` scriveva la notifica **solo in tabella**, e il suo stesso commento lo
 * diceva: *«Il push e il rispetto delle preferenze passano da `NotificationsService`, che qui non è
 * raggiungibile. Meglio una campanella che accende un pallino che il silenzio di prima.»* Era vero
 * quando è stato scritto, e non lo è più: `notifica-utente.ts` ha già mostrato la forma — una
 * funzione libera che riceve le sue dipendenze — e `PushModule` è autonomo apposta.
 *
 * ⛔ **Il caso che ha fatto aprire la voce**: «Piano bloccato» **ferma l'erogazione**. La cliente
 * vede «Menu in preparazione» e basta; l'unica che può sbloccare è la nutrizionista, e finché non
 * apriva il backoffice non lo sapeva nessuno. Simone, 4/9: l'avviso va **alla nutrizionista e alla
 * coach**.
 *
 * ⛔ **QUI SI DECIDE IL DISTURBO, NON LO STATO.** La riga in app si scrive **sempre**, per tutti i
 * destinatari, anche per chi ha spento quel tipo: è la traccia che tiene la segnalazione in elenco
 * e la fa vedere alla prossima apertura. Quello che si può spegnere è la **push sul telefono**.
 * ⚠️ Confondere le due cose vorrebbe dire che una casella del profilo cancella un allarme clinico
 * dall'elenco, che non è quello che quella casella promette.
 * ⚠️ **E il percorso gemello fa l'opposto**, va detto invece che ignorato: `notificaUtente` — che
 * `EscalationRoutingService` usa per le stesse categorie — l'opt-out lo applica **prima** della
 * riga in app, quindi lì la casella cancella davvero la segnalazione dall'elenco. Sono due
 * semantiche diverse dello stesso interruttore, tutte e due vive; questa è quella che la casella
 * promette, l'altra è una voce da aprire, non una cosa da uniformare di nascosto alle sei del
 * mattino.
 *
 * ⚠️ **L'EMAIL NON È QUI, ED È UNA DECISIONE SOSPESA.** Simone l'aveva chiesta insieme alla push;
 * scriverla stanotte voleva dire passare da `sendNotificationEmail`, che è il modello delle
 * **clienti** (il piè di pagina dice «hai attivato le notifiche via email nelle preferenze», falso
 * per una nutrizionista, e rimanda a un interruttore che per lei non esiste), che mette in copia la
 * coach della cliente, e che **scrive il corpo in `email_log`** — cioè nome della cliente e motivo
 * clinico del blocco in una tabella che il backoffice mostra. Va deciso, non dedotto: vedi la voce
 * `piano-bloccato-solo-in-app`.
 */
import { EscalationCategory } from './escalation-routing';
import { staffDisabledTypes } from '../notifications/notifica-utente';

/** Quel poco che serve sapere di un destinatario per decidere se disturbarlo. */
export interface UtenteDestinatario {
  id: string;
  /** `User.prefs`, da cui si legge `notificationsDisabled` (l'opt-out per tipo dello staff). */
  prefs?: unknown;
}

/**
 * A chi mandare la push, fra i destinatari della segnalazione.
 *
 * ⚠️ **Un destinatario di cui non si sa niente la riceve lo stesso.** Non trovare la riga utente è
 * un intoppo di lettura, non una preferenza: trattarlo come un opt-out vorrebbe dire che un
 * singhiozzo del database spegne un allarme, in silenzio e proprio quando serve.
 */
export function chiVaDisturbato(
  destinatari: readonly string[],
  utenti: readonly UtenteDestinatario[],
  category: EscalationCategory,
): string[] {
  const tipo = `escalation_${category}`;
  const perId = new Map(utenti.map((u) => [u.id, u]));
  return destinatari.filter((userId) => {
    const u = perId.get(userId);
    return !u || !staffDisabledTypes(u.prefs).includes(tipo);
  });
}
