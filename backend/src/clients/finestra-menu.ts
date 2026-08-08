/**
 * La finestra temporale dei menu mostrati nella scheda cliente.
 *
 * Nasce dalla richiesta di Simone dell'8/8: «se il cliente ha più piani io nella riga di acquisto
 * premendo devo aprire i suoi vecchi menu, altrimenti dove vedo lo storico?». Prima la finestra
 * era fissa (ultimi 56 giorni + 7 avanti) e i menu di un piano finito erano irraggiungibili.
 *
 * Sta in un file a parte perché è l'unico pezzo di `getMenus` in cui si può sbagliare in silenzio:
 * un periodo invertito o smisurato non fa errore, fa una query che gratta mesi di menu. Qui è
 * verificabile senza istanziare il servizio (che ha molte dipendenze).
 */

/** Tetto della finestra: il piano più lungo in vendita è **12m**, quindi un anno ci deve stare. */
export const MENU_MAX_GIORNI = 400;

/** Giorni indietro nella finestra di default (senza periodo richiesto). */
export const MENU_GIORNI_INDIETRO = 56;

/** Giorni avanti nella finestra di default: i menu dei prossimi giorni sono già generati. */
export const MENU_GIORNI_AVANTI = 7;

export interface PeriodoRichiesto {
  from?: string;
  to?: string;
}

/** Motivo del rifiuto, in italiano: arriva così com'è alla coach. */
export class PeriodoNonValido extends Error {}

function giornoUtc(iso?: string): Date | null {
  if (!iso) return null;
  const x = new Date(`${String(iso).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(x.getTime()) ? null : x;
}

/**
 * Calcola `from`/`to` della query. Senza periodo restituisce la finestra di sempre; con un periodo
 * lo valida e lo usa tale e quale — così si aprono i menu di un piano anche finito da mesi.
 * @param adesso data di riferimento (iniettabile: i test non devono dipendere da oggi).
 * @throws PeriodoNonValido se una data non si legge, se sono invertite o se il periodo è smisurato.
 */
export function finestraMenu(periodo?: PeriodoRichiesto, adesso: Date = new Date()): { from: Date; to: Date } {
  if (!periodo?.from && !periodo?.to) {
    const from = new Date(adesso);
    from.setDate(from.getDate() - MENU_GIORNI_INDIETRO);
    const to = new Date(adesso);
    to.setDate(to.getDate() + MENU_GIORNI_AVANTI);
    return { from, to };
  }
  // Mezzo periodo (solo `from` o solo `to`) è quasi sempre un link costruito male: meglio dirlo
  // che indovinare un estremo e mostrare menu di un intervallo che nessuno ha chiesto.
  const from = giornoUtc(periodo.from);
  const to = giornoUtc(periodo.to);
  if (!from || !to) throw new PeriodoNonValido('Periodo non valido: servono sia la data di inizio sia quella di fine (AAAA-MM-GG).');
  if (from.getTime() > to.getTime()) throw new PeriodoNonValido('Periodo con le date invertite.');
  const giorni = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (giorni > MENU_MAX_GIORNI) throw new PeriodoNonValido(`Periodo troppo lungo (max ${MENU_MAX_GIORNI} giorni).`);
  return { from, to };
}
