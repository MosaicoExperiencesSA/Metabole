import { describe, expect, it } from 'vitest';
import { AVVISO_INDIRIZZO, campiMancanti, nomeCampo } from './indirizzoCheckout';

const pieno = { addressLine: 'Via Roma 1', postalCode: '20100', city: 'Milano', province: 'MI' };

describe('carrello — indirizzo da completare (16/9)', () => {
  it('indirizzo completo: nessun campo mancante', () => {
    expect(campiMancanti(pieno)).toEqual([]);
  });

  it('tutto vuoto: tutti e quattro, nell ordine dello schermo', () => {
    expect(campiMancanti({ addressLine: '', postalCode: '', city: '', province: '' }))
      .toEqual(['addressLine', 'postalCode', 'city', 'province']);
  });

  it('gli spazi non valgono come dato', () => {
    expect(campiMancanti({ ...pieno, city: '   ', province: ' ' })).toEqual(['city', 'province']);
  });

  it('un solo campo mancante viene indicato da solo', () => {
    expect(campiMancanti({ ...pieno, postalCode: '' })).toEqual(['postalCode']);
  });

  it('i nomi sono quelli che la cliente vede sullo schermo', () => {
    expect(nomeCampo('addressLine')).toBe('Via e numero civico');
    expect(nomeCampo('postalCode')).toBe('CAP');
    expect(nomeCampo('city')).toBe('Città');
    expect(nomeCampo('province')).toBe('Provincia');
  });

  it('la scritta è quella chiesta da Simone', () => {
    expect(AVVISO_INDIRIZZO).toBe('Completa i dati per procedere');
  });
});
