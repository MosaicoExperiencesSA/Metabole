/**
 * La finestra dei menu nella scheda cliente.
 *
 * Questi test proteggono la parte in cui un errore non si vede: `getMenus` non fa altro che
 * interrogare i menu tra due date, e se le date sono sbagliate la risposta arriva comunque — solo
 * che è la risposta a una domanda diversa. In particolare:
 *  - togliere il periodo NON deve cambiare quello che la coach vedeva prima (56 giorni indietro,
 *    7 avanti): questa è la vista che usa ogni giorno;
 *  - un anno intero deve passare, perché in vendita c'è un piano da 12 mesi e i suoi menu vanno
 *    aperti tutti;
 *  - mezzo periodo, date invertite o smisurate vanno rifiutati con una frase leggibile, non
 *    trasformati in una query enorme.
 */

import {
  finestraMenu,
  MENU_GIORNI_AVANTI,
  MENU_GIORNI_INDIETRO,
  MENU_MAX_GIORNI,
  PeriodoNonValido,
} from './finestra-menu';

const OGGI = new Date('2026-08-08T10:30:00.000Z');
const giorni = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

describe('finestra dei menu in scheda cliente', () => {
  it('senza periodo resta la finestra di sempre: 56 giorni indietro, 7 avanti', () => {
    const { from, to } = finestraMenu(undefined, OGGI);
    expect(giorni(from, OGGI)).toBe(MENU_GIORNI_INDIETRO);
    expect(giorni(OGGI, to)).toBe(MENU_GIORNI_AVANTI);
  });

  it('un oggetto vuoto vale come «senza periodo» (query senza from/to)', () => {
    const a = finestraMenu({}, OGGI);
    const b = finestraMenu(undefined, OGGI);
    expect(a.from.getTime()).toBe(b.from.getTime());
    expect(a.to.getTime()).toBe(b.to.getTime());
  });

  it('con il periodo di un piano finito apre esattamente quelle date', () => {
    const { from, to } = finestraMenu({ from: '2025-01-15', to: '2025-04-15' }, OGGI);
    expect(from.toISOString().slice(0, 10)).toBe('2025-01-15');
    expect(to.toISOString().slice(0, 10)).toBe('2025-04-15');
  });

  it('accetta anche una data-ora completa (ISO da Prisma), tenendo solo il giorno', () => {
    const { from } = finestraMenu({ from: '2025-01-15T23:00:00.000Z', to: '2025-04-15T00:00:00.000Z' }, OGGI);
    expect(from.toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });

  it('un piano da 12 mesi ci sta dentro: è il più lungo in vendita', () => {
    expect(() => finestraMenu({ from: '2025-08-08', to: '2026-08-08' }, OGGI)).not.toThrow();
  });

  it('rifiuta mezzo periodo: un estremo indovinato mostrerebbe menu che nessuno ha chiesto', () => {
    expect(() => finestraMenu({ from: '2025-01-15' }, OGGI)).toThrow(PeriodoNonValido);
    expect(() => finestraMenu({ to: '2025-04-15' }, OGGI)).toThrow(PeriodoNonValido);
  });

  it('rifiuta le date invertite e lo dice in italiano', () => {
    expect(() => finestraMenu({ from: '2025-04-15', to: '2025-01-15' }, OGGI)).toThrow(/invertite/i);
  });

  it('rifiuta una data illeggibile', () => {
    expect(() => finestraMenu({ from: 'ieri', to: '2025-04-15' }, OGGI)).toThrow(PeriodoNonValido);
  });

  it('rifiuta il periodo smisurato, indicando il tetto', () => {
    expect(() => finestraMenu({ from: '2020-01-01', to: '2026-01-01' }, OGGI)).toThrow(
      new RegExp(`max ${MENU_MAX_GIORNI} giorni`),
    );
  });

  it('lo stesso giorno per inizio e fine è legittimo (un solo menu da guardare)', () => {
    const { from, to } = finestraMenu({ from: '2025-03-01', to: '2025-03-01' }, OGGI);
    expect(from.getTime()).toBe(to.getTime());
  });
});
