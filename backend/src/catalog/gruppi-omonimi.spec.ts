import { alimenti, chiaveNome, famiglieDiOmonimi, type Gruppo } from './gruppi-omonimi';

const g = (p: Partial<Gruppo> & { id: string; name: string }): Gruppo => ({
  productId: null, status: 'approved', members: { items: [] }, createdAt: new Date('2026-01-01'), ...p,
});

describe('chiaveNome — quando due nomi sono lo stesso nome', () => {
  it('non guarda maiuscole, accenti e spazi ai bordi', () => {
    expect(chiaveNome('  Bevande Vegetali ')).toBe(chiaveNome('bevande vegetali'));
    expect(chiaveNome('Purè di patate')).toBe(chiaveNome('pure di patate'));
  });

  /** ⚠️ Un tasto premuto due volte non deve creare un gruppo a parte. */
  it('⚠️ e collassa gli spazi interni', () => {
    expect(chiaveNome('Bevande  vegetali')).toBe(chiaveNome('Bevande vegetali'));
  });

  /**
   * ⛔ **E si ferma lì.** «Bevande vegetali» e «Bevande vegetali non zuccherate» sono **due gruppi
   * diversi**: il secondo esiste apposta. Una normalizzazione che togliesse le parole di servizio
   * li unirebbe, e le clienti che non possono avere zuccheri aggiunti riceverebbero le bevande
   * zuccherate come equivalenti.
   */
  it('⛔ «non zuccherate» resta un gruppo diverso', () => {
    expect(chiaveNome('Bevande vegetali')).not.toBe(chiaveNome('Bevande vegetali non zuccherate'));
  });
});

describe('alimenti', () => {
  it('legge gli items, senza vuoti né doppioni', () => {
    expect(alimenti({ items: ['latte di soia', ' latte di soia ', '', 'latte di avena'] }))
      .toEqual(['latte di soia', 'latte di avena']);
  });

  it('⚠️ e su un members storto non esplode', () => {
    expect(alimenti(null)).toEqual([]);
    expect(alimenti({ items: 'latte di soia' })).toEqual([]);
    expect(alimenti({})).toEqual([]);
  });
});

describe('famiglieDiOmonimi', () => {
  it('un nome che compare una volta sola non è una famiglia', () => {
    expect(famiglieDiOmonimi([g({ id: '1', name: 'Pesci bianchi' })])).toEqual([]);
  });

  /** ⚠️ Il caso di Simone: sei «Bevande vegetali», stesso ambito e stesso stato. */
  it('⚠️ omonimi con stesso ambito e stesso stato: unione sicura', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Bevande vegetali', members: { items: ['latte di soia', 'latte di avena'] } }),
      g({ id: '2', name: 'bevande  vegetali', members: { items: ['latte di soia', 'latte di riso'] } }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0].verdetto).toBe('sicura');
    expect(f[0].alimentiUniti).toEqual(['latte di soia', 'latte di avena', 'latte di riso']);
    expect(f[0].aggiunti).toBe(1);
  });

  /**
   * ⛔ **Ambiti diversi = non è pulizia, è nutrizione.** Un gruppo con `productId` è **di una
   * dieta**: unirlo a quello di un'altra rende gli alimenti dell'una equivalenti anche nell'altra.
   */
  it('⛔ omonimi di diete diverse: da guardare, non sicura', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Bevande vegetali', productId: 'dieta-A' }),
      g({ id: '2', name: 'Bevande vegetali', productId: 'dieta-B' }),
    ]);
    expect(f[0].verdetto).toBe('da guardare');
    expect(f[0].motivi.join(' ')).toMatch(/ambiti diversi/);
  });

  it('⛔ e un globale insieme a uno di prodotto è ambiti diversi lo stesso', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Bevande vegetali', productId: null }),
      g({ id: '2', name: 'Bevande vegetali', productId: 'dieta-A' }),
    ]);
    expect(f[0].verdetto).toBe('da guardare');
  });

  /** ⛔ Unire una bozza dentro un approvato fa entrare nel motore roba che nessuno ha validato. */
  it('⛔ una bozza insieme a un approvato è da guardare', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Pesci bianchi', status: 'approved' }),
      g({ id: '2', name: 'Pesci bianchi', status: 'draft' }),
    ]);
    expect(f[0].verdetto).toBe('da guardare');
    expect(f[0].motivi.join(' ')).toMatch(/stati diversi/);
  });

  /**
   * ⛔ **I pesi dei grassi.** Due elenchi diversi non si uniscono scegliendone uno: quel numero
   * finisce nei grammi che una persona si mette nel piatto.
   */
  it('⛔ due gruppi con pesi diversi sono da guardare', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Grassi', members: { items: ['olio'], fattori: { olio: 1 } } }),
      g({ id: '2', name: 'Grassi', members: { items: ['burro'], fattori: { burro: 2 } } }),
    ]);
    expect(f[0].verdetto).toBe('da guardare');
    expect(f[0].motivi.join(' ')).toMatch(/pesi dei grassi/);
  });

  it('⚠️ ma se i pesi ce li ha uno solo, non è un conflitto', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'Grassi', members: { items: ['olio'], fattori: { olio: 1 } } }),
      g({ id: '2', name: 'Grassi', members: { items: ['burro'] } }),
    ]);
    expect(f[0].verdetto).toBe('sicura');
  });

  /**
   * ⛔ **Il capofila è il PIÙ VECCHIO, e non è un dettaglio**: `sostituzione-chat` cerca il gruppo
   * per nome fra gli approvati ordinati per `createdAt` e prende il primo. Quello è il gruppo che
   * oggi vince, e l'unione deve arricchire lui — se no si sposta il comportamento invece di
   * ripararlo.
   */
  it('⛔ il capofila è il gruppo più vecchio', () => {
    const f = famiglieDiOmonimi([
      g({ id: 'nuovo', name: 'Bevande vegetali', createdAt: new Date('2026-06-01'), members: { items: ['b'] } }),
      g({ id: 'vecchio', name: 'Bevande vegetali', createdAt: new Date('2026-01-01'), members: { items: ['a'] } }),
    ]);
    expect(f[0].gruppi[0].id).toBe('vecchio');
    expect(f[0].alimentiUniti).toEqual(['a', 'b']);
  });

  it('⚠️ e le famiglie escono dalla più numerosa', () => {
    const f = famiglieDiOmonimi([
      g({ id: '1', name: 'A' }), g({ id: '2', name: 'A' }),
      g({ id: '3', name: 'B' }), g({ id: '4', name: 'B' }), g({ id: '5', name: 'B' }),
    ]);
    expect(f.map((x) => x.nome)).toEqual(['B', 'A']);
  });
});
