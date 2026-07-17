# Metabole — Lead creato da backoffice: credenziali, questionario e reset password

Spiegazione per chi sviluppa il **backoffice** (creazione lead) e il relativo endpoint backend.
Serve a tenere allineati backoffice e app cliente su un unico contratto dati. Nessun nome di
campo è inventato: sono quelli reali dello schema Prisma condiviso.

---

## 1. Contesto: due strade di registrazione

1. **Lead che si registra da solo** (dall'app): flusso attuale, resta **invariato**. L'utente
   crea le credenziali nella schermata "Crea il tuo account" e poi fa il questionario di
   onboarding.
2. **Lead inserito da backoffice** (da un collega): è il caso nuovo descritto qui. L'utente
   riceve le credenziali via mail e **non** deve passare dalla schermata di creazione credenziali.

L'obiettivo è che entrambi convergano sullo stesso onboarding, senza doppioni e senza schermate
inutili.

## 2. Il flusso del lead da backoffice (chi fa cosa)

1. **Il collega crea il lead da backoffice** → l'endpoint backend crea l'account (dettagli sotto).
2. **Il lead riceve le credenziali via email** (email + password provvisoria).
3. **Primo login del lead:** l'app riconosce che **non ha mai completato il questionario** e lo
   porta dritto al questionario di onboarding, **saltando** la schermata di creazione credenziali
   (le ha già). Da qui l'onboarding prosegue identico al flusso normale.
4. **Alla fine del primo questionario**, l'app gli chiede di **impostare una sua password** (perché
   quella attuale è provvisoria, impostata di default). Fatto questo, l'account è in sicurezza.

> Nota: la richiesta di reset avviene **alla fine del primo questionario** (opzione scelta), non al
> secondo accesso. Così l'account viene messo in sicurezza subito, anche se il lead non torna più.

## 3. Contratto dati — cosa deve impostare il backoffice/endpoint alla creazione

Quando il collega crea un lead da backoffice, l'account (`User`) va creato così:

| Campo | Valore | Perché |
|---|---|---|
| `email` | l'email reale del lead | chiave di accesso |
| `passwordHash` | hash **argon2** di una password provvisoria **casuale e unica** per quel lead (min 8 caratteri) | mai una password fissa uguale per tutti (sarebbe un buco di sicurezza) |
| `role` | `client` | è una cliente |
| `status` | `active` | può accedere subito |
| `emailVerifiedAt` | **adesso** (`now()`) | l'email l'ha messa un collega: la diamo per verificata, niente link di conferma |
| `mustChangePassword` | **`true`** | dice all'app che la password è provvisoria e va cambiata a fine questionario |

E **NON** va creato/compilato il questionario:

- **Nessun `ClientProfile` con `onboardingCompletedAt` valorizzato.** Il marcatore
  `ClientProfile.onboardingCompletedAt` deve restare **nullo** (o il `ClientProfile` non esistere
  ancora): è esattamente ciò che fa capire all'app "questo utente non ha mai fatto il questionario".

### Il campo `User.mustChangePassword` ESISTE GIÀ — niente migration nuova

Buona notizia: il flag è già nello schema Prisma condiviso e ha già la sua migration
(`20260714120000_must_change_password`):

```prisma
mustChangePassword Boolean @default(false) @map("must_change_password")
```

Ed è già tutto pronto lato backend:
- `UsersService.createUser(...)` accetta già `mustChangePassword` → alla creazione del lead da
  backoffice basta passarlo a **`true`**.
- Il flag viene già **azzerato** quando l'utente imposta la password (endpoint app dedicato, sotto).
- Il flag è già esposto nell'utente pubblico (`toPublicUser`), quindi l'app lo riceve al login.

Quindi al backoffice **non serve creare nessun campo**: basta che, nella creazione del lead cliente,
imposti `mustChangePassword: true` ed `emailVerifiedAt` = adesso, e non compili il questionario.
(La parte app che consuma il flag — endpoint `PATCH /me/password/initial` + schermata a fine
questionario — l'abbiamo già implementata noi.)

## 4. L'email al lead (parte del collega)

Contenuto minimo:
- l'**email** con cui accedere;
- la **password provvisoria** generata;
- una riga tipo: "Al primo accesso completerai un breve questionario e poi potrai impostare la tua
  password personale."

## 5. Cosa fa l'app cliente (lo sviluppiamo noi — qui solo per chiarezza, non va rifatto lato backoffice)

- **Al login**, se `ClientProfile.onboardingCompletedAt` è nullo → l'utente entra nel questionario
  di onboarding. La schermata "crea credenziali" non compare mai in fase di login (è solo nel flusso
  di auto-registrazione), quindi il lead da backoffice non la vede per costruzione.
- Questa logica vale **sia** per il lead da backoffice **sia** per un utente che si era registrato
  ma aveva abbandonato prima di finire il questionario: in entrambi i casi riprende dal questionario.
- **A fine questionario**, se `mustChangePassword = true`, l'app mostra "Imposta la tua password".
  Quando la reimposta, azzeriamo `mustChangePassword` (→ `false`). Per gli utenti auto-registrati il
  flag è `false`, quindi non vedono nessuna richiesta di reset.

## 6. Regole password (allineamento tecnico)

- Minimo **8 caratteri** (come la registrazione normale).
- Hash con **argon2** (stesso algoritmo di `auth.service`), mai password in chiaro nel DB o nelle mail salvate.
- La provvisoria deve essere **casuale e unica** per ogni lead.

## In una riga

Il backoffice crea il lead con email reale, una password provvisoria casuale (argon2), email già
verificata e `mustChangePassword = true`, **senza** compilare il questionario; l'app lo riconosce
dal questionario non completato, lo fa partire da lì saltando le credenziali, e a fine questionario
gli fa impostare la password definitiva azzerando il flag.
