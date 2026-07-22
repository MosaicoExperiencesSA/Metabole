# Metabole — generare l'APK Android

L'app in `app/` è **unica per tutti i ruoli**: dopo il login smista in base al ruolo
dell'account (`GET /me` → `role`):

- **client** → app cliente (onboarding, menu, percorso, agenda…).
- **coach** / **sales** (Responsabile Coach) → schermate mobile coach (dashboard, clienti,
  alert, chat, agenda, guadagni).
- **nutritionist** / **head_nutritionist** → schermate mobile nutrizionista (dashboard,
  pazienti + cartella clinica, diete/protocolli, agenda visite, guadagni).
- altri ruoli staff (admin, marketing…) → messaggio "usa il backoffice web".

Tutte le schermate sono collegate al backend reale (`https://metabole-backend.onrender.com`),
non sono mockup. Sull'app nativa le chiamate REST passano dal layer nativo
(**CapacitorHttp** attivo), quindi funzionano anche se il backend non ha il CORS del browser.

---

## Prerequisiti (una volta sola)

- **Node 18+** e **npm** (per compilare il web).
- **Android Studio** (già installato sul Mac) con un JDK 17+ (Android Studio ne include uno).
- Alla prima apertura, Android Studio scarica da solo Android SDK + build-tools.

## Primo APK di prova (sideload) — passo per passo

Dalla cartella `app/`:

```bash
cd app
npm install                 # dipendenze web (una volta)
npm run android:init        # build web + genera la cartella android/ (npx cap add android)
npm run android:open        # apre il progetto android/ in Android Studio
```

In Android Studio:

1. Aspetta il **Gradle sync** (prima volta: qualche minuto, scarica le dipendenze).
2. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Al termine compare "APK(s) generated" con link **locate**: l'APK è in
   `app/android/app/build/outputs/apk/debug/app-debug.apk`.
4. Copia quell'`app-debug.apk` sul telefono (email/USB/Drive) e installalo
   (serve "Origini sconosciute" abilitato). È firmato con la chiave di **debug**: va bene
   per provare, non per il Play Store.

In alternativa, con un telefono collegato in **USB debugging**: premi ▶︎ **Run** e l'app
si installa e si avvia direttamente.

### Dopo aver modificato il codice web

```bash
npm run android:sync        # ricompila il web e lo copia in android/
```

poi ri-builda l'APK da Android Studio (o `Run`).

---

## Login di prova

Usa gli account esistenti sul backend di produzione (di prova). Esempi già presenti:

- **Cliente**: `simone.salogni+cliente-test@gmail.com` (Giulia Test).
- **Coach**: `coach.test@metabole.eu` (Marta Coach).
- **Nutrizionista**: `nutrizionista.test@metabole.eu` (Dr.ssa Bini).

(le password sono quelle già in uso per il collaudo; gli account `@metabole.eu` reali sono
14, vedi note di progetto).

---

## Notifiche push (opzionale, dopo)

L'APK si compila e gira **senza** Firebase: le push semplicemente non partono (la
registrazione fallisce ed è gestita, l'app non crasha). Per accenderle serve un progetto
**Firebase Cloud Messaging** (vedi `Metabole_Notifiche_Push_Setup.md`):

1. Crea il progetto Firebase e un'app Android con package **`app.metabole`**.
2. Scarica `google-services.json` e mettilo in `app/android/app/`.
3. In `app/android/build.gradle` aggiungi il classpath
   `com.google.gms:google-services:4.4.2`; in `app/android/app/build.gradle` in fondo:
   `apply plugin: 'com.google.gms.google-services'`.
4. Ricompila. Il token viene mandato a `POST /me/push-tokens` (già gestito nel codice).
5. La chiave service account va **solo** su Render (`FIREBASE_SERVICE_ACCOUNT`), mai nel repo.

---

## Verso il Play Store (fase successiva)

Per pubblicare servono, oltre all'account **Google Play Developer** (25$ una tantum):

- Una **firma di release** (keystore) — da `Build → Generate Signed Bundle / APK`.
- Il formato **AAB** (Android App Bundle), non l'APK.
- Icona/nome/versione definitivi (`app/android/app/src/main/res` e `versionCode`/`versionName`).

Il keystore di release va custodito (mai nel repo). Posso predisporre `signingConfigs` e il
flusso quando arriviamo a quel punto.

---

## Note tecniche

- **appId**: `app.metabole` · **appName**: `Metabole`.
- La cartella `android/` è in `.gitignore` (generata): si rigenera con `npm run android:init`.
- Endpoint API: default `https://metabole-backend.onrender.com`; override con `VITE_API_URL`
  in `app/.env` per puntare a un altro backend.
- CI: `.github/workflows/android-apk.yml` compila un APK di debug a ogni push (artefatto
  scaricabile) — comodo per non dipendere dal Mac.
