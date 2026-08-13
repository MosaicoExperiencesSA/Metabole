import { cosaManca, leggiRicetta } from './ricetta-dettata';

describe('leggiRicetta', () => {
  it('legge la forma vera: nome sopra, ingredienti sotto', () => {
    const r = leggiRicetta('Tonno alle olive\ntonno 120 g\nolive nere 30 g\npranzo, onnivora');
    expect(r.nome).toBe('Tonno alle olive');
    expect(r.ingredienti).toEqual([
      { name: 'tonno', qty: 120, unit: 'g', riga: 'tonno 120 g' },
      { name: 'olive nere', qty: 30, unit: 'g', riga: 'olive nere 30 g' },
    ]);
    expect(r.slot).toBe('lunch');
    expect(r.regime).toBe('omnivore');
  });

  it('⚠️ legge anche la quantità scritta prima: le ricette vere usano tutte e due le forme', () => {
    // Riconoscerne una sola vorrebbe dire scartare metà di quello che scrive una persona, e la
    // parte scartata sarebbe silenziosa.
    const r = leggiRicetta('Insalata\n120 g di ceci\n- 30 g olio evo');
    expect(r.ingredienti.map((i) => i.name)).toEqual(['ceci', 'olio evo']);
    expect(r.ingredienti.map((i) => i.qty)).toEqual([120, 30]);
  });

  it('i decimali con la virgola sono numeri', () => {
    expect(leggiRicetta('X\nolio 12,5 g').ingredienti[0].qty).toBe(12.5);
  });

  it('⚠️ «keto» è uno STILE, non un regime', () => {
    // `Recipe.regime` dice chi può mangiare il piatto (onnivora/vegetariana/vegana). Scambiarli
    // vorrebbe dire pubblicare una ricetta con la carne dentro un regime vegetariano — l'errore che
    // nessuna schermata riprende, perché il campo È compilato.
    const r = leggiRicetta('Uova e avocado\nuova 100 g\ncolazione keto, vegetariana');
    expect(r.tags).toEqual(['keto']);
    expect(r.regime).toBe('vegetarian');
    expect(r.slot).toBe('breakfast');
  });

  it('«vegana» non viene letta come «vegetariana»', () => {
    expect(leggiRicetta('X\ntofu 100 g\ncena vegana').regime).toBe('vegan');
  });

  it('⚠️ una riga senza quantità NON diventa un ingrediente da zero grammi', () => {
    // Nella ricetta comparirebbe una riga che nessuno ha scritto, con un peso che nessuno ha detto.
    const r = leggiRicetta('Pasta al pomodoro\nquesta la faccio spesso\npasta 80 g');
    expect(r.ingredienti.map((i) => i.name)).toEqual(['pasta']);
  });

  it('«sale q.b.» resta un ingrediente, ma senza peso', () => {
    const r = leggiRicetta('Pasta\npasta 80 g\n- sale q.b.');
    expect(r.ingredienti[1]).toMatchObject({ name: 'sale', qty: null, unit: 'q.b.' });
  });

  it('il nome non se lo inventa: se c’è solo l’elenco, resta vuoto', () => {
    const r = leggiRicetta('- pasta 80 g\n- olio 10 g');
    expect(r.nome).toBeNull();
  });

  it('una riga che è solo il pasto non diventa il nome del piatto', () => {
    expect(leggiRicetta('pranzo\npasta 80 g').nome).toBeNull();
  });
});

describe('cosaManca', () => {
  it('elenca quello che serve per poterla scrivere', () => {
    expect(cosaManca(leggiRicetta('pasta 80 g'))).toEqual([
      'il nome del piatto',
      'per quale pasto (colazione, spuntino, pranzo, merenda, cena)',
      'se è onnivora, vegetariana o vegana',
    ]);
  });

  it('completa non manca niente', () => {
    expect(cosaManca(leggiRicetta('Tonno alle olive\ntonno 120 g\ncena onnivora'))).toEqual([]);
  });

  it('⚠️ senza ingredienti non si va avanti, nemmeno col nome giusto', () => {
    // Una ricetta senza ingredienti non è una bozza incompleta: è un titolo, e finirebbe in
    // catalogo come una cosa che sembra un piatto.
    expect(cosaManca(leggiRicetta('Tonno alle olive\npranzo onnivora'))).toContain(
      'gli ingredienti, uno per riga con la quantità',
    );
  });
});
