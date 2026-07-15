import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../api/client';

let started = false;

/**
 * Registra il dispositivo per le notifiche push e manda il token al backend.
 * No-op sul web (le push arrivano solo sull'app nativa). Si chiama dopo il login.
 */
export async function initPush(): Promise<void> {
  if (started) return;
  if (Capacitor.getPlatform() === 'web') return;
  // Le push restano SPENTE finché Firebase (google-services.json) non è configurato:
  // su Android, registrarle senza Firebase può lanciare un'eccezione nativa che chiude
  // l'app. Ad app collegata a Firebase, impostare VITE_ENABLE_PUSH=true e ricompilare.
  if (import.meta.env.VITE_ENABLE_PUSH !== 'true') return;
  started = true;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // Quando il dispositivo riceve il token FCM, lo salviamo lato server.
    await PushNotifications.addListener('registration', (token) => {
      api('/me/push-tokens', {
        method: 'POST',
        body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
      }).catch(() => {
        /* riproveremo alla prossima apertura */
      });
    });
    await PushNotifications.addListener('registrationError', () => {
      /* nessuna push su questo dispositivo */
    });

    await PushNotifications.register();
  } catch {
    /* il push non è disponibile su questo dispositivo: ignora */
  }
}
