import { aggregaSpesa, conservaSpuntati, stessaLista, type VoceSpesa } from './lista-della-spesa';

const ing = (name: string, qty?: number, unit?: string) => ({ name, qty, unit });

describe('aggregaSpesa — quello che finisce nel carrello', () => {
  const ricette = new Map([
    ['r-pranzo', [ing('Farro', 80, 'g'), ing('Ceci', 100, 'g')]],
    ['r-cena', [ing('farro', 40, 'g'), ing('Uova', 2, 'pz')]],
  ]);

  it('somma per nome e unità, senza badare alle maiuscole', () => {
    const voci = aggregaSpesa(
      [{ meals: [{ slot: 'lunch', recipeId: 'r-pranzo' }, { slot: 'dinner', recipeId: 'r-cena' }] }],
      ricette,
    );
    expect(voci).toEqual([
      { name: 'Farro', qty: 120, unit: 'g', checked: false },
      { name: 'Ceci', qty: 100, unit: 'g', checked: false },
      { name: 'Uova', qty: 2, unit: 'pz', checked: false },
    ]);
  });

  /**
   * ⚠️ Il fattore è quello del PASTO e non della giornata: dentro lo stesso giorno la colazione può
   * essere al suo tetto (×1,6) e il pranzo no. Un fattore per giornata comprerebbe la spesa
   * sbagliata su tutti e due i piatti.
   */
  it('⚠️ il moltiplicatore di porzione è per pasto', () => {
    const voci = aggregaSpesa(
      [{ meals: [{ slot: 'lunch', recipeId: 'r-pranzo', porzione: 1.8 }, { slot: 'dinner', recipeId: 'r-cena' }] }],
      ricette,
    );
    // 80 × 1,8 = 144, più i 40 della cena che non è scalata.
    expect(voci.find((v) => v.name === 'Farro')?.qty).toBe(184);
    expect(voci.find((v) => v.name === 'Uova')?.qty).toBe(2);
  });

  it('⚠️ «q.b.» resta senza quantità e non diventa zero, e non azzera la somma degli altri', () => {
    const voci = aggregaSpesa(
      [{ meals: [{ slot: 'lunch', recipeId: 'a' }, { slot: 'dinner', recipeId: 'b' }] }],
      new Map([
        ['a', [ing('Sale'), ing('Farro', 80, 'g')]],
        ['b', [ing('Sale'), ing('Farro', 20, 'g')]],
      ]),
    );
    expect(voci).toEqual([
      { name: 'Sale', qty: null, unit: null, checked: false },
      { name: 'Farro', qty: 100, unit: 'g', checked: false },
    ]);
  });

  /**
   * ⚠️ E VALE IN TUTTI E DUE GLI ORDINI (revisione del 18/8 sera). Prima la somma partiva `null` se
   * la riga senza quantità arrivava per prima, e da lì non si muoveva più: «q.b. di farro il lunedì»
   * cancellava i 100 g del martedì. L'ordine dei giorni non deve decidere cosa compare nella lista.
   */
  it('⚠️ la riga senza quantità non azzera la somma NEMMENO se arriva per prima', () => {
    const ricette = new Map([
      ['senza', [ing('Farro')]],
      ['con', [ing('Farro', 100)]],
    ]);
    const primaSenza = aggregaSpesa([{ meals: [{ slot: 'lunch', recipeId: 'senza' }, { slot: 'dinner', recipeId: 'con' }] }], ricette);
    const primaCon = aggregaSpesa([{ meals: [{ slot: 'dinner', recipeId: 'con' }, { slot: 'lunch', recipeId: 'senza' }] }], ricette);
    expect(primaSenza[0].qty).toBe(100);
    expect(primaCon[0].qty).toBe(100);
  });

  it('la ricetta che non c\'è più e la giornata illeggibile non fanno cadere la lista', () => {
    const voci = aggregaSpesa(
      [{ meals: [{ slot: 'lunch', recipeId: 'sparita' }] }, { meals: null }, { meals: [{ slot: 'dinner', recipeId: 'r-cena' }] }],
      ricette,
    );
    expect(voci.map((v) => v.name)).toEqual(['farro', 'Uova']);
  });
});

describe('conservaSpuntati — l\'unica cosa che il server non sa rifare', () => {
  const calcolate: VoceSpesa[] = [
    { name: 'Farro', qty: 144, unit: 'g', checked: false },
    { name: 'Uova', qty: 2, unit: 'pz', checked: false },
  ];

  it('la spunta torna sulla riga giusta anche se la quantità è cambiata', () => {
    const unite = conservaSpuntati(calcolate, [{ name: 'farro', qty: 80, unit: 'g', checked: true }]);
    expect(unite[0]).toEqual({ name: 'Farro', qty: 144, unit: 'g', checked: true });
    expect(unite[1].checked).toBe(false);
  });

  /**
   * ⚠️ La quantità NON si conserva: se il piatto è cresciuto, i 120 g diventano 216 anche su una
   * riga già spuntata. Chi ha già comprato lo vede e decide; tenere il numero vecchio perché «tanto
   * l'ha già presa» vorrebbe dire nasconderle che ora gliene serve di più.
   */
  it('⚠️ si conserva la spunta, non la quantità', () => {
    const unite = conservaSpuntati(calcolate, [{ name: 'Farro', qty: 80, unit: 'g', checked: true }]);
    expect(unite[0].qty).toBe(144);
  });

  it('la voce sparita se ne va con la sua spunta, e una lista illeggibile non spunta niente', () => {
    const unite = conservaSpuntati(calcolate, [{ name: 'Zucchine', qty: 100, unit: 'g', checked: true }]);
    expect(unite.every((v) => !v.checked)).toBe(true);
    expect(conservaSpuntati(calcolate, undefined)).toBe(calcolate);
  });
});

describe('stessaLista — per non scrivere quando non è successo niente', () => {
  const a: VoceSpesa[] = [
    { name: 'Farro', qty: 144, unit: 'g', checked: true },
    { name: 'Uova', qty: 2, unit: 'pz', checked: false },
  ];

  it('⚠️ l\'ordine non conta: un giorno rigenerato con gli stessi piatti non è una lista diversa', () => {
    expect(stessaLista(a, [a[1], a[0]])).toBe(true);
  });

  it('una quantità diversa, una spunta diversa o una voce in più sono liste diverse', () => {
    expect(stessaLista(a, [{ ...a[0], qty: 80 }, a[1]])).toBe(false);
    expect(stessaLista(a, [{ ...a[0], checked: false }, a[1]])).toBe(false);
    expect(stessaLista(a, [a[0]])).toBe(false);
    expect(stessaLista(a, [a[0], a[1], { name: 'Sale', qty: null, unit: null, checked: false }])).toBe(false);
    expect(stessaLista(a, null)).toBe(false);
  });

  it('due righe con lo stesso nome e unità diverse non si confondono fra loro', () => {
    const b: VoceSpesa[] = [
      { name: 'Latte', qty: 200, unit: 'ml', checked: false },
      { name: 'Latte', qty: 1, unit: 'pz', checked: true },
    ];
    expect(stessaLista(b, [b[1], b[0]])).toBe(true);
    expect(stessaLista(b, [b[0], { ...b[1], checked: false }])).toBe(false);
  });
});
