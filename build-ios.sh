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

# Repo spostato fuori da iCloud il 6/8/2026: iCloud teneva i file come segnaposto
# vuoti e corrompeva .git. La variabile si chiama ancora SORGENTE per chiarezza.
SORGENTE="$HOME/Progetti/Metabole"
BUILD="$HOME/MetaboleBuild"
PLIST_DEST="$SORGENTE/app/GoogleService-Info.plist"

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
echo "→ Allineo i file dal repo…"
rsync -a --delete --exclude node_modules --exclude android --exclude ios "$SORGENTE/" "$BUILD/"

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
echo "   • Signing & Capabilities → Team: Genius Company SA (TNDPSUPTA8) — è questo, non altri"
echo "   • + Capability: Push Notifications e Background Modes→Remote notifications (una volta)"
echo "   • prima volta col plist: trascina GoogleService-Info.plist nel gruppo App (una volta)"
echo "   • ▶︎ Run con l'iPhone collegato per provare · Product → Archive per l'App Store"
echo ""
echo "⚠️  PRIMA di caricare l'archivio, verifica che le push siano accese (il 6/8 sono"
echo "    costate un'ora: l'archivio si firmava in development senza dire niente)."
echo "    Con l'archivio selezionato in Organizer → tasto destro → Show in Finder, poi:"
echo "      codesign -d --entitlements - --xml <archivio>/Products/Applications/App.app | xxd -r -p"
echo "    Devono risultare  aps-environment = production  e  get-task-allow assente/false."
echo "    Se esce 'development': manca il certificato Apple Distribution (scade ogni anno)."
