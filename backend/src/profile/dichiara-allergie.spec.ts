/**
 * LA DOMANDA IN APP, per chi non ha mai risposto.
 *
 * I due test che contano sono i due paletti: **si aggiunge e non si sostituisce** (una risposta nuova
 * non può cancellare un'allergia registrata da qualcun altro) e **«non ne ho» è una risposta**,
 * mentre il silenzio no.
 */
import { dichiarazione, haRisposto } from './dichiara-allergie';

const UE = ['glutine', 'latte', 'uova', 'frutta_a_guscio'];

describe('cosa si scrive sul profilo', () => {
  it('⚠️ AGGIUNGE a quello che c\'era, non lo sostituisce', () => {
    // Una risposta nuova non può far sparire un'allergia che una nutrizionista aveva registrato.
    const e = dichiarazione(['latte'], { allergie: ['glutine'] }, UE);
    expect(e.allergie).toEqual(['latte', 'glutine']);
  });

  it('non duplica quello che c\'è già, comunque sia scritto', () => {
    expect(dichiarazione(['Latte'], { allergie: ['latte'] }, UE).allergie).toEqual(['Latte']);
  });

  it('il testo libero resta fra le allergie E si marca in `allergiesOther`', () => {
    // ⚠️ Marcatore, non spostamento: sette punti del codice leggono `allergies` per escludere davvero.
    const e = dichiarazione([], { allergie: ['latte'], altro: ['favismo'] }, UE);
    expect(e.allergie).toEqual(['latte', 'favismo']);
    expect(e.allergiesOther).toEqual(['favismo']);
  });

  it('⚠️ si chiede alla nutrizionista SOLO per quello che è arrivato adesso', () => {
    // Le voci vecchie hanno già la loro domanda aperta: riaprirla riempirebbe la coda di doppioni.
    const e = dichiarazione(['carboidrati'], { altro: ['favismo'] }, UE);
    expect(e.allergiesOther).toEqual(['carboidrati', 'favismo']);
    expect(e.daTradurre).toEqual(['favismo']);
  });

  it('«altro» e «nessuna» non finiscono fra gli alimenti', () => {
    expect(dichiarazione([], { allergie: ['altro', 'nessuna', 'latte'] }, UE).allergie).toEqual(['latte']);
  });
});

describe('ha risposto?', () => {
  it('⚠️ «non ne ho» È una risposta', () => {
    expect(haRisposto({ nessuna: true })).toBe(true);
  });

  it('il silenzio no', () => {
    expect(haRisposto({})).toBe(false);
    expect(haRisposto({ allergie: [], altro: [] })).toBe(false);
  });

  it('un elenco pieno sì', () => {
    expect(haRisposto({ allergie: ['latte'] })).toBe(true);
  });
});
