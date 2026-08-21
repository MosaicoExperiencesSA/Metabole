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

describe('⛔ oraLocaleInMinuti — le due ore che decidono cosa mangia qualcuno', () => {
  const { oraLocaleInMinuti } = require('./date-only');

  /**
   * ⛔ Il caso per cui questa funzione esiste. Su Render `TZ` non è impostata: `getHours()` risponde
   * l'ora UTC, che d'estate è **due ore indietro** rispetto a Roma. Con una finestra che apre a
   * mezzogiorno, alle 12:30 italiane il server direbbe «sono le 10:30, non è ancora aperta» — e
   * sposterebbe la finestra OGGI a una cliente che ha già pranzato.
   */
  it('⛔ le 12:30 di Roma sono 750 minuti, non 630', () => {
    expect(oraLocaleInMinuti(new Date('2026-08-21T12:30:00+02:00'))).toBe(12 * 60 + 30);
    // E la riga scritta a mano che si sarebbe usata al posto suo, su un processo a UTC:
    const aUtc = new Date('2026-08-21T12:30:00+02:00');
    expect(aUtc.getUTCHours() * 60 + aUtc.getUTCMinutes()).toBe(10 * 60 + 30);
  });

  it('mezzanotte è zero, e le 23:59 sono l\'ultimo minuto', () => {
    expect(oraLocaleInMinuti(new Date('2026-08-21T00:00:00+02:00'))).toBe(0);
    expect(oraLocaleInMinuti(new Date('2026-08-21T23:59:00+02:00'))).toBe(23 * 60 + 59);
  });

  /**
   * ⚠️ D'inverno l'Italia è UTC+1, non +2: una funzione che sottraesse due ore fisse sbaglierebbe
   * per metà anno, ed è il modo in cui un difetto di fuso non si riproduce in agosto.
   */
  it('⚠️ vale anche con l\'ora solare, dove lo scarto è di UN\'ora', () => {
    expect(oraLocaleInMinuti(new Date('2026-01-15T12:30:00+01:00'))).toBe(12 * 60 + 30);
    expect(oraLocaleInMinuti(new Date('2026-01-15T11:30:00Z'))).toBe(12 * 60 + 30);
  });

  it('resta dentro la giornata, sempre', () => {
    for (const iso of ['2026-03-29T02:30:00Z', '2026-10-25T02:30:00Z', '2026-12-31T23:00:00Z']) {
      const m = oraLocaleInMinuti(new Date(iso));
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(24 * 60);
    }
  });
});
