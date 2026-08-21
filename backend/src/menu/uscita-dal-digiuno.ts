/**
 * USCIRE DAL DIGIUNO PORTA VIA TUTTO L'OROLOGIO — l'elenco, scritto una volta sola.
 *
 * ## Perché esiste un file per sette `null`
 *
 * Perché le porte che tolgono una cliente dal digiuno sono **quattro**, e ognuna scriveva il proprio
 * elenco a mano:
 *
 *  1. la scheda staff (`clients.updateClient`);
 *  2. il questionario rifatto (`onboarding.service`);
 *  3. lo script di spostamento percorso (`prisma/sposta-percorso-cliente.ts`);
 *  4. il profilo della cliente stessa (`profile.updateProfile`, che accetta `pathType`).
 *
 * ⚠️ Il 21/8 tre di queste quattro erano **già divergenti**: lo script azzerava solo `fastingWindow`,
 * il profilo non azzerava niente, e la scheda staff aveva l'elenco giusto ma dietro una guardia che
 * guardava il campo sbagliato. Non è distrazione: sette nomi copiati in quattro punti divergono per
 * costruzione, e la sesta volta che si aggiunge una colonna se ne dimenticano due.
 *
 * ## ⛔ Perché **tutti e sette**, e in particolare `fastingSceltoIl`
 *
 * `fastingSceltoIl` è la memoria della domanda: finché è pieno, la pagina dell'orologio non le si
 * riapre più. Se sopravvive a un giro fuori dal digiuno, il giorno che questa cliente ci torna **non
 * le viene chiesto niente** e si ritrova la finestra di sei mesi prima — un dato che agisce e non si
 * vede, e che nessuno ha mai deciso.
 *
 * ⚠️ E lo stato peggiore non è «tutto scritto»: è **mezzo**. Con `fastingWindow` a `null` e
 * protocollo e orario ancora scritti, l'app e la scheda calcolano le fasce da quelli — «08:00 –
 * 16:00 · 3 pasti» — mentre il motore, che legge `fastingWindow`, non salta niente e le manda tutti
 * i pasti. Schermo e piatto che dicono due cose diverse, senza nessun errore da nessuna parte.
 *
 * ⚠️ Qui non c'è Prisma e non c'è nessuna decisione: c'è **l'elenco**. Chi chiama decide *se* è il
 * momento di azzerare (`restaQualcosaDellOrologio`) e lo scrive nella sua transazione, col suo audit.
 */

/** Le sette colonne dell'orologio. ⚠️ Se ne nasce un'ottava, si aggiunge **qui**. */
export const COLONNE_OROLOGIO = [
  'fastingWindow',
  'fastingProtocol',
  'fastingStartMin',
  'fastingTargetStartMin',
  'fastingTargetProtocol',
  'fastingSceltoIl',
  'fastingChangedAt',
] as const;

export type ColonnaOrologio = (typeof COLONNE_OROLOGIO)[number];

/**
 * I sette `null` da mettere in `data`.
 *
 * ⚠️ Un oggetto **nuovo** a ogni chiamata: una costante condivisa finirebbe dentro un `data` di
 * Prisma, e il primo che ci scrive sopra la sporca per tutti gli altri chiamanti del processo.
 */
export const orologioAzzerato = (): Record<ColonnaOrologio, null> =>
  Object.fromEntries(COLONNE_OROLOGIO.map((c) => [c, null])) as Record<ColonnaOrologio, null>;

/**
 * C'è ancora qualcosa dell'orologio addosso a questo profilo?
 *
 * ⛔ È la domanda giusta, e non «la finestra era piena» — che era la guardia di prima. Esiste un modo
 * di arrivarci con la finestra già vuota e l'orologio ancora tutto scritto (lo script lo sapeva
 * creare), e in quello stato la guardia vecchia **non partiva**: proprio nel caso peggiore.
 *
 * ⚠️ `0` e `''` contano come «scritto»: `fastingStartMin: 0` è la mezzanotte, un orario vero. Il
 * confronto è con `null`/`undefined`, non con la verità di JavaScript.
 */
export function restaQualcosaDellOrologio(profilo: Record<string, unknown> | null | undefined): boolean {
  if (!profilo) return false;
  return COLONNE_OROLOGIO.some((c) => profilo[c] !== null && profilo[c] !== undefined);
}

/**
 * Il `select` da dare a Prisma per poter rispondere a `restaQualcosaDellOrologio`.
 *
 * ⚠️ Sta qui e non nei chiamanti perché è la **stessa** domanda: un servizio che ne seleziona sei su
 * sette risponde «non c'è più niente» a un profilo che ha ancora una colonna scritta, e sbaglia in
 * silenzio.
 */
export const SELECT_OROLOGIO = Object.fromEntries(
  COLONNE_OROLOGIO.map((c) => [c, true]),
) as Record<ColonnaOrologio, true>;
