# Nota completa per l'agente APP — Metabole (29/07/2026)

Nota autonoma per chi gestisce **build, Capgo OTA e pubblicazione** dell'app (iOS/Android). Tutta la
**logica backend + frontend è già su `main`** e la CI **Backend / App / Backoffice è verde**. Restano
due cose lato app: (1) far arrivare il frontend aggiornato all'**app iOS/Android installata**, (2) far
passare la **CI "Android APK (debug)"**. Sotto trovi tutto: cosa è cambiato, come spedirlo e come
correggere la build.

---

## A) STATO ATTUALE
- **Backend (Render):** deployato, aggiornato. Nessuna migration, nessun env nuovo.
- **Web app (Vercel):** aggiornata (deploy automatico al push). Gli utenti su browser vedono già tutto.
- **App iOS (TestFlight) / Android installata:** hanno ancora il **bundle JS vecchio** → mostrano il
  vecchio comportamento anche se il backend è nuovo. Serve spedire il nuovo bundle (OTA o rebuild).
- **CI GitHub Actions:** Backend/App/Backoffice verdi; **"Android APK (debug)" rossa** (vedi §C).

---

## B) iOS/ANDROID INSTALLATA: SPEDIRE IL NUOVO BUNDLE (OTA Capgo)
**Perché:** i fix recenti sono nel frontend (`app/src/**`). L'app impacchetta il bundle: finché non
si spedisce un aggiornamento, l'app usa il JS della vecchia build. (Es.: il vecchio bundle non conosce
lo stato menu `expired`, quindi continua a mostrare l'ultimo menu invece di "percorso concluso".)

**Come:** pubblicare una **release OTA Capgo** col nuovo `dist/`:
```
cd app
npm run build            # verde (verificato)
npm run ...ota...        # scripts/ota-release.mjs → canale letto dall'app
```
In alternativa (o in parallelo, per chi installa da zero): nuova build store —
`npx cap sync ios android`, poi Xcode (build number +1) per TestFlight/App Store e Android Studio
(versionCode +1) per Play.

**Cosa contiene questo aggiornamento (cosa vede l'utente):**
- **Percorso concluso:** a prova/piano scaduto niente "menu di oggi"/"menu futuri" su Home e "Il tuo
  percorso"; compare "Nessun piano attivo"; **non** si mostra più un menu vecchio come "di oggi"; lo
  storico "Menu passati" resta.
- **Report:** progressione piano (obiettivo 1/3 mesi → mantenimento → monitoraggio); **niente
  congratulazioni se la cliente è ingrassata** (tono incoraggiante); invito "chiedi alla coach per
  sconti esclusivi" sotto il prezzo.
- **Menu/Home:** tasto **"Ricetta"** apre la scheda ricetta (non naviga al menu); popup valutazione,
  il tasto **"Seguita"** ora si evidenzia.
- **Coach (nell'app unica):** **Email in-app** nella lista clienti/lead (apre la Posta interna, non il
  chooser del SO).
- (Da lavori poco precedenti, se non già nella build attiva: deep-link notifiche, pallino attività
  coach, fix sostituzione ingrediente in Home.)

**File `app/src` toccati (nel bundle):** `pages/Home.tsx`, `pages/Menu.tsx`, `pages/Percorso.tsx`,
`pages/Report.tsx`, `components/MenuReviewPopup.tsx`, `components/MenuStatusBanner.tsx`,
`staff/shared/ContactActions.tsx` (+ eventuale `components/AppHeader.tsx`, `staff/*`).

**⚠ Nota review (se fate una build store, non serve per l'OTA):** ora **senza misure iniziali il menu
è trattenuto e il popup misure è bloccante** (per ogni piano attivo e a ogni ciclo). L'account di
review deve poterlo superare (inserendo il peso). Testare / annotarlo al recensore.

---

## C) CI "Android APK (debug)": ERRORE E FIX
Log reale dello step `./gradlew assembleDebug`:
```
Execution failed for task ':app:checkDebugAarMetadata'.
> An issue was found when checking AAR metadata:
  1. Dependency 'androidx.work:work-runtime:2.10.5' requires libraries and applications that
     depend on it to compile against version 35 or later of the Android APIs.
     :app is currently compiled against android-34.
     Also, the maximum recommended compile SDK version for AGP 8.2.1 is 34.
BUILD FAILED
```
**Causa:** `@capgo/capacitor-updater@6.50.2` porta `androidx.work:work-runtime:2.10.5`, che richiede
**compileSdk 35**. Il progetto generato da Capacitor 6 è a **compileSdk/targetSdk 34, AGP 8.2.1,
Gradle 8.2.1** (`android/variables.gradle`, `android/build.gradle`, `gradle-wrapper.properties`).
Lo step `android-actions/setup-android@v3` (già aggiunto alla workflow, va TENUTO) è necessario ma
non sufficiente: bisogna alzare la SDK.

`android/` è **generato in CI** (gitignored), quindi il fix va applicato **dopo `cap add android`**
(es. un piccolo script chiamato in `android:init` / `android:sync`, come i vari `install-*.mjs`).

**Fix consigliato (durevole) — compileSdk 35:**
- `android/variables.gradle`: `compileSdkVersion = 35` e `targetSdkVersion = 35`
- `android/build.gradle`: `classpath 'com.android.tools.build:gradle:8.6.0'` (o 8.7.x)
- `android/gradle/wrapper/gradle-wrapper.properties`: `...gradle-8.7-all.zip` (o 8.9)
- (AGP 8.6+/Gradle 8.7+ richiedono JDK 17 → già impostato nella workflow.)

**Fix alternativo (minimale, resta su SDK 34/AGP 8.2.1) — forzare work-runtime:**
in `android/app/build.gradle`:
```gradle
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.9.1'
        force 'androidx.work:work-runtime-ktx:2.9.1'
    }
}
```
Da verificare che Capgo 6.50.2 giri con WorkManager 2.9.x (2.9↔2.10 è API-compatibile).

**Ordine di deploy generale:** backend (già fatto) → poi app (OTA e/o build). Nessuna dipendenza
stretta col fix CI, che riguarda solo l'artefatto APK di debug.

---

## D) COSA NON È VOSTRO (già chiuso lato logica)
Tutti i fix di comportamento (backend + frontend) sono su `main` e testati dalla CI. Questa nota
riguarda solo: **spedire il frontend all'app (OTA)** e **far passare la build APK (SDK 35 per Capgo)**.
Per domande sulla logica applicativa: registri `REGISTRO_*.md` nella root del repo.
