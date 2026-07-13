import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

// Versione dall'app package.json, iniettata a build-time come costante globale __APP_VERSION__.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// App cliente Metabole. In sviluppo l'API è su VITE_API_URL (default: backend Render).
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { port: 5174 },
});
