import { aGiorno, giornoLocale, toDateOnly } from './date-only';

/**
 * Il difetto: `toDateOnly()` leggeva il giorno **UTC**. Il server sta a Francoforte, le clienti
 * in Italia, e d'estate l'Italia è avanti di due ore — quindi fra la mezzanotte e le 02:00 in
 * Italia è già domani mentre per UTC è ancora ieri.
 *
 * Non è un dettaglio di lancette: le misure hanno un vincolo di unicità per `(cliente, data)` e
 * si salvano in `upsert`. Una pesata delle 00:30 dell'8 agosto veniva registrata al **7** e
 * **sovrascriveva** la misura del 7. Il dato del giorno prima spariva, senza un errore.
 *
 * Questi test fissano la regola: il giorno è quello che intende la cliente, cioè quello italiano.
 */

describe('giornoLocale — il giorno che intende la cliente', () => {
  it('ORA LEGALE: 00:30 in Italia è già il giorno dopo, anche se per UTC è ieri', () => {
    // 2026-08-08T00:30 in Italia = 2026-08-07T22:30Z
    const mezzanottePassata = new Date('2026-08-08T00:30:00+02:00');
    expect(mezzanottePassata.toISOString().slice(0, 10)).toBe('2026-08-07'); // com'era prima
    expect(giornoLocale(mezzanottePassata)).toBe('2026-08-08'); // com'è adesso
  });

  it('ORA SOLARE: vale lo stesso con un\'ora di scarto', () => {
    const notteInvernale = new Date('2026-01-15T00:30:00+01:00');
    expect(notteInvernale.toISOString().slice(0, 10)).toBe('2026-01-14');
    expect(giornoLocale(notteInvernale)).toBe('2026-01-15');
  });

  it('nel resto della giornata non cambia niente', () => {
    expect(giornoLocale(new Date('2026-08-08T14:00:00+02:00'))).toBe('2026-08-08');
    expect(giornoLocale(new Date('2026-08-08T09:00:00Z'))).toBe('2026-08-08');
  });
});

describe('toDateOnly', () => {
  it('una data SENZA orario si prende alla lettera', () => {
    // Non c'è niente da convertire: convertirla la sposterebbe di un giorno nei fusi a ovest.
    expect(toDateOnly('2026-08-08').toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(toDateOnly('2026-01-15').toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('un istante notturno finisce sul giorno italiano, non su quello UTC', () => {
    expect(toDateOnly('2026-08-08T00:30:00+02:00').toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('restituisce sempre mezzanotte UTC (la colonna è un DATE)', () => {
    const d = toDateOnly('2026-08-08T17:45:12.345+02:00');
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it('una data non valida viene rifiutata invece di passare come NaN', () => {
    expect(() => toDateOnly('non-una-data')).toThrow();
  });

  it('senza argomento dà il giorno di oggi, in Italia', () => {
    const atteso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    expect(toDateOnly().toISOString().slice(0, 10)).toBe(atteso);
  });
});

describe('aGiorno — la copia che stava in due servizi', () => {
  it('fa la stessa cosa di toDateOnly partendo da un Date', () => {
    const istante = new Date('2026-08-08T00:30:00+02:00');
    expect(aGiorno(istante).toISOString()).toBe(toDateOnly(istante.toISOString()).toISOString());
    // Prima queste due righe davano risultati diversi: `dateOnly` era copiata in
    // `diet-agent.service` e in `conversation-summary.service`, e leggeva il giorno UTC.
    expect(aGiorno(istante).toISOString().slice(0, 10)).toBe('2026-08-08');
  });
});
