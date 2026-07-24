#!/usr/bin/env node
/**
 * Adegua il progetto iOS generato da Capacitor (cap add ios) per Metabole:
 *   1. ICONA: copia docs/ios-icon/AppIcon-512@2x.png (1024×1024, senza trasparenza)
 *      al posto dell'icona di default di Capacitor.
 *   2. VERSIONE: MARKETING_VERSION / CURRENT_PROJECT_VERSION nel progetto Xcode
 *      presi da app/android-version.json (stessa fonte di verità di Android).
 *   3. PUSH (solo se app/GoogleService-Info.plist esiste — stesso pattern difensivo
 *      di install-push.mjs Android; senza file: build ok, push spente):
 *      - copia il plist in ios/App/App/ (va poi trascinato UNA volta dentro Xcode)
 *      - aggiunge `pod 'FirebaseMessaging'` al Podfile
 *      - patcha AppDelegate.swift: FirebaseApp.configure() + scambio token APNs→FCM
 *        (il backend invia via FCM: serve il token FCM, non quello APNs grezzo)
 *
 * IDEMPOTENTE. Eseguito da `npm run ios:sync` dopo `cap sync ios`.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IOS = path.join(ROOT, 'app', 'ios');
const APP_DIR = path.join(IOS, 'App', 'App');
const PBXPROJ = path.join(IOS, 'App', 'App.xcodeproj', 'project.pbxproj');
const PODFILE = path.join(IOS, 'App', 'Podfile');
const APPDELEGATE = path.join(APP_DIR, 'AppDelegate.swift');
const ICON_SRC = path.join(ROOT, 'docs', 'ios-icon', 'AppIcon-512@2x.png');
const ICON_DEST = path.join(APP_DIR, 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const PLIST_SRC = path.join(ROOT, 'app', 'GoogleService-Info.plist');
const PLIST_DEST = path.join(APP_DIR, 'GoogleService-Info.plist');
const VERSION_FILE = path.join(ROOT, 'app', 'android-version.json');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(APP_DIR))) {
    console.error(`❌ Manca ${APP_DIR}\n   Genera prima il progetto iOS:  cd app && npm run ios:init`);
    process.exit(1);
  }

  // 1) Icona
  if (await exists(ICON_SRC)) {
    await fs.copyFile(ICON_SRC, ICON_DEST);
    console.log('→ Icona Metabole installata (AppIcon 1024).');
  } else {
    console.log('→ docs/ios-icon/AppIcon-512@2x.png assente: resta l\'icona di default.');
  }

  // 2) Versione da android-version.json
  if ((await exists(VERSION_FILE)) && (await exists(PBXPROJ))) {
    const { versionCode, versionName } = JSON.parse(await fs.readFile(VERSION_FILE, 'utf8'));
    let p = await fs.readFile(PBXPROJ, 'utf8');
    const patched = p
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`);
    if (patched !== p) {
      await fs.writeFile(PBXPROJ, patched);
      console.log(`→ Versione Xcode: ${versionName} (build ${versionCode}).`);
    } else {
      console.log(`→ Versione Xcode già a ${versionName} (build ${versionCode}).`);
    }
  }

  // 3) Push / Firebase (solo se il plist c'è)
  if (!(await exists(PLIST_SRC))) {
    console.log('ℹ️  app/GoogleService-Info.plist non presente → push iOS spente (build ok).');
    console.log('    Per attivarle: Firebase → Aggiungi app iOS (bundle app.metabole) → scarica il plist in app/.');
    return console.log('✅ Progetto iOS pronto (senza push).');
  }

  await fs.copyFile(PLIST_SRC, PLIST_DEST);
  console.log('   GoogleService-Info.plist copiato in ios/App/App/.');
  console.log('   ⚠️  Se è la prima volta: in Xcode trascina GoogleService-Info.plist dentro il gruppo "App"');
  console.log('       (spunta "Copy items if needed" NO, target App SÌ). Serve una volta sola.');

  // Podfile: pod FirebaseMessaging
  let pod = await fs.readFile(PODFILE, 'utf8');
  if (pod.includes('FirebaseMessaging')) {
    console.log('   Podfile: FirebaseMessaging già presente.');
  } else if (/target 'App' do/.test(pod)) {
    pod = pod.replace(/target 'App' do/, `target 'App' do\n  pod 'FirebaseMessaging'`);
    await fs.writeFile(PODFILE, pod);
    console.log('   Podfile: aggiunto pod FirebaseMessaging (ora serve `pod install`).');
  } else {
    console.error('⚠️  Non trovo "target \'App\' do" nel Podfile: aggiungi a mano pod \'FirebaseMessaging\'.');
  }

  // AppDelegate: configure + scambio token APNs→FCM
  let ad = await fs.readFile(APPDELEGATE, 'utf8');
  let changed = false;
  if (!ad.includes('import FirebaseCore')) {
    ad = ad.replace(/import UIKit/, 'import UIKit\nimport FirebaseCore\nimport FirebaseMessaging');
    changed = true;
  }
  if (!ad.includes('FirebaseApp.configure()')) {
    ad = ad.replace(
      /(func application\(_ application: UIApplication, didFinishLaunchingWithOptions[^\{]*\{)/,
      `$1\n        FirebaseApp.configure()`,
    );
    changed = true;
  }
  if (!ad.includes('Messaging.messaging().apnsToken')) {
    ad = ad.replace(
      /func application\(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data\) \{[\s\S]*?\n    \}/,
      `func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Il backend invia le push via FCM: scambiamo il token APNs con quello FCM.
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }`,
    );
    changed = true;
  }
  if (changed) {
    await fs.writeFile(APPDELEGATE, ad);
    console.log('   AppDelegate.swift: Firebase configurato (init + token FCM).');
  } else {
    console.log('   AppDelegate.swift: già configurato.');
  }

  console.log('✅ Progetto iOS pronto (push Firebase cablate).');
  console.log('   In Xcode, UNA volta sola: Signing & Capabilities → + Capability →');
  console.log('   "Push Notifications" e "Background Modes" (spunta Remote notifications).');
}

main().catch((e) => { console.error(e); process.exit(1); });
