/**
 * Letture condivise per i campi numerici che la CLIENTE compila a mano.
 *
 * ## Perché esiste
 *
 * Il 7/8 una cliente non riusciva a correggere le proprie misure: lasciava vuota la casella
 * «Fianchi» e il salvataggio falliva con «hipsCm must not be less than 40». Il motivo è che
 * `Number('')` fa **0**, e uno zero supera il controllo «è un numero» per poi schiantarsi sul
 * minimo. Un campo lasciato in bianco diventava così un valore fuori scala.
 *
 * Corretto il DTO delle misure, un controllo sugli altri DTO che le clienti compilano ha trovato
 * lo **stesso identico difetto ancora vivo in due posti**, e uno è il peggiore possibile: il
 * questionario di **registrazione** (`startWaistCm`, `startHipsCm`), cioè il primo contatto con
 * il prodotto, dove un errore incomprensibile non fa perdere una funzione — fa perdere la
 * persona. L'altro è la modifica dell'obiettivo (`weightToLoseKg`, `weeks`, `waistToLoseCm`).
 *
 * Da qui la regola in un posto solo: **campo facoltativo vuoto = campo non mandato**, mai zero.
 *
 * ## Cosa NON fa
 *
 * Non tocca i campi **obbligatori**. Sul peso, uno zero è un errore da segnalare, non una casella
 * in bianco: lì il messaggio giusto è «il peso deve essere un numero», non un silenzioso «non
 * l'ho ricevuto». E non allarga i limiti: 5 cm resta rifiutato, perché tollerare lo zero non
 * vuol dire tollerare tutto.
 */

/**
 * Valore numerico FACOLTATIVO scritto a mano: `''`, `null`, `0`, i negativi e il testo non
 * numerico diventano `undefined`, cioè «non lo mando». Accetta la virgola decimale, che è
 * come si scrivono i numeri in italiano.
 *
 * Da usare con `@IsOptional()` su misure, circonferenze, chili e settimane — dove lo zero non è
 * un valore possibile e quindi non c'è ambiguità su cosa significhi.
 */
export const numeroOpzionale = ({ value }: { value: unknown }): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
};

/**
 * Come `numeroOpzionale`, ma lo **zero è un valore legittimo**: serve dove «0» vuol dire
 * davvero zero e non «non compilato» — per esempio i centimetri di girovita che una cliente si
 * pone come obiettivo di perdere, dove 0 significa «non mi interessa quella misura».
 * Solo la stringa vuota e il testo non numerico diventano `undefined`.
 */
export const numeroOpzionaleConZero = ({ value }: { value: unknown }): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
};
