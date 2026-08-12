/**
 * LA FORMULA CHE DECIDE COSA SI MANGIA.
 *
 * Il blocco che conta è il primo: fino al 12/8 un piatto mai votato valeva **cinque stelle**, e
 * quel default rendeva lo stato «conforto» — umore basso → menu più amati — o inutile o
 * controproducente. Nessun test lo guardava, perché la formula stava dentro una closure.
 */
import { STELLE_SE_MAI_VOTATA, punteggioRicetta, type PesiPunteggio } from './punteggio';

/** Pesi tipici: solo efficacia e gradimento, nessuna penalità, per leggere il conto a occhio. */
const PESI: PesiPunteggio = {
  wEff: 1, wGrad: 1, proteinBonus: 0, penaltyRepeat: 0, penaltyStagione: 0,
};
/** Lo stato «conforto»: il gradimento pesa 1.8 volte (`menu_state_boost`). */
const CONFORTO: PesiPunteggio = { ...PESI, wGrad: 1.8 };

describe('⚠️ un piatto mai votato vale ZERO stelle', () => {
  it('è zero, deciso da Simone il 12/8', () => {
    expect(STELLE_SE_MAI_VOTATA).toBe(0);
  });

  it('mai votato non guadagna niente sul gradimento', () => {
    expect(punteggioRicetta({ stelle: null }, PESI)).toBe(0);
    expect(punteggioRicetta({}, PESI)).toBe(0);
  });

  it('⚠️ un piatto che ha votato bene BATTE uno mai provato', () => {
    // Prima era il contrario: mai votato valeva 5 (1.0) e batteva un quattro stelle (0.8).
    const votato = punteggioRicetta({ stelle: 4 }, PESI);
    const maiProvato = punteggioRicetta({ stelle: null }, PESI);
    expect(votato).toBeGreaterThan(maiProvato);
  });

  it('⚠️ e nel CONFORTO il vantaggio si allarga, invece di rovesciarsi', () => {
    // È il senso dello stato: nel giorno storto le arrivano i piatti che ha detto di amare.
    const distanzaNormale = punteggioRicetta({ stelle: 5 }, PESI) - punteggioRicetta({ stelle: null }, PESI);
    const distanzaConforto = punteggioRicetta({ stelle: 5 }, CONFORTO) - punteggioRicetta({ stelle: null }, CONFORTO);
    expect(distanzaConforto).toBeGreaterThan(distanzaNormale);
  });

  it('⚠️ per chi non ha votato NIENTE l\'ordine non cambia: era una costante, resta una costante', () => {
    // La garanzia che questo cambio non sposta i menu di chi non ha mai votato. Prima tutti 1.0,
    // adesso tutti 0.0: in entrambi i casi decidono efficacia, ripetizione e stagione.
    const a = punteggioRicetta({ efficacia: 0.7 }, PESI);
    const b = punteggioRicetta({ efficacia: 0.3 }, PESI);
    expect(a).toBeGreaterThan(b);
    // E il conforto non ribalta niente fra due piatti entrambi mai votati.
    expect(punteggioRicetta({ efficacia: 0.7 }, CONFORTO)).toBeGreaterThan(punteggioRicetta({ efficacia: 0.3 }, CONFORTO));
  });

  it('le cinque stelle valgono il peso pieno del gradimento', () => {
    expect(punteggioRicetta({ stelle: 5 }, PESI)).toBe(1);
    expect(punteggioRicetta({ stelle: 5 }, CONFORTO)).toBeCloseTo(1.8, 5);
  });
});

describe('gli altri pezzi del conto', () => {
  it('l\'efficacia appresa pesa quanto dice il suo peso', () => {
    expect(punteggioRicetta({ efficacia: 0.5 }, { ...PESI, wEff: 2 })).toBe(1);
    expect(punteggioRicetta({ efficacia: null }, PESI)).toBe(0);
  });

  it('la proteina conta SOLO prima di un evento', () => {
    const pre = { ...PESI, proteinBonus: 2, usePreEvent: true };
    expect(punteggioRicetta({ proteina: 0.4 }, pre)).toBeCloseTo(0.8, 5);
    // Fuori dal pre-evento la stessa ricetta non guadagna niente da lì.
    expect(punteggioRicetta({ proteina: 0.4 }, { ...pre, usePreEvent: false })).toBe(0);
  });

  it('la ripetizione toglie punti a ogni volta servita', () => {
    const p = { ...PESI, penaltyRepeat: 0.3 };
    expect(punteggioRicetta({ stelle: 5, volteDiRecente: 2 }, p)).toBeCloseTo(1 - 0.6, 5);
  });

  it('⚠️ fuori stagione si PENALIZZA, non si esclude', () => {
    // Un piatto fuori stagione è meno grave di una cena mancante (decisione di Simone): il
    // punteggio scende, la ricetta resta in gara.
    const p = { ...PESI, penaltyStagione: 0.5 };
    const dentro = punteggioRicetta({ stelle: 5 }, p);
    const fuori = punteggioRicetta({ stelle: 5, fuoriStagione: true }, p);
    expect(fuori).toBeLessThan(dentro);
    expect(fuori).toBeCloseTo(0.5, 5);
  });

  it('una ricetta senza niente di noto vale zero, non NaN', () => {
    const p = { ...PESI, proteinBonus: 2, penaltyRepeat: 1, penaltyStagione: 1, usePreEvent: true };
    expect(punteggioRicetta({}, p)).toBe(0);
  });
});
