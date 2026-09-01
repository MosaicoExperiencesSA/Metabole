import {
  PESI_RIENTRO,
  PESI_RITORNO_IN_EQUILIBRIO,
  leMigliori,
  ordinaLeGiornate,
  type GiornataCandidata,
} from './giornate-che-hanno-funzionato';

const g = (chiave: string, caloKg: number | null, gradimento: number | null, recenza = 0): GiornataCandidata =>
  ({ chiave, caloKg, gradimento, recenza });

describe('quali giornate hanno funzionato meglio', () => {
  it('col peso solo, vince quella col calo maggiore', () => {
    const ordine = ordinaLeGiornate([g('a', -0.2, 5), g('b', -1.1, 1), g('c', 0.3, 5)], PESI_RIENTRO);
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['b', 'a', 'c']);
  });

  /**
   * ⚠️ Richiesta di Simone del 27/8 per Ritorno in Equilibrio: *«migliori risultati E al cliente
   * più graditi»*. Un mese di piatti che non le piacciono non lo finisce nessuno.
   */
  it('⚠️ col gusto a metà, la via di mezzo amata batte il calo migliore ma odiato', () => {
    const ordine = ordinaLeGiornate([
      g('scesa-di-piu-ma-odiata', -1.0, 1),
      g('scesa-quasi-e-amata', -0.6, 5),
      g('cosi-cosi', -0.2, 3),
    ], PESI_RITORNO_IN_EQUILIBRIO);
    expect(ordine[0].giornata.chiave).toBe('scesa-quasi-e-amata');
  });

  it('e le due funzioni danno ordini diversi sugli stessi dati — è il motivo per cui i pesi esistono', () => {
    const giornate = [
      g('scesa-di-piu-ma-odiata', -1.0, 1),
      g('scesa-quasi-e-amata', -0.6, 5),
      g('cosi-cosi', -0.2, 3),
    ];
    expect(ordinaLeGiornate(giornate, PESI_RIENTRO)[0].giornata.chiave).toBe('scesa-di-piu-ma-odiata');
    expect(ordinaLeGiornate(giornate, PESI_RITORNO_IN_EQUILIBRIO)[0].giornata.chiave).toBe('scesa-quasi-e-amata');
  });

  /**
   * ⛔ **LA RAGIONE PER CUI SI USA IL RANGO E NON LA DISTANZA MIN–MAX.** Con
   * `(v − min) / (max − min)` una differenza di cento grammi fra le due migliori pesa quanto la
   * distanza fra la migliore e la peggiore, e una sola giornata eccezionale schiaccia tutte le
   * altre in fondo alla scala rendendole indistinguibili.
   */
  it('⛔ una giornata eccezionale non schiaccia le altre in fondo alla scala', () => {
    const ordine = ordinaLeGiornate([
      g('normale-a', -0.3, null),
      g('normale-b', -0.2, null),
      g('normale-c', -0.1, null),
      g('eccezionale', -12, null), // una pesata sbagliata, o una settimana fuori scala
    ], PESI_RIENTRO);
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['eccezionale', 'normale-a', 'normale-b', 'normale-c']);
    // le tre normali restano distinte fra loro invece di collassare tutte vicino a zero
    const p = ordine.slice(1).map((x) => x.punteggio);
    expect(p[0] - p[1]).toBeGreaterThan(0.2);
    expect(p[1] - p[2]).toBeGreaterThan(0.2);
  });

  /**
   * ⛔ Contarla zero vorrebbe dire mettere in fondo proprio le giornate delle clienti che le stelle
   * non le danno mai — cioè quasi tutte.
   */
  it('⛔ una giornata che nessuno ha votato non è una giornata che è piaciuta poco', () => {
    const ordine = ordinaLeGiornate([
      g('votata-male', -1.0, 1),
      g('mai-votata', -1.0, null),
      g('votata-bene', -1.0, 5),
    ], PESI_RITORNO_IN_EQUILIBRIO);
    // sta in mezzo: non premiata, non punita
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['votata-bene', 'mai-votata', 'votata-male']);
  });

  it('vale anche per il peso: senza pesate vicine non lo sappiamo, non è uno zero', () => {
    const ordine = ordinaLeGiornate([g('scesa', -1, null), g('ignota', null, null), g('salita', 1, null)], PESI_RIENTRO);
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['scesa', 'ignota', 'salita']);
  });

  /**
   * ⛔ Sommare una costante a tutte non cambierebbe l'ordine, ma renderebbe i punteggi non
   * confrontabili fra una cliente che vota e una che non vota — e il primo che li guardasse
   * insieme concluderebbe che la seconda ha giornate peggiori.
   */
  it('⛔ se un segnale manca a TUTTE, il suo peso si ridistribuisce invece di aggiungere una costante', () => {
    const senzaStelle = [g('a', -1.0, null), g('b', 0.0, null)];
    const ordine = ordinaLeGiornate(senzaStelle, PESI_RITORNO_IN_EQUILIBRIO);
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['a', 'b']);
    // il migliore prende 1, non 0.5: il peso del gusto è finito tutto sul calo
    expect(ordine[0].punteggio).toBeCloseTo(1, 6);
    expect(ordine[1].punteggio).toBeCloseTo(0, 6);
  });

  /** ⚠️ Un segnale piatto non deve decidere l'ordine: si fa da parte. */
  it('⚠️ se un segnale è uguale per tutte non distingue niente', () => {
    const ordine = ordinaLeGiornate([g('a', -1, 3), g('b', -1, 5)], PESI_RITORNO_IN_EQUILIBRIO);
    expect(ordine[0].giornata.chiave).toBe('b');
  });

  it('⚠️ a parità vince la più recente, invece dell\'ordine in cui il database le ha restituite', () => {
    const ordine = ordinaLeGiornate([g('vecchia', -1, 4, 100), g('nuova', -1, 4, 900)], PESI_RITORNO_IN_EQUILIBRIO);
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['nuova', 'vecchia']);
  });

  it('senza giornate non c\'è ordine, e non è un errore', () => {
    expect(ordinaLeGiornate([], PESI_RIENTRO)).toEqual([]);
  });

  it('con tutti i pesi a zero non si rompe: nessuno vince, e restano nell\'ordine di recenza', () => {
    const ordine = ordinaLeGiornate([g('a', -5, 5, 1), g('b', 0, 1, 2)], { calo: 0, gusto: 0 });
    expect(ordine.map((x) => x.giornata.chiave)).toEqual(['b', 'a']);
  });
});

describe('leMigliori', () => {
  it('prende le prime, senza doppioni di chiave', () => {
    const scelte = leMigliori([g('a', -1, 5), g('a', -1, 5), g('b', -0.5, 5)], 2, PESI_RIENTRO);
    expect(scelte.map((s) => s.chiave)).toEqual(['a', 'b']);
  });

  /**
   * ⚠️ **Non riempie a forza.** Se le giornate buone sono meno di quante ne servono se ne
   * restituiscono meno: cosa fare del buco lo decide chi chiama — il kit di rientro completa coi
   * giorni più recenti, ed è una scelta sua.
   */
  it('⚠️ se ce ne sono meno di quante ne servono, ne rende meno — non inventa', () => {
    expect(leMigliori([g('a', -1, 5)], 4, PESI_RIENTRO)).toHaveLength(1);
  });

  it('zero giornate chieste, zero rese', () => {
    expect(leMigliori([g('a', -1, 5)], 0, PESI_RIENTRO)).toEqual([]);
    expect(leMigliori([g('a', -1, 5)], -3, PESI_RIENTRO)).toEqual([]);
  });
});
