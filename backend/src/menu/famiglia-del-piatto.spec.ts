import { famigliaDelPiatto, famigliaGiaVista, stessaFamiglia } from './famiglia-del-piatto';

const ing = (...righe: [string, number | null][]) => righe.map(([name, qty]) => ({ name, qty, unit: 'g' }));

describe('famiglia del piatto — l ingrediente principale (19/9)', () => {
  describe('famigliaDelPiatto', () => {
    it('è l ingrediente che pesa di più', () => {
      expect(famigliaDelPiatto(ing(['Zucchine', 120], ['Uova', 150], ['Formaggio', 30]))).toBe('Uova');
    });

    it('a parità di grammi vince il primo scritto', () => {
      expect(famigliaDelPiatto(ing(['Uova', 100], ['Funghi', 100]))).toBe('Uova');
    });

    it('senza grammature non si indovina: null', () => {
      expect(famigliaDelPiatto(ing(['Uova', null]))).toBeNull();
      expect(famigliaDelPiatto([{ name: 'Uova', qty: 2, unit: 'pz' }])).toBeNull();
      expect(famigliaDelPiatto([])).toBeNull();
      expect(famigliaDelPiatto(null)).toBeNull();
      expect(famigliaDelPiatto('due uova')).toBeNull();
    });

    it('un principale fatto di sole parole di contorno non è una famiglia', () => {
      expect(famigliaDelPiatto(ing(['Olio', 200]))).toBeNull();
    });
  });

  describe('stessaFamiglia', () => {
    it('⛔ le due frittate del 21 e del 22 settembre sono la stessa famiglia', () => {
      const frittataFunghi = famigliaDelPiatto(ing(['Uova', 150], ['Funghi', 80], ['Prezzemolo', 5]));
      const frittataZucchine = famigliaDelPiatto(ing(['Uova', 150], ['Zucchine', 100], ['Formaggio', 30]));
      expect(stessaFamiglia(frittataFunghi, frittataZucchine)).toBe(true);
    });

    it('anche le uova strapazzate, come ha chiesto Simone', () => {
      expect(stessaFamiglia('Uova', 'Uovo')).toBe(true);
      expect(stessaFamiglia('Uova', 'Albumi')).toBe(true);
    });

    it('lo stesso alimento con un taglio diverso: stessa famiglia', () => {
      expect(stessaFamiglia('Petto di pollo', 'Pollo')).toBe(true);
      expect(stessaFamiglia('Riso venere', 'Riso basmati')).toBe(true);
      expect(stessaFamiglia('Yogurt greco', 'Skyr')).toBe(true);
    });

    it('⛔ due pesci diversi NON si bloccano a vicenda per un aggettivo', () => {
      expect(stessaFamiglia('Sgombro affumicato', 'Salmone affumicato')).toBe(false);
      expect(stessaFamiglia('Pollo grigliato', 'Orata grigliata')).toBe(false);
      expect(stessaFamiglia('Filetto di maiale', 'Filetto di merluzzo')).toBe(false);
    });

    it('alimenti diversi restano diversi', () => {
      expect(stessaFamiglia('Uova', 'Salmone')).toBe(false);
      expect(stessaFamiglia('Pepe', 'Peperoni')).toBe(false);
      expect(stessaFamiglia('Mela', 'Melanzane')).toBe(false);
      expect(stessaFamiglia('Pollo', 'Tacchino')).toBe(false);
    });

    it('«non lo so» non combacia con niente, nemmeno con un altro «non lo so»', () => {
      expect(stessaFamiglia(null, null)).toBe(false);
      expect(stessaFamiglia(null, 'Uova')).toBe(false);
      expect(stessaFamiglia('Uova', undefined)).toBe(false);
      expect(stessaFamiglia('', 'Uova')).toBe(false);
    });
  });

  it('famigliaGiaVista guarda tutte le recenti, e i null non contano', () => {
    expect(famigliaGiaVista('Uova', ['Salmone', 'Uovo'])).toBe(true);
    expect(famigliaGiaVista('Uova', ['Salmone', 'Avena'])).toBe(false);
    expect(famigliaGiaVista('Uova', [])).toBe(false);
    expect(famigliaGiaVista(null, ['Uova'])).toBe(false);
    expect(famigliaGiaVista('Uova', [null, undefined])).toBe(false);
  });
});
