/**
 * ALLERGIE E INTOLLERANZE, LETTE IN CIMA AL PROFILO — richiesta di Simone (16/8).
 *
 * In app c'erano già, ma nel secondo riquadro («Cibi esclusi»), insieme alla spiegazione lunga e ai
 * cibi che la cliente gestisce da sé. Qui salgono in **sintesi** nel primo riquadro, quello che si
 * legge come «il mio piano in una schermata»: accanto alla dieta e al regime stanno i due vincoli
 * che decidono cosa NON può esserci nel piatto. Sola lettura — si cambiano dalla nutrizionista.
 *
 * ⚠️ LA DISTINZIONE CHE REGGE TUTTO QUESTO FILE: **«nessuna allergia» e «non ce l'hai mai detto»
 * non sono la stessa cosa.** La prima è un'affermazione — vuol dire che il piatto è libero — e
 * scriverla quando in realtà non lo sappiamo è il modo più veloce di far fidare una persona di una
 * cosa che nessuno ha verificato. È la stessa regola che il riquadro «Cibi esclusi» applica dal
 * 12/8, e vale doppio qui dove la riga è corta e si legge di sfuggita.
 */

export type StatoAllergie =
  /** Ce ne sono, e si dicono. */
  | { tipo: 'elenco'; testo: string }
  /** Gliel'abbiamo chiesto e ha detto di no: «nessuna» si può scrivere. */
  | { tipo: 'nessuna' }
  /** Non gliel'abbiamo mai chiesto: si dice quello, non «nessuna». */
  | { tipo: 'mai_chieste' };

/** Le voci non vuote, con la maiuscola solo sulla prima: è una frase, non un elenco puntato. */
function elenco(voci: readonly string[] | null | undefined): string | null {
  const pulite = (voci ?? []).map((v) => (v ?? '').trim()).filter(Boolean);
  if (!pulite.length) return null;
  const t = pulite.join(', ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Cosa scrivere sulla riga delle allergie.
 *
 * ⚠️ Se ci sono allergie valgono **anche senza la data**: le clienti iscritte prima che la
 * dichiarazione esistesse hanno le allergie in scheda e `allergieDichiarateIl` a `null`. Fra i due
 * errori possibili — mostrare un'allergia che qualcuno ha già corretto, o nasconderne una vera —
 * si sceglie sempre lo stesso.
 */
export function statoAllergie(
  allergie: readonly string[] | null | undefined,
  dichiarateIl: string | null | undefined,
): StatoAllergie {
  const testo = elenco(allergie);
  if (testo) return { tipo: 'elenco', testo };
  return dichiarateIl ? { tipo: 'nessuna' } : { tipo: 'mai_chieste' };
}

/**
 * Le intolleranze, o `null` se non ce ne sono.
 *
 * ⚠️ Qui `null` vuol dire «la riga non compare», e la differenza con le allergie è voluta: un
 * elenco vuoto di intolleranze **non è un'affermazione di sicurezza**, quindi non c'è niente da
 * dire — e una riga che dice «nessuna» in un riquadro di sintesi è rumore che allunga la lettura.
 */
export function elencoIntolleranze(voci: readonly string[] | null | undefined): string | null {
  return elenco(voci);
}
