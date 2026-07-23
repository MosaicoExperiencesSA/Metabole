# Registro modifiche — Cancellazione account in-app (requisito store)

**Data:** 23 luglio 2026 · Base: origin/main allineata (verificata contro GitHub HEAD).

## Summary
Cancellazione account self-service in app (requisito Google Play / App Store)

## Description
Google Play e (soprattutto) l'App Store richiedono che un'app con registrazione offra
l'eliminazione dell'account DENTRO l'app, oltre alla pagina web già pubblicata
(https://metabole.eu/Metabole_Cancellazione_Account.html). Implementata:

- **Backend** — `users.service.ts`: nuovo `deleteMyAccount(userId, password)`.
  Verifica la password (argon2, come changePassword), poi ANONIMIZZA l'account:
  email → `deleted-<id>@anon.metabole.eu`, nome → "Account Eliminato", telefono/foto/
  secondaryEmail azzerati, password sostituita con hash casuale; `deletedAt` + status
  `suspended` (stessa semantica dell'archiviazione admin: in backoffice finisce tra gli
  Archiviati), refresh token revocati, push token eliminati, audit `me.account.delete`
  (con la vecchia email nei metadata per eventuali richieste successive).
  Protezioni: solo ruolo `client` (lo staff passa dall'admin), mai l'admin protetto
  della variabile Render, richiede password corretta.
- **Backend** — `me.controller.ts`: nuovo `POST /me/account/delete` con
  `DeleteMyAccountDto { password }`.
- **App** — `Profilo.tsx`: nuova sezione "Elimina account" in fondo al profilo
  (dopo "Esci"): bottone rosso → pannello con avviso di definitività, spunta di
  conferma e password; su successo logout e ritorno alla landing. Type-check
  frontend eseguito in sandbox: OK.

## Note operative
- Il pezzo BACKEND va live col prossimo deploy Render (controllare l'esito build).
- Il pezzo APP salirà su Play col prossimo AAB (versionCode 3) — NON serve toccare la
  release attualmente in revisione. Su iOS nascerà incluso nella prima build.
- I dati contabili restano (obbligo di legge); la rimozione profonda dei documenti
  sanitari resta nel flusso operatore via email, come descritto nella pagina web.
- Unit test dedicati non aggiunti in questa tornata (client Prisma non generabile in
  sandbox): la copertura è demandata al type-check Render + collaudo live con un
  account di prova usa-e-getta.

## Collaudo suggerito (dopo il deploy)
1. Registrare un cliente di prova (simone.salogni+delete-test@gmail.com).
2. Dall'app: Profilo → Elimina account → spunta + password → conferma.
3. Verificare: logout automatico, login non più possibile, utente tra gli Archiviati
   in backoffice con nome "Account Eliminato", audit `me.account.delete` presente.
