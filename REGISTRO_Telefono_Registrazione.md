# Registro modifiche — Telefono in registrazione + login con email o telefono

**Data:** 17 luglio 2026
**Ambito:** app cliente (Register) + backend (auth).

## Summary
In registrazione ora si chiede il **telefono** (prefisso internazionale a discesa + numero),
obbligatorio insieme all'email. Il **login con email _o_ telefono** era già stato implementato dal
socio: qui si completa il quadro raccogliendo il telefono alla registrazione.

## Description
Login con email/telefono: già presente (auth.service.login cerca per email o per cifre del
telefono, con controllo di unicità; il campo Login "Email o telefono" c'è già). Mancava solo
raccogliere il telefono alla registrazione. Modifiche:

Backend
- `dto/register.dto.ts`: nuovo campo `phone` **obbligatorio** (min 6, max 32).
- `auth.service.ts` register(): normalizza il telefono, controlla l'**unicità** sulle cifre (stessa
  logica del login: match esatto o per suffisso) e lo salva su `User.phone`. Se il numero è già
  usato → `ConflictException('Numero di telefono già registrato')`.

App
- `pages/Register.tsx`: sotto l'email, campo **Telefono** = casella a discesa prefisso (Italia +39
  di default, + paesi comuni) e numero; entrambi obbligatori. All'invio il telefono viene combinato
  (`"+39 3331234567"`) e mandato. L'errore 409 distingue "telefono già registrato" da "email già
  registrata" (quest'ultima mantiene la proposta di reset password).
- `auth/AuthContext.tsx`: `RegisterPayload.phone` + invio nel body.

## Nota di allineamento (drift)
- Backend auth (`register.dto.ts`, `auth.service.ts`): in iCloud erano allineati a origin/main → editati direttamente.
- `Register.tsx`: la versione iCloud era **più vecchia** (aveva ancora i bottoni Apple/Google e un
  input password grezzo). Consegnata la versione aggiornata (PasswordField, **senza** Apple/Google,
  come da tua richiesta precedente) + il campo telefono.
- `AuthContext.tsx`: consegnata la versione iCloud + `mustChangePassword` (flusso lead-backoffice) + `phone`.
  Su App.tsx/AuthContext.tsx resta la riconciliazione con l'app del socio al commit.

## Note aperte
- Backlog residuo: "Checkout — indirizzo di spedizione condizionale".
- Verifica su device: registrazione con telefono + login usando il numero.
