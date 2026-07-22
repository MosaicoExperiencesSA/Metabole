#!/usr/bin/env node
/**
 * Installa il widget home Android (mascotte Gaia, 3 formati) nel progetto Android
 * generato da Capacitor: copia i file da docs/android-widget/ dentro
 * app/android/app/src/main/ e aggiunge il <receiver> al manifest. Idempotente.
 *
 * Va eseguito DOPO `cap sync android` (lo fa in automatico `npm run android:sync`)
 * e PRIMA di gradlew, perché Capacitor rigenera parte di app/android/ a ogni sync.
 *
 *   node scripts/install-widget.mjs        (dalla radice del progetto)
 *   node ../scripts/install-widget.mjs     (dalla cartella app/)
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'android-widget');
const MAIN = path.join(ROOT, 'app', 'android', 'app', 'src', 'main');
const PKG_DIR = path.join(MAIN, 'java', 'app', 'metabole');
const MANIFEST = path.join(MAIN, 'AndroidManifest.xml');

const RECEIVER = `
        <receiver
            android:name=".MetaboleWidget"
            android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/metabole_widget_info" />
        </receiver>
`;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyInto(srcDir, destDir, filter = () => true) {
  if (!(await exists(srcDir))) return;
  await fs.mkdir(destDir, { recursive: true });
  for (const f of await fs.readdir(srcDir)) {
    if (!filter(f)) continue;
    await fs.copyFile(path.join(srcDir, f), path.join(destDir, f));
  }
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

  console.log('→ Copio i file del widget (3 formati)…');
  await fs.mkdir(PKG_DIR, { recursive: true });
  await fs.copyFile(path.join(SRC, 'java', 'MetaboleWidget.java'), path.join(PKG_DIR, 'MetaboleWidget.java'));
  await copyInto(path.join(SRC, 'res', 'layout'), path.join(MAIN, 'res', 'layout'), (f) => f.endsWith('.xml'));
  await copyInto(path.join(SRC, 'res', 'drawable'), path.join(MAIN, 'res', 'drawable'));
  await copyInto(path.join(SRC, 'res', 'xml'), path.join(MAIN, 'res', 'xml'), (f) => f.endsWith('.xml'));

  console.log('→ Aggiungo il receiver al manifest (se manca)…');
  let xml = await fs.readFile(MANIFEST, 'utf8');
  if (xml.includes('MetaboleWidget')) {
    console.log('   già presente, salto.');
  } else if (xml.includes('</application>')) {
    xml = xml.replace('</application>', `${RECEIVER}    </application>`);
    await fs.writeFile(MANIFEST, xml);
    console.log('   receiver aggiunto.');
  } else {
    console.error('⚠️  Non trovo </application> nel manifest: aggiungi il receiver a mano (vedi docs/android-widget/AndroidManifest-receiver.xml).');
  }

  console.log('✅ Widget installato (quadrato, rettangolare, largo).');
}

main().catch((e) => { console.error(e); process.exit(1); });
