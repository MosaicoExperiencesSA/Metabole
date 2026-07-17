import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Handoff punto 6 — funnel per segmento e canale + link preferenze firmato.
 *
 * SEGMENTO di provenienza (ex cliente / lead caldo / lead freddo): se non è
 * impostato a mano sulla scheda, si deriva dallo storico importato e dallo stage.
 */

export type FunnelSegment = 'ex_cliente' | 'lead_caldo' | 'lead_freddo';

// Stage di pipeline che indicano un contatto "caldo" (ha interagito davvero).
const WARM_STAGES = new Set(['contacted', 'interested', 'recall', 'appointment', 'negotiation', 'trial', 'paid', 'won']);

export function deriveSegment(r: {
  segment?: string | null;
  previousStatus?: string | null;
  historicalPaidCents?: number | null;
  stage?: string | null;
}): FunnelSegment {
  if (r.segment === 'ex_cliente' || r.segment === 'lead_caldo' || r.segment === 'lead_freddo') return r.segment;
  if ((r.historicalPaidCents ?? 0) > 0) return 'ex_cliente';
  const prev = (r.previousStatus ?? '').toLowerCase();
  if (prev.includes('client') || prev.includes('attiv') || prev.includes('acquis')) return 'ex_cliente';
  if (r.stage && WARM_STAGES.has(r.stage)) return 'lead_caldo';
  return 'lead_freddo';
}

// ---------- Token firmato per la pagina preferenze (disiscrizione facile) ----------
// Formato: <recordId>.<hmac-sha256(recordId, secret) primi 32 hex>. Nessuna scadenza:
// il link nel footer delle email deve funzionare sempre (requisito GDPR).

function sign(recordId: string, secret: string): string {
  return createHmac('sha256', secret).update(`prefs:${recordId}`).digest('hex').slice(0, 32);
}

export function prefsToken(recordId: string, secret: string): string {
  return `${recordId}.${sign(recordId, secret)}`;
}

/** Ritorna il recordId se la firma è valida, altrimenti null. */
export function verifyPrefsToken(token: string, secret: string): string | null {
  const dot = (token ?? '').lastIndexOf('.');
  if (dot <= 0) return null;
  const recordId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(recordId, secret);
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return recordId;
}
