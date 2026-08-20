/**
 * NEL REPORT C'ERANO DUE DOMANDE IN UNA FUNZIONE SOLA — 20/8 sera.
 *
 * `plan-report.service.day0()` veniva chiamata sia su `new Date()` — «che giorno è **oggi**» — sia
 * su `sub.startDate` e `sub.endDate` — «di che giorno è **questa data salvata**». Sono due domande
 * diverse con due risposte diverse, e `setHours(0,0,0,0)` rispondeva a tutte e due nel fuso del
 * **processo**: su Render è UTC, quindi fra mezzanotte e le 02:00 in Italia «oggi» era **ieri**.
 *
 * ⚠️ È lo stesso miscuglio già trovato in `coach-tasks.day()` la mattina del 20/8, ed è **il motivo
 * per cui il difetto non si vedeva**: finché le due domande passano dalla stessa funzione, correggere
 * l'una rompe l'altra, quindi non si corregge nessuna delle due.
 */
import { aGiorno, giornoDelDato } from '../common/date-only';

describe('le due domande, separate', () => {
  /**
   * L'istante è il 20 agosto 2026 alle 23:30 UTC: a Roma sono le **01:30 del 21**. È la fascia in
   * cui il difetto viveva, ed è l'unica in cui le due risposte differiscono.
   */
  const NOTTE = new Date('2026-08-20T23:30:00.000Z');

  it('«che giorno è oggi» risponde col giorno di Roma', () => {
    expect(aGiorno(NOTTE).toISOString().slice(0, 10)).toBe('2026-08-21');
  });

  it('«di che giorno è questa data salvata» resta in UTC, ed è voluto', () => {
    expect(giornoDelDato(NOTTE).toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('⛔ e in quella fascia le due risposte NON coincidono: è tutto il difetto', () => {
    expect(aGiorno(NOTTE).getTime()).not.toBe(giornoDelDato(NOTTE).getTime());
  });

  it('fuori da quella fascia coincidono, ed è per questo che di giorno non si vedeva niente', () => {
    const POMERIGGIO = new Date('2026-08-20T14:00:00.000Z');
    expect(aGiorno(POMERIGGIO).getTime()).toBe(giornoDelDato(POMERIGGIO).getTime());
  });

  it('`giornoDelDato` non dipende dal fuso della macchina: azzera sui campi UTC, non con setHours', () => {
    // Una data con ora piccola: `setHours` su una macchina a est l'avrebbe spostata al giorno prima.
    const MATTINA = new Date('2026-08-20T00:30:00.000Z');
    expect(giornoDelDato(MATTINA).toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });
});
