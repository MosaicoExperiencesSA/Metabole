#!/usr/bin/env node
/**
 * Installa il contapassi nativo (sensore TYPE_STEP_COUNTER) nel progetto Android
 * generato da Capacitor: copia StepCounter.java, sovrascrive MainActivity.java
 * (per registrare il plugin) e aggiunge il permesso ACTIVITY_RECOGNITION al
 * manifest. Idempotente. Va eseguito dopo `cap sync android` (lo fa
 * automaticamente `npm run android:sync`).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'android-steps');
const MAIN = path.join(ROOT, 'app', 'android', 'app', 'src', 'main');
const PKG_DIR = path.join(MAIN, 'java', 'app', 'metabole');
const MANIFEST = path.join(MAIN, 'AndroidManifest.xml');

const PERMISSION = '    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />';

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(SRC))) {
    console.error(`❌ Manca ${SRC} — esegui dalla radice del progetto (con docs/ e app/).`);
    process.exit(1);
  }
  if (!(await exists(MAIN))) {
    console.error(`❌ Manca ${MAIN}\n   Genera prima il progetto Android:  cd app && npx cap sync android`);
    process.exit(1);
  }

  console.log('→ Installo il contapassi nativo…');
  await fs.mkdir(PKG_DIR, { recursive: true });
  await fs.copyFile(path.join(SRC, 'StepCounter.java'), path.join(PKG_DIR, 'StepCounter.java'));
  await fs.copyFile(path.join(SRC, 'MainActivity.java'), path.join(PKG_DIR, 'MainActivity.java'));

  let xml = await fs.readFile(MANIFEST, 'utf8');
  if (xml.includes('ACTIVITY_RECOGNITION')) {
    console.log('   permesso già presente nel manifest.');
  } else if (xml.includes('<application')) {
    // Inserisce il permesso subito prima del tag <application>.
    xml = xml.replace('<application', `${PERMISSION}\n\n    <application`);
    await fs.writeFile(MANIFEST, xml);
    console.log('   permesso ACTIVITY_RECOGNITION aggiunto.');
  } else {
    console.error('⚠️  Non trovo <application> nel manifest: aggiungi a mano il permesso ACTIVITY_RECOGNITION.');
  }

  console.log('✅ Contapassi installato (StepCounter + registrazione in MainActivity).');
}

main().catch((e) => { console.error(e); process.exit(1); });
