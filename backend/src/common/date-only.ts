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

/**
 * ⚠️ **IL GIORNO DI UNA DATA SALVATA — letto in UTC, e di proposito.**
 *
 * È l'altra metà di `aGiorno`, e la differenza è tutta nella domanda:
 *   · «che giorno è **oggi**?» → `aGiorno(new Date())`, e la risposta è il giorno di **Roma**;
 *   · «di che giorno è **questa data salvata**?» → qui, e la risposta resta quella **UTC**.
 *
 * ⛔ Non è pigrizia: `Subscription.startDate` e `endDate` sono `DateTime` con istanti veri dentro,
 * scritti in mesi diversi da punti diversi. Rileggerli nel fuso di Roma sposterebbe di un giorno i
 * piani venduti fra le 22:00 e le 24:00 UTC — cioè cambierebbe la data di un contratto già pagato.
 * ✅ `npm run diag:giorno-piani` (20/8) dice che **oggi non ce n'è nessuno**: 78 date, zero che
 * cambierebbero giorno. Ma «zero oggi» non è «zero per sempre», e il giorno che si vorrà unificare
 * si farà con quella misura in mano, non per simmetria.
 *
 * ⚠️ Rispetto a `setHours(0,0,0,0)` — che era la riga scritta a mano in `plan-report`, `lifecycle` e
 * `agent-orchestrator` — il risultato su Render è **lo stesso**, perché lì il processo sta a UTC. La
 * differenza è che questo non dipende da come è configurata la macchina: la stessa riga sul portatile
 * di chi sviluppa dava un giorno diverso, ed è il modo in cui un difetto di fuso non si riproduce.
 */
export function giornoDelDato(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * ## Lo stesso difetto delle misure, ma sui soldi
 *
 * Tutto quello che sta scritto in testa a questo file — «fra mezzanotte e le 02:00 in Italia è
 * già domani mentre per UTC è ancora ieri» — vale identico per il MESE, e il mese è l'unità di
 * misura di tutta la parte economica: il tetto di guadagno è mensile, la finestra dei prelievi
 * va dal 1 al 7, i compensi si aggregano per `YYYY-MM`.
 *
 * Fino al 20/8 quei confini erano presi con `new Date(d.getFullYear(), d.getMonth(), 1)` e
 * `d.getDate()`, cioè **nel fuso del server** — che su Render è UTC, perché `TZ` non è impostata
 * da nessuna parte. Alle 00:30 dell'1 settembre a Roma il server risponde «31 agosto»:
 *
 *  - una provvigione accreditata in quel momento veniva contata nel **mese precedente**, e per
 *    chi ha un tetto di guadagno quel mese era già pieno: l'importo veniva tagliato e — per
 *    decisione esplicita, l'eccedenza non slitta — **perso**. Nessuna riga a registro, nessun
 *    errore: solo l'audit, che non guarda nessuno;
 *  - la finestra dei prelievi risultava **chiusa** nelle prime due ore del giorno 1 e **aperta**
 *    nelle prime due ore del giorno 8. «Dal 1 al 7» è una promessa scritta nel messaggio d'errore;
 *  - il portafoglio mostrava il mese appena chiuso ancora «in maturazione» invece che prelevabile.
 *
 * Da qui in avanti il mese dei soldi è il mese di **Roma**, come il giorno delle misure.
 */

let orologio: Intl.DateTimeFormat | null | undefined;
function orologioFuso(): Intl.DateTimeFormat | null {
  if (orologio !== undefined) return orologio;
  try {
    orologio = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    // Stesso comportamento di `fmt()`: fuso irriconoscibile → si torna a UTC invece di far
    // fallire ogni richiesta.
    // eslint-disable-next-line no-console
    console.error(`[date-only] fuso "${FUSO}" non riconosciuto: i confini di mese tornano a UTC.`);
    orologio = null;
  }
  return orologio;
}

/** I campi di calendario di un istante, letti nel fuso, riscritti come se fossero UTC. */
function comeSeUTC(f: Intl.DateTimeFormat, d: Date): number {
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) if (x.type !== 'literal') p[x.type] = x.value;
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
}

/**
 * L'ISTANTE in cui comincia il giorno `YYYY-MM-DD` nel fuso dell'azienda.
 *
 * Non è `…T00:00:00Z`: mezzanotte a Roma dell'1 settembre sono le 22:00 UTC del 31 agosto. Serve
 * l'istante vero perché `LedgerEntry.date` è un timestamp, non una colonna DATE — confrontarlo
 * con la mezzanotte UTC sposta il confine di due ore, che è esattamente il difetto.
 *
 * Le due passate non sono superstizione: l'offset dipende dall'istante, e spostandosi si può
 * attraversare il cambio dell'ora legale. La prima passata trova l'offset del punto di partenza,
 * la seconda quello del punto di arrivo.
 */
export function inizioDelGiorno(giorno: string): Date {
  const nominale = Date.parse(`${giorno}T00:00:00.000Z`);
  const f = orologioFuso();
  if (!f || Number.isNaN(nominale)) return new Date(nominale);
  let istante = nominale;
  for (let i = 0; i < 2; i++) istante = nominale - (comeSeUTC(f, new Date(istante)) - istante);
  return new Date(istante);
}

/** Il mese di calendario di un istante, nel fuso dell'azienda. Formato `YYYY-MM`. */
export function meseLocale(d: Date): string {
  return giornoLocale(d).slice(0, 7);
}

/** Il giorno del mese (1–31) nel fuso dell'azienda — quello che intende chi legge «dal 1 al 7». */
export function giornoDelMeseLocale(d: Date): number {
  return Number(giornoLocale(d).slice(8, 10));
}

/** L'istante in cui è cominciato il mese in corso, nel fuso dell'azienda. */
export function inizioMeseLocale(d = new Date()): Date {
  return inizioDelGiorno(`${meseLocale(d)}-01`);
}

/**
 * I due estremi di un mese `YYYY-MM` come li vuole Prisma: `{ gte, lt }`.
 * Esiste perché la pagina «Compensi staff» filtrava per mese con `Date.UTC(...)`, cioè con un
 * confine diverso da quello con cui il tetto aveva contato le stesse righe: due mesi diversi che
 * si chiamano tutti e due «settembre».
 */
export function confineMese(period: string): { gte: Date; lt: Date } {
  const [y, m] = period.split('-').map(Number);
  const dopo = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { gte: inizioDelGiorno(`${period}-01`), lt: inizioDelGiorno(`${dopo}-01`) };
}

/**
 * Il mese prima (`passo` negativo) o dopo di `2026-08`.
 *
 * Sta qui e non in `analytics/serie-giornaliera.ts` — dove è nato — perché serve anche alla parte
 * economica: lo «Storico mesi» del portafoglio deve andare indietro di sei mesi con la stessa
 * aritmetica con cui l'analitica ci va. L'analitica continua a esportarlo, ma chiamando questo:
 * due implementazioni della stessa aritmetica sono due implementazioni che un giorno divergono su
 * dicembre.
 *
 * Un mese scritto male torna com'è: qui non si indovina.
 */
export function meseSpostato(mese: string, passo: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec((mese ?? '').trim());
  if (!m) return mese;
  const totale = Number(m[1]) * 12 + (Number(m[2]) - 1) + passo;
  if (totale < 0) return mese;
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}`;
}

/**
 * ⛔ **CHE ORA È ADESSO, IN MINUTI DA MEZZANOTTE, NEL FUSO DELL'AZIENDA.**
 *
 * Nasce con l'orologio del digiuno (21/8), e sta **qui** e non là per la stessa ragione di tutto il
 * resto del file: su Render `TZ` non è impostata, quindi `d.getHours()` risponde l'ora **UTC** —
 * d'estate due ore indietro rispetto a Roma.
 *
 * ⚠️ Perché lì quelle due ore non sono un dettaglio: decidono se la finestra di oggi **si è già
 * aperta**, e da quella risposta dipende se lo spostamento della finestra vale da oggi o da domani.
 * Alle 12:30 di Roma, con una finestra che apre a mezzogiorno, un server a UTC direbbe «sono le
 * 10:30, non è ancora aperta» e sposterebbe la finestra **oggi** a una cliente che ha già pranzato:
 * cioè le racconterebbe una giornata che non ha fatto.
 *
 * ⚠️ Se il fuso non è riconosciuto si ripiega su UTC **e lo si scrive**, come `giornoLocale`: un
 * ripiego silenzioso su un dato che decide cosa mangia qualcuno è il difetto peggiore dei due.
 */
export function oraLocaleInMinuti(d = new Date()): number {
  try {
    const parti = new Intl.DateTimeFormat('en-GB', {
      timeZone: FUSO,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const ore = Number(parti.find((p) => p.type === 'hour')?.value ?? NaN);
    const minuti = Number(parti.find((p) => p.type === 'minute')?.value ?? NaN);
    if (!Number.isInteger(ore) || !Number.isInteger(minuti)) throw new Error('parti mancanti');
    return ore * 60 + minuti;
  } catch {
    console.error(`[date-only] fuso "${FUSO}" non riconosciuto: l'ora del giorno torna a UTC.`);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}
