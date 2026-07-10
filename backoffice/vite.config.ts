import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Backoffice Metabole. In sviluppo l'API è su http://localhost:3000 (o VITE_API_URL).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
