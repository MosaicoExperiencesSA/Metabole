import { describe, expect, it } from 'vitest';
import { daQuantoFermo, frasePausaMenu } from './da-quanto-fermo';

const ADESSO = new Date(2026, 7, 18, 9, 0, 0); // 18 agosto 2026, ore 9 locali
const giorniFa = (n: number, ora = 9) => new Date(2026, 7, 18 - n, ora, 0, 0).toISOString();

describe('daQuantoFermo', () => {
  it('oggi, ieri, e i giorni in mezzo', () => {
    expect(daQuantoFermo(giorniFa(0), ADESSO)).toBe('da oggi');
    expect(daQuantoFermo(giorniFa(1), ADESSO)).toBe('da ieri');
    expect(daQuantoFermo(giorniFa(5), ADESSO)).toBe('da 5 giorni');
  });

  it('oltre le due settimane si passa alle settimane: «da 13 giorni» non si legge', () => {
    expect(daQuantoFermo(giorniFa(13), ADESSO)).toBe('da 13 giorni');
    expect(daQuantoFermo(giorniFa(14), ADESSO)).toBe('da 2 settimane');
    expect(daQuantoFermo(giorniFa(30), ADESSO)).toBe('da 4 settimane');
  });

  /**
   * ⚠️ I giorni si contano per CALENDARIO. Bloccata alle 23, guarda l'app alle 8 del mattino dopo:
   * sono nove ore, ma il giorno è un altro e per lei è «da ieri». A multipli di 24 ore avrebbe
   * letto «da oggi», cioè che è appena successo.
   */
  it('⚠️ per calendario, non a multipli di 24 ore: le 23 di ieri sono «da ieri»', () => {
    expect(daQuantoFermo(giorniFa(1, 23), new Date(2026, 7, 18, 8, 0, 0))).toBe('da ieri');
  });

  /**
   * ⚠️ «Non lo so» non diventa «da 0 giorni». Chi chiama scrive la frase di prima, che è meno
   * precisa ma vera — inventare per non lasciare un buco è il difetto, non il rimedio.
   */
  it('⚠️ senza data torna null, e non «da oggi»', () => {
    expect(daQuantoFermo(null, ADESSO)).toBeNull();
    expect(daQuantoFermo(undefined, ADESSO)).toBeNull();
    expect(daQuantoFermo('', ADESSO)).toBeNull();
    expect(daQuantoFermo('non-una-data', ADESSO)).toBeNull();
  });

  it('⚠️ e una data nel futuro non è «da -2 giorni»: è un dato che non torna, e si tace', () => {
    expect(daQuantoFermo(giorniFa(-2), ADESSO)).toBeNull();
  });
});

describe('frasePausaMenu', () => {
  it('col da quanto dentro, quando lo sappiamo', () => {
    expect(frasePausaMenu(giorniFa(3), ADESSO)).toContain('fermo da 3 giorni');
  });

  it('senza data resta una frase vera, solo meno precisa', () => {
    const f = frasePausaMenu(null, ADESSO);
    expect(f).toBe('Il tuo menu è in attesa della pesata. Inserisci qui le misure e riparte subito, oppure contatta la tua coach.');
  });

  /**
   * ⚠️ La via d'uscita che dipende da lei viene PRIMA di quella che dipende da qualcun altro:
   * mandarla ad aspettare la coach per una cosa che le costa trenta secondi è farle perdere un
   * altro giorno di menu.
   */
  it('⚠️ «inserisci qui» sta prima di «contatta la coach»', () => {
    const f = frasePausaMenu(giorniFa(2), ADESSO);
    expect(f.indexOf('Inserisci qui')).toBeLessThan(f.indexOf('contatta la tua coach'));
  });
});
