import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Handoff punto 6 — funnel per segmento e canale + link preferenze firmato.
 *
 * SEGMENTO di provenienza (ex cliente / lead caldo / lead freddo): se non è
 * impostato a mano sulla scheda, si deriva dallo storico importato e dallo stage.
 */

export type FunnelSegment = 'ex_cliente' | 'lead_caldo' | 'lead_freddo';

/**
 * ⛔ **QUI C'ERA L'ELENCO DELLE COLONNE «CALDE», ED ERA DI UN ALTRO CRM.**
 *
 * Diceva: `contacted, interested, recall, appointment, negotiation, trial, paid, won`. Misurato il
 * 20/8 contro le colonne vere del prodotto: **sei di quelle otto chiavi in Metabole non esistono**
 * (contacted, interested, recall, appointment, negotiation, won), e **dieci delle dodici colonne
 * vere l'elenco non le conosceva** — fra cui «Questionario completato», «Coach assegnata», «Call
 * con la coach», «Prima visita», «Follow-up».
 *
 * ⚠️ Il risultato non era un errore: era una risposta, sbagliata, data con sicurezza. Una cliente
 * che aveva già fatto la prima visita risultava **lead freddo** in ogni evento del funnel e nelle
 * email del ciclo di vita — cioè riceveva i messaggi pensati per chi non ha mai risposto.
 *
 * ## La regola adesso, e perché è al contrario
 *
 * Non c'è più un elenco di colonne calde: **freddo è solo «Nuovo contatto»** (`lead_in`), la
 * colonna in cui una scheda nasce senza che sia successo niente. Tutto il resto è caldo, perché
 * ogni altra colonna vuol dire che qualcosa è successo.
 *
 * ⚠️ Ed è il verso giusto per la ragione che ha prodotto il difetto: con un elenco di colonne
 * calde, **ogni colonna nuova nasce fredda** e bisogna ricordarsi di aggiungerla. «Primo accesso
 * effettuato», creata oggi, sarebbe nata fredda. Così invece nasce calda, che è quasi sempre la
 * verità, e se un giorno servirà una seconda colonna fredda si aggiunge qui — dove chi la aggiunge
 * sta già leggendo perché.
 *
 * Scelte da Simone, 20/8.
 */
const STAGE_FREDDI = new Set(['lead_in']);

/**
 * ⚠️ «Percorso concluso» è un **ex cliente**, non un lead freddo (Simone, 20/8). Prima ci arrivava
 * solo chi aveva speso soldi *prima* di Metabole (`historicalPaidCents`): una cliente nata qui e
 * arrivata in fondo al percorso non diventava mai ex cliente, e riceveva le email di chi non ci ha
 * mai risposto invece di quelle che parlano di tornare.
 */
const STAGE_EX_CLIENTE = new Set(['path_ended']);

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
  if (r.stage && STAGE_EX_CLIENTE.has(r.stage)) return 'ex_cliente';
  /**
   * ⚠️ **Senza colonna, freddo.** Una scheda senza `stage` non è una scheda «di cui non si sa»:
   * è una scheda su cui non è successo niente, come «Nuovo contatto». Trattarla come calda vorrebbe
   * dire mandare le email dei contatti caldi a chi è arrivato da un import e basta.
   */
  if (!r.stage || STAGE_FREDDI.has(r.stage)) return 'lead_freddo';
  return 'lead_caldo';
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
