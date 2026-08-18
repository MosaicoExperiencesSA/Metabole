import { ingredientiScalati, pastoDelGiorno, porzioneDelGiorno } from './porzione-del-giorno';
import { PORZIONE_DA_DIRE } from './porzione-scalata';

/** Una giornata come sta in `MenuDay.meals`. */
const giornata = [
  { slot: 'breakfast', recipeId: 'r-colazione', name: 'Porridge', kcal: 480, kcalBase: 300, porzione: 1.6 },
  { slot: 'lunch', recipeId: 'r-pranzo', name: 'Farro e ceci', kcal: 891, kcalBase: 495, porzione: 1.8 },
  { slot: 'dinner', recipeId: 'r-cena', name: 'Frittata', kcal: 500 },
];

describe('porzioneDelGiorno — il fattore si rilegge dallo snapshot, non si chiede al telefono', () => {
  it('col giorno e lo slot torna il fattore e le due kcal', () => {
    expect(porzioneDelGiorno(giornata, 'r-pranzo', 'lunch')).toEqual({
      fattore: 1.8,
      kcal: 891,
      kcalBase: 495,
    });
  });

  it('senza slot basta la ricetta: dalla home si apre con ?ricetta=&giorno= e lo slot non c\'è', () => {
    expect(porzioneDelGiorno(giornata, 'r-colazione')?.fattore).toBe(1.6);
  });

  /**
   * ⚠️ Il piatto senza moltiplicatore non ha niente da dire: la scheda deve restare quella di
   * catalogo. Un «×1» scritto sotto una ricetta è rumore che si impara a saltare, e il giorno che
   * il numero conta davvero non lo legge più nessuno.
   */
  it('il piatto NON scalato non dice niente, e nemmeno uno scarto che nessuno peserebbe', () => {
    expect(porzioneDelGiorno(giornata, 'r-cena', 'dinner')).toBeNull();
    expect(porzioneDelGiorno([{ slot: 'lunch', recipeId: 'r', name: 'x', kcal: 10, porzione: 1 }], 'r')).toBeNull();
    expect(porzioneDelGiorno([{ slot: 'lunch', recipeId: 'r', name: 'x', kcal: 10, porzione: 1.03 }], 'r')).toBeNull();
  });

  /**
   * ⚠️ IL NUMERO È LO STESSO DI `testoPorzione` NELL'APP (`app/src/lib/meals.ts`), e i due devono
   * restare uguali: sotto la soglia il menu non dice niente, e una scheda che intanto mostrasse
   * grammature diverse da quelle di catalogo farebbe cambiare gli ingredienti senza spiegazione.
   * Il gemello di questo test sta di là.
   */
  it('⚠️ la soglia è quella della riga nel menu: 1,05', () => {
    expect(PORZIONE_DA_DIRE).toBe(1.05);
    const con = (porzione: number) => porzioneDelGiorno([{ slot: 'lunch', recipeId: 'r', name: 'x', kcal: 10, porzione }], 'r');
    expect(con(1.05)).toBeNull();
    expect(con(1.06)?.fattore).toBe(1.06);
  });

  /**
   * ⚠️ IL CASO CHE VALE IL MODULO. Lo stesso piatto in due pasti dello stesso giorno con due
   * fattori diversi — succede davvero, perché il tetto dello spuntino (×1,25) è più basso di
   * quello dei pasti principali (×1,8). Senza lo slot non si può scegliere: `null`, cioè «non lo
   * so», e la scheda torna quella di catalogo. Sceglierne uno a caso vorrebbe dire scrivere una
   * grammatura sbagliata sotto il nome di un piatto vero.
   */
  it('⚠️ stesso piatto in due pasti con fattori diversi e senza slot: non si indovina', () => {
    const doppio = [
      { slot: 'snack_am', recipeId: 'r-frutta', name: 'Mela', kcal: 100, porzione: 1.25 },
      { slot: 'snack_pm', recipeId: 'r-frutta', name: 'Mela', kcal: 144, porzione: 1.8 },
    ];
    expect(porzioneDelGiorno(doppio, 'r-frutta')).toBeNull();
    // Con lo slot invece la domanda ha una risposta sola.
    expect(porzioneDelGiorno(doppio, 'r-frutta', 'snack_pm')?.fattore).toBe(1.8);
  });

  it('lo stesso piatto due volte con lo STESSO fattore non è ambiguo', () => {
    const doppio = [
      { slot: 'snack_am', recipeId: 'r-frutta', name: 'Mela', kcal: 125, porzione: 1.25 },
      { slot: 'snack_pm', recipeId: 'r-frutta', name: 'Mela', kcal: 125, porzione: 1.25 },
    ];
    expect(porzioneDelGiorno(doppio, 'r-frutta')?.fattore).toBe(1.25);
  });

  it('il piatto che in quel giorno non c\'è, e la giornata illeggibile, tacciono', () => {
    expect(porzioneDelGiorno(giornata, 'r-pranzo', 'dinner')).toBeNull();
    expect(porzioneDelGiorno(giornata, 'r-che-non-esiste')).toBeNull();
    expect(porzioneDelGiorno(null, 'r-pranzo')).toBeNull();
    expect(porzioneDelGiorno('{}' as unknown, 'r-pranzo')).toBeNull();
    expect(porzioneDelGiorno(giornata, '')).toBeNull();
  });
});

describe('ingredientiScalati — la stessa regola della lista della spesa', () => {
  it('i grammi all\'intero, i pezzi con un decimale', () => {
    const scalati = ingredientiScalati(
      [
        { name: 'farro perlato', qty: 80, unit: 'g' },
        { name: 'mela', qty: 1, unit: 'pz' },
        { name: 'olio evo', qty: 8, unit: 'ml' },
      ],
      1.5,
    );
    expect(scalati).toEqual([
      { name: 'farro perlato', qty: 120, unit: 'g' },
      // ⚠️ Una mela e mezza esce così com'è: arrotondarla è una decisione della nutrizionista.
      { name: 'mela', qty: 1.5, unit: 'pz' },
      { name: 'olio evo', qty: 12, unit: 'ml' },
    ]);
  });

  /**
   * ⚠️ «q.b.» esiste nel catalogo: un ingrediente senza quantità va lasciato senza quantità.
   * Moltiplicare un vuoto darebbe `0`, e «0 g di sale» è un'istruzione sbagliata, non un dato
   * mancante.
   */
  it('⚠️ l\'ingrediente senza quantità resta senza quantità', () => {
    expect(ingredientiScalati([{ name: 'sale' }, { name: 'pepe', unit: 'q.b.' }], 2)).toEqual([
      { name: 'sale' },
      { name: 'pepe', unit: 'q.b.' },
    ]);
  });

  it('gli altri campi della riga non si perdono per strada', () => {
    expect(ingredientiScalati([{ name: 'riso', qty: 70, unit: 'g', note: 'integrale' }], 2)).toEqual([
      { name: 'riso', qty: 140, unit: 'g', note: 'integrale' },
    ]);
  });

  it('una lista illeggibile torna null, e chi chiama lascia la scheda com\'era', () => {
    expect(ingredientiScalati(undefined, 1.8)).toBeNull();
    expect(ingredientiScalati('farro, ceci' as unknown, 1.8)).toBeNull();
  });
});

/**
 * LE SOSTITUZIONI VALGONO ANCHE SENZA PORZIONE (revisione del 18/8 sera).
 *
 * La porzione e le sostituzioni sono due cose diverse: un piatto non scalato può avere lo stesso
 * «carote → biete» concordato in chat. Chiedendo solo la porzione, la scheda mostrava le carote.
 */
describe('pastoDelGiorno e le sostituzioni', () => {
  const conSostituzione = [
    {
      slot: 'lunch',
      recipeId: 'r-pranzo',
      name: 'Farro e ceci',
      kcal: 495,
      substitutions: [{ from: 'carote', to: 'biete', reason: 'non graditi', fromQty: 100, toQty: 120, unit: 'g', concordataIl: '2026-08-18' }],
    },
  ];

  it('⚠️ il pasto si trova anche quando non c\'è nessun moltiplicatore', () => {
    expect(porzioneDelGiorno(conSostituzione, 'r-pranzo')).toBeNull();
    expect(pastoDelGiorno(conSostituzione, 'r-pranzo')?.substitutions).toHaveLength(1);
  });

  it('⚠️ e gli ingredienti della scheda sono quelli del PIATTO: prima si sostituisce, poi si scala', () => {
    const scalati = ingredientiScalati(
      [{ name: 'carote', qty: 100, unit: 'g' }, { name: 'farro', qty: 80, unit: 'g' }],
      1.8,
      conSostituzione[0].substitutions as never,
    );
    // 120 g di biete (la quantità concordata) × 1,8, e le carote non ci sono più.
    expect(scalati).toEqual([
      { name: 'biete', qty: 216, unit: 'g' },
      { name: 'farro', qty: 144, unit: 'g' },
    ]);
  });

  it('senza sostituzioni non cambia niente rispetto a prima', () => {
    expect(ingredientiScalati([{ name: 'farro', qty: 80, unit: 'g' }], 1.5)).toEqual([{ name: 'farro', qty: 120, unit: 'g' }]);
  });

  /** ⚠️ Due volte lo stesso piatto con sostituzioni diverse: non si indovina, come per i fattori. */
  it('⚠️ due pasti uguali con sostituzioni diverse, senza slot: non si sceglie', () => {
    const doppio = [
      { slot: 'snack_am', recipeId: 'r', name: 'x', kcal: 100, substitutions: [{ from: 'a', to: 'b', reason: 'r', concordataIl: 'x' }] },
      { slot: 'snack_pm', recipeId: 'r', name: 'x', kcal: 100 },
    ];
    expect(pastoDelGiorno(doppio, 'r')).toBeNull();
    expect(pastoDelGiorno(doppio, 'r', 'snack_am')?.substitutions).toHaveLength(1);
  });
});
