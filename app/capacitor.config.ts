import type { CapacitorConfig } from '@capacitor/cli';

// Configurazione Capacitor: da questa base web nascono Android (APK) e iOS.
// L'app è unica per tutti i ruoli: dopo il login smista cliente / coach / nutrizionista.
const config: CapacitorConfig = {
  appId: 'app.metabole',
  appName: 'Metabole',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Sull'app nativa le chiamate REST passano dal layer nativo: niente vincolo CORS
    // del browser (il backend può anche non avere CORS abilitato lato web).
    CapacitorHttp: {
      enabled: true,
    },
    // Come vengono presentate le push in primo piano.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Aggiornamenti OTA (Capgo) in modalita' MANUALE self-hosted: il controllo versione
    // lo gestiamo noi in src/lib/ota.ts leggendo metabole.eu/app-updates/latest.json.
    // Niente auto-update del plugin, niente server Capgo.
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
