/**
 * ⛔ **QUALI EVENTI DI BREVO TOLGONO UN INDIRIZZO DALLE EMAIL PROMOZIONALI** (6/11/2026).
 *
 * Il webhook di Brevo arriva da DUE posti con due dialetti: il webhook delle campagne e quello delle
 * email transazionali (da cui parte l'invito a Gaia, `smtp/email`). Fino al 6/11 si confrontava il
 * nome dell'evento così com'era, in minuscolo, con un elenco scritto a mano, e mancava
 * `invalid_email`: Brevo lo manda quando l'indirizzo è scritto male o il dominio non esiste — cioè
 * proprio gli indirizzi vecchi dello storico importato, quelli che hanno portato il bounce al 7,37%
 * (pannello Consegnabilità, 7/10–5/11). Quegli indirizzi restavano in coda.
 *
 * Il nome si normalizza togliendo tutto quello che non è una lettera (`hard_bounce`, `hardBounce` e
 * `HARD-BOUNCE` sono lo stesso evento) e si restituisce il nome canonico, che finisce in
 * `marketing_opt_out.reason`.
 *
 * ⚠️ `soft_bounce` e `deferred` NON escludono: sono una casella piena o un server lento, cioè
 * indirizzi vivi. Escluderli toglierebbe persone vere per un guasto di un giorno.
 */
const ESCLUDONO: Record<string, string> = {
  unsubscribed: 'unsubscribed',
  unsubscribe: 'unsubscribed',
  spam: 'spam',
  complaint: 'spam',
  hardbounce: 'hard_bounce',
  invalidemail: 'invalid_email',
  blocked: 'blocked',
  blacklisted: 'blocked',
};

/** Il motivo canonico per cui l'evento esclude l'indirizzo, o `null` se l'indirizzo resta. */
export function motivoOptOutBrevo(evento: unknown): string | null {
  if (typeof evento !== 'string') return null;
  const chiave = evento.toLowerCase().replace(/[^a-z]/g, '');
  return ESCLUDONO[chiave] ?? null;
}
