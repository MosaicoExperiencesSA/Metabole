import { confineMese, giornoDelMeseLocale, inizioDelGiorno, inizioMeseLocale, meseLocale } from './date-only';
import { inizioMese, mesePeriodo } from './tetto-compensi';

/**
 * IL MESE DEI SOLDI — il difetto che questi test tengono chiuso.
 *
 * Su Render `TZ` non è impostata: il processo sta a UTC. D'estate l'Italia è avanti di due ore,
 * quindi **fra le 00:00 e le 02:00 del primo del mese, a Roma è già il mese nuovo e per il server
 * no**. Tre cose andavano storte, in ordine di quanto costano:
 *
 *  1. una provvigione accreditata in quelle due ore veniva contata nel mese PRECEDENTE. Per chi ha
 *     un tetto di guadagno mensile quel mese era già pieno: l'importo veniva tagliato e — per
 *     decisione esplicita l'eccedenza non slitta — perso. Senza riga a registro e senza errore;
 *  2. la finestra dei prelievi «dal 1 al 7» risultava chiusa nelle prime due ore del giorno 1;
 *  3. il portafoglio mostrava il mese appena chiuso ancora «in maturazione».
 *
 * ⚠️ I confronti col «modo vecchio» sono scritti con `getUTC*`, non con `getDate()`/`getMonth()`.
 * Non è pedanteria: `getDate()` legge il fuso del PROCESSO, quindi su un Mac italiano il difetto
 * non si vedrebbe e questi test passerebbero senza dimostrare niente — un test che diventa verde
 * per il fuso di chi lo lancia è peggio di nessun test. `getUTC*` è esattamente ciò che il vecchio
 * codice faceva su Render, ovunque lo si lanci.
 */
describe('il mese dei soldi è quello di Roma, non quello del server', () => {
  // 00:30 dell'1 settembre a Roma = 22:30 del 31 agosto a Greenwich.
  const primoSettembreNotte = new Date('2026-09-01T00:30:00+02:00');

  it('l’istante di prova è quello giusto: 00:30 a Roma = 22:30 del giorno prima a Greenwich', () => {
    expect(primoSettembreNotte.toISOString()).toBe('2026-08-31T22:30:00.000Z');
  });

  it('alle 00:30 dell’1 settembre il mese è settembre', () => {
    expect(meseLocale(primoSettembreNotte)).toBe('2026-09');
    expect(mesePeriodo(primoSettembreNotte)).toBe('2026-09');
    // Il modo vecchio, quello che sbagliava (su Render `toISOString()` è ciò che si leggeva):
    expect(primoSettembreNotte.toISOString().slice(0, 7)).toBe('2026-08');
  });

  it('il mese comincia a mezzanotte di Roma, non a mezzanotte UTC', () => {
    // L'istante vero: 1 settembre 00:00 a Roma = 31 agosto 22:00 UTC.
    expect(inizioMeseLocale(primoSettembreNotte).toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(inizioMese(primoSettembreNotte).toISOString()).toBe('2026-08-31T22:00:00.000Z');
  });

  it('una provvigione delle 00:30 del 1° cade DENTRO il mese nuovo, non nel tetto di quello vecchio', () => {
    // È la riga che veniva tagliata: `date >= inizioMese()` deve essere vera per settembre.
    expect(primoSettembreNotte.getTime()).toBeGreaterThanOrEqual(inizioMese(primoSettembreNotte).getTime());
    // E con il confine vecchio — su Render, `new Date(anno, mese, 1)` in un processo a UTC —
    // la stessa riga cadeva dentro AGOSTO, cioè dentro un mese già arrivato al tetto:
    const confineVecchio = new Date(Date.UTC(primoSettembreNotte.getUTCFullYear(), primoSettembreNotte.getUTCMonth(), 1));
    expect(confineVecchio.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(primoSettembreNotte.getTime()).toBeGreaterThanOrEqual(confineVecchio.getTime());
  });

  it('«dal 1 al 7» conta i giorni di Roma', () => {
    expect(giornoDelMeseLocale(primoSettembreNotte)).toBe(1);
    expect(primoSettembreNotte.getUTCDate()).toBe(31); // il modo vecchio: finestra chiusa il giorno 1
    // …e simmetricamente il giorno 8, dove la finestra restava aperta di due ore in più.
    const ottoNotte = new Date('2026-09-08T00:30:00+02:00');
    expect(giornoDelMeseLocale(ottoNotte)).toBe(8);
    expect(ottoNotte.getUTCDate()).toBe(7);
  });

  it('d’inverno lo scarto è di un’ora, e vale lo stesso', () => {
    const primoGennaioNotte = new Date('2026-01-01T00:30:00+01:00');
    expect(primoGennaioNotte.toISOString()).toBe('2025-12-31T23:30:00.000Z');
    expect(meseLocale(primoGennaioNotte)).toBe('2026-01');
    expect(inizioMeseLocale(primoGennaioNotte).toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(giornoDelMeseLocale(primoGennaioNotte)).toBe(1);
  });

  it('a metà giornata non cambia niente (il difetto è solo di notte)', () => {
    const pomeriggio = new Date('2026-09-15T14:00:00+02:00');
    expect(meseLocale(pomeriggio)).toBe('2026-09');
    expect(giornoDelMeseLocale(pomeriggio)).toBe(15);
  });
});

describe('confineMese — il filtro «un mese solo» della pagina Compensi staff', () => {
  it('prende dalle 00:00 di Roma del primo alle 00:00 di Roma del primo dopo', () => {
    const { gte, lt } = confineMese('2026-09');
    expect(gte.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-09-30T22:00:00.000Z');
  });

  it('dicembre scavalca l’anno', () => {
    const { gte, lt } = confineMese('2026-12');
    expect(gte.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('include la provvigione delle 00:30 del primo e NON quella delle 00:30 del primo dopo', () => {
    const { gte, lt } = confineMese('2026-09');
    const dentro = new Date('2026-09-01T00:30:00+02:00');
    const fuori = new Date('2026-10-01T00:30:00+02:00');
    expect(dentro >= gte && dentro < lt).toBe(true);
    expect(fuori >= gte && fuori < lt).toBe(false);
    // Con i confini UTC di prima, la prima riga finiva fuori e la seconda dentro: esattamente
    // al contrario.
    const gteUtc = new Date(Date.UTC(2026, 8, 1));
    const ltUtc = new Date(Date.UTC(2026, 9, 1));
    expect(dentro >= gteUtc && dentro < ltUtc).toBe(false);
    expect(fuori >= gteUtc && fuori < ltUtc).toBe(true);
  });

  it('lo stesso confine che usa il tetto: il primo del mese i due combaciano', () => {
    // Il tetto conta `date >= inizioMese()`; la pagina filtra `confineMese(periodo).gte`.
    // Se questi due numeri divergono, la pagina che dice «ha toccato il tetto» somma un mese
    // diverso da quello su cui il tetto ha deciso.
    const adesso = new Date('2026-09-01T00:30:00+02:00');
    expect(inizioMese(adesso).getTime()).toBe(confineMese(mesePeriodo(adesso)).gte.getTime());
  });
});

describe('inizioDelGiorno — attorno al cambio dell’ora legale', () => {
  it('l’ultima domenica di marzo (si va avanti) il giorno comincia comunque a mezzanotte di Roma', () => {
    // 29 marzo 2026: alle 02:00 locali si passa alle 03:00. Mezzanotte è ancora ora solare.
    expect(inizioDelGiorno('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    // Il giorno dopo è già ora legale.
    expect(inizioDelGiorno('2026-03-30').toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });

  it('l’ultima domenica di ottobre (si torna indietro)', () => {
    // 25 ottobre 2026: alle 03:00 locali si torna alle 02:00. Mezzanotte è ancora ora legale.
    expect(inizioDelGiorno('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(inizioDelGiorno('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
});
