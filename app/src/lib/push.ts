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
  // l'app. __ENABLE_PUSH__ è true SOLO se google-services.json era presente al build
  // (vedi vite.config.ts): così si accendono da sole quando metti il file, niente flag.
  if (!__ENABLE_PUSH__) return;
  started = true;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    const piattaforma = Capacitor.getPlatform();
    // Il permesso è stato negato: diciamolo al server, altrimenti dal backoffice si
    // vede solo l'assenza del token e non si capisce di chi è la colpa.
    if (perm.receive !== 'granted') return void segnalaErrore(`permesso notifiche non concesso (${perm.receive})`, piattaforma);

    // Quando il dispositivo riceve il token FCM, lo salviamo lato server.
    await PushNotifications.addListener('registration', (token) => {
      api('/me/push-tokens', {
        method: 'POST',
        body: JSON.stringify({ token: token.value, platform: piattaforma }),
      }).catch((e) => {
        // Riproveremo alla prossima apertura, ma intanto lasciamo traccia: un token
        // ottenuto e non salvato è un caso diverso da un token mai ottenuto.
        segnalaErrore(`token ricevuto ma non salvato: ${e instanceof Error ? e.message : String(e)}`, piattaforma);
      });
    });
    // ⚠️ Qui prima c'era un blocco vuoto: l'errore di registrazione spariva e dal server
    // si vedeva solo "nessun dispositivo", senza sapere se fosse un permesso negato, una
    // capability Push mancante nella build iOS o Firebase mal configurato. Ora si sa.
    await PushNotifications.addListener('registrationError', (err) => {
      const m = (err as { error?: string } | undefined)?.error ?? 'errore di registrazione senza dettagli';
      segnalaErrore(m, piattaforma);
    });

    await PushNotifications.register();
  } catch (e) {
    segnalaErrore(`eccezione in initPush: ${e instanceof Error ? e.message : String(e)}`, Capacitor.getPlatform());
  }
}

/** Manda al backend il motivo per cui le push non si sono attivate. Non deve mai far cadere l'app. */
function segnalaErrore(message: string, platform: string): void {
  api('/me/push-tokens/error', { method: 'POST', body: JSON.stringify({ message, platform }) }).catch(() => {
    /* se non riusciamo nemmeno a segnalare, pazienza: ci riproviamo alla prossima apertura */
  });
}
