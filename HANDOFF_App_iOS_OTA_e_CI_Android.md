# Handoff per l'agente APP — iOS non aggiornato (OTA) + CI Android APK rossa

Nota per la sessione/agente che gestisce build, Capgo OTA e pubblicazione (i file `capgo`,
`scripts/ota-release.mjs`, `install-ios.mjs`, `install-play.mjs` stanno sul repo lato app, NON nel
repo backend/cloud). Diagnosi fatta il 29/07/2026.

---

## 1) iOS mostra il vecchio comportamento (web OK)
**Sintomo:** dopo i fix "percorso concluso / niente menu vecchio in dashboard" (e altri fix
frontend), la **web app (Vercel)** è corretta, ma l'**app iOS (TestFlight)** mostra ancora il
vecchio comportamento.

**Causa:** i fix sono nel **frontend** (`app/src/pages/Home.tsx`, `Percorso.tsx`,
`components/MenuStatusBanner.tsx`, ecc.). L'app iOS ha il **bundle JS impacchettato** dell'ultima
build; il backend è aggiornato ma il frontend nell'app no. (Il vecchio bundle non conosce lo stato
`expired` e fa ancora il fallback all'ultimo menu.)

**Fix:** pubblicare una **release OTA Capgo** col nuovo `dist/` (già buildabile: `npm run build` in
`app/` è verde), così l'app iOS/Android scarica il bundle aggiornato **senza passare dallo store**.
In pratica: `npm run build` → lo script OTA del progetto (`scripts/ota-release.mjs`) verso il
canale che l'app legge. In alternativa, una nuova build TestFlight con `npx cap sync` + Xcode.

## 2) CI "Android APK (debug)" rossa — errore reale
Log dello step `./gradlew assembleDebug`:
```
Execution failed for task ':app:checkDebugAarMetadata'.
> Dependency 'androidx.work:work-runtime:2.10.5' requires libraries and applications that
  depend on it to compile against version 35 or later of the Android APIs.
  :app is currently compiled against android-34.
  Also, the maximum recommended compile SDK for AGP 8.2.1 is 34.
```

**Causa:** `@capgo/capacitor-updater@6.50.2` tira `androidx.work:work-runtime:2.10.5`, che pretende
**compileSdk 35**. Il progetto generato da Capacitor 6 usa **compileSdk/targetSdk 34, AGP 8.2.1,
Gradle 8.2.1** (in `android/variables.gradle`, `android/build.gradle`, `gradle-wrapper.properties`).
Lo step `android-actions/setup-android` (aggiunto nella workflow) NON basta: serve alzare la SDK.

**Fix consigliato (durevole):** portare il progetto a **compileSdk 35** con AGP/Gradle compatibili.
Poiché `android/` è generato in CI (gitignored), va applicato DOPO `cap add android` — es. un piccolo
script chiamato in `android:init`/`android:sync` che imposta:
- `android/variables.gradle`: `compileSdkVersion = 35` (e `targetSdkVersion = 35`);
- `android/build.gradle`: `com.android.tools.build:gradle:8.6.0` (o 8.7.x);
- `android/gradle/wrapper/gradle-wrapper.properties`: `gradle-8.7-all.zip` (o 8.9).

**Fix alternativo (minimale, se non si vuole alzare AGP/SDK ora):** forzare la work-runtime a una
versione che compila con SDK 34, aggiungendo in `android/app/build.gradle`:
```gradle
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.9.1'
        force 'androidx.work:work-runtime-ktx:2.9.1'
    }
}
```
(Da iniettare post-generazione, come fanno gli script `install-*.mjs`.) Da verificare che Capgo
6.50.2 funzioni con work-runtime 2.9.x (WorkManager 2.9↔2.10 è API-compatibile).

**Nota:** lo step `- name: Setup Android SDK / uses: android-actions/setup-android@v3` aggiunto oggi
alla workflow è comunque corretto e va tenuto (serve per far scaricare a gradle platform/build-tools).

---

## Cosa NON è coinvolto qui
Tutti i fix di logica (backend + frontend) sono già su `main` e la CI **Backend/App/Backoffice è
verde**. Questo handoff riguarda solo: (1) far arrivare il frontend aggiornato all'app iOS via OTA,
(2) far passare la build APK di debug alzando la SDK per Capgo.
