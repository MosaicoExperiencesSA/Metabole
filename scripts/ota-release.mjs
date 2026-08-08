#!/usr/bin/env node
/**
 * Prepara lo zip di un aggiornamento OTA (Capgo, self-hosted). NON tocca gli store:
 * serve per spingere un fix web all'app nativa senza ripassare dalla revisione.
 *
 *   node scripts/ota-release.mjs <versione>
 *   es:  node scripts/ota-release.mjs 3.1
 *
 * Cosa fa:
 *   1. scrive la versione in app/package.json (è il numero che l'app MOSTRA in Profilo:
 *      senza questo passo il bundle "2.1.1" dichiarava ancora "2.1.0")
 *   2. build del web (npm run build in app/) → dist/
 *   3. zip del CONTENUTO di dist/ (index.html alla radice dello zip) →
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

  // ⛔ GUARDIA 2 (6/8/2026, dopo averci sbattuto davvero).
  // Capgo decide se scaricare confrontando la STRINGA di versione, non il contenuto:
  // in `ota.ts` un telefono che ha già applicato la versione X si segna
  // `ota_applied_version = X` e non riscarica mai più quel numero. Quindi ripubblicare
  // un bundle DIVERSO con lo STESSO numero non raggiunge chi ha già preso il precedente:
  // resta bloccato per sempre su un bundle vecchio, e non c'è modo di accorgersene.
  // Il 6/8 tre bundle diversi sono usciti tutti come "2.0.1".
  const giaPubblicato = path.join(ROOT, 'backend', 'ota-bundles', `metabole-${version}.zip`);
  if (existsSync(giaPubblicato) && !process.env.OTA_FORCE) {
    console.error(`\n⛔ La versione ${version} è già stata pubblicata: esiste backend/ota-bundles/metabole-${version}.zip`);
    console.error('   Sovrascriverla NON aggiorna chi l\'ha già scaricata: Capgo confronta il numero,');
    console.error('   non il contenuto, e quei telefoni resterebbero fermi al bundle vecchio per sempre.');
    console.error(`   Alza il numero: aggiorna "version" in app/package.json e rilancia con la versione nuova.`);
    console.error('   (Se sei certo che nessuno l\'abbia scaricata: OTA_FORCE=1 node scripts/ota-release.mjs ' + version + ')\n');
    process.exit(1);
  }

  // ⛔ GUARDIA 3 (9/8/2026). Il numero che l'app MOSTRA (`__APP_VERSION__`, in Profilo) viene
  // da `app/package.json` e veniva iniettato al build; questo script invece usava la versione
  // solo come nome dello zip e come valore di OTA_VERSION. Erano due numeri scollegati: la
  // 2.1.1 è stata costruita, pubblicata e scaricata, e sui telefoni compariva «2.1.0».
  // Nessuno poteva più sapere che cosa stesse girando su un telefono — che è il motivo per cui
  // il numero di versione esiste. Ora la versione si scrive PRIMA di costruire: quello che
  // vedi in app è quello che hai pubblicato.
  const pkgPath = path.join(APP, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  if (pkg.version !== version) {
    console.log(`→ allineo app/package.json: ${pkg.version} → ${version}`);
    pkg.version = version;
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  (committa anche questo: il numero in app deve restare quello pubblicato)');
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
