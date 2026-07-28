import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Preferences } from '@capacitor/preferences';

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
 *  2) leggiamo un piccolo file pubblico su metabole.eu (`latest.json`) con
 *     { version, url } dell'ultimo bundle;
 *  3) se è una versione nuova (diversa da quella in esecuzione e non già scaricata),
 *     scarichiamo lo zip e lo mettiamo in coda con next(): si attiva al prossimo
 *     passaggio in background / riavvio (non interrompe l'uso corrente).
 *
 * Solo su piattaforma NATIVA: su web è no-op (la web app si aggiorna col deploy Vercel).
 *
 * Regola operativa (vedi docs/OTA_Aggiornamenti.md):
 *  - dopo ogni pubblicazione sullo store, `latest.json` va rimesso "spento"
 *    ({ "version": null }) così le installazioni fresche non riscaricano nulla;
 *  - per spingere un fix via OTA: build → zip di dist/ → upload su
 *    metabole.eu/app-updates/ → aggiorna `latest.json` con la nuova version+url.
 */

const OTA_URL = (import.meta.env.VITE_OTA_URL as string | undefined)
  ?? 'https://metabole.eu/app-updates/latest.json';
const APPLIED_KEY = 'ota_applied_version';

interface LatestBundle { version?: string | null; url?: string | null }

export async function initOta(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return; // OTA solo su app nativa

  // Segnala che il bundle attuale è partito bene (evita il rollback automatico di Capgo).
  try { await CapacitorUpdater.notifyAppReady(); } catch { /* ignora */ }

  try {
    const res = await fetch(`${OTA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = (await res.json()) as LatestBundle;
    if (!latest?.version || !latest?.url) return; // OTA spento o non configurato

    // Già in esecuzione questa versione?
    let currentVersion: string | undefined;
    try { currentVersion = (await CapacitorUpdater.current())?.bundle?.version; } catch { /* ignora */ }
    if (latest.version === currentVersion) return;

    // Già scaricata/messa in coda questa versione? (evita ri-download inutili)
    const { value: applied } = await Preferences.get({ key: APPLIED_KEY });
    if (applied === latest.version) return;

    const bundle = await CapacitorUpdater.download({ version: latest.version, url: latest.url });
    await CapacitorUpdater.next({ id: bundle.id }); // si attiva al prossimo background/riavvio
    await Preferences.set({ key: APPLIED_KEY, value: latest.version });
  } catch {
    /* offline o nessun aggiornamento: l'app continua con il bundle attuale */
  }
}
