#!/usr/bin/env node
/**
 * Prepara un pacchetto di aggiornamento OTA (Capgo, self-hosted) da caricare su
 * metabole.eu. NON tocca gli store: serve per spingere un fix web all'app nativa
 * senza ripassare dalla revisione.
 *
 *   node scripts/ota-release.mjs <versione>
 *   es:  node scripts/ota-release.mjs 3.1
 *
 * Cosa fa:
 *   1. build del web (npm run build in app/) → dist/
 *   2. zip del CONTENUTO di dist/ (index.html alla radice dello zip) →
 *      ota-out/metabole-<versione>.zip
 *   3. stampa il testo di `latest.json` da caricare su metabole.eu/app-updates/
 *
 * Poi, a mano (una volta), su metabole.eu (SiteGround File Manager, cartella
 * public_html/app-updates/):
 *   - carica  metabole-<versione>.zip
 *   - aggiorna latest.json con il testo stampato
 * L'app scaricherà il bundle e lo attiverà al prossimo avvio.
 *
 * ⚠ La <versione> deve essere SEMPRE nuova e crescente rispetto all'ultima spinta.
 * ⚠ Dopo una pubblicazione sullo store, rimetti latest.json "spento":
 *   { "version": null, "url": null }  (così le installazioni fresche non riscaricano).
 */
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(APP, 'dist');
const OUT = path.join(ROOT, 'ota-out');
const BASE_URL = 'https://metabole.eu/app-updates';

const version = process.argv[2];
if (!version || !/^[0-9A-Za-z._-]+$/.test(version)) {
  console.error('Uso: node scripts/ota-release.mjs <versione>   (es. 3.1)');
  process.exit(1);
}

function run(cmd, cwd) {
  console.log(`→ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  console.log('=== Metabole · pacchetto OTA ' + version + ' ===');
  run('npm run build', APP);

  await fs.mkdir(OUT, { recursive: true });
  const zipName = `metabole-${version}.zip`;
  const zipPath = path.join(OUT, zipName);
  await fs.rm(zipPath, { force: true });
  // zip del CONTENUTO di dist/ (non della cartella): index.html alla radice.
  run(`zip -r -q "${zipPath}" .`, DIST);

  const latest = { version, url: `${BASE_URL}/${zipName}`, notes: '' };
  console.log('\n✅ Bundle pronto:');
  console.log('   ' + zipPath);
  console.log('\n📤 Carica su metabole.eu/app-updates/:');
  console.log('   1) il file  ' + zipName);
  console.log('   2) latest.json con questo contenuto:\n');
  console.log(JSON.stringify(latest, null, 2));
  console.log('\n(Per SPEGNERE l\'OTA dopo una release store: latest.json = { "version": null, "url": null })');
}

main().catch((e) => { console.error(e); process.exit(1); });
