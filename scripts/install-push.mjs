#!/usr/bin/env node
/**
 * Attiva le notifiche push (Firebase Cloud Messaging) nel progetto Android
 * generato da Capacitor:
 *   1. copia google-services.json (scaricato da Firebase) in app/android/app/
 *   2. assicura il wiring gradle: classpath del plugin google-services nel
 *      build.gradle di progetto e l'apply condizionato in quello del modulo app.
 *
 * È IDEMPOTENTE e DIFENSIVO: se il template Capacitor include già il wiring non
 * tocca nulla; se google-services.json NON è presente in app/ esce senza errori
 * (le push restano semplicemente spente e il build va a buon fine lo stesso).
 * Va eseguito dopo `cap sync android` (lo fa automaticamente `npm run android:sync`).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const SRC_JSON = path.join(APP, 'google-services.json');           // scaricato da Firebase, in iCloud
const ANDROID = path.join(APP, 'android');
const APP_MODULE = path.join(ANDROID, 'app');
const DEST_JSON = path.join(APP_MODULE, 'google-services.json');
const ROOT_GRADLE = path.join(ANDROID, 'build.gradle');
const APP_GRADLE = path.join(APP_MODULE, 'build.gradle');
const MANIFEST = path.join(APP_MODULE, 'src', 'main', 'AndroidManifest.xml');

const GS_VERSION = '4.4.2';
// Android 13+ (API 33): senza questo permesso le notifiche non vengono mostrate
// e non compare il popup di consenso. Il runtime lo chiede via requestPermissions().
const POST_NOTIF = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />';
const APPLY_BLOCK = `
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch (Exception e) {
    logger.info("google-services.json non trovato: plugin google-services non applicato (push disattivate).")
}
`;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(SRC_JSON))) {
    console.log('ℹ️  google-services.json non presente in app/ → notifiche push disattivate (build ok).');
    console.log('    Per attivarle: scarica il file da Firebase e mettilo in app/google-services.json.');
    return;
  }
  if (!(await exists(APP_MODULE))) {
    console.error(`❌ Manca ${APP_MODULE}\n   Genera prima il progetto Android:  cd app && npx cap sync android`);
    process.exit(1);
  }

  console.log('→ Attivo le notifiche push (Firebase)…');
  await fs.copyFile(SRC_JSON, DEST_JSON);
  console.log('   google-services.json copiato in android/app/.');

  // 1) classpath del plugin nel build.gradle di progetto (se non c'è già).
  if (await exists(ROOT_GRADLE)) {
    let g = await fs.readFile(ROOT_GRADLE, 'utf8');
    if (g.includes('com.google.gms:google-services')) {
      console.log('   classpath google-services già presente (build.gradle di progetto).');
    } else if (g.includes("classpath 'com.android.tools.build:gradle")) {
      g = g.replace(
        /(classpath 'com\.android\.tools\.build:gradle[^\n]*\n)/,
        `$1        classpath 'com.google.gms:google-services:${GS_VERSION}'\n`,
      );
      await fs.writeFile(ROOT_GRADLE, g);
      console.log('   classpath google-services aggiunto (build.gradle di progetto).');
    } else {
      console.error('⚠️  Non trovo il classpath android gradle: aggiungi a mano il plugin google-services.');
    }
  }

  // 2) apply condizionato nel build.gradle del modulo app (se non c'è già).
  if (await exists(APP_GRADLE)) {
    let g = await fs.readFile(APP_GRADLE, 'utf8');
    if (g.includes('com.google.gms.google-services')) {
      console.log('   apply google-services già presente (build.gradle del modulo app).');
    } else {
      g = g.trimEnd() + '\n' + APPLY_BLOCK;
      await fs.writeFile(APP_GRADLE, g);
      console.log('   apply google-services aggiunto (build.gradle del modulo app).');
    }
  }

  // 3) permesso POST_NOTIFICATIONS nel manifest (Android 13+).
  if (await exists(MANIFEST)) {
    let xml = await fs.readFile(MANIFEST, 'utf8');
    if (xml.includes('POST_NOTIFICATIONS')) {
      console.log('   permesso POST_NOTIFICATIONS già presente nel manifest.');
    } else if (xml.includes('<application')) {
      xml = xml.replace('<application', `${POST_NOTIF}\n\n    <application`);
      await fs.writeFile(MANIFEST, xml);
      console.log('   permesso POST_NOTIFICATIONS aggiunto al manifest.');
    } else {
      console.error('⚠️  Non trovo <application> nel manifest: aggiungi a mano POST_NOTIFICATIONS.');
    }
  }

  console.log('✅ Notifiche push attivate (google-services + wiring gradle + permesso).');
}

main().catch((e) => { console.error(e); process.exit(1); });
