# Nota per l'agente APP — Metabole (30/07/2026)

Aggiornamento per chi gestisce **build, Capgo OTA e pubblicazione** dell'app iOS/Android.
Tutta la **logica backend + frontend web è già su `main`** e va in produzione al push (Render +
Vercel). Restano da fare **solo** cose lato app: spedire il nuovo bundle all'app installata e far
passare la CI Android. Sotto: cosa è cambiato di recente nell'app, e i due punti aperti.

---

## A) STATO
- **Backend (Render):** al push si applicano **2 migration** in automatico
  (`20260730120000_recipe_difficulty_simple_pref`, `20260730130000_client_activity_level`).
  Nessun env nuovo. Il calcolo fabbisogno e i menu "a necessità" sono attivi lato server.
- **Web app + backoffice (Vercel):** aggiornati al push. Gli utenti su browser vedono già tutto.
- **App iOS (TestFlight) / Android installata:** hanno ancora il **bundle JS precedente** → NON
  mostrano le novità frontend qui sotto finché non si spedisce il nuovo bundle (OTA o rebuild).

---

## B) NOVITÀ FRONTEND DELL'APP DA SPEDIRE (OTA)
Modifiche in `app/src/**` accumulate dagli ultimi lavori. Vanno all'app installata con una
**release OTA Capgo** del nuovo `dist/` (oppure una nuova build store).

File toccati nel bundle app (oltre a quelli delle note precedenti):
- `app/src/pages/Profilo.tsx`:
  - nuova sezione **"Attività fisica"** (la cliente sceglie il livello: sedentaria → molto attiva)
    → alimenta il calcolo del fabbisogno calorico;
  - nuova sezione **"Ricette" → toggle "Preferisco ricette semplici"** (menu con piatti semplici
    di cucina italiana, quando disponibili).

Cosa vede l'utente dopo l'aggiornamento: nel Profilo compaiono "Attività fisica" e il toggle
"Preferisco ricette semplici". (Le calorie dei menu e le ricette semplici sono lato backend: già
attive al deploy, ma il **controllo dell'attività** e il **toggle** in app arrivano solo col bundle.)

**Come spedire (come per le release precedenti):**
```
cd app
npm run build            # verde (verificato)
npm run ...ota...        # scripts/ota-release.mjs → canale letto dall'app
```
In alternativa: nuova build store (`npx cap sync ios android` → Xcode / Android Studio, build
number +1).

> Nota: gli script `capgo` / `scripts/ota-release.mjs` / `install-*.mjs` stanno **solo** sul repo
> lato app (il repo backend/cloud non li ha), quindi la release OTA la fai tu da lì.

---

## C) PUNTI ANCORA APERTI (dalle note precedenti — TUTTORA VALIDI)

### C1) iOS/Android installata: serve la prima release OTA
Le modifiche frontend degli ultimi giorni (percorso concluso / niente menu vecchio in dashboard,
tasto "Ricetta", report, email in-app, ecc. + le due nuove sezioni del Profilo di §B) sono nel
bundle: finché non parte una release OTA, l'app installata mostra il vecchio comportamento.

### C2) CI "Android APK (debug)" rossa — alzare la SDK per Capgo
Errore reale dello step `./gradlew assembleDebug`:
```
Dependency 'androidx.work:work-runtime:2.10.5' requires ... compile against version 35 or later
:app is currently compiled against android-34
```
Causa: `@capgo/capacitor-updater@6.50.2` porta `androidx.work:work-runtime:2.10.5`, che richiede
**compileSdk 35**; il progetto Capacitor 6 è a compileSdk/targetSdk 34, AGP 8.2.1, Gradle 8.2.1.
`android/` è generato in CI (gitignored) → il fix va applicato **dopo `cap add android`**
(es. script chiamato in `android:init`/`android:sync`).

Fix consigliato (durevole): portare a **compileSdk 35**
- `android/variables.gradle`: `compileSdkVersion = 35`, `targetSdkVersion = 35`
- `android/build.gradle`: `com.android.tools.build:gradle:8.6.0` (o 8.7.x)
- `android/gradle/wrapper/gradle-wrapper.properties`: `gradle-8.7-all.zip` (o 8.9)

Fix alternativo (minimale, resta su SDK 34): forzare la work-runtime in `android/app/build.gradle`:
```gradle
configurations.all {
  resolutionStrategy {
    force 'androidx.work:work-runtime:2.9.1'
    force 'androidx.work:work-runtime-ktx:2.9.1'
  }
}
```
Lo step `android-actions/setup-android@v3` già in workflow va **tenuto**.

---

## D) COSA NON È VOSTRO (già chiuso lato logica)
Fabbisogno calorico, menu a necessità, ricette semplici, campo attività: tutto backend + web è su
`main` e va live al push. Questa nota riguarda solo: (1) spedire il frontend aggiornato all'app
(OTA), (2) far passare la build APK (SDK 35 per Capgo). Dettagli logica: registri `REGISTRO_*.md`
nella root del repo.
