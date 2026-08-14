import { describe, expect, it } from 'vitest';
import { raccontaSpuntiniEsclusi } from './spuntiniEsclusi';

/**
 * GLI SPUNTINI TOLTI DALLA NUTRIZIONISTA, LETTI DALLA CLIENTE — voce 235.
 * Il motore li rispetta già: senza questa riga in profilo lei riceve giornate senza merenda e
 * nessuno gliel'ha detto. È lo stesso buco che avevano le allergie.
 */
describe('raccontaSpuntiniEsclusi', () => {
  it('uno solo, per nome', () => {
    expect(raccontaSpuntiniEsclusi(['afternoon_snack'])).toBe('La merenda del pomeriggio');
    expect(raccontaSpuntiniEsclusi(['morning_snack'])).toBe('Lo spuntino del mattino');
  });

  it('tutti e due, in ordine di giornata e non in quello in cui sono scritti', () => {
    expect(raccontaSpuntiniEsclusi(['afternoon_snack', 'morning_snack']))
      .toBe('Lo spuntino del mattino e la merenda del pomeriggio');
  });

  it('niente da dire: nessuna riga in profilo', () => {
    expect(raccontaSpuntiniEsclusi([])).toBeNull();
    expect(raccontaSpuntiniEsclusi(null)).toBeNull();
    expect(raccontaSpuntiniEsclusi(undefined)).toBeNull();
  });

  it('⚠️ un pasto che non so nominare non diventa un codice sullo schermo di una cliente', () => {
    // «dinner» in faccia a chi legge non è un'informazione, è un difetto che si vede. Ma nemmeno
    // si nasconde che un pasto è stato tolto: si dice che c'è, senza dargli un nome inventato.
    expect(raccontaSpuntiniEsclusi(['dinner'])).toBe('Un altro pasto');
    expect(raccontaSpuntiniEsclusi(['morning_snack', 'dinner'])).toBe('Lo spuntino del mattino e un altro pasto');
  });

  it('⚠️ due sconosciuti non diventano «un altro pasto e un altro pasto»', () => {
    expect(raccontaSpuntiniEsclusi(['dinner', 'lunch'])).toBe('Altri pasti');
  });

  it('un doppione non si conta due volte', () => {
    expect(raccontaSpuntiniEsclusi(['morning_snack', 'morning_snack'])).toBe('Lo spuntino del mattino');
  });
});
