import { contaVeganiCheChiedono } from './vegani-che-chiedono';

describe('contaVeganiCheChiedono', () => {
  const CATALOGO = [
    { id: '1', name: 'Frittata di zucchine', ingredients: [{ name: 'uova' }, { name: 'zucchine' }] },
    { id: '2', name: 'Pasta al pesto', ingredients: [{ name: 'basilico' }, { name: 'parmigiano reggiano' }] },
    { id: '3', name: 'Cannelloni vegani', ingredients: [{ name: 'ricotta di mandorla' }] },
    { id: '4', name: 'Omelette dolce', ingredients: [{ name: 'uova' }, { name: 'zucchero' }] },
    // ⚠️ Anche la carne chiede: la domanda è «chiede conferma», e la carne la fa la porta di prima.
    { id: '5', name: 'Insalata di pollo', ingredients: [{ name: 'petto di pollo' }] },
  ];

  it('⛔ conta chi chiede, e raggruppa per ingrediente dalla più frequente', () => {
    const c = contaVeganiCheChiedono(CATALOGO);
    expect(c.esaminate).toBe(5);
    expect(c.chiedono).toBe(4);
    expect(c.parole[0]).toEqual({ ingrediente: 'uova', ricette: 2, esempi: ['Frittata di zucchine', 'Omelette dolce'] });
    expect(c.parole.map((p) => p.ingrediente)).toEqual(['uova', 'parmigiano reggiano', 'petto di pollo']);
  });

  /** ⛔ La riga che decide: il derivato vegetale NON compare. Se compare, la regola di forma è rotta. */
  it('⛔ «ricotta di mandorla» non è fra le parole che chiedono', () => {
    expect(contaVeganiCheChiedono(CATALOGO).parole.some((p) => p.ingrediente.includes('mandorla'))).toBe(false);
  });
});
