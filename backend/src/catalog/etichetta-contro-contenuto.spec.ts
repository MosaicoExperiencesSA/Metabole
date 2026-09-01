import { classifica, regimeGiusto, sembraUnImitazione } from './etichetta-contro-contenuto';

/**
 * ⛔ IL GIUDIZIO DI `regime:contenuto`, provato PRIMA che riscriva il catalogo.
 *
 * Con `APPLICA=1` quello script cambia `Recipe.regime` in blocco — 549 ricette al primo giro. Il
 * 1/9 il suo mucchio «sicuro» conteneva due errori nelle prime trenta righe, e li ha visti una
 * persona leggendo l'output: non una prova, perché il giudizio stava dentro lo script.
 */
describe('classifica', () => {
  it('pesce fra gli ingredienti → sicura, e va a pescetariano', () => {
    const e = classifica('Salmone al forno con asparagi', ['filetto di salmone', 'asparagi']);
    expect(e).toEqual({ tipo: 'sicura', cosa: 'pesce', prova: 'filetto di salmone', regimeGiusto: 'pescetarian' });
  });

  it('carne fra gli ingredienti → sicura, e va a onnivoro', () => {
    const e = classifica('Tacchino ai funghi', ['petto di tacchino', 'funghi']);
    expect(e).toEqual({ tipo: 'sicura', cosa: 'carne', prova: 'petto di tacchino', regimeGiusto: 'omnivore' });
  });

  it('⚠️ la carne vince sul pesce: «mare e monti» esiste', () => {
    const e = classifica('Risotto mare e monti', ['gamberi', 'salsiccia']);
    expect(e).toMatchObject({ tipo: 'sicura', cosa: 'carne' });
  });

  /** ⛔ I DUE FALSI POSITIVI VERI, presi dalla produzione dell'1/9. */
  it('⛔ «Carota tagliata sottile» non rende onnivoro un Buddha Bowl di lenticchie', () => {
    const e = classifica('Buddha Bowl di Lenticchie Nere e Germogli su Base di Quinoa',
      ['Lenticchie nere', 'Carota tagliata sottile', 'Quinoa']);
    expect(e).toEqual({ tipo: 'ok' });
  });

  it('⛔ la «ricciolina» è una cicoria, non una ricciola', () => {
    const e = classifica('Torta di Riso Integrale Salata con Ricotta e Cicoria Amara',
      ['riso integrale', 'ricotta', 'cicoria amara cruda (ricciolina)']);
    expect(e).toEqual({ tipo: 'ok' });
  });

  /** ⛔ LE IMITAZIONI: nei dubbi, in tutti e due i versi. */
  it.each([
    ['Insalata di melone, feta e prosciutto di tofu affumicato', ['prosciutto di tofu affumicato', 'melone']],
    ['Lenticchie Nere con Petto d\'Anatra di Tofu', ['petto d\'anatra di tofu affumicato', 'lenticchie']],
    ['Crostoni con hummus e acciughe vegetali', ['acciughe vegetali', 'ceci']],
  ])('⛔ «%s» non si corregge a macchina: sembra un\'imitazione', (nome, ing) => {
    const e = classifica(nome, ing);
    expect(e.tipo).toBe('dubbia');
    if (e.tipo === 'dubbia') expect(e.perche).toContain('imitazione');
  });

  /**
   * ⛔ E l'imitazione **non decide al contrario**: «Prosciutto con contorno vegetale» è prosciutto
   * vero. Finisce nei dubbi, non fra le corrette — ma soprattutto NON resta dichiarato vegetariano
   * senza che nessuno lo guardi.
   */
  it('⛔ «Prosciutto con contorno vegetale» finisce nei dubbi, non fra le ok', () => {
    const e = classifica('Prosciutto con contorno vegetale', ['prosciutto crudo', 'verdure grigliate']);
    expect(e.tipo).toBe('dubbia');
  });

  it('⚠️ un pesce nominato solo nel titolo è dubbio: può mancare l\'ingrediente in elenco', () => {
    const e = classifica('Branzino al forno con verdure rosse e limone', ['verdure rosse', 'limone']);
    expect(e).toMatchObject({ tipo: 'dubbia', cosa: 'pesce', perche: 'solo nel nome' });
  });

  it('⚠️ e un piatto vegetale che si chiama come un pesce è dubbio anche lui, non corretto', () => {
    const e = classifica("Polpo d'Alghe Nori Farcito", ['alga nori', 'riso integrale']);
    expect(e.tipo).toBe('dubbia');
  });

  it('una ricetta davvero vegetale non risulta niente', () => {
    expect(classifica('Pasta al pomodoro', ['pasta integrale', 'pomodoro', 'basilico'])).toEqual({ tipo: 'ok' });
  });

  it('regimeGiusto: il più stretto che può mangiarlo', () => {
    expect(regimeGiusto('pesce')).toBe('pescetarian');
    expect(regimeGiusto('carne')).toBe('omnivore');
  });

  it('sembraUnImitazione rende la parola trovata, o null', () => {
    expect(sembraUnImitazione('ragù vegetale')).toBe('vegetale');
    expect(sembraUnImitazione('ragù di manzo')).toBeNull();
  });
});
