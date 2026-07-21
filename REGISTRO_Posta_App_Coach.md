# Registro modifiche — Pagina Posta nell'app (coach): ricevute + inviate

**Data:** 21 luglio 2026 · Base: origin/main b546911.

## Summary
Aggiunta, **solo per le coach**, un'iconcina **Posta** in alto nell'app che apre una pagina con
la casella `@metabole.eu` collegata nel backoffice: due schede **Ricevute** e **Inviate**, con
apertura del messaggio e **Rispondi**. Prima la posta si vedeva solo dal backoffice; ora la coach
la consulta dal telefono. Completa la funzione "scrivi dalla casella del backoffice" (parte 1).

## Description
**Backend**
- `mailbox.service.ts`:
  - `resolveSentFolder()` (NUOVO): trova la cartella "Inviata" della casella per **flag speciale
    IMAP `\Sent`**, con fallback ai nomi comuni (`Sent`, `INBOX.Sent`, `Sent Items`). I server di
    posta usano nomi diversi, quindi non se ne può assumere uno.
  - `collectRecent()` (NUOVO, privato): logica condivisa di lettura ultimi N messaggi di una
    cartella; ora ogni voce include anche **`to`/`toName`** (serve per la scheda Inviate).
  - `listInbox()` invariato nel comportamento (ora delega a `collectRecent`); `listSent()`
    (NUOVO) legge la cartella Inviata; `getMessage(userId, uid, mailbox)` ora accetta la cartella
    (`inbox`|`sent`) e marca "letto" solo per l'inbox.
- `mailbox.controller.ts`: nuovi/aggiornati endpoint `GET /me/mailbox/sent` e
  `GET /me/mailbox/message/:uid?folder=sent`. Stessi ruoli/guard già presenti sulla casella.

**Frontend app**
- `staff/coach/CoachPosta.tsx` (NUOVO): pagina con stato casella (se non collegata, invita a
  collegarla dal backoffice → Impostazioni → Posta), schede **Ricevute/Inviate**, lista messaggi,
  apertura in un foglio (testo o HTML in iframe isolato) e **Rispondi** (riusa il modale di
  composizione, che invia dalla casella della coach).
- `staff/coach/CoachApp.tsx`: nuova rotta `/posta`.
- `staff/ui.tsx` (`StaffShell`): iconcina **Posta** (✉️) nell'header, mostrata **solo ai ruoli
  coach** (`COACH_ROLES`: coach, coordinatrice, responsabile). I nutrizionisti non la vedono.

## Perché è la soluzione giusta
La casella dell'operatore era già collegata e leggibile via IMAP dal backoffice; qui si riusa la
stessa infrastruttura esponendo la lettura anche nell'app, aggiungendo solo la cartella "Inviata"
(risolta in modo robusto via flag speciale). Nessun nuovo sistema, nessun duplicato: una sola
casella, vista da backoffice e app.

## Note e verifica
- **Prerequisito**: la casella va collegata **una volta** dal backoffice (Impostazioni → Posta).
  Senza, la pagina mostra un avviso chiaro e non tenta letture.
- **Solo coach**: iconcina e rotta sono lato coach; i nutrizionisti restano invariati.
- **Deliverability/lettura**: dipendono dal server `mail.metabole.eu` (SiteGround). Se comparissero
  timeout, è il tema noto degli IP di Render da whitelistare lato hosting.
- Nessuna migration. Verifiche: `tsc --noEmit` app **OK**; transpile backend OK; tipi imapflow
  (`path`/`name`/`specialUse`) verificati; NUL check OK.
