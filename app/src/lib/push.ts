import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../api/client';
import { datiDallaPush, type DatiNotifica } from './rottaNotifica';

let started = false;

/**
 * ⚠️ IL TOCCO PUÒ ARRIVARE PRIMA DELLE ROTTE.
 *
 * Se l'app è chiusa, il sistema la avvia e consegna il tocco subito: in quel momento React può non
 * aver ancora montato il router, e navigare vorrebbe dire parlare a qualcuno che non c'è. Il tocco
 * si mette da parte e lo si consuma appena qualcuno è in grado di raccoglierlo — altrimenti aprire
 * l'app da una notifica funzionerebbe solo se l'app era già aperta, cioè nel caso che serve meno.
 */
let toccoInSospeso: DatiNotifica | null = null;
let vaiAllaNotifica: ((dati: DatiNotifica) => void) | null = null;

/** Chi sa navigare si registra qui. Se c'era un tocco in attesa, lo riceve subito. */
export function alToccoDellaNotifica(handler: (dati: DatiNotifica) => void): void {
  vaiAllaNotifica = handler;
  if (toccoInSospeso) {
    const dati = toccoInSospeso;
    toccoInSospeso = null;
    handler(dati);
  }
}

function consegna(dati: DatiNotifica): void {
  if (vaiAllaNotifica) vaiAllaNotifica(dati);
  else toccoInSospeso = dati;
}

/**
 * Registra il dispositivo per le notifiche push e manda il token al backend.
 * No-op sul web (le push arrivano solo sull'app nativa). Si chiama dopo il login.
 */
export async function initPush(): Promise<void> {
  if (started) return;
  const piattaforma = Capacitor.getPlatform();
  if (piattaforma === 'web') return;

  // 🔎 TRACCIA (6/8/2026). Su iPhone non arrivava né token né errore: silenzio totale,
  // impossibile capire dove si fermasse. Ora ogni passaggio viene riferito al server e
  // il pulsante "Push di prova" mostra l'ULTIMO passo raggiunto. Costa una chiamata per
  // avvio dell'app e ci fa risparmiare ore di ipotesi.
  segnalaErrore(`traccia: initPush avviato · enablePush=${String(__ENABLE_PUSH__)}`, piattaforma);

  // Le push restano SPENTE finché Firebase (google-services.json) non è configurato:
  // su Android, registrarle senza Firebase può lanciare un'eccezione nativa che chiude
  // l'app. __ENABLE_PUSH__ è true SOLO se google-services.json era presente al build
  // (vedi vite.config.ts): così si accendono da sole quando metti il file, niente flag.
  if (!__ENABLE_PUSH__) return void segnalaErrore('bundle costruito SENZA google-services.json: registrazione push disattivata a compile-time', piattaforma);
  started = true;

  try {
    let perm = await PushNotifications.checkPermissions();
    segnalaErrore(`traccia: permesso letto = ${perm.receive}`, piattaforma);
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
      segnalaErrore(`traccia: permesso richiesto → ${perm.receive}`, piattaforma);
    }
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

    /**
     * IL TOCCO SULLA NOTIFICA (Simone, 12/8: «se clicco sulla notifica mi porti nella chat
     * specifica»). Prima non c'era nessun ascoltatore: toccare la push apriva l'app sulla home, e
     * il messaggio bisognava ritrovarlo a mano — che è il motivo per cui una notifica esiste.
     *
     * I dati arrivano dai `data` di Firebase, che il server riempie in `dati-push.ts`.
     */
    await PushNotifications.addListener('pushNotificationActionPerformed', (azione) => {
      try {
        consegna(datiDallaPush(azione?.notification?.data));
      } catch {
        /* un tocco che non si sa dove portare apre l'app e basta: come prima, non peggio */
      }
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
