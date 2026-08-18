import { describe, expect, it } from 'vitest';
import { testoPorzione } from './meals';

describe('testoPorzione — la riga che impedisce alla cliente di leggere due numeri diversi', () => {
  it('col fattore e le kcal di partenza dice tutte e due le cose', () => {
    const t = testoPorzione({ porzione: 1.8, kcalBase: 500 });
    expect(t).toBe('Porzione più abbondante, ×1,8 — pesa gli ingredienti per 1,8 volte (in ricetta ne trovi 500)');
  });

  it('la virgola, non il punto: è un numero che legge una persona', () => {
    expect(testoPorzione({ porzione: 1.25 })).toContain('×1,3');
  });

  it('senza le kcal di partenza resta una frase, senza la parentesi', () => {
    expect(testoPorzione({ porzione: 1.6 })).toBe('Porzione più abbondante, ×1,6 — pesa gli ingredienti per 1,6 volte');
  });

  /**
   * ⚠️ Un avviso che compare sempre non è un avviso. La porzione di catalogo (assente, o 1) non ha
   * niente da dire, e nemmeno uno scarto del 3% che nessuno peserebbe: la riga esiste per spiegare
   * una differenza VISIBILE fra le kcal del menu e le grammature della scheda ricetta.
   */
  it('⚠️ senza porzione, o con una porzione che non cambia niente, non dice niente', () => {
    expect(testoPorzione({})).toBeNull();
    expect(testoPorzione({ porzione: 1 })).toBeNull();
    expect(testoPorzione({ porzione: 1.03 })).toBeNull();
    expect(testoPorzione({ porzione: NaN })).toBeNull();
    expect(testoPorzione({ porzione: 0 })).toBeNull();
  });
});
