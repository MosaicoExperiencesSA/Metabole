#!/bin/bash
#
# Metabole — prepara/aggiorna il progetto iOS e apre Xcode.
#   1. sposta GoogleService-Info.plist da Downloads in app/ (se c'è → push attive)
#   2. allinea i file da iCloud, npm install, genera ios/ se manca
#   3. sync Capacitor + adeguamenti Metabole (icona, versione, Firebase)
#   4. pod install e apertura di Xcode: da lì si fa Run (iPhone) o Archive (App Store)
#
# USO:  bash build-ios.sh

set -e

ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Metabole"
BUILD="$HOME/MetaboleBuild"
PLIST_DEST="$ICLOUD/app/GoogleService-Info.plist"

echo "=== Metabole · progetto iOS ==="

# ---- 1. GoogleService-Info.plist da Downloads/Desktop (come per Android) ----
for c in "$HOME/Downloads/GoogleService-Info.plist" "$HOME/Desktop/GoogleService-Info.plist"; do
  if [ -f "$c" ]; then
    mv -f "$c" "$PLIST_DEST"
    echo "→ GoogleService-Info.plist spostato in app/ (push iOS attive)."
    break
  fi
done
if [ ! -f "$PLIST_DEST" ]; then
  echo "ℹ️  GoogleService-Info.plist non trovato: procedo con push iOS spente."
  echo "    (Firebase → Aggiungi app iOS bundle app.metabole → scarica il plist e rilancia)"
fi

# ---- 2. allineo e preparo ---------------------------------------------------
echo "→ Allineo i file da iCloud…"
rsync -a --delete --exclude node_modules --exclude android --exclude ios "$ICLOUD/" "$BUILD/"

cd "$BUILD/app"
echo "→ npm install…"
npm install

if [ ! -d ios ]; then
  echo "→ Genero il progetto iOS (cap add ios)…"
  npm run build
  npx cap add ios
fi

# ---- 3. sync + adeguamenti Metabole ----------------------------------------
echo "→ Sync Capacitor iOS + adeguamenti (icona, versione, Firebase)…"
npm run build
npx cap sync ios
node ../scripts/install-ios.mjs

# ---- 4. pod install + Xcode -------------------------------------------------
echo "→ pod install…"
cd ios/App
pod install

echo "→ Apro Xcode…"
open App.xcworkspace

echo ""
echo "✅ Progetto pronto. In Xcode:"
echo "   • Signing & Capabilities → Team: Mosaico Experiences SA (una volta)"
echo "   • + Capability: Push Notifications e Background Modes→Remote notifications (una volta)"
echo "   • prima volta col plist: trascina GoogleService-Info.plist nel gruppo App (una volta)"
echo "   • ▶︎ Run con l'iPhone collegato per provare · Product → Archive per l'App Store"
