/**
 * ⛔ **QUAL È L'ORA IN CUI QUESTA SUITE SI ROMPE.**
 *
 * Fra la mezzanotte e le 02:00 italiane (l'01:00 in ora solare) il giorno di Roma e il giorno UTC
 * non coincidono, ed è la fascia in cui vive tutta la famiglia di difetti che
 * `src/common/date-only.ts` esiste per chiudere. Questo file risponde a una domanda sola — «che
 * istante è, oggi, quello pericoloso?» — ed è **puro**: niente jest, niente effetti. Chi falsifica
 * l'orologio è `orario-pericoloso.ts`, che sta accanto e chiama questa funzione.
 *
 * ⚠️ **Sono due file per una ragione**: il guardiano (`src/common/lora-pericolosa-si-gira.spec.ts`)
 * deve poter *chiedere* qual è l'istante e verificarne la proprietà — che i due giorni divergano
 * davvero — invece di cercarla scritta nel sorgente. Un guardiano che confronta stringhe è verde
 * anche quando la cosa che dichiara di controllare è stata tolta: è già successo in questa stessa
 * consegna, due volte, e le ha trovate la revisione e non i test.
 *
 * ⚠️ **E l'istante si calcola da OGGI, non è una data scritta a mano.** La prima stesura fissava
 * `2026-08-22T22:30:00.000Z`. Ma questa suite ha dentro dei test con date assolute che scadono (voce
 * `test-che-scadono-il-2-settembre`): dal 2 settembre `npm test` sarebbe stato rosso e
 * `npm run test:notte` verde, cioè il passo che serve a dire «rotta solo di notte» avrebbe detto
 * l'esatto contrario. L'orologio finto deve spostare **l'ora**, non il calendario.
 */

/** Il fuso dell'azienda, come lo intende `src/common/date-only.ts`. */
const FUSO = process.env.APP_TIMEZONE || 'Europe/Rome';

/** `en-CA` produce esattamente `YYYY-MM-DD`. */
function giornoIn(fuso: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * L'istante in cui comincia il giorno `YYYY-MM-DD` nel fuso dato. Due passate perché l'offset
 * dipende dall'istante e spostandosi si può attraversare il cambio dell'ora legale — la stessa
 * ragione, e lo stesso conto, di `inizioDelGiorno` in `date-only.ts`.
 */
function inizioDelGiornoIn(fuso: string, giorno: string): number {
  const nominale = Date.parse(`${giorno}T00:00:00.000Z`);
  let istante = nominale;
  for (let i = 0; i < 2; i++) {
    const comeSeUTC = Date.parse(`${giornoIn(fuso, new Date(istante))}T${oraIn(fuso, new Date(istante))}Z`);
    istante = nominale - (comeSeUTC - istante);
  }
  return istante;
}

function oraIn(fuso: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: fuso, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
      .format(d)
      // ⚠️ Ancorato all'inizio: `.replace('24:', …)` senza àncora colpirebbe anche i minuti di
      // `10:24:00`. Alcune versioni di ICU rendono mezzanotte come `24:00:00`; questa no, ma il
      // ripiego costa una riga e l'alternativa è un'ora sbagliata che non si vede.
      .replace(/^24:/, '00:');
  } catch {
    return d.toISOString().slice(11, 19);
  }
}

/** Mezz'ora dopo la mezzanotte: dentro la fascia in ogni stagione, e lontano dai suoi due bordi. */
const MEZZ_ORA = 30 * 60_000;

/**
 * L'istante pericoloso **del giorno di `riferimento`**: le 00:30 nel fuso dell'azienda.
 *
 * ⚠️ `ORA_FINTA`, se c'è, vince: serve per andare a vedere un'altra ora o un altro giorno —
 * è così che si è misurato che dal 2 settembre due suite diventano rosse da sole.
 */
export function oraPericolosa(riferimento: Date = new Date(), override = process.env.ORA_FINTA): Date {
  if (override) {
    const scelto = new Date(override);
    if (Number.isNaN(scelto.getTime())) throw new Error(`ORA_FINTA non è una data valida: "${override}"`);
    return scelto;
  }
  return new Date(inizioDelGiornoIn(FUSO, giornoIn(FUSO, riferimento)) + MEZZ_ORA);
}

/**
 * A quest'istante il giorno del fuso dell'azienda e il giorno UTC sono diversi?
 * È **la** proprietà che rende utile l'ora scelta, e si calcola invece di darla per buona.
 */
export function iGiorniDivergono(istante: Date, fuso: string = FUSO): boolean {
  return giornoIn(fuso, istante) !== istante.toISOString().slice(0, 10);
}
