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
  const bumped = v
    .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 35')
    .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 35');
  if (bumped !== v) {
    await fs.writeFile(VARIABLES, bumped);
    console.log('→ variables.gradle: compileSdk/targetSdk portati a 35 (requisito Play Store).');
  } else {
    console.log('→ variables.gradle: SDK già a 35, salto.');
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

  console.log('✅ Progetto Android adeguato ai requisiti Play Store (SDK 35).');
}

main().catch((e) => { console.error(e); process.exit(1); });
