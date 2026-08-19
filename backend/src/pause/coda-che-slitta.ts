/**
 * QUANDO UNA PAUSA ALLUNGA IL PIANO IN CORSO, LA CODA SCORRE IN AVANTI CON LUI.
 *
 * Decisione di Simone, 19/8 sera. Fino a quel momento `freezeSubscription` sommava i giorni di
 * pausa alla fine del piano che sta erogando e **non guardava se dietro c'era una coda già pagata**:
 *
 *     piano #1  01/06 → 25/08        pausa di 7 giorni →  01/06 → 01/09
 *     piano #2  25/08 → 25/11  (in coda, già pagato)      25/08 → 25/11   ← resta dov'era
 *
 * ⛔ E quei sette giorni la cliente li perde due volte: il #2 comincia mentre il #1 sta ancora
 * erogando, `attivoInCorso` ne sceglie **uno solo** — quello che finisce più tardi — e i giorni
 * dell'altro **scorrono senza che riceva niente**. È esattamente ciò che nel caso Lorena ha portato
 * il piano #2 al 01/09.
 *
 * ⚠️ **La pausa non si tocca**: è una promessa già fatta a voce quando arriva qui, e accorciarla o
 * rifiutarla vorrebbe dire togliere alla cliente qualcosa che le è stato detto. Si sposta la coda —
 * che è **anche lei sua**, e spostandola non perde nemmeno un giorno di quello che ha pagato.
 *
 * ## LE TRE COSE CHE QUESTA REGOLA FA, E PERCHÉ
 *
 * 1. **Sposta inizio E fine**, dello stesso numero di giorni. Spostare solo l'inizio le
 *    accorcerebbe il piano di quei giorni: sarebbe la stessa sottrazione silenziosa, spostata.
 * 2. **Sposta tutta la fila, non solo la prima**. Se ci sono due code una dietro l'altra e ne
 *    spostassi una sola, quella finirebbe addosso alla seconda: avrei chiuso il difetto qui e
 *    aperto lo stesso difetto un metro più in là. Spostandole tutte dello stesso numero di giorni,
 *    le distanze fra loro restano quelle di prima.
 * 3. ⚠️ **Non tocca le righe che cominciano PRIMA della vecchia fine.** Quelle si sovrappongono già,
 *    e una sovrapposizione che esiste oggi è stata autorizzata da una persona (la matita della data
 *    d'inizio chiede conferma e la registra, ed è una decisione di Simone tenerla così). Spostarla
 *    vorrebbe dire disfare in automatico quello che qualcuno ha deciso a mano.
 *
 * ⚠️ Il confine è **`>=` la vecchia fine**, non «si sovrappone alla fine nuova»: la coda che parte
 * *esattamente* il giorno in cui finisce il piano è il passaggio di testimone normale — quello che
 * `finalizeApproval` costruisce da solo — e se non scorresse anche lei si troverebbe a partire
 * **dentro** il piano allungato. È il caso più frequente di tutti, non un caso limite.
 *
 * ⚠️ Modulo **puro**: niente Prisma, niente Nest, niente orologio. Riceve le righe e i giorni, e
 * torna che cosa scrivere.
 */

import { giornoLocale } from '../common/date-only';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';

export interface RigaDaSpostare {
  id: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

export interface Spostamento {
  id: string;
  startDate: Date;
  endDate: Date | null;
}

const GIORNO = 86_400_000;

/**
 * IL GIORNO **DELL'AZIENDA**, non quello del processo.
 *
 * ⚠️ Qui c'era `setHours(0,0,0,0)` con scritto accanto «mezzanotte locale» — e non lo era: su Render
 * il processo gira in **UTC**, quindi quella era mezzanotte UTC. La revisione avversariale del 19/8
 * sera l'ha rotto con un caso vero: un piano che finisce alle 00:00Z del 26 e una coda che parte
 * alle 22:00Z del 25 sono **lo stesso giorno a Roma** — il passaggio di testimone normale — ma due
 * giorni diversi in UTC. La coda non scorreva, la pausa allungava il piano davanti, e la coda
 * finiva **dentro** di lui: cioè esattamente il caso Lorena che questo modulo esiste per chiudere,
 * riaperto dal confine di giorno.
 *
 * ⛔ E il commento sbagliato è la parte peggiore: diceva «locale» e nessuno andava a verificare.
 * Adesso è la **stessa** funzione che usa `sovrapposizione-piani.ts`, cioè la matita — due funzioni
 * che rispondono alla stessa domanda devono chiamare la stessa terza, non somigliarsi.
 */
const giorno = (d: Date): string => giornoLocale(d);

/**
 * Le righe della fila da far scorrere, e di quanto.
 *
 * @param righe        tutte le righe della cliente (basta id, stato e date)
 * @param idAllungato  la riga che la pausa ha allungato: non si sposta, si è già mossa lei
 * @param fineVecchia  dove finiva PRIMA della pausa — è il confine della fila
 * @param giorni       i giorni di pausa concessi
 */
export function codaCheSlitta(
  righe: readonly RigaDaSpostare[],
  idAllungato: string,
  fineVecchia: Date,
  giorni: number,
): Spostamento[] {
  if (!Number.isFinite(giorni) || giorni <= 0) return [];
  const confine = giorno(fineVecchia);
  return (righe ?? [])
    .filter((r) => r.id !== idAllungato)
    .filter((r) => (STATI_CON_UN_PIANO as readonly string[]).includes(r.status))
    .filter((r): r is RigaDaSpostare & { startDate: Date } => !!r.startDate)
    .filter((r) => giorno(r.startDate) >= confine)
    .map((r) => ({
      id: r.id,
      startDate: new Date(r.startDate.getTime() + giorni * GIORNO),
      // ⚠️ Fine assente = piano aperto: resta aperto. Inventargli una fine sarebbe un dato nuovo.
      endDate: r.endDate ? new Date(r.endDate.getTime() + giorni * GIORNO) : null,
    }));
}
