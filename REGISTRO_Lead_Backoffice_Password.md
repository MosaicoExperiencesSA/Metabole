# Registro modifiche — Lead da backoffice: password iniziale a fine questionario

**Data:** 17 luglio 2026
**Ambito:** app cliente + backend (auth/me). Flusso per i lead creati da backoffice.

## Summary
Un lead creato da backoffice (con password provvisoria) al primo accesso parte dal questionario
(saltando la creazione credenziali, già gestita) e, **a fine questionario**, imposta la sua
password personale; il flag `mustChangePassword` viene azzerato.

## Description
Il grosso era già pronto lato backend/socio: flag `User.mustChangePassword` (schema + migration),
creazione utente da backoffice che lo accetta, azzeramento al cambio password, ed esposizione in
`toPublicUser`. Anche l'instradamento app era già a posto: un cliente senza onboarding completato
riceve già la schermata questionario (mai la creazione credenziali, che è solo nel flusso di
auto-registrazione). Mancava solo consumare il flag lato app. Modifiche:

Backend
- `users.service.ts`: nuovo `setInitialPassword(userId, newPassword)` — imposta la password al
  primo accesso **senza** richiedere quella provvisoria (l'utente è già autenticato e
  `mustChangePassword=true` prova che è un primo cambio forzato); azzera il flag. Se il flag non è
  attivo, rimanda al cambio password normale.
- `me.controller.ts`: nuova rotta `PATCH /me/password/initial` (DTO con solo `newPassword`).

App
- `auth/AuthContext.tsx`: `User.mustChangePassword?: boolean`.
- `pages/SetPassword.tsx` (nuovo): schermata "Imposta la tua password" (nuova + conferma), chiama
  `/me/password/initial`, poi `refreshMe()` e prosegue.
- `App.tsx`: dopo l'onboarding, se `user.mustChangePassword` è true → `SetPassword` prima della
  home. Copre anche il caso di un utente con onboarding già fatto a cui l'admin ha resettato la
  password (reset forzato al successivo accesso).

## Nota di allineamento (drift app iCloud vs origin/main)
Le versioni iCloud di `App.tsx` e `auth/AuthContext.tsx` risultano **più vecchie** di origin/main
(il socio su origin/main ha una gestione staff con `StaffApp` e un sistema permessi che in iCloud
non c'è ancora). Per non rompere il build dell'albero iCloud, le mie modifiche sono state applicate
**sopra le versioni iCloud** (superset puliti), non su origin/main. Al commit/push andrà riconciliata
la divergenza sull'app con il lavoro del socio.

## Contratto con il backoffice (collega)
Vedi `Metabole_Handoff_Lead_Backoffice_Password.md`: alla creazione del lead impostare
`mustChangePassword: true` + `emailVerifiedAt = now`, password provvisoria casuale (argon2), e NON
compilare il questionario (`onboardingCompletedAt` nullo).

## Note aperte
- Ripresa del lavoro "telefono in registrazione" (in pausa).
- Verifica end-to-end quando il collega crea un lead reale da backoffice.
