/**
 * Il diff che alimenta il log delle modifiche (lead e cliente).
 *
 * Perché ha dei test suoi: è la funzione che decide **cosa** si vedrà nel log, e sbagliarla non
 * produce nessun errore — produce un log che mente. Nei due versi: righe che dicono «modificato» su
 * un salvataggio che non ha cambiato niente (e allora nessuno lo legge più), oppure una modifica
 * vera che non compare (e allora quando serve non c'è).
 */

import { campiCambiati, etichettaCampo } from './diff-campi';

describe('campi cambiati per il log delle modifiche', () => {
  it('registra solo i campi davvero cambiati', () => {
    const out = campiCambiati(
      { phone: '333111', city: 'Milano' },
      { phone: '333222', city: 'Milano' },
      ['phone', 'city'],
    );
    expect(out).toEqual([{ campo: 'phone', prima: '333111', dopo: '333222' }]);
  });

  it('un salvataggio che non cambia niente non scrive niente', () => {
    expect(campiCambiati({ phone: '333111' }, { phone: '333111' }, ['phone'])).toEqual([]);
  });

  it('i campi non presenti nella richiesta non si guardano', () => {
    // `city` è diversa, ma la richiesta non la conteneva: non l'ha toccata nessuno.
    const out = campiCambiati({ phone: '333111', city: 'Milano' }, { phone: '333111' }, ['phone']);
    expect(out).toEqual([]);
  });

  it('vuoto, null e spazi sono la stessa cosa: un campo lasciato in bianco non è una modifica', () => {
    expect(campiCambiati({ alias: null }, { alias: '' }, ['alias'])).toEqual([]);
    expect(campiCambiati({ alias: '  ' }, { alias: null }, ['alias'])).toEqual([]);
    expect(campiCambiati({ alias: 'Giu' }, { alias: '  Giu ' }, ['alias'])).toEqual([]);
  });

  it('svuotare un campo È una modifica, e si legge', () => {
    expect(campiCambiati({ phone: '333111' }, { phone: null }, ['phone'])).toEqual([
      { campo: 'phone', prima: '333111', dopo: null },
    ]);
  });

  it('riempire un campo prima vuoto È una modifica', () => {
    expect(campiCambiati({ codiceFiscale: null }, { codiceFiscale: 'RSSMRA80A01H501U' }, ['codiceFiscale'])).toEqual([
      { campo: 'codiceFiscale', prima: null, dopo: 'RSSMRA80A01H501U' },
    ]);
  });

  it('i tag si confrontano per contenuto, non per ordine', () => {
    expect(campiCambiati({ tags: ['estate', 'vip'] }, { tags: ['vip', 'estate'] }, ['tags'])).toEqual([]);
    expect(campiCambiati({ tags: ['vip'] }, { tags: ['vip', 'estate'] }, ['tags'])).toHaveLength(1);
  });

  it('le date finiscono nel log in ISO, e due date uguali non sono una modifica', () => {
    const a = new Date('1980-01-01T00:00:00.000Z');
    const b = new Date('1980-01-01T00:00:00.000Z');
    expect(campiCambiati({ birthDate: a }, { birthDate: b }, ['birthDate'])).toEqual([]);
    const out = campiCambiati({ birthDate: null }, { birthDate: a }, ['birthDate']);
    expect(out[0].dopo).toBe('1980-01-01T00:00:00.000Z');
  });

  it('il booleano del consenso cambia in entrambi i versi', () => {
    expect(campiCambiati({ marketingConsent: false }, { marketingConsent: true }, ['marketingConsent'])).toHaveLength(1);
    expect(campiCambiati({ marketingConsent: true }, { marketingConsent: true }, ['marketingConsent'])).toEqual([]);
  });

  it('regge un record mancante da una parte o dall\'altra', () => {
    expect(campiCambiati(null, { phone: '333' }, ['phone'])).toEqual([{ campo: 'phone', prima: null, dopo: '333' }]);
    expect(campiCambiati({ phone: '333' }, null, ['phone'])).toEqual([]);
  });

  it('le etichette sono in italiano, e un campo sconosciuto non rompe la riga', () => {
    expect(etichettaCampo('codiceFiscale')).toBe('Codice fiscale');
    expect(etichettaCampo('campoNuovoDomani')).toBe('campoNuovoDomani');
  });
});
