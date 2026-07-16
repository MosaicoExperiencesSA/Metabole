/// <reference types="vite/client" />

/** Versione dell'app, iniettata da Vite (vite.config.ts) dal package.json. */
declare const __APP_VERSION__: string;

/** true se google-services.json è presente al build → notifiche push attive. */
declare const __ENABLE_PUSH__: boolean;
