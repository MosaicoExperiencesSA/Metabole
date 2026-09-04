# 04 · Identità: registrazione, verifica mail, login, password

## Le tabelle (tre, e bastano)

```prisma
model User {
  id                 String     @id @default(uuid())
  email              String     @unique
  secondaryEmail     String?    @unique @map("secondary_email")   // → capitolo 05
  passwordHash       String     @map("password_hash")
  mustChangePassword Boolean    @default(false) @map("must_change_password")
  role               Role       @default(user)
  customRoleKey      String?    @map("custom_role_key")
  status             UserStatus @default(active)   // active | suspended | deleted
  emailVerifiedAt    DateTime?  @map("email_verified_at")
  locale             String     @default("it")
  theme              String     @default("light")
  // anagrafica
  firstName String? @map("first_name")
  lastName  String? @map("last_name")
  phone     String?
  photoUrl  String? @map("photo_url")   // data URL ridotta, per l'avatar
  createdAt DateTime  @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")
}

// La sessione lunga. Salvato HASHATO: chi legge il database non può usarlo.
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
}

// Token MONOUSO per verifica email, cambio email e reset password. Anche questo hashato.
model ActionToken {
  id        String          @id @default(uuid())
  userId    String          @map("user_id")
  type      ActionTokenType // email_verification | email_change | password_reset
  tokenHash String          @unique @map("token_hash")
  email     String?         // la destinazione, per il cambio email
  expiresAt DateTime        @map("expires_at")
  usedAt    DateTime?       @map("used_at")
}
```

⚠️ **I token si salvano hashati (SHA-256), mai in chiaro.** Un token in chiaro nel database è una
password: chi legge una riga entra nell'account. Si salva `sha256(token)`, si manda il token
nell'email, e alla verifica si cerca per hash.

⚠️ **Monouso vuol dire `usedAt`, non "lo cancello".** Cancellarlo fa sparire la traccia; un token
usato che resta con la sua data racconta cosa è successo e quando.

## Il flusso di registrazione

```
POST /auth/register  { email, password, … }
   │
   ├─ email già presa?  → errore
   ├─ crea User (emailVerifiedAt = null)
   ├─ crea ActionToken(email_verification), scadenza 48h
   ├─ manda l'email con il link
   └─ risponde ok  ⚠️ senza far entrare
```

Poi, dal link:

```
GET  /auth/verify-email?token=…    ← il click nell'email (redirect a una pagina)
POST /auth/verify-email { token }  ← la stessa cosa dal frontend
   │
   ├─ token inesistente / di tipo sbagliato / già usato / scaduto → «non valido o scaduto»
   └─ in transazione:  usedAt = now  +  user.emailVerifiedAt = now
```

**Le tre decisioni da prendere qui, ed è meglio prenderle adesso:**

1. **Si può entrare prima di aver verificato?** In Metabole sì, e la verifica è un promemoria.
   L'alternativa (login bloccato finché non verifica) è più severa e più sicura, ma raddoppia le
   richieste di assistenza il primo mese. Scegli, e scrivilo nel `CLAUDE.md`.
2. **Quanto dura il token?** 48 ore è il valore del kit. Meno di 24 taglia fuori chi apre la posta
   il lunedì; più di una settimana è un link vivo in una casella che magari non è più sua.
3. **Il messaggio d'errore non distingue i casi.** «Token non valido o scaduto» copre inesistente,
   già usato e scaduto. Distinguere aiuterebbe l'utente, ma dice a chi prova link a caso quali
   esistono.

### Sia GET che POST, e perché

Il `GET` serve perché **il click in un'email è una GET**: l'utente arriva sulla pagina già
verificato. Il `POST` serve al frontend quando il token viaggia diversamente (app, deep link).
Uno solo dei due non basta, e sono due righe.

## Il login

```
POST /auth/login  { email, password }
   │
   ├─ cerca per email  OPPURE per secondaryEmail   ← ⚠️ capitolo 05
   ├─ status !== active → errore generico
   ├─ password sbagliata → errore generico
   └─ emette la coppia:  accessToken (breve)  +  refreshToken (lungo, hashato in DB)
```

⚠️ **Un solo messaggio d'errore per «email inesistente» e «password sbagliata».** Due messaggi
diversi sono un modo gratuito per scoprire chi è iscritto.

⚠️ **Il login accetta anche l'email secondaria.** È il senso della doppia mail: l'utente entra con
quella che si ricorda. Le notifiche invece vanno **sempre** alla principale (capitolo 05).

### La coppia di token

| Token | Dove sta | Durata | Cosa fa |
|---|---|---|---|
| access | in memoria nel frontend | minuti | autentica ogni richiesta |
| refresh | cookie o storage sicuro, **hashato in DB** | giorni/settimane | rinnova l'access |

`POST /auth/refresh` verifica l'hash, controlla `revokedAt` e `expiresAt`, e ne emette uno nuovo.
`POST /auth/logout` mette `revokedAt`: da lì quel refresh è morto anche se qualcuno ne ha una copia.

## Le password

- **Hash con bcrypt o argon2**, mai altro, mai «tanto è un progetto piccolo».
- **Reset**: `POST /auth/password-reset` → token monouso → `POST /auth/password-reset/confirm`.
  ⚠️ La richiesta di reset risponde **sempre ok**, anche se l'email non esiste: altrimenti è di
  nuovo un modo per sapere chi è iscritto.
- **Al reset si revocano tutti i refresh token dell'utente.** Chi cambia la password lo fa spesso
  proprio perché teme che qualcuno sia dentro: se le sessioni restano vive, non ha ottenuto niente.
- **`mustChangePassword`**: gli account creati da un amministratore nascono con questo flag, e il
  frontend porta a una schermata di cambio obbligato al primo accesso. Serve perché la password
  iniziale l'ha vista una seconda persona.

## Cosa finisce nel registro attività

Ogni evento di identità **si scrive** (capitolo 07): `auth.login`, `auth.logout`,
`auth.email_verified`, `auth.password_reset_requested`, `auth.password_changed`,
`auth.email_change_requested`, `auth.email_change_confirmed`, `auth.email_primary_swapped`.

Con l'indirizzo IP. Il giorno che qualcuno chiede «chi è entrato nel mio account», questa è l'unica
risposta possibile.

## Le email transazionali

Il kit prevede **modelli modificabili dall'amministratore** (tabella `EmailTemplate`, capitolo 07)
con dei segnaposto `{{variabile}}`, e un testo predefinito nel codice per quando il modello manca o
è disattivato. Le quattro che servono da subito:

| Chiave | Quando parte |
|---|---|
| `email_verification` | alla registrazione |
| `email_change` | alla richiesta di cambio email |
| `password_reset` | alla richiesta di reset |
| `welcome` | alla verifica completata |

## Checklist di montaggio — capitolo 04

- [ ] `User`, `RefreshToken`, `ActionToken` a schema; token salvati **hashati**
- [ ] `auth.service.ts` e `auth.controller.ts` copiati dallo starter
- [ ] Verifica email attiva, con **sia** `GET` **che** `POST /auth/verify-email`
- [ ] Il login cerca su `email` **e** `secondaryEmail`
- [ ] Errori di login indistinguibili fra email inesistente e password sbagliata
- [ ] Il reset password revoca tutti i refresh token
- [ ] `mustChangePassword` gestito dal frontend con la schermata dedicata
- [ ] Gli otto eventi di identità finiscono nel registro attività
- [ ] I quattro modelli email esistono, con il testo predefinito nel codice
