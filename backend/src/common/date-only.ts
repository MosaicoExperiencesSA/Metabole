import { BadRequestException } from '@nestjs/common';

/**
 * «Che giorno è oggi?» — e la risposta non è ovvia quanto sembra.
 *
 * ## Il difetto che questo file chiude
 *
 * Fino al 7/8 `toDateOnly()` prendeva il giorno **UTC**. Ma il server sta a Francoforte, le
 * clienti stanno in Italia, e d'estate l'Italia è avanti di due ore: fra la **mezzanotte e le
 * 02:00** (l'01:00 d'inverno) in Italia è già domani mentre per UTC è ancora ieri.
 *
 * Conseguenza concreta, ogni notte: una cliente che si pesa alle 00:30 dell'8 agosto vedeva la
 * misura registrata al **7**. E siccome le misure hanno un vincolo di unicità per
 * `(cliente, data)` e si salvano in `upsert`, quella pesata **sovrascriveva** la misura del 7 —
 * il dato del giorno prima spariva. Nessun errore, nessun avviso: solo un punto del grafico che
 * cambia valore.
 *
 * Stesso effetto sul check-in, sull'acqua, sui passi e sul gate misure, che a quel punto crede
 * che la misura di «oggi» ci sia già.
 *
 * ## La regola adesso
 *
 * Il giorno è quello del **fuso dell'azienda** (`APP_TIMEZONE`, default `Europe/Rome`), che è
 * quello che intendono sia la cliente sia la coach quando dicono «oggi». Resta salvato come
 * mezzanotte UTC, perché la colonna è un DATE e il confronto dev'essere stabile.
 *
 * Una stringa di sola data (`2026-08-08`) viene presa **alla lettera**: non contiene un orario,
 * quindi non c'è niente da convertire — e convertirla la sposterebbe di un giorno in tutti i
 * fusi a ovest di Greenwich.
 */

/**
 * Fuso di riferimento dell'azienda. Da Render, senza deploy, se un giorno servisse.
 *
 * ⚠️ **Esportato** (12/8, con gli slot delle visite): fuori di qui c'erano due punti con
 * `'Europe/Rome'` scritto a mano — `visits.service.ts` e `signals.service.ts` — che quindi
 * ignoravano `APP_TIMEZONE`. Con l'agenda delle visite il fuso decide a che ora una persona si
 * presenta a una visita: due verità sul fuso sono un appuntamento mancato.
 */
export const FUSO = process.env.APP_TIMEZONE || 'Europe/Rome';

/** `2026-08-08` — una data e basta, senza orario: si prende com'è. */
const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

let formattatore: Intl.DateTimeFormat | null = null;
function fmt(): Intl.DateTimeFormat | null {
  if (formattatore) return formattatore;
  try {
    // `en-CA` produce esattamente `YYYY-MM-DD`, che è quello che serve.
    formattatore = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO });
    return formattatore;
  } catch {
    // Fuso sconosciuto (ICU ridotta o variabile scritta male): meglio il vecchio
    // comportamento UTC che un errore su ogni richiesta.
    // eslint-disable-next-line no-console
    console.error(`[date-only] fuso "${FUSO}" non riconosciuto: si torna al giorno UTC.`);
    return null;
  }
}

/** Il giorno di calendario di un istante, nel fuso dell'azienda. Formato `YYYY-MM-DD`. */
export function giornoLocale(d: Date): string {
  const f = fmt();
  return f ? f.format(d) : d.toISOString().slice(0, 10);
}

/**
 * Normalizza a mezzanotte UTC (colonna DATE), col giorno letto nel fuso dell'azienda.
 * Helper puro, senza dipendenze di dominio: sta qui (non in signals.service) per evitare
 * cicli di import.
 */
export function toDateOnly(input?: string): Date {
  if (input && SOLO_DATA.test(input.trim())) {
    // Data senza orario: vale così com'è scritta.
    return new Date(`${input.trim()}T00:00:00.000Z`);
  }
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida');
  return new Date(`${giornoLocale(d)}T00:00:00.000Z`);
}

/**
 * Come `toDateOnly` ma partendo da un `Date` già in mano. Esiste perché la stessa riga era
 * copiata in `diet-agent.service` e `conversation-summary.service`, **e in entrambe leggeva il
 * giorno UTC**: due copie dello stesso difetto, in due punti che nessuno avrebbe collegato al
 * caso delle misure.
 */
export function aGiorno(d: Date): Date {
  return new Date(`${giornoLocale(d)}T00:00:00.000Z`);
}
