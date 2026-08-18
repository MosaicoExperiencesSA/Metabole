/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Backoffice Metabole. In sviluppo l'API è su http://localhost:3000 (o VITE_API_URL).
export default defineConfig({
  plugins: [react()],
  /**
   * TEST DEL BACKOFFICE (vitest, aggiunto il 18/8) — e vale la pena dire perché solo adesso.
   *
   * Backend e app avevano i loro; il backoffice veniva **solo compilato** dalla CI. È il motivo per
   * cui quattro difetti di `menuOrder.ts` sono stati lì una settimana senza che nessuno li vedesse,
   * e sono saltati fuori solo perché qualcuno ha chiesto di spiegare come funziona quel file: un
   * dedup che fondeva due gruppi omonimi (perdita di dati, silenziosa), un'icona che spariva a chi
   * rinominava un gruppo, i titoli non ripuliti, e un default scritto che non scattava mai.
   * ⚠️ Un file che decide cosa vede una persona nel menu e che non ha un collaudo non è «semplice»:
   * è solo non controllato.
   *
   * `environment: 'node'`: per ora si collauda la logica pura (`lib/`), non i componenti — stessa
   * scelta dell'app. Il giorno che servirà provare una schermata si passa a 'jsdom' e si aggiunge
   * testing-library, senza toccare nient'altro.
   */
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
  server: { port: 5173 },
});
