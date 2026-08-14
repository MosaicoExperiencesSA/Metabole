/**
 * IL DIVIETO SU UNA DIETA — i casi che decidono se una persona domani trova il tonno nel piatto.
 *
 * I due test che contano: il divieto è una lista di **parole** e non di ricette (o la ricetta
 * pubblicata domani passa lo stesso), e uno slot che resta a zero **si vede**, perché è il caso in
 * cui la regola non si applica a quella cliente.
 */
import { RULE_CODE_ESCLUSIONI, clientiScoperte, paroleVietate, ricetteVietate, slotScoperti, terminiVietati } from './regola-dieta';

describe('i termini vietati dalle righe di ProductRule', () => {
  it('legge solo le righe giuste e accese', () => {
    expect(
      terminiVietati([
        { ruleCode: RULE_CODE_ESCLUSIONI, enabled: true, params: { termini: ['Tonno', ' salmone '] } },
        { ruleCode: RULE_CODE_ESCLUSIONI, enabled: false, params: { termini: ['pollo'] } },
        { ruleCode: 'menu_select_w_eff', enabled: true, params: { valore: 3 } },
      ]),
    ).toEqual(['tonno', 'salmone']);
  });

  it('⚠️ una riga spenta non vieta niente: spegnere è il modo di togliere senza perdere la traccia', () => {
    expect(terminiVietati([{ ruleCode: RULE_CODE_ESCLUSIONI, enabled: false, params: { termini: ['tonno'] } }])).toEqual([]);
  });

  it('parametri storti non fanno saltare niente', () => {
    expect(terminiVietati([{ ruleCode: RULE_CODE_ESCLUSIONI, enabled: true, params: null }])).toEqual([]);
    expect(terminiVietati([{ ruleCode: RULE_CODE_ESCLUSIONI, enabled: true, params: { termini: 'tonno' } }])).toEqual([]);
  });
});

describe('quali ricette escono dalla dieta', () => {
  const ricette = [
    { id: 'r1', name: 'Tonno alle olive', ingredients: [{ name: 'tonno' }, { name: 'olive' }] },
    { id: 'r2', name: 'Insalata di riso', ingredients: [{ name: 'riso' }, { name: 'tonno' }, { name: 'mais' }] },
    { id: 'r3', name: 'Pollo al limone', ingredients: [{ name: 'pollo' }] },
  ];

  it('⚠️ prende anche il piatto che ha il termine solo fra gli INGREDIENTI', () => {
    // «Insalata di riso» non dice tonno nel nome: se si guardasse solo il nome, il divieto sarebbe
    // una decorazione.
    expect([...ricetteVietate(ricette, ['tonno'])].sort()).toEqual(['r1', 'r2']);
  });

  it('senza termini non vieta niente', () => {
    expect(ricetteVietate(ricette, []).size).toBe(0);
  });

  it('⚠️ il divieto è di PAROLE, non di id: la ricetta pubblicata domani ci ricade dentro', () => {
    const domani = [...ricette, { id: 'r9', name: 'Tramezzino al tonno', ingredients: [] }];
    expect(ricetteVietate(domani, ['tonno']).has('r9')).toBe(true);
  });

  it('il termine si espande come per le clienti', () => {
    expect(paroleVietate(['frutta a guscio'])).toEqual(expect.arrayContaining(['noci', 'mandorle']));
  });
});

describe('chi resta senza un pasto', () => {
  const pool = new Map<string, Set<string>>([
    ['colazione', new Set(['r3'])],
    ['pranzo', new Set(['r1', 'r2'])],
  ]);

  it('⚠️ lo slot che va a zero si vede: è il caso in cui la regola NON si applica a quella cliente', () => {
    expect(slotScoperti(pool, new Set(['r1', 'r2']))).toEqual([{ slot: 'pranzo', rimaste: 0 }]);
  });

  it('uno slot che resta con poco non è scoperto: si racconta, non si blocca', () => {
    expect(slotScoperti(pool, new Set(['r1']))).toEqual([]);
  });

  it('senza divieti non c\'è niente di scoperto', () => {
    expect(slotScoperti(pool, new Set())).toEqual([]);
  });
});

describe('l\'elenco delle clienti scoperte — con nome e cognome (decisione di Simone, 13/8)', () => {
  // Il pool della dieta: a pranzo due piatti (uno col tonno), a cena solo il tonno.
  const POOL = new Map([
    ['lunch', [
      { id: 'r-tonno', name: 'Tonno alle olive', ingredients: [] },
      { id: 'r-pollo', name: 'Pollo ai ferri', ingredients: [] },
    ]],
    ['dinner', [
      { id: 'r-tonno2', name: 'Insalata di tonno', ingredients: [] },
    ]],
  ]);
  const VIETATE = new Set(['r-tonno', 'r-tonno2']);

  it('la cliente il cui pasto resterebbe a zero finisce in elenco, col pasto scoperto', () => {
    const fuori = clientiScoperte(POOL, VIETATE, [
      { userId: 'c1', nome: 'Giulia Rossi', esclusioni: [] },
    ]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].nome).toBe('Giulia Rossi');
    expect(fuori[0].pasti).toEqual(['cena']);
  });

  it('⚠️ chi aveva GIÀ il pasto a zero per le sue esclusioni non è «scoperta dalla regola»', () => {
    // La cena le era già vuota per colpa sua (esclude il tonno da prima): non è la regola nuova ad
    // averla lasciata senza — e metterla in elenco farebbe sembrare la regola più cattiva di com'è.
    const fuori = clientiScoperte(POOL, VIETATE, [
      { userId: 'c2', nome: 'Anna Bianchi', esclusioni: ['tonno'] },
    ]);
    expect(fuori).toHaveLength(0);
  });

  it('chi ha ancora piatti in ogni pasto non compare', () => {
    const soloPranzo = new Map([['lunch', POOL.get('lunch')!]]);
    const fuori = clientiScoperte(soloPranzo, new Set(['r-tonno']), [
      { userId: 'c3', nome: 'Carla Verdi', esclusioni: [] },
    ]);
    expect(fuori).toHaveLength(0);
  });

  it('senza ricette vietate l\'elenco è vuoto e non si calcola niente', () => {
    expect(clientiScoperte(POOL, new Set(), [{ userId: 'c1', nome: 'G', esclusioni: [] }])).toEqual([]);
  });
});
