#!/usr/bin/env node
/**
 * Installa l'ICONA dell'app (launcher icon) con Gaia che sorride, al posto dell'icona
 * di default di Capacitor. Copia le mipmap generate da docs/android-icon/res/ dentro
 * app/android/app/src/main/res/, sovrascrivendo ic_launcher / ic_launcher_round e
 * aggiungendo foreground/background per l'icona adattiva (Android 8+). Idempotente.
 *
 * Va eseguito DOPO `cap sync android` (lo fa in automatico `npm run android:sync`)
 * e PRIMA di gradlew, perché Capacitor rigenera parte di app/android/ a ogni sync.
 *
 *   node scripts/install-icon.mjs        (dalla radice del progetto)
 *   node ../scripts/install-icon.mjs     (dalla cartella app/)
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'android-icon', 'res');
const RES = path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(SRC))) {
    console.error(`❌ Manca ${SRC} — esegui dalla radice del progetto (con docs/ e app/).`);
    process.exit(1);
  }
  if (!(await exists(RES))) {
    console.error(`❌ Manca ${RES}\n   Genera prima il progetto Android:  cd app && npx cap sync android`);
    process.exit(1);
  }

  console.log('→ Installo l\'icona Gaia (tutte le densità)…');
  let copied = 0;
  for (const dir of await fs.readdir(SRC)) {
    const srcDir = path.join(SRC, dir);
    const stat = await fs.stat(srcDir);
    if (!stat.isDirectory()) continue; // solo le cartelle mipmap-*
    const destDir = path.join(RES, dir);
    await fs.mkdir(destDir, { recursive: true });
    for (const f of await fs.readdir(srcDir)) {
      await fs.copyFile(path.join(srcDir, f), path.join(destDir, f));
      copied++;
    }
  }

  // L'icona adattiva di default di Capacitor usa un foreground VETTORIALE
  // (res/drawable/ic_launcher_foreground.xml): lo rimuoviamo così non prevale
  // sul nostro (il nostro adaptive XML punta a @mipmap/ic_launcher_foreground).
  for (const leftover of [
    path.join(RES, 'drawable', 'ic_launcher_foreground.xml'),
    path.join(RES, 'drawable-v24', 'ic_launcher_foreground.xml'),
  ]) {
    if (await exists(leftover)) {
      await fs.rm(leftover);
      console.log(`   rimosso foreground vettoriale di default: ${path.relative(ROOT, leftover)}`);
    }
  }

  console.log(`✅ Icona Gaia installata (${copied} file copiati).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
