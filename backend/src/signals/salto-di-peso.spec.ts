import { SALTO_ALLARME_KG_DEFAULT, saltoDiPeso, spiegaSaltoDiPeso } from './salto-di-peso';

/**
 * ⛔ **LA SOGLIA DI LUCIA (5/9): salto improvviso oltre 4 kg.** Il caso che la voce
 * `pesate-lontane-buco-del-ritmo` chiedeva di coprire da agosto: venti chili dopo venticinque
 * giorni senza pesarsi, che col guardrail dei dati sporchi non suonava.
 */

const g = (giorno: number, kg: number) => ({ date: new Date(2026, 8, giorno), weightKg: kg });

describe('saltoDiPeso', () => {
  it('⛔ il caso del rientro: venti chili in venticinque giorni adesso si vedono', () => {
    const out = saltoDiPeso([g(1, 92), g(26, 72)]);
    expect(out).toMatchObject({ persi: 20, giorni: 25 });
  });

  it('⚠️ un calo normale non dice niente: 2 kg in una settimana è un percorso, non un allarme', () => {
    expect(saltoDiPeso([g(1, 80), g(8, 78)])).toBeNull();
  });

  it('⚠️ la soglia è «oltre», non «da»: esattamente 4 kg non suona', () => {
    expect(saltoDiPeso([g(1, 80), g(8, 76)])).toBeNull();
    expect(saltoDiPeso([g(1, 80), g(8, 75.9)])?.persi).toBe(4.1);
  });

  it('⛔ gli AUMENTI non li guarda: hanno il loro avviso, e questa regola parla di calo', () => {
    expect(saltoDiPeso([g(1, 70), g(8, 80)])).toBeNull();
  });

  it('⚠️ pesate in disordine: si riordinano qui dentro, il segno non si rovescia', () => {
    expect(saltoDiPeso([g(20, 70), g(1, 80)])?.persi).toBe(10);
  });

  it('⚠️ prende il salto PEGGIORE, non il primo', () => {
    expect(saltoDiPeso([g(1, 90), g(5, 85), g(9, 72)])?.persi).toBe(13);
  });

  it('⚠️ righe illeggibili non fanno saltare il conto', () => {
    expect(saltoDiPeso([{ date: new Date('boh'), weightKg: 80 }, g(8, 60)])).toBeNull();
    expect(saltoDiPeso([])).toBeNull();
    expect(saltoDiPeso(undefined as never)).toBeNull();
  });

  it(`la soglia predefinita è ${SALTO_ALLARME_KG_DEFAULT}, e si può stringere`, () => {
    expect(saltoDiPeso([g(1, 80), g(8, 77)])).toBeNull();
    expect(saltoDiPeso([g(1, 80), g(8, 77)], 2)?.persi).toBe(3);
  });

  it('la frase dice le due date e i chili, non «salto anomalo»', () => {
    const s = saltoDiPeso([g(1, 92), g(26, 72)])!;
    const frase = spiegaSaltoDiPeso(s, (d) => d.toLocaleDateString('it-IT'));
    expect(frase).toContain('−20 kg');
    expect(frase).toContain('25 giorni');
  });
});
