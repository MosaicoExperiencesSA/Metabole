import type { CapacitorConfig } from '@capacitor/cli';

// Configurazione Capacitor: da questa base web nascono Android (APK) e iOS.
const config: CapacitorConfig = {
  appId: 'app.metabole.client',
  appName: 'Metabole',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
