#!/bin/bash
#
# Metabole — build APK completo in un colpo solo.
#   1. sposta google-services.json nel posto giusto (attiva le push)
#   2. allinea i file da iCloud e compila l'APK
#   3. apre la cartella con l'APK pronto
#
# USO:
#   bash build-apk.sh                      → cerca google-services.json in Downloads/Desktop
#   bash build-apk.sh /percorso/al/file    → usa il file che gli indichi
#
# Dopo la prima volta il file resta in iCloud: puoi lanciarlo senza argomenti.

set -e

ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Metabole"
BUILD="$HOME/MetaboleBuild"
APKDIR="$BUILD/app/android/app/build/outputs/apk/debug"
GS_DEST="$ICLOUD/app/google-services.json"

echo "=== Metabole · build APK ==="

# ---- 1. google-services.json nel posto giusto -------------------------------
SRC="${1:-}"
if [ -z "$SRC" ]; then
  for c in "$HOME/Downloads/google-services.json" "$HOME/Desktop/google-services.json"; do
    if [ -f "$c" ]; then SRC="$c"; break; fi
  done
fi

if [ -n "$SRC" ] && [ -f "$SRC" ]; then
  echo "→ Sposto google-services.json in app/ (push attive)…"
  mkdir -p "$ICLOUD/app"
  mv -f "$SRC" "$GS_DEST"
  echo "   ok: $GS_DEST"
elif [ -f "$GS_DEST" ]; then
  echo "→ google-services.json già presente in app/ → push attive."
else
  echo "⚠️  google-services.json non trovato (né in Downloads/Desktop né passato come argomento)."
  echo "    Compilo lo stesso, ma le PUSH resteranno SPENTE."
  echo "    Per attivarle: scaricalo da Firebase e rilancia, oppure:"
  echo "    bash build-apk.sh /percorso/google-services.json"
fi

# ---- 2. allineo e compilo ---------------------------------------------------
echo "→ Allineo i file da iCloud…"
rsync -a --delete --exclude node_modules --exclude android "$ICLOUD/" "$BUILD/"

echo "→ Sync Capacitor (build web + widget + contapassi + push)…"
cd "$BUILD/app"
npm run android:sync

echo "→ Compilo l'APK (gradle)…"
cd "$BUILD/app/android"
./gradlew assembleDebug

# ---- 3. apro la cartella ----------------------------------------------------
echo "✅ APK pronto: $APKDIR/app-debug.apk"
open "$APKDIR"
