#!/usr/bin/env node
/**
 * Adegua il progetto iOS generato da Capacitor (cap add ios) per Metabole:
 *   1. ICONA: copia docs/ios-icon/AppIcon-512@2x.png (1024×1024, senza trasparenza)
 *      al posto dell'icona di default di Capacitor.
 *   2. VERSIONE: MARKETING_VERSION / CURRENT_PROJECT_VERSION nel progetto Xcode
 *      presi da app/android-version.json (stessa fonte di verità di Android).
 *   2e. DEPLOYMENT TARGET iOS 15.0, nel progetto Xcode E nel Podfile.
 *   3. FIRMA E CAPABILITY PUSH (vedi sotto: è la parte che il 6/8/2026 è costata un'ora)
 *   4. PUSH (solo se app/GoogleService-Info.plist esiste — stesso pattern difensivo
 *      di install-push.mjs Android; senza file: build ok, push spente):
 *      - copia il plist in ios/App/App/ E lo aggancia al target (fase Resources)
 *      - aggiunge `pod 'FirebaseMessaging'` al Podfile
 *      - patcha AppDelegate.swift: FirebaseApp.configure() + scambio token APNs→FCM
 *        (il backend invia via FCM: serve il token FCM, non quello APNs grezzo)
 *
 * ⚠️ PERCHÉ IL PUNTO 3 ESISTE (6 agosto 2026).
 * `ios/` viene RIGENERATO (`cap add ios`) e con lui sparisce tutto quello che vive solo nel
 * progetto Xcode. Nella 2.0 erano sparite quattro cose insieme — capability Push, il
 * GoogleService-Info.plist agganciato al target, `aps-environment` a `production`, e per di
 * più il template Capacitor rimetteva `CODE_SIGN_IDENTITY = "iPhone Developer"`, che firmava
 * l'archivio in development. Nessuna delle quattro produce un errore: la build passa, si
 * carica, e le push semplicemente non arrivano a nessuno. Le abbiamo rimesse a mano una per
 * una, in un'ora, la sera della pubblicazione.
 * Rimetterle a mano ogni volta è la garanzia di riperderle. Da qui in avanti le rimette
 * questo script, e — come per i metodi del delegato — VERIFICA il proprio risultato:
 * se qualcosa non è andato a posto esce con errore, invece di dire «fatto».
 * Resta fuori una cosa sola, che nessuno script può fare: il **certificato Apple
 * Distribution scade ogni anno**, e senza quello l'archivio torna a firmarsi in development.
 * Il controllo prima di caricare è in coda a `build-ios.sh`.
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

const ENTITLEMENTS = path.join(APP_DIR, 'App.entitlements');
// Team di firma. È «Genius Company SA», NON «Mosaico Experiences SA»: il 6/8 un suggerimento
// sbagliato in build-ios.sh stava per far scegliere il team errato. Scritto una volta qui.
const DEVELOPMENT_TEAM = 'TNDPSUPTA8';
/**
 * Il minimo di iOS su cui gira l'app. Capacitor genera 13.0; dalla primavera 2027 App Store Connect
 * rifiuta gli upload costruiti su un minimo così basso. Scritto una volta qui, usato nel progetto
 * Xcode e nel Podfile — che devono dire lo stesso numero.
 */
const IOS_TARGET = '15.0';
// `aps-environment` = production: è la voce che nella 2.0 valeva `development` e teneva le
// push spente in produzione senza che niente lo segnalasse.
const ENTITLEMENTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>production</string>
</dict>
</plist>
`;

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

/**
 * Come sopra, ma per una RISORSA (finisce nella fase Resources, non in Sources): è il caso
 * del GoogleService-Info.plist, che senza questo aggancio sta nella cartella ma NON dentro
 * l'app — Firebase all'avvio non lo trova e le push restano spente, senza un errore.
 * Ancorato ad Assets.xcassets, che nel template Capacitor c'è sempre.
 */
function addResourceToPbxproj(pbx, name, fileType, refId, buildId) {
  if (pbx.includes(`/* ${name} */ = {isa = PBXFileReference`)) return pbx; // già presente
  const buildLine = `\t\t${buildId} /* ${name} in Resources */ = {isa = PBXBuildFile; fileRef = ${refId} /* ${name} */; };\n`;
  const refLine = `\t\t${refId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; path = "${name}"; sourceTree = "<group>"; };\n`;
  pbx = pbx.replace(/(\/\* Begin PBXBuildFile section \*\/\n)/, `$1${buildLine}`);
  pbx = pbx.replace(/(\/\* Begin PBXFileReference section \*\/\n)/, `$1${refLine}`);
  pbx = pbx.replace(/(\t+[0-9A-F]+ \/\* AppDelegate\.swift \*\/,\n)/, `$1\t\t\t\t${refId} /* ${name} */,\n`);
  pbx = pbx.replace(/(\t+[0-9A-F]+ \/\* Assets\.xcassets in Resources \*\/,\n)/, `$1\t\t\t\t${buildId} /* ${name} in Resources */,\n`);
  return pbx;
}

/**
 * Aggiunge un file al solo elenco del progetto (PBXFileReference + gruppo "App"), senza
 * compilarlo né copiarlo dentro l'app: è quello che serve a `App.entitlements`, che Xcode
 * usa tramite il percorso in CODE_SIGN_ENTITLEMENTS. Senza la voce nell'elenco il build
 * funziona lo stesso, ma il file diventa invisibile in Xcode e la prima persona che lo cerca
 * pensa che non ci sia.
 */
function addFileRefToPbxproj(pbx, name, fileType, refId) {
  if (pbx.includes(`/* ${name} */ = {isa = PBXFileReference`)) return pbx;
  const refLine = `\t\t${refId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; path = ${name}; sourceTree = "<group>"; };\n`;
  pbx = pbx.replace(/(\/\* Begin PBXFileReference section \*\/\n)/, `$1${refLine}`);
  pbx = pbx.replace(/(\t+[0-9A-F]+ \/\* AppDelegate\.swift \*\/,\n)/, `$1\t\t\t\t${refId} /* ${name} */,\n`);
  return pbx;
}

/**
 * Impostazioni di firma sui DUE blocchi buildSettings del target App (Debug e Release).
 * Li si riconosce da `INFOPLIST_FILE = App/Info.plist;`: è la riga che distingue il target
 * dai blocchi di progetto e dai Pods, dove queste impostazioni non vanno messe.
 */
function patchFirma(pbx) {
  return pbx.replace(/buildSettings = \{\n([\s\S]*?)\n\t\t\t\};/g, (blocco, corpo) => {
    if (!corpo.includes('INFOPLIST_FILE = App/Info.plist;')) return blocco;
    let righe = corpo
      .split('\n')
      // Capacitor rimette questa riga a ogni rigenerazione e forza la firma DEVELOPMENT:
      // l'archivio esce con get-task-allow=true e aps-environment=development.
      .filter((r) => !/^\s*("?CODE_SIGN_IDENTITY(\[[^\]]*\])?"?)\s*=/.test(r))
      .filter((r) => !/^\s*CODE_SIGN_ENTITLEMENTS\s*=/.test(r))
      .filter((r) => !/^\s*CODE_SIGN_STYLE\s*=/.test(r))
      .filter((r) => !/^\s*DEVELOPMENT_TEAM\s*=/.test(r));
    const ind = '\t\t\t\t';
    righe = [
      `${ind}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`,
      `${ind}CODE_SIGN_STYLE = Automatic;`,
      `${ind}DEVELOPMENT_TEAM = ${DEVELOPMENT_TEAM};`,
      ...righe,
    ];
    return `buildSettings = {\n${righe.join('\n')}\n\t\t\t};`;
  });
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

  /**
   * 2e) DEPLOYMENT TARGET a 15.0 — nel progetto Xcode E nel Podfile.
   *
   * Capacitor genera 13.0. Oggi non blocca niente, ma **dalla primavera 2027 App Store Connect
   * rifiuta gli upload** costruiti su un minimo così basso: è una scadenza, non un'opinione, e
   * arrivarci il giorno della pubblicazione vuol dire scoprirlo mentre si sta caricando.
   *
   * ⚠️ Sta QUI e non fatto a mano in Xcode per la stessa ragione di tutto il resto di questo file:
   * `ios/` viene rigenerato, e ogni cosa che vive solo nel progetto Xcode sparisce con lui. Una
   * modifica a mano è una modifica che si riperde alla prossima `cap add ios`, e nessuna delle
   * sparizioni dà errore — la build passa lo stesso.
   *
   * ⚠️ E si tocca ANCHE il Podfile: se `platform :ios` resta a 13.0, CocoaPods costruisce i pod per
   * 13 mentre l'app dichiara 15. Non è un dettaglio estetico — è il tipo di disallineamento che
   * produce decine di warning e, quando va male, un pod che non compila la sera sbagliata.
   */
  if (await exists(PBXPROJ)) {
    let p = await fs.readFile(PBXPROJ, 'utf8');
    const np = p.includes('IPHONEOS_DEPLOYMENT_TARGET')
      ? p.replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${IOS_TARGET};`)
      : p.replace(/buildSettings = \{\n/g, `buildSettings = {\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${IOS_TARGET};\n`);
    if (np !== p) {
      await fs.writeFile(PBXPROJ, np);
      console.log(`→ Deployment target iOS: ${IOS_TARGET}.`);
    } else {
      console.log(`→ Deployment target iOS già a ${IOS_TARGET}.`);
    }
    /**
     * ⚠️ SI VERIFICA, non si dichiara. Come i metodi del delegato e la capability push: se resta in
     * giro anche un solo target sotto il minimo, l'archivio si costruisce lo stesso e il rifiuto
     * arriva da Apple mesi dopo. Meglio un errore adesso.
     */
    const rimasti = (await fs.readFile(PBXPROJ, 'utf8')).match(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g) ?? [];
    const sbagliati = rimasti.filter((r) => !r.includes(IOS_TARGET));
    if (sbagliati.length) {
      console.error(`⚠️  Restano ${sbagliati.length} target iOS diversi da ${IOS_TARGET}: ${sbagliati.join(' ')}`);
      process.exit(1);
    }
  }

  if (await exists(PODFILE)) {
    let pod = await fs.readFile(PODFILE, 'utf8');
    const npod = pod.match(/^\s*platform :ios,/m)
      ? pod.replace(/^(\s*)platform :ios,\s*'[^']+'/m, `$1platform :ios, '${IOS_TARGET}'`)
      : `platform :ios, '${IOS_TARGET}'\n${pod}`;
    if (npod !== pod) {
      await fs.writeFile(PODFILE, npod);
      console.log(`→ Podfile: platform :ios, '${IOS_TARGET}' (ora serve \`pod install\`).`);
    } else {
      console.log(`→ Podfile: platform già a ${IOS_TARGET}.`);
    }
    if (!(await fs.readFile(PODFILE, 'utf8')).includes(`platform :ios, '${IOS_TARGET}'`)) {
      console.error(`⚠️  Non sono riuscito a mettere platform :ios, '${IOS_TARGET}' nel Podfile.`);
      process.exit(1);
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

  // 2d) FIRMA E CAPABILITY PUSH — le quattro cose che la rigenerazione di ios/ cancella.
  //     Va eseguito SEMPRE, anche senza plist: la firma non dipende da Firebase.
  if (await exists(PBXPROJ)) {
    // Entitlements: è QUESTO file la "capability Push". Il pulsante «+ Capability → Push
    // Notifications» in Xcode non fa altro che scrivere aps-environment qui dentro.
    const entExists = await exists(ENTITLEMENTS);
    const entAttuale = entExists ? await fs.readFile(ENTITLEMENTS, 'utf8') : '';
    if (!entAttuale.includes('<key>aps-environment</key>') || !entAttuale.includes('<string>production</string>')) {
      await fs.writeFile(ENTITLEMENTS, ENTITLEMENTS_XML);
      console.log(`→ App.entitlements ${entExists ? 'corretto' : 'creato'}: aps-environment = production.`);
    } else {
      console.log('→ App.entitlements già a production.');
    }

    let p = await fs.readFile(PBXPROJ, 'utf8');
    const prima = p;
    p = addFileRefToPbxproj(p, 'App.entitlements', 'text.plist.entitlements', 'ABCDEF0000000000000000C1');
    p = patchFirma(p);
    const modificato = p !== prima;
    if (modificato) await fs.writeFile(PBXPROJ, p);

    // Verifica del proprio risultato PRIMA di dire com'è andata: «già a posto» detto senza
    // aver guardato è esattamente la bugia che ci è costata la serata del 6/8.
    // Due blocchi nel target (Debug e Release), entrambi devono avere gli entitlements.
    const finale = await fs.readFile(PBXPROJ, 'utf8');
    const blocchiTarget = (finale.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length;
    const guai = [];
    if (blocchiTarget < 2) guai.push(`CODE_SIGN_ENTITLEMENTS presente in ${blocchiTarget} configurazioni su 2 (Debug e Release)`);
    if (/CODE_SIGN_IDENTITY/.test(finale)) guai.push('CODE_SIGN_IDENTITY è ancora nel progetto: l\'archivio si firmerebbe in development');
    if (!finale.includes(`DEVELOPMENT_TEAM = ${DEVELOPMENT_TEAM};`)) guai.push(`DEVELOPMENT_TEAM non è ${DEVELOPMENT_TEAM}`);
    if (guai.length) {
      console.error('\n⛔ Progetto Xcode non sistemato: le push in produzione NON funzionerebbero.');
      guai.forEach((g) => console.error(`   · ${g}`));
      console.error('   Sistemabile a mano in Xcode → Signing & Capabilities, ma prima capiamo perché lo script non ci è riuscito.');
      process.exit(1);
    }
    console.log(modificato
      ? `→ Firma: entitlements agganciati, team ${DEVELOPMENT_TEAM}, firma automatica; via CODE_SIGN_IDENTITY development. Verificato.`
      : '→ Firma: già a posto (verificato).');
  }

  // 3) Push / Firebase (solo se il plist c'è)
  if (!(await exists(PLIST_SRC))) {
    console.log('ℹ️  app/GoogleService-Info.plist non presente → push iOS spente (build ok).');
    console.log('    Per attivarle: Firebase → Aggiungi app iOS (bundle app.metabole) → scarica il plist in app/.');
    return console.log('✅ Progetto iOS pronto (senza push).');
  }

  await fs.copyFile(PLIST_SRC, PLIST_DEST);
  console.log('   GoogleService-Info.plist copiato in ios/App/App/.');

  // Copiarlo non basta: se non è nella fase Resources del target, il file resta sul disco ma
  // NON entra dentro l'app, e all'avvio FirebaseApp.configure() non lo trova. È uno dei
  // quattro anelli del 6/8 — e come gli altri non produce nessun errore visibile.
  if (await exists(PBXPROJ)) {
    let p = await fs.readFile(PBXPROJ, 'utf8');
    const prima = p;
    p = addResourceToPbxproj(p, 'GoogleService-Info.plist', 'text.plist.xml', 'ABCDEF0000000000000000D1', 'ABCDEF0000000000000000D2');
    if (p !== prima) {
      await fs.writeFile(PBXPROJ, p);
      console.log('   GoogleService-Info.plist agganciato al target (fase Resources).');
    } else {
      console.log('   GoogleService-Info.plist già agganciato al target.');
    }
    const finale = await fs.readFile(PBXPROJ, 'utf8');
    if (!finale.includes('GoogleService-Info.plist in Resources */,')) {
      console.error('\n⛔ GoogleService-Info.plist NON è nella fase Resources: Firebase non lo troverà e le push resteranno spente.');
      console.error('   In Xcode: trascinalo nel gruppo "App" ("Copy items if needed" NO, target App SÌ).');
      process.exit(1);
    }
  }

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
  console.log('   Firma, capability Push e plist sono già a posto: in Xcode NON devi più');
  console.log('   toccare Signing & Capabilities né trascinare il plist.');
  console.log('   ⚠️  Resta una cosa che nessuno script può fare: il certificato Apple');
  console.log('       Distribution scade ogni anno. Prima di caricare l\'archivio, il controllo');
  console.log('       con codesign è in coda a build-ios.sh.');
}

main().catch((e) => { console.error(e); process.exit(1); });
