import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Preferences } from '@capacitor/preferences';
import { API_BASE_URL } from '../api/client';
import { track } from './track';

/**
 * Aggiornamenti OTA (Over-The-Air) — SELF-HOSTED, senza server Capgo.
 *
 * L'app nativa (iOS/Android) impacchetta il web (dist/): normalmente le modifiche
 * frontend arrivano solo con una nuova build sullo store. Con l'OTA invece l'app
 * scarica al volo un nuovo bundle web e lo attiva al prossimo avvio, SENZA passare
 * dallo store — utile per fix e ritocchi UI (NON per modifiche native: plugin,
 * permessi, icona, push → quelle richiedono sempre una build store).
 *
 * Come funziona:
 *  1) all'avvio chiamiamo notifyAppReady() (sicurezza anti-rollback di Capgo);
 *  2) leggiamo il manifest pubblico dal NOSTRO backend (`/api/v1/app-updates/latest.json`)
 *     con { version, url } dell'ultimo bundle;
 *  3) se è una versione nuova (diversa da quella in esecuzione e non già scaricata),
 *     scarichiamo lo zip e lo mettiamo in coda con next(): si attiva al prossimo
 *     passaggio in background / riavvio (non interrompe l'uso corrente).
 *
 * NB: il manifest è servito dal backend (Render), NON da metabole.eu: il server
 * SiteGround blocca (403) la cartella /app-updates/ e non è sovrascrivibile.
 * Il backend è sotto nostro controllo, senza WAF.
 *
 * Solo su piattaforma NATIVA: su web è no-op (la web app si aggiorna col deploy Vercel).
 *
 * Regola operativa (vedi docs/OTA_Aggiornamenti.md):
 *  - OTA spento di default (il backend risponde version:null finché non imposti le env);
 *  - per accendere/spingere un fix via OTA: build → zip di dist/ → carica lo zip su
 *    un URL pubblico → imposta OTA_VERSION e OTA_BUNDLE_URL su Render.
 */

const OTA_URL = (import.meta.env.VITE_OTA_URL as string | undefined)
  ?? `${API_BASE_URL}/api/v1/app-updates/latest.json`;
const APPLIED_KEY = 'ota_applied_version';
const LAST_ERROR_KEY = 'ota_last_error';

/**
 * Un OTA che fallisce in silenzio è il peggiore dei casi: il manifest dice che c'è
 * una versione nuova, lo zip non c'è (o è corrotto), e sui telefoni non cambia niente
 * mentre da qui sembra tutto a posto. È già successo, ed è la stessa lezione degli
 * script di patch che non verificavano il proprio risultato: si segnala, non si ingoia.
 *
 * L'errore viaggia come evento analitico (`ota_error`, stessa strada di tutti gli altri)
 * e si ripete solo se CAMBIA: se un bundle è rotto lo scopriamo al primo avvio, non
 * riceviamo lo stesso errore da ogni telefono a ogni apertura.
 */
async function segnala(fase: string, dettaglio: Record<string, unknown>): Promise<void> {
  const firma = `${fase}:${JSON.stringify(dettaglio)}`;
  try {
    const { value } = await Preferences.get({ key: LAST_ERROR_KEY });
    if (value === firma) return; // già segnalato, identico: non insistiamo
    await Preferences.set({ key: LAST_ERROR_KEY, value: firma });
  } catch { /* se le preferenze non rispondono, segnaliamo comunque */ }
  console.warn('[OTA]', fase, dettaglio);
  track('ota_error', { fase, piattaforma: Capacitor.getPlatform(), ...dettaglio });
}

interface LatestBundle { version?: string | null; url?: string | null }

export async function initOta(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return; // OTA solo su app nativa

  // Segnala che il bundle attuale è partito bene (evita il rollback automatico di Capgo).
  try { await CapacitorUpdater.notifyAppReady(); } catch { /* ignora */ }

  let latest: LatestBundle | null = null;
  try {
    const res = await fetch(`${OTA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      // Il manifest è servito dal nostro backend: se non risponde è un problema nostro.
      await segnala('manifest', { stato: res.status });
      return;
    }
    latest = (await res.json()) as LatestBundle;
  } catch {
    // Qui dentro ci finisce anche il telefono semplicemente offline: non è un errore
    // da segnalare, l'app riprova al prossimo avvio.
    return;
  }
  if (!latest?.version || !latest?.url) return; // OTA spento o non configurato: normale

  // Già in esecuzione questa versione?
  let currentVersion: string | undefined;
  try { currentVersion = (await CapacitorUpdater.current())?.bundle?.version; } catch { /* ignora */ }
  if (latest.version === currentVersion) return;

  // Già scaricata/messa in coda questa versione? (evita ri-download inutili)
  try {
    const { value: applied } = await Preferences.get({ key: APPLIED_KEY });
    if (applied === latest.version) return;
  } catch { /* preferenze non disponibili: al peggio riscarichiamo */ }

  try {
    const bundle = await CapacitorUpdater.download({ version: latest.version, url: latest.url });
    await CapacitorUpdater.next({ id: bundle.id }); // si attiva al prossimo background/riavvio
    await Preferences.set({ key: APPLIED_KEY, value: latest.version });
    // Serve a sapere che l'OTA è arrivato davvero sui telefoni: finora non lo sapeva nessuno.
    track('ota_scaricato', { versione: latest.version, piattaforma: Capacitor.getPlatform() });
  } catch (e) {
    // Il caso che ci è già costato caro: manifest che punta a uno zip inesistente (404),
    // zip corrotto, spazio finito. Da qui in poi si vede.
    await segnala('download', {
      versione: latest.version,
      url: latest.url,
      messaggio: e instanceof Error ? e.message : String(e),
    });
  }
}
