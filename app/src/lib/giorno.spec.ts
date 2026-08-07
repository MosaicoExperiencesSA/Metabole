import { describe, expect, it } from 'vitest';
import { isoDi, oggiIso } from './giorno';

/**
 * Il giorno dell'app deve coincidere con quello del server, altrimenti si chiedono cose diverse:
 * lei apre il menu «di oggi» e il database ne conosce un altro.
 *
 * Prima l'app calcolava il giorno **UTC** (`new Date().toISOString().slice(0, 10)`). D'estate
 * l'Italia è avanti di due ore, quindi fra la mezzanotte e le 02:00 UTC è ancora al giorno prima:
 * in quella finestra il menu di oggi non compariva, i passi finivano sul giorno precedente e la
 * pagina Obiettivo credeva che la misura di oggi non fosse stata inviata.
 */
describe('isoDi / oggiIso', () => {
  it('ORA LEGALE: 00:30 in Italia è già il giorno dopo, anche se per UTC è ieri', () => {
    const mezzanottePassata = new Date('2026-08-08T00:30:00+02:00');
    expect(mezzanottePassata.toISOString().slice(0, 10)).toBe('2026-08-07'); // com'era prima
    expect(isoDi(mezzanottePassata)).toBe('2026-08-08'); // com'è adesso
  });

  it('ORA SOLARE: vale lo stesso con un\'ora di scarto', () => {
    expect(isoDi(new Date('2026-01-15T00:30:00+01:00'))).toBe('2026-01-15');
  });

  it('nel resto della giornata non cambia niente', () => {
    expect(isoDi(new Date('2026-08-08T14:00:00+02:00'))).toBe('2026-08-08');
    expect(isoDi(new Date('2026-08-08T09:00:00Z'))).toBe('2026-08-08');
  });

  it('il giorno NON dipende da dove si trova il telefono', () => {
    // Una cliente in viaggio deve vedere il giorno del suo percorso, non quello del posto in cui
    // si trova: il dato a database è uno solo, ed è sul calendario italiano.
    const stessoIstante = new Date('2026-08-08T10:00:00+02:00');
    expect(isoDi(stessoIstante)).toBe('2026-08-08');
    expect(isoDi(new Date(stessoIstante.getTime()))).toBe('2026-08-08');
  });

  it('oggiIso ha il formato che il backend si aspetta', () => {
    expect(oggiIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
