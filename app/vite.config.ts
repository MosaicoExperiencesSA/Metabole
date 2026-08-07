/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'fs';
import { defineConfig } from 'vite';

// Versione dall'app package.json, iniettata a build-time come costante globale __APP_VERSION__.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Le notifiche push si accendono DA SOLE quando il file google-services.json è presente
// nella cartella app/ (scaricato da Firebase). Senza quel file restano spente, così su
// Android non si rischia il crash nativo di registrazione FCM senza configurazione.
const pushEnabled = existsSync(new URL('./google-services.json', import.meta.url));

// App cliente Metabole. In sviluppo l'API è su VITE_API_URL (default: backend Render).
export default defineConfig({
  plugins: [react()],
  // Test dell'app (vitest, aggiunto il 7/8). Non c'erano: backend e backoffice avevano i loro,
  // l'app veniva solo compilata dalla CI. È il motivo per cui un difetto banale — una casella
  // vuota che partiva come `0` e bloccava il salvataggio delle misure — è arrivato a una
  // cliente invece di fermarsi qui.
  //
  // `environment: 'node'`: per ora si testa la logica pura (lib/), non i componenti. Il giorno
  // che servirà provare una schermata si passa a 'jsdom' e si aggiunge testing-library, senza
  // toccare nient'altro.
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __ENABLE_PUSH__: JSON.stringify(pushEnabled),
  },
  server: { port: 5174 },
});
