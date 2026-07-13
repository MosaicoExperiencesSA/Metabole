/**
 * Tracciamento eventi (analitico) per l'app cliente.
 * Invia ogni interazione rilevante a POST /api/v1/events (append-only).
 *
 * - fire-and-forget: non blocca mai l'UI e ingoia gli errori;
 * - `fetch(..., { keepalive: true })`: sopravvive alla chiusura pagina e — a
 *   differenza di navigator.sendBeacon — permette l'header Authorization, così
 *   il backend può legare l'evento all'utente quando è loggato;
 * - `eventId` UUID per evento → idempotenza sui retry;
 * - `session` anonima persistente (riconciliata all'utente alla registrazione);
 * - `refcod` letto una volta da ?ref=CODICE e conservato per l'attribuzione.
 *
 * Vedi docs/Metabole_Tracciamento_Dati.md.
 */
import { API_BASE_URL, getAccessToken } from '../api/client';

const SESSION_KEY = 'metabole_session';
const REFCOD_KEY = 'metabole_refcod';

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fallback sotto */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSession(): string {
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = 'sess_' + uuid();
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return 'sess_ephemeral';
  }
}

/** Cattura ?ref=CODICE dall'URL (una volta) e lo conserva per la registrazione. */
function getRefcod(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ref');
    if (fromUrl) localStorage.setItem(REFCOD_KEY, fromUrl);
    return localStorage.getItem(REFCOD_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface TrackMeta {
  phase?: 'flow' | 'app';
  screen?: string;
  step?: number;
}

/** Registra un evento. Non attende la risposta e non lancia mai. */
export function track(event: string, data?: Record<string, unknown>, meta?: TrackMeta): void {
  try {
    const payload = {
      event,
      eventId: uuid(),
      ts: Date.now(),
      session: getSession(),
      refcod: getRefcod(),
      phase: meta?.phase,
      screen: meta?.screen,
      step: meta?.step,
      data,
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    void fetch(`${API_BASE_URL}/api/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* analitica best-effort: ignoriamo gli errori di rete */
    });
  } catch {
    /* il tracciamento non deve mai rompere l'app */
  }
}

/** Il codice referral conservato (per legarlo al cliente alla registrazione). */
export function currentRefcod(): string | undefined {
  return getRefcod();
}
