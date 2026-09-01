import { ePesce } from '../catalog/piatto-di-cosa';

/**
 * ⛔ I FUNGHI OSTRICA NON SONO OSTRICHE — 1/9.
 *
 * Trovato leggendo i 549 nomi di `regime:contenuto`: «Polenta Morbida ai Funghi Misti con Spinaci
 * Freschi e Noci Tostate» stava per essere riscritta **pescetariana**, perché fra gli ingredienti
 * c'era «funghi misti freschi (champignon, ostriche)».
 *
 * ⚠️ E il danno non è solo l'etichetta: a una cliente allergica ai **molluschi** quella parola fa
 * sparire dal menu i piatti di funghi — cioè quello che può mangiare tranquillamente.
 *
 * ⛔ **Questa correzione NON copre il caso che l'ha fatta nascere, e la prova lo dice.** Là
 * «ostriche» sta da sola dentro una parentesi, lontana da «funghi»: le frasi qui funzionano per
 * adiacenza, e allargarle a tutto il testo vorrebbe dire che un piatto con dei funghi accanto
 * smette di dichiarare le vongole — un falso negativo su un'allergia. Quella ricetta si corregge
 * a mano, e questa prova esiste perché nessuno creda il contrario.
 */
describe('funghi ostrica', () => {
  it.each([
    ['Vellutata di funghi ostrica e timo'],
    ['Polenta con funghi ostriche trifolati'],
    ['Fungo ostrica alla piastra'],
  ])('⛔ non è un mollusco: %s', (t) => {
    expect(ePesce(t)).toBe(false);
  });

  it.each([
    ['Ostriche crude al limone'],
    ['Insalata di ostriche e finocchi'],
    ['Spaghetti con cozze e vongole'],
  ])('⚠️ ma il mollusco vero resta: %s', (t) => {
    expect(ePesce(t)).toBe(true);
  });

  /**
   * ⛔ **IL CASO VERO DELLA PRODUZIONE RESTA SCOPERTO**, ed è voluto: la parola sta in una
   * parentesi lontana da «funghi». Chiudere anche questo vorrebbe dire guardare tutto il testo, e
   * allora un piatto di vongole con contorno di funghi smetterebbe di dichiarare le vongole.
   */
  it('⚠️ e il caso della parentesi NON si chiude: si corregge a mano, per scelta', () => {
    expect(ePesce('funghi misti freschi (champignon, ostriche)')).toBe(true);
  });
});
