import { describe, expect, it, vi, afterEach } from 'vitest';
import { etichettaGiorno, oraBreve, separatoreGiorno } from './oraChat';

/**
 * DATA E ORA DEI MESSAGGI (11/8: «in app non c'è data e ora delle chat»).
 *
 * Il dato arrivava già dal server e non si vedeva da nessuna parte: su una chat dove si aspetta la
 * nutrizionista, sapere se una risposta è di dieci minuti o di tre giorni prima è l'informazione più
 * importante dopo il testo.
 */
const fissaOggi = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => vi.useRealTimers());

describe('oraBreve', () => {
  it('due cifre per ora e minuti', () => {
    expect(oraBreve('2026-08-11T09:05:00')).toBe('09:05');
    expect(oraBreve('2026-08-11T14:32:00')).toBe('14:32');
  });

  it('una data assente o storta non stampa niente, e non esplode', () => {
    expect(oraBreve(null)).toBe('');
    expect(oraBreve(undefined)).toBe('');
    expect(oraBreve('non-una-data')).toBe('');
  });
});

describe('etichettaGiorno', () => {
  it('oggi e ieri si chiamano per nome: nessuno fa il calcolo sulla data', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(etichettaGiorno('2026-08-11T09:00:00')).toBe('Oggi');
    expect(etichettaGiorno('2026-08-10T23:59:00')).toBe('Ieri');
  });

  it('più indietro: giorno della settimana e data', () => {
    fissaOggi('2026-08-11T12:00:00');
    const e = etichettaGiorno('2026-08-04T10:00:00');
    expect(e).toContain('4');
    expect(e).toContain('agosto');
  });

  it('un altro anno porta l\'anno con sé', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(etichettaGiorno('2025-12-24T10:00:00')).toContain('2025');
  });

  it('mezzanotte non diventa «ieri»: conta il giorno, non le ore passate', () => {
    fissaOggi('2026-08-11T00:30:00');
    expect(etichettaGiorno('2026-08-11T00:05:00')).toBe('Oggi');
  });
});

describe('separatoreGiorno', () => {
  it('il primo messaggio porta sempre il giorno', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(separatoreGiorno(null, '2026-08-11T09:00:00')).toBe('Oggi');
  });

  it('due messaggi dello stesso giorno: nessun separatore in mezzo', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(separatoreGiorno('2026-08-11T09:00:00', '2026-08-11T11:00:00')).toBeNull();
  });

  it('cambio di giorno: il separatore compare', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(separatoreGiorno('2026-08-10T23:50:00', '2026-08-11T00:10:00')).toBe('Oggi');
  });

  it('una data precedente storta non nasconde il separatore', () => {
    fissaOggi('2026-08-11T12:00:00');
    expect(separatoreGiorno('boh', '2026-08-11T09:00:00')).toBe('Oggi');
  });
});
