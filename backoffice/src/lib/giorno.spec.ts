/**
 * ⛔ **QUESTA FUNZIONE LEGGE UNA DATA CHE FERMA I MENU A QUALCUNO.**
 *
 * È la scadenza della visita (23/8): fino a quel giorno compreso la cliente riceve i menu, dal
 * giorno dopo il percorso si ferma. Sbagliare a leggerla non produce un errore — produce una
 * persona che resta senza menu il giorno sbagliato, e nessuno che sappia perché.
 */
import { describe, expect, it } from 'vitest';
import { giornoIso, giornoItaliano } from './giorno';

describe('⛔ le due forme in cui una persona scrive una data', () => {
  it('all\'italiana', () => {
    expect(giornoIso('30/09/2026')).toBe('2026-09-30');
    expect(giornoIso('1/1/2027')).toBe('2027-01-01'); // senza zeri davanti
    expect(giornoIso('  30/09/2026  ')).toBe('2026-09-30');
  });

  it('e come la scrive il computer', () => {
    expect(giornoIso('2026-09-30')).toBe('2026-09-30');
  });

  /**
   * ⛔ **Un parser generoso è un parser che sbaglia in silenzio.** `30-9-26` non si sa se sia il 2026
   * o il 1926; `03/04` non si sa se sia il 3 aprile o il 4 marzo. Si dice di no, e la frase che
   * l'utente legge mostra come scriverla — non «formato non valido».
   */
  it('⛔ e nient\'altro: le forme ambigue si rifiutano', () => {
    for (const t of ['30-9-26', '03/04', '30 settembre', 'domani', '2026/09/30', '', '   ']) {
      expect(giornoIso(t)).toBeNull();
    }
    expect(giornoIso(null)).toBeNull();
    expect(giornoIso(undefined)).toBeNull();
  });

  /**
   * ⛔ **IL GIORNO DEVE ESISTERE.** `new Date('2026-02-31')` in JavaScript non è un errore: è il 3
   * marzo. Una scadenza spostata di due giorni senza dirlo è esattamente il tipo di cosa che nessuno
   * va a verificare — e qui vuol dire due giorni di menu tolti, o regalati, a caso.
   */
  it('⛔ il 31 di febbraio non è una data', () => {
    expect(giornoIso('31/02/2026')).toBeNull();
    expect(giornoIso('2026-02-31')).toBeNull();
    expect(giornoIso('31/04/2026')).toBeNull(); // aprile ha 30 giorni
    expect(giornoIso('32/01/2026')).toBeNull();
    expect(giornoIso('30/13/2026')).toBeNull();
  });

  /** ⚠️ E il 29 febbraio bisestile invece esiste: rifiutarlo sarebbe l'errore opposto. */
  it('⚠️ il 29 febbraio di un anno bisestile sì', () => {
    expect(giornoIso('29/02/2028')).toBe('2028-02-29');
    expect(giornoIso('29/02/2027')).toBeNull();
  });

  /** ⚠️ Il giro completo: quello che si scrive è quello che si rilegge. */
  it('⚠️ e si rilegge come è stata scritta', () => {
    expect(giornoItaliano(giornoIso('30/09/2026')!)).toBe('30/09/2026');
    expect(giornoItaliano('2027-01-01')).toBe('01/01/2027');
  });
});
