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

/**
 * ⚠️ QUELLO CHE NON SI CONTA VA DETTO — 18/8.
 *
 * `mancanti` esisteva dal primo giorno, con un commento sopra il calcolo che spiegava perché
 * conta («un totale più basso del vero è esattamente il tipo di errore che nessuno nota guardando
 * il numero») — e poi il racconto se ne dimenticava. Chi dettava una ricetta con dentro un alimento
 * fuori tabella leggeva un totale kcal più basso del vero, e niente glielo diceva.
 */
describe('⚠️ raccontaMacro dice quello che NON ha contato', () => {
  const ing = (name: string, qty: number | null = 100, unit: string | null = 'g') => ({ name, qty, unit });
  const val = (name: string, kcal: number): ValorePer100 => ({ name, kcal, protein: 5, carbs: 10, fat: 2 });

  it('⚠️ un alimento fuori tabella: lo dice, e dice che il totale è più basso del vero', () => {
    const m = calcolaMacro(
      [ing('pane'), ing('marmellata di sambuco')],
      new Map<string, ValorePer100 | null>([['pane', val('pane', 270)], ['marmellata di sambuco', null]]),
    );
    expect(m.mancanti).toEqual(['marmellata di sambuco']);
    const testo = raccontaMacro(m);
    expect(testo).toContain('Non ho i valori di marmellata di sambuco');
    expect(testo).toContain('più basso del vero');
  });

  /**
   * ⚠️ «Non ce l'ho» e «ce l'ho due volte» sono due problemi diversi e portano a due azioni
   * diverse: il primo si risolve aggiungendo una riga alla tabella, il secondo dicendo se lo pesa
   * crudo o cotto. Metterli nello stesso messaggio manderebbe la nutrizionista a fare la cosa
   * sbagliata.
   */
  it('⚠️ un alimento ambiguo NON è un alimento mancante: due messaggi diversi', () => {
    const m = calcolaMacro(
      [ing('farro'), ing('olio', 10)],
      new Map<string, ValorePer100 | null>([['farro', val('farro', 353)], ['olio', val('olio', 899)]]),
      ['farro'],
    );
    expect(m.ambigui).toEqual(['farro']);
    expect(m.mancanti).toEqual([]);
    // ⚠️ E non è entrato nel conto: 10 g di olio soltanto.
    expect(m.kcal).toBe(90);
    const testo = raccontaMacro(m);
    expect(testo).toContain('in più stati (crudo e cotto)');
    expect(testo).toContain('quasi tre volte');
    expect(testo).toContain('Dimmi come li pesa');
  });

  it('quando è tutto in tabella non dice niente in più: un avviso che compare sempre non è un avviso', () => {
    const m = calcolaMacro([ing('pane')], new Map<string, ValorePer100 | null>([['pane', val('pane', 270)]]));
    const testo = raccontaMacro(m);
    expect(testo).not.toContain('Non ho i valori');
    expect(testo).not.toContain('più stati');
  });
});
