import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// App cliente Metabole. In sviluppo l'API è su VITE_API_URL (default: backend Render).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
