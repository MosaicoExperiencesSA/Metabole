import { GIORNI_DELLA_FINESTRA, NESSUN_LIMITE, carneRestante } from './carne-quante-volte';

/**
 * ⚠️ Decisione di Simone (1/9): la carne **due volte a settimana** per il flexitariano. È quello
 * che distingue «Flessibile» da «onnivoro»: senza, le due cose sono la stessa.
 */
describe('quante volte ancora la carne', () => {
  it('con il tetto a due e nessuna giornata di carne, ne restano due', () => {
    expect(carneRestante([], 10, 2)).toBe(2);
  });

  it('e scala con quelle già servite', () => {
    expect(carneRestante([8], 10, 2)).toBe(1);
    expect(carneRestante([8, 9], 10, 2)).toBe(0);
  });

  /**
   * ⛔ **La settimana è una finestra SCORREVOLE, non il calendario.** Con la settimana di
   * calendario si potrebbe avere carne sabato e domenica, poi lunedì e martedì: quattro volte in
   * quattro giorni, e tutte e due le settimane «rispettate». Chi mangia conta i giorni.
   */
  it('⛔ le giornate fuori dalla settimana non contano più', () => {
    // servite ai giorni 1 e 2, oggi è il 10: fuori dalla finestra di 7
    expect(carneRestante([1, 2], 10, 2)).toBe(2);
    // al giorno 8 la carne del giorno 2 è ancora dentro (8 − 2 = 6 < 7)
    expect(carneRestante([1, 2], 8, 2)).toBe(1);
  });

  it('il bordo della finestra è quello dichiarato', () => {
    const oggi = 10;
    const alBordo = oggi - GIORNI_DELLA_FINESTRA; // esattamente 7 giorni fa: fuori
    expect(carneRestante([alBordo], oggi, 2)).toBe(2);
    expect(carneRestante([alBordo + 1], oggi, 2)).toBe(1);
  });

  /** ⚠️ Zero vuol dire «nessun limite», non «mai carne»: è il valore di chi la regola non ce l'ha. */
  it('⚠️ zero è nessun limite, non un divieto', () => {
    expect(carneRestante([1, 2, 3, 4, 5], 6, NESSUN_LIMITE)).toBe(Infinity);
    expect(carneRestante([], 1, -3)).toBe(Infinity);
  });

  it('non va mai sotto zero, anche se il tetto è stato sforato', () => {
    expect(carneRestante([7, 8, 9], 10, 2)).toBe(0);
  });

  it('e una giornata futura non conta: si guarda indietro, non avanti', () => {
    expect(carneRestante([12], 10, 2)).toBe(2);
  });
});
