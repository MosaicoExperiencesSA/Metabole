import { conflittiDiPromozione, raccontaConflitti } from './conflitti-dizionario';

/**
 * «CHIEDI CONFERMA AL NUTRIZIONISTA CAPO ATTRAVERSO VERA» (risposta di Simone, 13/8, alla domanda
 * di Nocanty sul dizionario promosso). Decisione in
 * progetto/NOTA_Dizionario_Promosso_Conferma_Capo.md.
 */

const V = (nutrizionistaId: string, nome: string, membri: string[], nutrizionistaNome?: string) => ({
  nutrizionistaId, nome, membri, nutrizionistaNome,
});

describe('conflittiDiPromozione — chi ha già una sua versione DIVERSA', () => {
  const daPromuovere = V('lucia', 'formaggi molli', ['stracchino', 'crescenza', 'robiola'], 'Lucia');

  it('trova chi ne ha una diversa, e dice in cosa differisce', () => {
    const c = conflittiDiPromozione(daPromuovere, [
      V('anna', 'formaggi molli', ['stracchino', 'mozzarella'], 'Anna'),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].nutrizionistaNome).toBe('Anna');
    // Quello che cambia la decisione: cosa c'è nella comune e non nella sua, e viceversa.
    expect(c[0].inPiuNellaComune.sort()).toEqual(['crescenza', 'robiola']);
    expect(c[0].soloNellaSua).toEqual(['mozzarella']);
  });

  it('⚠️ chi ce l\'ha IDENTICA non compare: dirlo sarebbe rumore', () => {
    expect(conflittiDiPromozione(daPromuovere, [
      V('anna', 'formaggi molli', ['robiola', 'stracchino', 'crescenza'], 'Anna'),
    ])).toEqual([]);
  });

  it('⚠️ singolare e plurale non sono un conflitto: si confronta con la radice', () => {
    expect(conflittiDiPromozione(daPromuovere, [
      V('anna', 'formaggi molli', ['Stracchino', 'crescenze', 'robiole'], 'Anna'),
    ])).toEqual([]);
  });

  it('l\'autrice della voce non è in conflitto con sé stessa', () => {
    expect(conflittiDiPromozione(daPromuovere, [V('lucia', 'formaggi molli', ['altro'], 'Lucia')])).toEqual([]);
  });

  it('le voci con un ALTRO nome non c\'entrano', () => {
    expect(conflittiDiPromozione(daPromuovere, [V('anna', 'pasto leggero', ['insalata'], 'Anna')])).toEqual([]);
  });

  it('le voci già comuni non sono «di qualcuno»: non si contano', () => {
    expect(conflittiDiPromozione(daPromuovere, [
      { ...V('anna', 'formaggi molli', ['mozzarella'], 'Anna'), comune: true },
    ])).toEqual([]);
  });
});

describe('raccontaConflitti — la frase che legge il capo prima di dire sì', () => {
  it('dice CHI, in cosa differisce, e che le loro restano', () => {
    const t = raccontaConflitti([
      { nutrizionistaId: 'anna', nutrizionistaNome: 'Anna', inPiuNellaComune: ['crescenza'], soloNellaSua: ['mozzarella'] },
    ]);
    expect(t).toContain('Anna');
    expect(t).toContain('crescenza');
    expect(t).toContain('mozzarella');
    // ⚠️ Dice anche cosa NON succede: senza, il capo può credere di star cambiando i menu di tutte.
    expect(t).toContain('restano');
  });

  it('senza conflitti non dice niente: nessuna riga di rumore', () => {
    expect(raccontaConflitti([])).toBe('');
  });

  it('con tante versioni diverse le nomina tutte, ma la frase resta leggibile', () => {
    const t = raccontaConflitti([
      { nutrizionistaId: 'a', nutrizionistaNome: 'Anna', inPiuNellaComune: ['crescenza'], soloNellaSua: [] },
      { nutrizionistaId: 'b', nutrizionistaNome: 'Bea', inPiuNellaComune: [], soloNellaSua: ['feta'] },
    ]);
    expect(t).toContain('Anna');
    expect(t).toContain('Bea');
    expect(t).toContain('2 nutrizioniste');
  });
});
