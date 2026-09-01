import { DayComboService, RecipeInfo } from './day-combo.service';

const svc = new DayComboService();

const r = (id: string, kcal: number, score = 1, proteinShare = 0.3): RecipeInfo => ({ id, kcal, score, proteinShare });

describe('DayComboService.compose', () => {
  it('compone una giornata dentro la banda kcal del target', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['colazione', [r('c1', 300), r('c2', 400)]],
      ['pranzo', [r('p1', 500), r('p2', 700)]],
      ['cena', [r('d1', 500), r('d2', 800)]],
    ]);
    const res = svc.compose({
      slots: ['colazione', 'pranzo', 'cena'],
      poolBySlot,
      targetKcal: 1400,
      tolerancePct: 15,
      dayIndex: 0,
    });
    expect(res).not.toBeNull();
    const kcal = res!.reduce((a, m) => a + (poolBySlot.get(m.slot)!.find((x) => x.id === m.recipeId)!.kcal), 0);
    expect(kcal).toBeGreaterThanOrEqual(1400 * 0.85);
    expect(kcal).toBeLessThanOrEqual(1400 * 1.15);
    // una ricetta per slot, slot corretti e in ordine
    expect(res!.map((m) => m.slot)).toEqual(['colazione', 'pranzo', 'cena']);
  });

  it('a parità di kcal preferisce il punteggio più alto', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['pranzo', [r('p_lo', 700, 0.1), r('p_hi', 700, 0.9)]],
    ]);
    const res = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 0 });
    expect(res![0].recipeId).toBe('p_hi');
  });

  it('varia la giornata al variare del dayIndex (rotazione tra i migliori)', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['pranzo', [r('a', 700, 0.9), r('b', 700, 0.9), r('c', 700, 0.9)]],
    ]);
    const d0 = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 0 })![0].recipeId;
    const d1 = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 1 })![0].recipeId;
    expect(d0).not.toBe(d1);
  });

  it('nessuna combinazione nella banda kcal → null (fallback ai template)', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['colazione', [r('c1', 300)]],
      ['pranzo', [r('p1', 300)]],
      ['cena', [r('d1', 300)]],
    ]);
    // solo 900 kcal totali, target 1600 ±15% = [1360,1840] → fuori banda
    const res = svc.compose({ slots: ['colazione', 'pranzo', 'cena'], poolBySlot, targetKcal: 1600, tolerancePct: 15, dayIndex: 0 });
    expect(res).toBeNull();
  });

  it('slot senza candidati → null', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([['colazione', [r('c1', 300)]]]);
    const res = svc.compose({ slots: ['colazione', 'pranzo'], poolBySlot, targetKcal: 600, tolerancePct: 15, dayIndex: 0 });
    expect(res).toBeNull();
  });

  it('target non valido → null', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([['pranzo', [r('p1', 500)]]]);
    expect(svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 0, tolerancePct: 15, dayIndex: 0 })).toBeNull();
  });

  it('pool grande → usa la greedy e resta nella banda', () => {
    // 5 slot × 12 candidati = 248832 combinazioni > cap default → ramo greedy
    const poolBySlot = new Map<string, RecipeInfo[]>();
    const slots: string[] = [];
    for (let s = 0; s < 5; s++) {
      const slot = `slot${s}`;
      slots.push(slot);
      const arr: RecipeInfo[] = [];
      for (let i = 0; i < 12; i++) arr.push(r(`${slot}_${i}`, 200 + i * 30, ((s * 7 + i * 3) % 11) / 11));
      poolBySlot.set(slot, arr);
    }
    const res = svc.compose({ slots, poolBySlot, targetKcal: 1600, tolerancePct: 15, dayIndex: 0, maxCombos: 20000 });
    expect(res).not.toBeNull();
    const kcal = res!.reduce((a, m) => a + poolBySlot.get(m.slot)!.find((x) => x.id === m.recipeId)!.kcal, 0);
    expect(kcal).toBeGreaterThanOrEqual(1600 * 0.85);
    expect(kcal).toBeLessThanOrEqual(1600 * 1.15);
  });
});

/**
 * ⚠️ **SE DEGRADI, DILLO** — decisione di Simone dell'1/9 (Fase 3 del piano panieri): quando
 * nessuna giornata entra nella banda kcal, la banda si allarga a passi **e si scrive di quanto**.
 */
describe('DayComboService.componi — la banda che si allarga, e lo dice', () => {
  /** Un pool che dentro ±10% non ha niente, e a ±20% ha una giornata sola. */
  const poolStretto = () => new Map<string, RecipeInfo[]>([
    ['breakfast', [r('c1', 300)]],
    ['lunch', [r('p1', 500)]],
    ['dinner', [r('d1', 400)]], // totale 1200, target 1400 → scarto 14,3%
  ]);

  it('dentro la banda chiesta non allarga niente, e lo dice con uno zero', () => {
    const esito = svc.componi({
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 1200,
      tolerancePct: 10,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
    });
    expect(esito).not.toBeNull();
    expect(esito!.allargataDi).toBe(0);
    expect(esito!.tolleranzaUsata).toBe(10);
  });

  it('fuori banda allarga di un passo alla volta e si ferma al primo che basta', () => {
    const esito = svc.componi({
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 1400,
      tolerancePct: 10,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
    });
    expect(esito).not.toBeNull();
    // 1200 su 1400 è −14,3%: non basta ±10, basta ±15. Non deve arrivare a ±20.
    expect(esito!.tolleranzaUsata).toBe(15);
    expect(esito!.allargataDi).toBe(5);
    expect(esito!.giornata.map((m) => m.recipeId)).toEqual(['c1', 'p1', 'd1']);
  });

  /**
   * ⛔ **LA METÀ CHE RENDE ONESTA L'ALTRA.** Senza tetto, la banda si allargherebbe finché
   * qualcosa entra: a quel punto compone una giornata che col target non c'entra più niente e
   * dice di aver rispettato la regola. Oltre il tetto si torna `null` e si ripiega.
   */
  it('⛔ oltre il tetto NON compone: torna null e chi chiama ripiega', () => {
    const esito = svc.componi({
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 2400, // 1200 è metà: servirebbe ±50%
      tolerancePct: 10,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
    });
    expect(esito).toBeNull();
  });

  it('senza allargamento si comporta esattamente come prima', () => {
    const input = {
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 1400,
      tolerancePct: 10,
      dayIndex: 0,
    };
    expect(svc.componi(input)).toBeNull();
    expect(svc.compose(input)).toBeNull();
  });

  /**
   * ⚠️ Un parametro sbagliato in `config_param` non deve poter aprire la banda all'infinito: deve
   * solo lasciare le cose come stavano.
   */
  it('⚠️ un passo a zero o negativo non allarga, non gira a vuoto', () => {
    for (const allargamento of [{ passoPct: 0, tettoPct: 20 }, { passoPct: -5, tettoPct: 20 }, { passoPct: 5, tettoPct: 0 }]) {
      expect(svc.componi({
        slots: ['breakfast', 'lunch', 'dinner'],
        poolBySlot: poolStretto(),
        targetKcal: 1400,
        tolerancePct: 10,
        dayIndex: 0,
        allargamento,
      })).toBeNull();
    }
  });

  it('l\'ultimo passo non supera il tetto, anche se il passo non lo divide', () => {
    const esito = svc.componi({
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 1400,
      tolerancePct: 10,
      dayIndex: 0,
      allargamento: { passoPct: 7, tettoPct: 8 }, // 17 e 18: la prima che basta è 17
    });
    expect(esito).not.toBeNull();
    expect(esito!.tolleranzaUsata).toBeLessThanOrEqual(18);
    expect(esito!.allargataDi).toBeLessThanOrEqual(8);
  });

  it('`compose` continua a rendere solo la giornata, come l\'hanno sempre chiamata in giro', () => {
    const input = {
      slots: ['breakfast', 'lunch', 'dinner'],
      poolBySlot: poolStretto(),
      targetKcal: 1400,
      tolerancePct: 10,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
    };
    expect(svc.compose(input)).toEqual(svc.componi(input)!.giornata);
  });
});

/**
 * ⚠️ **LA COPPIA PRANZO/CENA** — richiesta di Simone del 26/8. I quattro meccanismi
 * anti-ripetizione che c'erano guardano un pasto alla volta: nessuno vedeva la giornata intera.
 */
describe('DayComboService.componi — la coppia pranzo/cena non si ripete', () => {
  const pool = () => new Map<string, RecipeInfo[]>([
    ['lunch', [r('spaghetti', 600), r('riso', 600)]],
    ['dinner', [r('branzino', 600), r('pollo', 600)]],
  ]);
  const base = { slots: ['lunch', 'dinner'], targetKcal: 1200, tolerancePct: 15, dayIndex: 0 };

  it('senza storico compone come ha sempre fatto', () => {
    const esito = svc.componi({ ...base, poolBySlot: pool() });
    expect(esito).not.toBeNull();
    expect(esito!.coppiaRipetuta).toBe(false);
  });

  it('con una coppia già servita ne sceglie un\'altra', () => {
    const esito = svc.componi({
      ...base,
      poolBySlot: pool(),
      coppieGiaViste: new Set(['spaghetti|branzino', 'spaghetti|pollo', 'riso|branzino']),
    });
    expect(esito).not.toBeNull();
    expect(esito!.giornata.map((m) => m.recipeId)).toEqual(['riso', 'pollo']);
    expect(esito!.coppiaRipetuta).toBe(false);
  });

  /**
   * ⛔ Con un pool stretto le coppie finiscono. Meglio ripetere una coppia — e dirlo — che lasciare
   * la cliente senza cena.
   */
  it('⛔ se sono finite compone lo stesso e lo dichiara', () => {
    const esito = svc.componi({
      ...base,
      poolBySlot: pool(),
      coppieGiaViste: new Set(['spaghetti|branzino', 'spaghetti|pollo', 'riso|branzino', 'riso|pollo']),
    });
    expect(esito).not.toBeNull();
    expect(esito!.coppiaRipetuta).toBe(true);
  });

  /**
   * ⛔ **La coppia non allarga le kcal.** Se una coppia già vista bastasse a far allargare la banda,
   * la varietà comprerebbe calorie fuori target — due regole che si scambiano la moneta. Prima si
   * decide la banda, poi lì dentro si preferisce una giornata nuova.
   */
  it('⛔ una coppia già vista NON è un motivo per allargare la banda', () => {
    const esito = svc.componi({
      slots: ['lunch', 'dinner'],
      poolBySlot: new Map<string, RecipeInfo[]>([
        ['lunch', [r('spaghetti', 600)]],
        ['dinner', [r('branzino', 600)]],
      ]),
      targetKcal: 1200,
      tolerancePct: 15,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
      coppieGiaViste: new Set(['spaghetti|branzino']),
    });
    expect(esito).not.toBeNull();
    expect(esito!.allargataDi).toBe(0);
    expect(esito!.coppiaRipetuta).toBe(true);
  });

  /** ⚠️ Una giornata senza pranzo o senza cena non ha coppia: la regola la lascia passare. */
  it('⚠️ il digiuno che toglie il pranzo non viene mai bloccato dalla regola', () => {
    const esito = svc.componi({
      slots: ['dinner'],
      poolBySlot: new Map<string, RecipeInfo[]>([['dinner', [r('branzino', 600)]]]),
      targetKcal: 600,
      tolerancePct: 15,
      dayIndex: 0,
      coppieGiaViste: new Set(['spaghetti|branzino', '|branzino']),
    });
    expect(esito).not.toBeNull();
    expect(esito!.coppiaRipetuta).toBe(false);
  });
});

/**
 * ⚠️ **LA REGOLA FLEXITARIANA** — decisione di Simone dell'1/9: la carne due volte a settimana.
 * È quello che distingue «Flessibile» da «onnivoro»: senza, le due cose sono la stessa.
 */
describe('DayComboService.componi — la carne due volte a settimana', () => {
  const conCarne = (id: string, kcal: number, carne: boolean): RecipeInfo =>
    ({ id, kcal, score: 1, proteinShare: 0.3, conCarne: carne });
  const pool = () => new Map<string, RecipeInfo[]>([
    ['lunch', [conCarne('pollo', 600, true), conCarne('pasta', 600, false)]],
    ['dinner', [conCarne('verdure', 600, false)]],
  ]);
  const base = { slots: ['lunch', 'dinner'], targetKcal: 1200, tolerancePct: 15, dayIndex: 0 };

  it('col tetto ancora aperto sceglie liberamente', () => {
    const esito = svc.componi({ ...base, poolBySlot: pool(), carneRestante: 2 });
    expect(esito!.carneOltreIlTetto).toBe(false);
  });

  it('⛔ col tetto esaurito preferisce la giornata senza carne', () => {
    const esito = svc.componi({ ...base, poolBySlot: pool(), carneRestante: 0 });
    expect(esito!.giornata.map((m) => m.recipeId)).toEqual(['pasta', 'verdure']);
    expect(esito!.carneOltreIlTetto).toBe(false);
  });

  /**
   * ⛔ **La rete**: se dentro la banda non resta nessuna giornata senza carne, si compone lo stesso
   * e lo si dichiara. Una regola alimentare sforata è un difetto da guardare; una cliente senza
   * cena è un guasto.
   */
  it('⛔ ma se non c\'è altro compone lo stesso, e lo dichiara', () => {
    const soloCarne = new Map<string, RecipeInfo[]>([
      ['lunch', [conCarne('pollo', 600, true)]],
      ['dinner', [conCarne('manzo', 600, true)]],
    ]);
    const esito = svc.componi({ ...base, poolBySlot: soloCarne, carneRestante: 0 });
    expect(esito).not.toBeNull();
    expect(esito!.carneOltreIlTetto).toBe(true);
  });

  /**
   * ⛔ **«Non lo sappiamo» non vuol dire «no».** Un piatto senza il dato conta come carne quando il
   * tetto è esaurito: il verso opposto renderebbe il tetto aggirabile da qualunque ricetta con gli
   * ingredienti scritti male.
   */
  it('⛔ un piatto di cui non sappiamo il contenuto non passa per «senza carne»', () => {
    const ignoto = new Map<string, RecipeInfo[]>([
      ['lunch', [{ id: 'boh', kcal: 600, score: 1, proteinShare: 0.3 }]],
      ['dinner', [conCarne('verdure', 600, false)]],
    ]);
    const esito = svc.componi({ ...base, poolBySlot: ignoto, carneRestante: 0 });
    expect(esito!.carneOltreIlTetto).toBe(true);
  });

  /**
   * ⛔ **La carne finita non è un motivo per allargare le kcal**: sarebbe una regola alimentare che
   * compra calorie fuori target. Sta dopo la banda, come la coppia.
   */
  it('⛔ il tetto della carne NON allarga la banda', () => {
    const esito = svc.componi({
      slots: ['lunch', 'dinner'],
      poolBySlot: new Map<string, RecipeInfo[]>([
        ['lunch', [conCarne('pollo', 600, true)]],
        ['dinner', [conCarne('manzo', 600, true)]],
      ]),
      targetKcal: 1200,
      tolerancePct: 15,
      dayIndex: 0,
      allargamento: { passoPct: 5, tettoPct: 20 },
      carneRestante: 0,
    });
    expect(esito!.allargataDi).toBe(0);
    expect(esito!.carneOltreIlTetto).toBe(true);
  });

  it('⚠️ e senza limite si comporta esattamente come prima', () => {
    for (const carneRestante of [undefined, Infinity]) {
      const esito = svc.componi({ ...base, poolBySlot: pool(), carneRestante });
      expect(esito!.carneOltreIlTetto).toBe(false);
    }
  });
});
