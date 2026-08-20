import { inizioMeseLocale, meseLocale } from './date-only';

/**
 * IL TETTO DI GUADAGNO MENSILE (§16.8) — la regola sta QUI, l'aritmetica è pura e testabile.
 *
 * Richiesta di Simone: «un tetto di guadagno per il nutrizionista». Decisione dell'11/8, dopo
 * l'obiezione («se la regola è uguale per tutti lo cambi 40 volte») posta e scartata: **solo il
 * campo sul profilo della persona**, niente default globale in `config_param`, niente cascata.
 *
 * Le tre decisioni di prodotto già prese, e dove si vedono nel codice:
 *  1. **l'eccedenza si perde** — non diventa un accantonamento da pagare dopo, non slitta al mese
 *     successivo: `quotaSottoTetto` restituisce quanto tagliare e il chiamante non lo mette da
 *     nessuna parte (lo scrive solo nell'audit, perché sparire in silenzio è un'altra cosa);
 *  2. **lo storno si sottrae anche se rientra nel tetto** — viene da sé perché il maturato si legge
 *     SOMMANDO il registro contabile, dove uno storno è una riga negativa: stornare libera spazio
 *     sotto il tetto, che è quello che deve succedere;
 *  3. **la regola vale per tutti i nutrizionisti** — ma il valore no: si scrive uno per uno.
 *
 * ## ⚠️ Zero non è un tetto
 *
 * `null` e `0` significano tutti e due «nessun tetto». Sembra una sottigliezza ed è invece il modo
 * ovvio in cui questa funzione azzererebbe lo stipendio di qualcuno: un campo numerico svuotato in
 * un form arriva spessissimo come `0`, e «tetto zero» letto alla lettera vuol dire che quella
 * persona non prende più una provvigione — senza errori, senza avvisi, per mesi. Un tetto vero a
 * zero non lo imposta nessuno di proposito; il campo svuotato invece lo fa chiunque.
 */

/**
 * Le categorie del registro contabile che sono GUADAGNO di una persona dello staff.
 *
 * Erano scritte due volte (`payouts.service.ts` e `compensation.controller.ts`) e ora sono qui:
 * non per pulizia, ma perché il tetto DEVE contare esattamente quello che il portafoglio della
 * persona le mostra come guadagnato. Se le due liste divergono, il tetto taglia su un numero che
 * lei non vede da nessuna parte — ed è impossibile da spiegare.
 *
 * `visit_compensation` non viene più prodotta (il compenso a visita è stato rimosso l'11/8, vedi la
 * lapide in `finance.service.ts`), ma lo storico esiste: va contata.
 */
export const CATEGORIE_COMPENSO = ['sales_commission', 'visit_compensation'];

/**
 * L'inizio del mese in corso — lo stesso confine che usa il portafoglio staff
 * (`payouts.service.ts`), per la stessa ragione di sopra: il mese del tetto e il mese del
 * portafoglio devono essere lo stesso mese.
 *
 * ⚠️ È il mese di **Roma**, non quello del server. Era `new Date(d.getFullYear(), d.getMonth(), 1)`,
 * cioè il fuso del processo: su Render è UTC, e alle 00:30 dell'1 settembre a Roma quel confine
 * diceva ancora agosto. Chi ha un tetto si vedeva tagliare — e perdere per sempre — una
 * provvigione arrivata a mese nuovo. La spiegazione lunga sta in `common/date-only.ts`.
 */
export function inizioMese(d = new Date()): Date {
  return inizioMeseLocale(d);
}

/**
 * Il periodo `YYYY-MM` sotto cui va scritto un compenso — **una sola risposta** alla domanda
 * «di che mese è questa riga».
 *
 * Era calcolato a mano in cinque punti (`finance.service`, due storni in `commerce.service`,
 * `payouts.service`) con due formule diverse, `toISOString().slice(0, 7)` e `getMonth()`. Finché
 * il server è a UTC le due coincidono fra loro e sbagliano insieme; la riga che le smaschera è
 * quella accreditata a mese nuovo, che veniva scritta nel periodo precedente — e stornata da un
 * altro ancora.
 */
export function mesePeriodo(d = new Date()): string {
  return meseLocale(d);
}

/**
 * Il tetto EFFETTIVO di una persona, in centesimi, oppure `null` se non ne ha.
 * Vedi il commento «Zero non è un tetto» in testa al file: `null`, `0` e qualunque valore non
 * positivo o non finito valgono tutti «nessun tetto».
 */
export function tettoAttivoCents(valore: number | null | undefined): number | null {
  if (valore === null || valore === undefined) return null;
  if (!Number.isFinite(valore)) return null;
  if (valore <= 0) return null;
  return Math.floor(valore);
}

export interface EsitoTetto {
  /** Quanto si può accreditare davvero adesso. */
  erogabileCents: number;
  /** Quanto va perso perché sopra il tetto (0 se il tetto non c'è o non è stato raggiunto). */
  tagliatoCents: number;
  /** Vero se dopo questo accredito la persona è al tetto (o già ci era). */
  raggiunto: boolean;
}

/**
 * Quanto di `dovutoCents` sta sotto il tetto, dato quanto la persona ha già maturato nel mese.
 *
 * Casi che questa funzione deve gestire, e che non sono decorativi:
 *  - **nessun tetto** → passa tutto, e `raggiunto` è falso: non esiste un tetto da raggiungere;
 *  - **maturato già oltre il tetto** (succede: il tetto si può abbassare a mese iniziato, o una
 *    provvigione può essere stata accreditata prima che il tetto esistesse) → residuo negativo,
 *    che va letto come zero e non come «hai credito»;
 *  - **maturato negativo** (più storni che provvigioni nel mese) → è spazio vero sotto il tetto,
 *    e resta tale: non lo si azzera, altrimenti chi ha subìto uno storno si troverebbe il tetto
 *    più basso di quello scritto sul suo profilo.
 */
export function quotaSottoTetto(input: {
  tettoCents: number | null | undefined;
  giaMaturatoCents: number;
  dovutoCents: number;
}): EsitoTetto {
  const dovuto = Math.max(0, Math.round(input.dovutoCents));
  const tetto = tettoAttivoCents(input.tettoCents);
  if (tetto === null) return { erogabileCents: dovuto, tagliatoCents: 0, raggiunto: false };

  const residuo = Math.max(0, tetto - Math.round(input.giaMaturatoCents));
  const erogabile = Math.min(dovuto, residuo);
  return {
    erogabileCents: erogabile,
    tagliatoCents: dovuto - erogabile,
    raggiunto: residuo - erogabile <= 0,
  };
}

/** «€ 3.000,00» — per le note del registro e i messaggi, con la virgola italiana. */
export function euroCents(cents: number): string {
  return '€ ' + (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
