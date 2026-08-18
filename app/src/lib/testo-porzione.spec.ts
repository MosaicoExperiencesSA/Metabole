import { describe, expect, it } from 'vitest';
import { PORZIONE_DA_DIRE, testoIngredientiScheda, testoPorzione } from './meals';

describe('testoPorzione — la riga che impedisce alla cliente di leggere due numeri diversi', () => {
  /**
   * ⚠️ NON dice più «pesa gli ingredienti per 1,8 volte», e il motivo è tutto qui: dal 18/8 le
   * grammature nella scheda della ricetta arrivano **già scalate** dal server. Ripetere qui il
   * conto a mano vorrebbe dire farlo fare due volte — ×3,24 nel piatto.
   */
  it('⚠️ manda alla ricetta, non ordina di moltiplicare', () => {
    const t = testoPorzione({ porzione: 1.8, kcalBase: 495 });
    expect(t).toBe('Porzione più abbondante, ×1,8 — nella ricetta trovi già le tue quantità (di catalogo è da 495)');
    expect(t).not.toContain('pesa');
  });

  it('la virgola, non il punto: è un numero che legge una persona', () => {
    expect(testoPorzione({ porzione: 1.25 })).toContain('×1,3');
  });

  it('senza le kcal di partenza resta una frase, senza la parentesi', () => {
    expect(testoPorzione({ porzione: 1.6 })).toBe('Porzione più abbondante, ×1,6 — nella ricetta trovi già le tue quantità');
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

  /**
   * ⚠️ IL GEMELLO DI QUESTO TEST STA NEL BACKEND (`menu/porzione-del-giorno.spec.ts`): è lo stesso
   * numero, e sotto di esso il server non scala le grammature della scheda. Se i due divergessero,
   * gli ingredienti cambierebbero senza che nessuna riga dica perché.
   */
  it('⚠️ la soglia è la stessa del server: 1,05', () => {
    expect(PORZIONE_DA_DIRE).toBe(1.05);
    expect(testoPorzione({ porzione: 1.05 })).toBeNull();
    expect(testoPorzione({ porzione: 1.06 })).not.toBeNull();
  });
});

describe('testoIngredientiScheda — chi comanda è la risposta del server, non quello che sa l\'app', () => {
  it('scalata: si pesano i numeri che si stanno leggendo', () => {
    expect(testoIngredientiScheda({ porzioneScheda: 1.8, porzioneMenu: 1.8 })).toEqual({
      testo: 'Quantità già per la tua porzione, ×1,8: pesa questi numeri',
      scalata: true,
    });
  });

  /**
   * ⚠️ IL CASO CHE VALE LA FUNZIONE. Il server non ha trovato la giornata (o il piatto compare due
   * volte con fattori diversi): la scheda è rimasta di catalogo, ma il menu dice ×1,8. Qui il conto
   * a mano torna, e deve tornare **scritto**: senza, la cliente pesa la porzione piccola credendo
   * di seguire il menu.
   */
  it('⚠️ NON scalata ma il menu dice ×1,8: torna l\'istruzione di pesare per 1,8 volte', () => {
    expect(testoIngredientiScheda({ porzioneMenu: 1.8 })).toEqual({
      testo: 'Quantità di catalogo: la tua porzione è ×1,8, pesa gli ingredienti per 1,8 volte',
      scalata: false,
    });
  });

  it('la porzione di catalogo — la stragrande maggioranza dei piatti — non dice niente', () => {
    expect(testoIngredientiScheda({})).toBeNull();
    expect(testoIngredientiScheda({ porzioneScheda: 1, porzioneMenu: 1 })).toBeNull();
    expect(testoIngredientiScheda({ porzioneMenu: 1.02 })).toBeNull();
  });

  /**
   * ⚠️ La scheda scalata vince anche quando l'app non sa niente: si arriva alla ricetta anche dalla
   * home, dove il fattore del pasto non viaggia. Il server l'ha scalata: si dice.
   */
  it('la scheda scalata parla anche se l\'app non sapeva niente del fattore', () => {
    expect(testoIngredientiScheda({ porzioneScheda: 1.6 })?.scalata).toBe(true);
  });
});
