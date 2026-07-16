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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __ENABLE_PUSH__: JSON.stringify(pushEnabled),
  },
  server: { port: 5174 },
});
