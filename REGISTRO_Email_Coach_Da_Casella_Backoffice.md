# Registro modifiche — Email coach dalla casella del backoffice

**Data:** 21 luglio 2026 · Base: origin/main 3e3ace8.

## Summary
Nella card cliente/lead lato coach il pulsante **Email** usava un link `mailto:`, quindi apriva
il programma di posta **personale** della coach (Gmail, Mail…) e la mail partiva dal suo indirizzo
privato. Ora il pulsante apre un **modale di composizione dentro l'app** e la mail parte dalla
**casella `@metabole.eu` della coach collegata nel backoffice** (via SMTP), non da quella personale.
Le risposte tornano quindi all'indirizzo aziendale.

## Description
**Backend** — `mailbox.service.ts`
- `send()` (invio SMTP dalla casella dell'operatore, già esistente) ora **registra l'invio** in
  `email_log` (mittente = casella, `templateKey: 'mailbox'`, stato `sent`/`failed` con dettaglio
  errore). Serve da tracciamento: chi ha scritto a chi e quando. Il logging non blocca l'invio.
- Nessun nuovo endpoint: si riusa `POST /me/mailbox/send` (già protetto per i ruoli staff), che
  invia con `from = casella @metabole.eu` dell'operatore.

**Frontend app** — nuovo componente riutilizzabile + due punti d'uso
- `staff/shared/EmailComposeModal.tsx` (NUOVO): modale con **Oggetto + Messaggio**; invia con
  `POST /me/mailbox/send` (`{ to, subject, text }`). Mostra "parte dalla tua casella @metabole.eu",
  stato di invio, conferma "Email inviata ✓" e, in caso di errore, il **messaggio del backend**
  (es. "Casella non configurata. Impostala prima dalle impostazioni." → la coach la configura nel
  backoffice, sezione Posta/Impostazioni).
- `staff/shared/ContactActions.tsx`: il pulsante Email non è più un `mailto:` ma apre il modale
  (vale per la lista clienti coach e la lista pazienti nutrizionista, che usano questo componente).
- `staff/coach/CoachLeadDetail.tsx`: sostituito anche il link `mailto:` inline della scheda lead
  con lo stesso modale.

## Perché è la soluzione giusta
Esistevano già due sistemi mail: quello **transazionale** (Brevo, mittente fisso `no-reply@`) e la
**casella personale @metabole.eu** dell'operatore (IMAP/SMTP, sezione Posta del backoffice). La
richiesta — "parta dalla mail collegata al backoffice" — corrisponde esattamente al secondo:
`MailboxService.send` invia già con `from` = casella dell'operatore. Bastava sostituire il
`mailto:` con un invio server-side verso quell'endpoint. Riusare l'infrastruttura esistente evita
duplicazioni e mantiene un solo punto di verità per la posta in uscita degli operatori.

## Note e prerequisiti
- **Prerequisito coach**: la casella va configurata **una volta** nel backoffice (Impostazioni →
  Posta, con indirizzo `@metabole.eu` e password). Finché non è fatto, l'invio dà un messaggio
  chiaro e la mail non parte. La configurazione della casella è nel backoffice, non nell'app.
- **Deliverability**: dipende dal server SMTP `mail.metabole.eu` (SiteGround). Se comparissero
  timeout, è il tema già noto degli IP di Render da mettere in whitelist lato hosting.
- **Consensi**: è una mail **1-a-1 relazionale** coach→propria cliente/lead (non massiva), quindi
  non passa dal filtro opt-out marketing (coerente con l'endpoint mailbox esistente).
- Nessuna migration. Verifiche: `tsc --noEmit` app **OK**; transpile backend OK; NUL check OK.
