#!/bin/bash
#
# Metabole — genera l'AAB di RELEASE firmato, pronto per il Play Store.
#   1. trova un JDK 17 (quello richiesto da Gradle 8.2.1)
#   2. crea il keystore di release la PRIMA volta (password generata e salvata
#      in ~/MetaboleKeys/keystore-password.txt → copiala nel password manager!)
#   3. allinea i file da iCloud, npm install, rigenera/sincronizza android/
#   4. compila l'AAB (bundleRelease), lo firma e apre la cartella col file
#
# USO:  bash build-aab.sh
# Il file finale è: ~/MetaboleBuild/app/android/app/build/outputs/bundle/release/app-release.aab

set -e

ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Metabole"
BUILD="$HOME/MetaboleBuild"
KEYS="$HOME/MetaboleKeys"
ALIAS="metabole"
OUT="$BUILD/app/android/app/build/outputs/bundle/release"

echo "=== Metabole · build AAB per il Play Store ==="

# ---- 0. Se il keystore era già stato creato altrove (wizard di Android Studio) lo riusiamo
if [ -f "$HOME/Documents/MetaboleKeys/metabole-release.jks" ]; then
  KEYS="$HOME/Documents/MetaboleKeys"
fi
KS="$KEYS/metabole-release.jks"
PWFILE="$KEYS/keystore-password.txt"

# ---- 1. JDK 17 ---------------------------------------------------------------
if [ -n "$JAVA_HOME" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "17'; then
  :
else
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
fi
if [ -z "$JAVA_HOME" ]; then
  for d in "$HOME/Library/Java/JavaVirtualMachines"/*/Contents/Home /Library/Java/JavaVirtualMachines/*/Contents/Home; do
    if [ -x "$d/bin/java" ] && "$d/bin/java" -version 2>&1 | grep -q 'version "17'; then
      JAVA_HOME="$d"; break
    fi
  done
fi
if [ -z "$JAVA_HOME" ]; then
  echo "❌ Non trovo un JDK 17 sul Mac."
  echo "   In Android Studio: Settings → Build Tools → Gradle → Gradle JDK → Download JDK… → 17."
  echo "   Poi rilancia questo script."
  exit 1
fi
export JAVA_HOME
echo "→ JDK 17: $JAVA_HOME"

# ---- 2. Keystore di release (creato solo la prima volta) --------------------
mkdir -p "$KEYS"
if [ ! -f "$KS" ]; then
  echo "→ Creo il keystore di release (prima volta)…"
  PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 28)"
  printf '%s\n' "$PASS" > "$PWFILE"
  chmod 600 "$PWFILE"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Metabole, O=Metabole, C=IT"
  echo ""
  echo "   ⚠️⚠️  KEYSTORE CREATO: $KS"
  echo "   ⚠️⚠️  PASSWORD in:    $PWFILE"
  echo "   ⚠️⚠️  Copia password e file nel password manager / backup: se li perdi"
  echo "         non potrai MAI più aggiornare l'app sul Play Store."
  echo ""
fi
if [ ! -f "$PWFILE" ]; then
  echo "Il keystore esiste ma manca $PWFILE."
  read -r -s -p "Inserisci la password del keystore: " PASS; echo
  printf '%s\n' "$PASS" > "$PWFILE"; chmod 600 "$PWFILE"
fi
PASS="$(head -n1 "$PWFILE")"

# ---- 3. Allineo da iCloud e preparo il progetto -----------------------------
echo "→ Allineo i file da iCloud…"
rsync -a --delete --exclude node_modules --exclude android "$ICLOUD/" "$BUILD/"

cd "$BUILD/app"
echo "→ npm install (dipendenze aggiornate)…"
npm install

if [ ! -d android ]; then
  echo "→ Progetto android/ assente: lo genero (cap add android)…"
  npm run android:init
fi
echo "→ Sync Capacitor (build web + widget + contapassi + push + requisiti Play)…"
npm run android:sync

# local.properties (posizione dell'Android SDK) se manca — serve fuori da Android Studio
if [ ! -f android/local.properties ]; then
  echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
  echo "→ Creato android/local.properties (SDK in ~/Library/Android/sdk)."
fi

# ---- 4. Compilo e firmo l'AAB -----------------------------------------------
echo "→ Compilo l'AAB di release (può metterci qualche minuto)…"
cd android
./gradlew bundleRelease

echo "→ Firmo l'AAB con il keystore…"
"$JAVA_HOME/bin/jarsigner" -keystore "$KS" -storepass "$PASS" \
  "$OUT/app-release.aab" "$ALIAS"
"$JAVA_HOME/bin/jarsigner" -verify "$OUT/app-release.aab" | grep -q "jar verified" \
  && echo "   firma verificata ✓"

echo ""
echo "✅ AAB pronto per il Play Store:"
echo "   $OUT/app-release.aab"
open "$OUT"
