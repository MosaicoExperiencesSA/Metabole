import { calcolaMacro, inGrammi, raccontaMacro, ValorePer100 } from './macro-da-ingredienti';

const V = (name: string, kcal: number | null, protein = 0, carbs = 0, fat = 0): ValorePer100 => ({
  name, kcal, protein, carbs, fat,
});

const TABELLA = new Map<string, ValorePer100 | null>([
  ['tonno', V('tonno', 116, 25, 0, 1)],
  ['olio evo', V('olio', 884, 0, 0, 100)],
]);

describe('inGrammi', () => {
  it('grammi, chili e la riga senza unità', () => {
    expect(inGrammi(120, 'g')).toBe(120);
    expect(inGrammi(1.5, 'kg')).toBe(1500);
    expect(inGrammi(120, null)).toBe(120);
  });

  it('⚠️ i volumi passano con densità 1, e non si corregge per alimento', () => {
    // Vero per l'acqua, generoso dell'8-9% per l'olio. Si accetta perché è la convenzione delle
    // tabelle: una tabella di densità scritta a mano qui sarebbe un secondo posto dove i numeri
    // divergono da NutrientFact.
    expect(inGrammi(200, 'ml')).toBe(200);
    expect(inGrammi(1, 'l')).toBe(1000);
  });

  it('quello che non è un peso non diventa un peso', () => {
    expect(inGrammi(2, 'cucchiai')).toBeNull();
    expect(inGrammi(null, 'q.b.')).toBeNull();
    expect(inGrammi(0, 'g')).toBeNull();
  });
});

describe('calcolaMacro', () => {
  it('somma in proporzione ai 100 g della tabella', () => {
    const m = calcolaMacro([{ name: 'tonno', qty: 200, unit: 'g' }], TABELLA);
    expect(m.kcal).toBe(232);
    expect(m.macros.protein_g).toBe(50);
    expect(m.mancanti).toEqual([]);
  });

  it('⚠️ un alimento fuori tabella NON si stima: si elenca', () => {
    // Senza i valori veri, l'unico modo di riempire `Recipe.kcal` sarebbe indovinarlo — e questi
    // numeri non restano fermi: il motore ci calcola sopra la quota proteica delle giornate.
    const m = calcolaMacro([{ name: 'tonno', qty: 100, unit: 'g' }, { name: 'tempeh', qty: 80, unit: 'g' }], TABELLA);
    expect(m.mancanti).toEqual(['tempeh']);
    // Il conto parziale resta, ma chi chiama non deve usarlo finché `mancanti` non è vuoto.
    expect(m.kcal).toBe(116);
  });

  it('⚠️ in tabella ma senza kcal conta come mancante', () => {
    // Una riga a metà darebbe un totale più basso del vero, ed è il tipo di errore che nessuno nota
    // guardando il numero.
    const m = calcolaMacro([{ name: 'x', qty: 100, unit: 'g' }], new Map([['x', V('x', null, 3)]]));
    expect(m.mancanti).toEqual(['x']);
    expect(m.kcal).toBe(0);
  });

  it('quello che non ha un peso non si conta, e si dice', () => {
    const m = calcolaMacro([{ name: 'tonno', qty: 100, unit: 'g' }, { name: 'sale', qty: null, unit: 'q.b.' }], TABELLA);
    expect(m.nonContati).toEqual(['sale']);
    expect(m.mancanti).toEqual([]);
    expect(m.kcal).toBe(116);
  });

  it('segnala di aver contato i millilitri come grammi', () => {
    const m = calcolaMacro([{ name: 'olio evo', qty: 10, unit: 'ml' }], TABELLA);
    expect(m.contieneVolumi).toBe(true);
    expect(m.kcal).toBe(88);
  });

  it('lo stesso alimento mancante due volte è una segnalazione sola', () => {
    const m = calcolaMacro(
      [{ name: 'tempeh', qty: 50, unit: 'g' }, { name: 'tempeh', qty: 30, unit: 'g' }],
      TABELLA,
    );
    expect(m.mancanti).toEqual(['tempeh']);
  });
});

describe('raccontaMacro', () => {
  it('dice i numeri, e dice le approssimazioni', () => {
    const m = calcolaMacro(
      [{ name: 'olio evo', qty: 10, unit: 'ml' }, { name: 'sale', qty: null, unit: 'q.b.' }],
      TABELLA,
    );
    const testo = raccontaMacro(m);
    expect(testo).toContain('88 kcal');
    expect(testo).toContain('millilitri');
    expect(testo).toContain('Non ho contato sale');
  });

  it('senza approssimazioni resta una riga sola', () => {
    const testo = raccontaMacro(calcolaMacro([{ name: 'tonno', qty: 100, unit: 'g' }], TABELLA));
    expect(testo).not.toContain('millilitri');
    expect(testo).not.toContain('Non ho contato');
  });
});
