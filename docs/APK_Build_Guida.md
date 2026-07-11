# Costruire l'APK Android di Metabole

L'app è **Capacitor** (web React → app nativa). L'APK si genera sul tuo Mac con
**Android Studio**. La configurazione è già pronta (`capacitor.config.ts`:
appId `app.metabole.client`, appName `Metabole`, webDir `dist`). `android/` è
gitignored: si rigenera in locale (non serve committarlo).

## Prerequisiti (una volta)
- **Node.js** installato (per `npm`).
- **Android Studio** installato con **Android SDK** e **JDK** (Android Studio include un JDK).
  La prima apertura scarica gli SDK necessari da sola.

## Passi (nel Terminale del Mac)

```bash
# 1. Vai nella cartella dell'app
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Metabole/app

# 2. Installa le dipendenze (la prima volta o dopo un pull)
npm install

# 3. Compila la web app in dist/
npm run build

# 4. Crea il progetto Android nativo (SOLO la prima volta)
npx cap add android

# 5. Copia web + plugin nel progetto Android (ogni volta che cambi la app)
npx cap sync android

# 6. Apri in Android Studio
npx cap open android
```

## In Android Studio
1. Attendi il **Gradle Sync** (in basso). Se chiede di installare SDK/componenti, accetta.
2. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. A fine build, clic su **locate** nella notifica: l'APK di test è in
   `android/app/build/outputs/apk/debug/app-debug.apk`.
4. Trasferisci l'`app-debug.apk` sul telefono Android (USB o link) e installalo
   (abilita "origini sconosciute" se richiesto).

In alternativa, da terminale senza aprire Android Studio:
```bash
cd android && ./gradlew assembleDebug
# APK in android/app/build/outputs/apk/debug/app-debug.apk
```

## Icona e splash (consigliato)
Di default l'APK usa l'icona Capacitor. Per l'icona Metabole:
```bash
# metti un logo 1024x1024 in  resources/icon.png  (e opz. resources/splash.png 2732x2732)
npm i -D @capacitor/assets
npx capacitor-assets generate --android
npx cap sync android
```
(Se non hai il logo in PNG ad alta risoluzione, dimmelo e vediamo come prepararlo.)

## Note
- **Backend**: l'app punta di default a `https://metabole-backend.onrender.com`
  (variabile `VITE_API_URL`, override opzionale via `.env` prima di `npm run build`).
- **APK di test vs release**: `app-debug.apk` va bene per provare su un telefono.
  Per distribuirlo (Play Store o installazione firmata) serve un **APK/AAB firmato**
  con un keystore — quando ci arriviamo ti guido a creare il keystore e a firmare.
- **versione**: `versionCode 1` / `versionName "1.0"` in `android/app/build.gradle`;
  alzali a ogni nuova release.
- **Widget da home screen**: il codice nativo del widget si aggiunge in questo stesso
  progetto Android (vedi `docs/Widget_Nativo_Guida.md`); l'endpoint dati è già pronto.
