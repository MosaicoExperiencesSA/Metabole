#!/usr/bin/env node
/**
 * Prepara lo zip di un aggiornamento OTA (Capgo, self-hosted). NON tocca gli store:
 * serve per spingere un fix web all'app nativa senza ripassare dalla revisione.
 *
 *   node scripts/ota-release.mjs <versione>
 *   es:  node scripts/ota-release.mjs 3.1
 *
 * Cosa fa:
 *   1. build del web (npm run build in app/) → dist/
 *   2. zip del CONTENUTO di dist/ (index.html alla radice dello zip) →
 *      ota-out/metabole-<versione>.zip
 *
 * Poi, per pubblicare l'aggiornamento (tutto dal backend, niente metabole.eu):
 *   1. copia  ota-out/metabole-<versione>.zip  in  backend/ota-bundles/  e fai push
 *      (così finisce nel deploy Render);
 *   2. su Render → Environment imposta  OTA_VERSION = <versione>  e salva.
 * L'app scaricherà il bundle da /api/v1/app-updates/bundles/ e lo attiverà al
 * prossimo avvio. (Il manifest è servito dal backend: la cartella /app-updates/
 * su metabole.eu è bloccata 403 da SiteGround.)
 *
 * ⚠ La <versione> deve essere SEMPRE nuova e crescente rispetto all'ultima spinta.
 * ⚠ Dopo una pubblicazione sullo store, rimuovi/svuota OTA_VERSION su Render
 *   (così le installazioni fresche non riscaricano un vecchio bundle).
 */
import { execSync } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(APP, 'dist');
const OUT = path.join(ROOT, 'ota-out');

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

  // ⛔ GUARDIA (aggiunta il 6/8/2026 dopo un incidente sfiorato).
  // `vite.config.ts` accende le push SOLO se `app/google-services.json` esiste al momento
  // del build (costante __ENABLE_PUSH__). Quel file è gitignorato, quindi su un clone fresco
  // — in sandbox o in CI — NON c'è: il build riesce lo stesso, ma tutto il codice di
  // registrazione del token viene eliminato dal bundle. Un OTA fatto così SPEGNE LE PUSH
  // sui telefoni che lo ricevono, in silenzio e senza errori.
  // Meglio rifiutarsi di costruire che scoprirlo dopo.
  if (!existsSync(path.join(APP, 'google-services.json'))) {
    console.error('\n⛔ Manca app/google-services.json — mi fermo qui.');
    console.error('   Senza quel file il bundle esce SENZA le notifiche push (__ENABLE_PUSH__ = false):');
    console.error('   chi riceve l\'aggiornamento smette di registrare il token e le push muoiono per tutti.');
    console.error('   Scaricalo da Firebase (Impostazioni progetto → app Android) e mettilo in app/.');
    console.error('   È gitignorato apposta: su un clone nuovo va rimesso a mano.\n');
    process.exit(1);
  }

  run('npm run build', APP);

  await fs.mkdir(OUT, { recursive: true });
  const zipName = `metabole-${version}.zip`;
  const zipPath = path.join(OUT, zipName);
  await fs.rm(zipPath, { force: true });
  // zip del CONTENUTO di dist/ (non della cartella): index.html alla radice.
  run(`zip -r -q "${zipPath}" .`, DIST);

  console.log('\n✅ Bundle pronto:');
  console.log('   ' + zipPath);
  console.log('\n📤 Per pubblicarlo (tutto dal backend):');
  console.log('   1) copia  ' + zipName + '  in  backend/ota-bundles/  e fai push');
  console.log('   2) su Render → Environment:  OTA_VERSION = ' + version + '   (poi Salva)');
  console.log('\n(Per SPEGNERE l\'OTA dopo una release store: rimuovi/svuota OTA_VERSION su Render)');
}

main().catch((e) => { console.error(e); process.exit(1); });
