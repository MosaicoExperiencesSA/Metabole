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
const STEPS_DIR = path.join(ROOT, 'docs', 'ios-steps');
const INFO_PLIST = path.join(APP_DIR, 'Info.plist');
const MOTION_KEY = 'NSMotionUsageDescription';
const MOTION_REASON = 'Metabole usa i passi per mostrarti i tuoi progressi di movimento della giornata.';

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Aggiunge un file sorgente (Swift/ObjC) al progetto Xcode: PBXFileReference +
 * PBXBuildFile nella fase Sources + voce nel gruppo "App". Idempotente (salta se
 * il file è già referenziato). Ancorato ai commenti stabili del template Capacitor,
 * non agli ID, così regge le rigenerazioni.
 */
function addSourceToPbxproj(pbx, name, fileType, refId, buildId) {
  if (pbx.includes(`/* ${name} */ = {isa = PBXFileReference`)) return pbx; // già presente
  const buildLine = `\t\t${buildId} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${refId} /* ${name} */; };\n`;
  const refLine = `\t\t${refId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; path = ${name}; sourceTree = "<group>"; };\n`;
  pbx = pbx.replace(/(\/\* Begin PBXBuildFile section \*\/\n)/, `$1${buildLine}`);
  pbx = pbx.replace(/(\/\* Begin PBXFileReference section \*\/\n)/, `$1${refLine}`);
  // gruppo App: subito dopo il child AppDelegate.swift
  pbx = pbx.replace(/(\t+[0-9A-F]+ \/\* AppDelegate\.swift \*\/,\n)/, `$1\t\t\t\t${refId} /* ${name} */,\n`);
  // fase Sources: subito dopo la voce AppDelegate.swift in Sources
  pbx = pbx.replace(/(\t+[0-9A-F]+ \/\* AppDelegate\.swift in Sources \*\/,\n)/, `$1\t\t\t\t${buildId} /* ${name} in Sources */,\n`);
  return pbx;
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

  // 2b) User Script Sandboxing = NO. Da Xcode 15+ è YES di default e blocca lo script
  //     CocoaPods "[CP] Embed Pods Frameworks" (errore "Sandbox: bash deny file-read-data").
  if (await exists(PBXPROJ)) {
    let p = await fs.readFile(PBXPROJ, 'utf8');
    let np;
    if (p.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
      np = p.replace(/ENABLE_USER_SCRIPT_SANDBOXING = [^;]+;/g, 'ENABLE_USER_SCRIPT_SANDBOXING = NO;');
    } else {
      // aggiunge il setting in ogni blocco buildSettings (project + target, Debug + Release)
      np = p.replace(/buildSettings = \{\n/g, 'buildSettings = {\n\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;\n');
    }
    if (np !== p) {
      await fs.writeFile(PBXPROJ, np);
      console.log('→ User Script Sandboxing disattivato (fix script CocoaPods).');
    } else {
      console.log('→ User Script Sandboxing già a NO.');
    }
  }

  // 2c) Contapassi iOS (CoreMotion). Copia il plugin nativo, lo registra nel
  //     progetto Xcode e aggiunge il permesso "Movimento e fitness". Equivalente
  //     iOS di android:steps (docs/android-steps → MainActivity). Va eseguito
  //     SEMPRE, anche senza push, quindi PRIMA del blocco push (che ha un return).
  if (await exists(path.join(STEPS_DIR, 'StepCounter.swift'))) {
    await fs.copyFile(path.join(STEPS_DIR, 'StepCounter.swift'), path.join(APP_DIR, 'StepCounter.swift'));
    await fs.copyFile(path.join(STEPS_DIR, 'StepCounterPlugin.m'), path.join(APP_DIR, 'StepCounterPlugin.m'));
    console.log('   Contapassi: StepCounter.swift + StepCounterPlugin.m copiati in ios/App/App/.');

    if (await exists(PBXPROJ)) {
      let p = await fs.readFile(PBXPROJ, 'utf8');
      const before = p;
      p = addSourceToPbxproj(p, 'StepCounter.swift', 'sourcecode.swift', 'ABCDEF0000000000000000A1', 'ABCDEF0000000000000000A2');
      p = addSourceToPbxproj(p, 'StepCounterPlugin.m', 'sourcecode.c.objc', 'ABCDEF0000000000000000B1', 'ABCDEF0000000000000000B2');
      if (p !== before) {
        await fs.writeFile(PBXPROJ, p);
        console.log('   Contapassi: sorgenti aggiunti al target App nel progetto Xcode.');
      } else {
        console.log('   Contapassi: già registrati nel progetto Xcode, salto.');
      }
    }

    if (await exists(INFO_PLIST)) {
      let ip = await fs.readFile(INFO_PLIST, 'utf8');
      if (!ip.includes(MOTION_KEY)) {
        ip = ip.replace('</dict>\n</plist>', `\t<key>${MOTION_KEY}</key>\n\t<string>${MOTION_REASON}</string>\n</dict>\n</plist>`);
        await fs.writeFile(INFO_PLIST, ip);
        console.log('   Contapassi: aggiunto NSMotionUsageDescription in Info.plist (permesso movimento).');
      } else {
        console.log('   Contapassi: NSMotionUsageDescription già presente, salto.');
      }
    }
  } else {
    console.log('ℹ️  docs/ios-steps/StepCounter.swift assente: contapassi iOS non installato.');
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
  // I due metodi del delegato che fanno arrivare il token a Capacitor.
  // ⚠️ Senza QUESTI l'app chiede il permesso, chiama register(), iOS consegna il token
  // all'AppDelegate… e lì non c'è nessuno ad ascoltare: nessun evento `registration`,
  // nessun `registrationError`, silenzio totale. È esattamente quello che è successo
  // nella build 2.0 (diagnosticato il 6/8/2026 — vedi metabole-push-ios-indagine).
  const METODI_PUSH = `
    // --- Push (inserito da install-ios.mjs) ---
    // Il backend invia via FCM: scambiamo il token APNs con quello FCM e lo giriamo a Capacitor.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`;

  if (ad.includes('Messaging.messaging().apnsToken')) {
    console.log('   AppDelegate.swift: metodi push già presenti.');
  } else if (/func application\(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data\) \{/.test(ad)) {
    // Il metodo esiste già (versione Capacitor standard): lo sostituiamo.
    ad = ad.replace(
      /func application\(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data\) \{[\s\S]*?\n    \}/,
      METODI_PUSH.trim().replace(/^\s*\/\/ --- Push[^\n]*\n/, ''),
    );
    changed = true;
    console.log('   AppDelegate.swift: metodi push sostituiti.');
  } else {
    // ⚠️ IL CASO CHE CI È COSTATO CARO: i metodi non ci sono proprio. Prima la replace()
    // non trovava nulla, non sostituiva niente e NON si lamentava: lo script stampava
    // "Firebase configurato" e la build usciva senza push. Ora li INSERIAMO.
    const ultimaGraffa = ad.lastIndexOf('\n}');
    if (ultimaGraffa < 0) {
      console.error('\n⛔ Non riesco a inserire i metodi push in AppDelegate.swift: struttura inattesa.');
      console.error('   Aggiungili a mano dentro la classe AppDelegate, altrimenti le push iOS non funzioneranno:');
      console.error(METODI_PUSH);
      process.exit(1);
    }
    ad = ad.slice(0, ultimaGraffa) + '\n' + METODI_PUSH + ad.slice(ultimaGraffa);
    changed = true;
    console.log('   AppDelegate.swift: metodi push MANCANTI → inseriti.');
  }

  if (changed) {
    await fs.writeFile(APPDELEGATE, ad);
  }

  // Controllo finale: se dopo tutto questo il cablaggio non c'è, meglio fermarsi che
  // consegnare una build muta.
  const finale = await fs.readFile(APPDELEGATE, 'utf8');
  const mancanti = [
    ['FirebaseApp.configure()', 'inizializzazione Firebase'],
    ['Messaging.messaging().apnsToken', 'scambio token APNs→FCM'],
    ['didFailToRegisterForRemoteNotificationsWithError', 'gestione degli errori di registrazione'],
  ].filter(([ago]) => !finale.includes(ago));
  if (mancanti.length) {
    console.error('\n⛔ AppDelegate.swift incompleto, le push iOS NON funzioneranno. Manca:');
    mancanti.forEach(([, cosa]) => console.error(`   · ${cosa}`));
    process.exit(1);
  }

  console.log('✅ Progetto iOS pronto (push Firebase cablate e verificate).');
  console.log('   In Xcode, UNA volta sola: Signing & Capabilities → + Capability →');
  console.log('   "Push Notifications" e "Background Modes" (spunta Remote notifications).');
}

main().catch((e) => { console.error(e); process.exit(1); });
