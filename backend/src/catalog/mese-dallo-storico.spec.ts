import { PESI_RITORNO_IN_EQUILIBRIO, type GiornataCandidata } from '../monitoring/giornate-che-hanno-funzionato';
import { DISTANZA_MINIMA_GIORNI, componiIlMese, quantoEPovero } from './mese-dallo-storico';

const g = (chiave: string, caloKg: number | null, gradimento: number | null, recenza = 0): GiornataCandidata =>
  ({ chiave, caloKg, gradimento, recenza });

/** Trenta giornate distinte, ordinate dalla migliore alla peggiore. */
const trenta = Array.from({ length: 30 }, (_, i) => g(`d${i}`, -(30 - i) / 10, 5 - (i % 5), 30 - i));

describe('un mese composto dal passato', () => {
  it('con storico abbondante non ripete niente', () => {
    const m = componiIlMese(trenta, 30, PESI_RITORNO_IN_EQUILIBRIO);
    expect(m.giornate).toHaveLength(30);
    expect(m.distinte).toBe(30);
    expect(m.ripetizioneMassima).toBe(1);
  });

  it('e prende le migliori, non le prime che capitano', () => {
    const m = componiIlMese(trenta, 3, PESI_RITORNO_IN_EQUILIBRIO);
    const ordinate = componiIlMese(trenta, 30, PESI_RITORNO_IN_EQUILIBRIO).giornate.slice(0, 3);
    expect(m.giornate.map((x) => x.chiave)).toEqual(ordinate.map((x) => x.chiave));
  });

  /**
   * ⛔ **Il problema vero non è scegliere le migliori: è cosa fare quando finiscono.** Se le copie
   * si ammucchiano, la cliente si accorge di mangiare la stessa settimana tre volte di fila.
   */
  it('⛔ con poco storico ripete, ma tenendo le distanze', () => {
    const dieci = trenta.slice(0, 10);
    const m = componiIlMese(dieci, 30, PESI_RITORNO_IN_EQUILIBRIO);
    expect(m.giornate).toHaveLength(30);
    expect(m.distinte).toBe(10);
    // nessuna giornata torna a meno di `DISTANZA_MINIMA_GIORNI` di distanza
    const ultima = new Map<string, number>();
    for (let i = 0; i < m.giornate.length; i++) {
      const k = m.giornate[i].chiave;
      const prima = ultima.get(k);
      if (prima !== undefined) expect(i - prima).toBeGreaterThanOrEqual(DISTANZA_MINIMA_GIORNI);
      ultima.set(k, i);
    }
  });

  /**
   * ⛔ **Quando si ricomincia il giro si riparte dalla MIGLIORE**, non si scende nella classifica:
   * chi ha chiesto «i menu che hanno funzionato meglio» non vuole che la seconda metà del mese sia
   * la coda della lista.
   */
  it('⛔ il secondo giro riparte dalle migliori, non dalle peggiori', () => {
    const dieci = trenta.slice(0, 10);
    const m = componiIlMese(dieci, 20, PESI_RITORNO_IN_EQUILIBRIO);
    const primoGiro = m.giornate.slice(0, 10).map((x) => x.chiave);
    const secondoGiro = m.giornate.slice(10, 20).map((x) => x.chiave);
    expect(secondoGiro).toEqual(primoGiro);
  });

  /**
   * ⚠️ **La distanza cede quando non c'è altro**: con tre giornate sole e una distanza di sette, si
   * ripete più spesso invece di lasciare il giorno vuoto. Un buco è sempre peggio di una
   * ripetizione — è la stessa rete che regge la finestra del digiuno.
   */
  it('⚠️ con pochissime giornate la distanza cede, invece di lasciare buchi', () => {
    const m = componiIlMese(trenta.slice(0, 3), 12, PESI_RITORNO_IN_EQUILIBRIO);
    expect(m.giornate).toHaveLength(12);
    expect(m.distinte).toBe(3);
    expect(m.ripetizioneMassima).toBe(4);
    // e comunque gira, invece di incollarsi sulla stessa
    expect(m.giornate[0].chiave).not.toBe(m.giornate[1].chiave);
  });

  it('una sola giornata di storico dà un mese di quella, e non si rompe', () => {
    const m = componiIlMese([g('sola', -1, 5)], 5, PESI_RITORNO_IN_EQUILIBRIO);
    expect(m.giornate).toHaveLength(5);
    expect(m.distinte).toBe(1);
    expect(m.ripetizioneMassima).toBe(5);
  });

  it('senza storico non compone niente, e non è un errore', () => {
    expect(componiIlMese([], 30, PESI_RITORNO_IN_EQUILIBRIO)).toEqual({ giornate: [], distinte: 0, ripetizioneMassima: 0 });
    expect(componiIlMese(trenta, 0, PESI_RITORNO_IN_EQUILIBRIO).giornate).toEqual([]);
  });
});

/**
 * ⚠️ La funzione promette «un mese dei tuoi piatti migliori»: se le giornate diverse sono dieci su
 * trenta, qualcuno deve saperlo **prima** che se ne accorga la cliente.
 */
describe('quanto è povero il mese', () => {
  it('con storico pieno non dice niente: un avviso che compare sempre non è un avviso', () => {
    expect(quantoEPovero(componiIlMese(trenta, 30, PESI_RITORNO_IN_EQUILIBRIO), 30)).toBeNull();
  });

  it('⚠️ con poco storico lo dice, e dice quanto', () => {
    const frase = quantoEPovero(componiIlMese(trenta.slice(0, 5), 30, PESI_RITORNO_IN_EQUILIBRIO), 30);
    expect(frase).toContain('5 giornate diverse su 30');
    expect(frase).toMatch(/6 volte/);
  });

  it('e senza storico lo dice in modo diverso, perché è un altro problema', () => {
    expect(quantoEPovero(componiIlMese([], 30, PESI_RITORNO_IN_EQUILIBRIO), 30)).toMatch(/non si può comporre/);
  });

  /** ⚠️ Una ripetizione ogni tanto su metà storico non è una notizia: si tace. */
  it('⚠️ e tace quando la ripetizione è ragionevole', () => {
    expect(quantoEPovero(componiIlMese(trenta.slice(0, 16), 30, PESI_RITORNO_IN_EQUILIBRIO), 30)).toBeNull();
  });
});

/**
 * ⛔ **LE DUE STESURE SBAGLIATE, TENUTE FERME COME PROVE.** Sono difetti che da fuori non si
 * vedono — il mese esce pieno e le giornate sono davvero le migliori — e senza queste righe la
 * prossima riscrittura ci ricasca senza accorgersene.
 */
describe('⛔ il passato di una cliente si usa TUTTO', () => {
  const sedici = trenta.slice(0, 16);

  /** 1ª stesura: «la prima della classifica che rispetta la distanza» → ne usava 7 su 16. */
  it('⛔ con 16 giornate di storico se ne usano 16, non 7', () => {
    expect(componiIlMese(sedici, 30, PESI_RITORNO_IN_EQUILIBRIO).distinte).toBe(16);
  });

  /** 2ª stesura: «prima quelle mai usate» → le prime sette tornavano 3 volte, altre nove 1. */
  it('⛔ e le ripetizioni si distribuiscono, invece di ammucchiarsi sulle prime', () => {
    const m = componiIlMese(sedici, 30, PESI_RITORNO_IN_EQUILIBRIO);
    const volte = new Map<string, number>();
    for (const g of m.giornate) volte.set(g.chiave, (volte.get(g.chiave) ?? 0) + 1);
    const conteggi = [...volte.values()];
    // 30 giorni su 16 giornate: qualcuna due volte, nessuna tre
    expect(Math.max(...conteggi)).toBe(2);
    expect(Math.min(...conteggi)).toBe(1);
  });

  /** ⚠️ E a parità di giri vince la migliore: fra due usate uguale, comanda la classifica. */
  it('⚠️ a parità di giri comanda la classifica', () => {
    const m = componiIlMese(trenta.slice(0, 4), 8, PESI_RITORNO_IN_EQUILIBRIO);
    expect(m.giornate.slice(0, 4).map((x) => x.chiave)).toEqual(m.giornate.slice(4, 8).map((x) => x.chiave));
  });
});
