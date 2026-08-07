/**
 * «Che giorno è oggi?» nell'app — e deve dare la **stessa** risposta del server.
 *
 * ## Il difetto
 *
 * Dappertutto si scriveva `new Date().toISOString().slice(0, 10)`, che è il giorno **UTC**.
 * D'estate l'Italia è avanti di due ore: fra la mezzanotte e le 02:00 (l'01:00 d'inverno) UTC è
 * ancora al giorno prima. In quella finestra:
 *  - il **menu di oggi** in Home e in Percorso cercava la data sbagliata, quindi non compariva;
 *  - i **passi** venivano attribuiti al giorno precedente (e la baseline si azzerava male);
 *  - la pagina Obiettivo credeva che la misura di oggi non fosse stata inviata.
 *
 * ## Perché il fuso è quello dell'azienda e non quello del telefono
 *
 * Il server registra i dati sul giorno di `Europe/Rome` (`common/date-only.ts`). Se qui usassimo
 * il giorno del **telefono**, una cliente in viaggio vedrebbe l'app e il server in disaccordo:
 * lei chiede il menu di un giorno, il database ne conosce un altro. Il giorno del percorso è uno
 * solo, ed è quello del calendario italiano.
 *
 * Deve restare allineato a `APP_TIMEZONE` del backend: se un giorno cambia lì, cambia anche qui.
 */

const FUSO = 'Europe/Rome';

let formattatore: Intl.DateTimeFormat | null = null;
function fmt(): Intl.DateTimeFormat | null {
  if (formattatore) return formattatore;
  try {
    // `en-CA` produce esattamente `YYYY-MM-DD`.
    formattatore = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO });
    return formattatore;
  } catch {
    // Browser o WebView senza i dati dei fusi: meglio il giorno UTC che una schermata rotta.
    return null;
  }
}

/** Il giorno di calendario di un istante, come lo intende il percorso. Formato `YYYY-MM-DD`. */
export function isoDi(d: Date): string {
  const f = fmt();
  return f ? f.format(d) : d.toISOString().slice(0, 10);
}

/** Oggi, come lo intende il percorso (e come lo registra il server). */
export function oggiIso(): string {
  return isoDi(new Date());
}
