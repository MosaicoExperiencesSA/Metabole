# Registro modifiche — Preparazione Play Store (appId definitivo + SDK 35)

**Data:** 22 luglio 2026
**Ambito:** app mobile (Capacitor/Android) — preparazione alla pubblicazione su Google Play.

## Summary
Play Store: appId definitivo `app.metabole` e target SDK 35 (nuovo script android:play)

## Description
Preparazione della prima pubblicazione su Google Play. Due interventi:

1. **applicationId definitivo `app.metabole`** (era `app.metabole.client`). Su Play l'ID non
   si può più cambiare dopo la pubblicazione, quindi è stato fissato ora. Aggiornati:
   - `app/capacitor.config.ts` (appId)
   - `scripts/install-widget.mjs` e `scripts/install-steps.mjs` (cartella package
     `java/app/metabole`)
   - `docs/android-widget/java/MetaboleWidget.java`, `docs/android-steps/StepCounter.java`,
     `docs/android-steps/MainActivity.java` (dichiarazione `package app.metabole;`)
   - documentazione (`app/BUILD_ANDROID.md`, `Metabole_Notifiche_Push_Setup.md`)

2. **Requisiti Play 2026** — nuovo `scripts/install-play.mjs` (agganciato a
   `npm run android:sync` in `app/package.json`):
   - `compileSdkVersion`/`targetSdkVersion` → **35** (Google Play rifiuta app nuove con
     target < 35; il template Capacitor 6 usa 34)
   - `android.suppressUnsupportedCompileSdk=35` in gradle.properties (AGP 8.2)
   - opt-out temporaneo dall'edge-to-edge forzato di Android 15 in styles.xml
     (`windowOptOutEdgeToEdgeEnforcement`), da rimuovere quando gestiremo le safe-area

## Conseguenze operative (da fare sul Mac)
- **Firebase**: il `google-services.json` esistente è registrato per `app.metabole.client`
  → nel progetto Firebase va aggiunta una nuova app Android con package **`app.metabole`**
  e il nuovo `google-services.json` va messo in `Metabole/app/` al posto del vecchio
  (senza, la build fallisce con "No matching client found for package name 'app.metabole'").
- **Rigenerare il progetto Android**: eliminare `~/MetaboleBuild/app/android` e la vecchia
  `Metabole/app/android` in iCloud (residuo di build), poi `npm run android:init` +
  `npm run android:sync` dalla copia di build.
- Il keystore di release NON è nel repo: va creato da Android Studio
  (Build → Generate Signed Bundle) e custodito fuori da iCloud/repo.

## Note
- Le push sono già attive end-to-end (backend FIREBASE_SERVICE_ACCOUNT su Render +
  google-services.json lato app): con il nuovo package continueranno a funzionare appena
  sostituito il json.
- Prima release: `versionCode 1`, `versionName "1.0"` (default del template, ok).
