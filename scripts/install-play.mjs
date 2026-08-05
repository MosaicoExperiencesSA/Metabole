#!/usr/bin/env node
/**
 * Adegua il progetto Android generato da Capacitor ai requisiti del PLAY STORE:
 *   1. variables.gradle → compileSdkVersion/targetSdkVersion 35 (obbligatorio per
 *      le app NUOVE su Google Play dal 2025/2026; il template Capacitor 6 usa 34).
 *   2. gradle.properties → android.suppressUnsupportedCompileSdk=35 (AGP 8.2
 *      emetterebbe un warning bloccante-in-apparenza con compileSdk 35).
 *   3. styles.xml → opt-out temporaneo dall'edge-to-edge forzato di Android 15
 *      (windowOptOutEdgeToEdgeEnforcement): senza, su Android 15 la UI finirebbe
 *      sotto la barra di stato. Da rimuovere quando gestiremo le safe-area in CSS.
 *   4. versionCode/versionName in app/build.gradle presi da app/android-version.json
 *      (unica fonte di verità: alzare lì versionCode a OGNI nuovo AAB per il Play Store).
 *
 * IDEMPOTENTE. Va eseguito dopo `cap sync android` (lo fa in automatico
 * `npm run android:sync`, come gli altri script install-*).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'app', 'android');
const VARIABLES = path.join(ANDROID, 'variables.gradle');
const GRADLE_PROPS = path.join(ANDROID, 'gradle.properties');
const STYLES = path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'styles.xml');
const APP_GRADLE = path.join(ANDROID, 'app', 'build.gradle');
const BUILD_GRADLE = path.join(ANDROID, 'build.gradle');
const WRAPPER = path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties');
const VERSION_FILE = path.join(ROOT, 'app', 'android-version.json');

// Target API 36 (Android 16) — obbligatorio su Google Play dal 31/8/2026 per gli
// aggiornamenti. compileSdk 36 richiede AGP >= 8.9.1, che a sua volta richiede
// Gradle >= 8.11.1 (JDK 17 già usato). Il template Capacitor 6 nasce con AGP 8.2.1
// e Gradle 8.2.1, quindi vanno alzati DOPO cap add android (qui).
const AGP_VERSION = '8.9.1';
const GRADLE_VERSION = '8.11.1';

const SUPPRESS = 'android.suppressUnsupportedCompileSdk=35';
const EDGE_ITEM = '        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>';

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(ANDROID))) {
    console.error(`❌ Manca ${ANDROID}\n   Genera prima il progetto Android:  cd app && npm run android:init`);
    process.exit(1);
  }

  // 1) variables.gradle → SDK 35
  let v = await fs.readFile(VARIABLES, 'utf8');
  // minSdk 23 (Android 6.0): richiesto da androidx.savedstate 1.4.0, trascinata dal plugin
  // OTA @capgo/capacitor-updater. Il template Capacitor 6 usa minSdk 22 e il merge del
  // manifest fallirebbe ("minSdkVersion 22 cannot be smaller than 23").
  const bumped = v
    .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
    .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36')
    .replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 23');
  if (bumped !== v) {
    await fs.writeFile(VARIABLES, bumped);
    console.log('→ variables.gradle: compileSdk/targetSdk 36 + minSdk 23 (Play Store API 36 + plugin OTA).');
  } else {
    console.log('→ variables.gradle: SDK già a 36 e minSdk 23, salto.');
  }

  // 1b) AGP + Gradle: compileSdk 36 richiede AGP >= 8.9.1 e Gradle >= 8.11.1.
  let bg = await fs.readFile(BUILD_GRADLE, 'utf8');
  const bgNew = bg.replace(
    /(com\.android\.tools\.build:gradle:)[0-9][0-9.]*/,
    `$1${AGP_VERSION}`,
  );
  if (bgNew !== bg) {
    await fs.writeFile(BUILD_GRADLE, bgNew);
    console.log(`→ build.gradle (progetto): Android Gradle Plugin ${AGP_VERSION}.`);
  } else {
    console.log(`→ build.gradle (progetto): AGP già ${AGP_VERSION} (o riga non trovata), salto.`);
  }

  if (await exists(WRAPPER)) {
    let w = await fs.readFile(WRAPPER, 'utf8');
    const wNew = w.replace(
      /gradle-[0-9][0-9.]*-(all|bin)\.zip/,
      `gradle-${GRADLE_VERSION}-all.zip`,
    );
    if (wNew !== w) {
      await fs.writeFile(WRAPPER, wNew);
      console.log(`→ gradle-wrapper.properties: Gradle ${GRADLE_VERSION}.`);
    } else {
      console.log(`→ gradle-wrapper.properties: Gradle già ${GRADLE_VERSION}, salto.`);
    }
  }

  // 2) gradle.properties → suppress warning compileSdk 35 con AGP 8.2
  let g = await fs.readFile(GRADLE_PROPS, 'utf8');
  if (!g.includes('suppressUnsupportedCompileSdk')) {
    await fs.writeFile(GRADLE_PROPS, g.trimEnd() + '\n\n' + SUPPRESS + '\n');
    console.log('→ gradle.properties: aggiunto suppressUnsupportedCompileSdk=35.');
  } else {
    console.log('→ gradle.properties: suppress già presente, salto.');
  }

  // 3) styles.xml → opt-out edge-to-edge (Android 15, targetSdk 35)
  if (await exists(STYLES)) {
    let s = await fs.readFile(STYLES, 'utf8');
    if (s.includes('windowOptOutEdgeToEdgeEnforcement')) {
      console.log('→ styles.xml: opt-out edge-to-edge già presente, salto.');
    } else if (s.includes('<style name="AppTheme.NoActionBar"')) {
      s = s.replace(
        /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
        `$1\n${EDGE_ITEM}`,
      );
      await fs.writeFile(STYLES, s);
      console.log('→ styles.xml: aggiunto opt-out edge-to-edge (Android 15).');
    } else {
      console.error('⚠️  Non trovo AppTheme.NoActionBar in styles.xml: aggiungi a mano windowOptOutEdgeToEdgeEnforcement.');
    }
  }

  // 4) versionCode / versionName da app/android-version.json
  if (await exists(VERSION_FILE)) {
    const { versionCode, versionName } = JSON.parse(await fs.readFile(VERSION_FILE, 'utf8'));
    if (Number.isInteger(versionCode) && typeof versionName === 'string') {
      let b = await fs.readFile(APP_GRADLE, 'utf8');
      const patched = b
        .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
        .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
      if (patched !== b) {
        await fs.writeFile(APP_GRADLE, patched);
        console.log(`→ build.gradle: versione impostata a ${versionName} (versionCode ${versionCode}).`);
      } else {
        console.log(`→ build.gradle: versione già a ${versionName} (versionCode ${versionCode}), salto.`);
      }
    } else {
      console.error('⚠️  app/android-version.json malformato: servono versionCode (intero) e versionName (stringa).');
    }
  } else {
    console.log('→ app/android-version.json assente: versionCode/versionName restano quelli del template.');
  }

  console.log(`✅ Progetto Android adeguato ai requisiti Play Store (target API 36, AGP ${AGP_VERSION}/Gradle ${GRADLE_VERSION}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
