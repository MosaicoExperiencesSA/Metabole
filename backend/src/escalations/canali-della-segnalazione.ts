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
 * ⛔ **E L'EMAIL, con il corpo che nomina la cliente e dice il motivo** (Simone, 4/9, alla domanda
 * posta apposta: *«la mail si può viaggiare»*). Non passa da `sendNotificationEmail` — quello è il
 * modello delle clienti — ma da `sendStaffAlertEmail`, che ha un testo suo, nessuna copia alla
 * coach e un `templateKey` separato. ⚠️ Il corpo finisce anche in `email_log`, che il backoffice
 * mostra: è la conseguenza di quella decisione, ed è scritta dove si vede.
 */
import { EscalationCategory } from './escalation-routing';
import { staffDisabledTypes } from '../notifications/notifica-utente';

/**
 * ⛔ **PER QUALI SEGNALAZIONI SI ARRIVA FINO ALLA POSTA.**
 *
 * `diet_blocked` è quella che Simone ha nominato, e la ragione è che **ferma l'erogazione**: la
 * cliente resta davanti a «Menu in preparazione» finché qualcuno non interviene.
 *
 * ⚠️ **Non è però l'unica che lascia una cliente senza menu**, e va detto invece di far credere il
 * contrario: `menu.service.ts` apre anche una `other` con motivo «menu NON erogato». È una
 * candidata, non una dimenticanza — allungare questo elenco è una decisione di prodotto, perché
 * ogni riga in più abbassa l'attenzione su quelle che c'erano già, e una posta che si smette di
 * leggere è peggio di una posta che non arriva.
 */
export const CATEGORIE_CON_EMAIL: ReadonlySet<EscalationCategory> = new Set<EscalationCategory>([
  'diet_blocked',
]);

/** Quel poco che serve sapere di un destinatario per decidere se disturbarlo. */
export interface UtenteDestinatario {
  id: string;
  email?: string | null;
  locale?: string | null;
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

/**
 * A chi mandare **anche** la mail, fra quelli che vanno disturbati.
 *
 * ⛔ **`nascita` non è un dettaglio: è l'argine al diluvio.** La stessa segnalazione si chiude e si
 * riapre più volte in un pomeriggio — la nutrizionista corregge le allergie, `resolveBlocks` chiude,
 * la cliente apre l'app, il motore ancora non compone e la riga torna aperta — e ogni ritorno è un
 * avviso. Con la push va bene: è il fatto nuovo, e chi l'ha risolta deve sapere che è tornata. Con
 * la posta sarebbero **dieci mail identiche in un pomeriggio**, cioè il modo più rapido per far
 * smettere di leggere proprio quelle. Quindi: **la mail la manda la nascita, non il ritorno.**
 *
 * ⚠️ Un blocco che torna **fuori** dalla tregua è una segnalazione nuova, e la mail la rifà: è
 * giusto, sono passate due settimane e nessuno se lo ricorda più.
 * ⚠️ E chi non ha un indirizzo non entra: lì il limite è fisico, non una scelta.
 */
export function chiRicevePostaAncheLei(
  daDisturbare: readonly string[],
  utenti: readonly UtenteDestinatario[],
  category: EscalationCategory,
  nascita: boolean,
): { userId: string; email: string; locale: string | null }[] {
  if (!nascita || !CATEGORIE_CON_EMAIL.has(category)) return [];
  const perId = new Map(utenti.map((u) => [u.id, u]));
  const posta: { userId: string; email: string; locale: string | null }[] = [];
  for (const userId of daDisturbare) {
    const u = perId.get(userId);
    const email = u?.email?.trim();
    if (email) posta.push({ userId, email, locale: u?.locale ?? null });
  }
  return posta;
}
