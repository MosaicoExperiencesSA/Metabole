# Registro modifiche — CI Android APK: setup esplicito dell'Android SDK

**Data:** 29 luglio 2026 · Base: main.

## Problema
La workflow GitHub Actions "Android APK (debug)" fallisce (`build-apk` in ~1m17s, "All jobs have
failed", 2 annotazioni). Il fallimento è **dentro `./gradlew assembleDebug`** (parte e muore subito).

## Diagnosi (nel container)
- Web build (`tsc -b && vite build`): **OK** con l'ultimo codice → non sono le modifiche TSX.
- Step nativi pre-gradle (`cap add android`, widget, contapassi, push, icona): **tutti OK**.
- Config gradle standard di Capacitor 6 (AGP 8.2.1, Gradle 8.2.1, compileSdk 34, JDK 17). Il caso
  google-services senza json è già gestito (plugin applicato solo se il json esiste).
- La workflow **non aveva uno step esplicito di setup dell'Android SDK**: si affidava a quello
  preinstallato in `ubuntu-latest`. Quando l'immagine del runner cambia, gradle non trova SDK/
  build-tools e fallisce subito — coerente col fallimento fulmineo.

## Fix — `.github/workflows/android-apk.yml`
- Aggiunto lo step **`android-actions/setup-android@v3`** (dopo il setup Java, prima di `npm ci`):
  configura l'Android SDK, accetta le licenze e permette a gradle di scaricare platform-34 /
  build-tools-34. Rende il build riproducibile a prescindere dall'immagine del runner.

## Nota
- Questo copre la causa più probabile. Per conferma serve il testo delle **2 annotazioni** del run
  fallito (View workflow run → job build-apk → step "Build APK di debug"): se l'errore è diverso
  (es. dipendenza/AGP/kotlin) si adatta. Il push di questa modifica ri-lancia la workflow (i path
  di trigger includono il file della workflow).
