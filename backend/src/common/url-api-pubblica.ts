/**
 * ⛔ L'INDIRIZZO PUBBLICO DELLE API, con `/api/v1` UNA volta sola (16/9).
 *
 * Le email portano link che devono arrivare al backend (disiscrizione con un clic, invito a Gaia).
 * Le rotte vivono sotto il prefisso globale `api/v1` (`main.ts`), ma `PUBLIC_API_URL` non dice se il
 * prefisso ce l'ha già: le email di marketing costruivano `…/public/marketing/unsubscribe` **senza**
 * prefisso, e l'allegato della chat lo aggiunge da sé. Qui la domanda ha una risposta sola: si parte
 * dalla variabile (o dall'indirizzo di Render), si toglie la barra finale, e `/api/v1` si aggiunge
 * solo se manca.
 */
export const INDIRIZZO_API_PREDEFINITO = 'https://metabole-backend.onrender.com';

export function urlApiPubblica(variabile: string | null | undefined): string {
  const base = (variabile?.trim() || INDIRIZZO_API_PREDEFINITO).replace(/\/+$/, '');
  return /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
}
