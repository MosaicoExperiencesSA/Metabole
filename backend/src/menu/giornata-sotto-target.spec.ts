import {
  giornateSottoTarget,
  kcalGiornata,
  laPeggiore,
  scostamentoPct,
  type GiornataDaControllare,
} from './giornata-sotto-target';

/** Una giornata, scritta come la vede il motore: slot + kcal. */
const giorno = (data: string, ...kcal: number[]): GiornataDaControllare => ({
  date: new Date(`${data}T00:00:00.000Z`),
  meals: kcal.map((k, i) => ({ slot: `slot${i}`, kcal: k })),
});

describe('kcalGiornata', () => {
  it('somma le kcal dei pasti', () => {
    expect(kcalGiornata([{ slot: 'lunch', kcal: 560 }, { slot: 'dinner', kcal: 400 }])).toBe(960);
  });

  it('un valore non finito conta zero, non NaN — un pasto senza ricetta non deve azzerare il giudizio', () => {
    expect(kcalGiornata([{ slot: 'lunch', kcal: 560 }, { slot: 'dinner', kcal: NaN }])).toBe(560);
    expect(kcalGiornata([])).toBe(0);
  });
});

describe('scostamentoPct', () => {
  it('è negativo sotto il target e ha una cifra decimale, come `contaGiornata` di Vera', () => {
    expect(scostamentoPct(1040, 1600)).toBe(-35);
    expect(scostamentoPct(1600, 1600)).toBe(0);
    expect(scostamentoPct(1750, 1600)).toBe(9.4);
  });
});

describe('giornateSottoTarget', () => {
  it('non segnala una giornata dentro la tolleranza', () => {
    // 1450 su 1600 = −9,4%, dentro il 15%.
    expect(giornateSottoTarget([giorno('2026-08-18', 1450)], 1600, 15)).toEqual([]);
  });

  it('non segnala una giornata SOPRA il target: è un\'altra domanda, e mescolarle vorrebbe dire non poter contare né l\'una né l\'altra', () => {
    expect(giornateSottoTarget([giorno('2026-08-18', 2000)], 1600, 15)).toEqual([]);
  });

  it('segnala la giornata sotto la banda, con lo scostamento e la quota del target', () => {
    const fuori = giornateSottoTarget([giorno('2026-08-18', 320, 160, 560)], 1600, 15);
    expect(fuori).toHaveLength(1);
    expect(fuori[0]).toEqual({
      data: '2026-08-18',
      kcal: 1040,
      scostamentoPct: -35,
      quotaDelTarget: 0.65,
    });
  });

  it('⚠️ il confine è STRETTO: esattamente sulla tolleranza non si segnala (è la banda che il motore usa per comporre)', () => {
    // −15% esatto su 1600 = 1360.
    expect(giornateSottoTarget([giorno('2026-08-18', 1360)], 1600, 15)).toEqual([]);
    expect(giornateSottoTarget([giorno('2026-08-18', 1359)], 1600, 15)).toHaveLength(1);
  });

  it('senza target non segnala niente: «non lo so» non è «va bene», ma non è un allarme', () => {
    expect(giornateSottoTarget([giorno('2026-08-18', 100)], 0, 15)).toEqual([]);
    expect(giornateSottoTarget([giorno('2026-08-18', 100)], null, 15)).toEqual([]);
    expect(giornateSottoTarget([giorno('2026-08-18', 100)], undefined, 15)).toEqual([]);
    expect(giornateSottoTarget([giorno('2026-08-18', 100)], Number.NaN, 15)).toEqual([]);
  });

  it('una giornata VUOTA non finisce qui: la fermano già la rete di dayComboPools e il blocco delle intolleranze', () => {
    expect(giornateSottoTarget([{ date: new Date('2026-08-18T00:00:00.000Z'), meals: [] }], 1600, 15)).toEqual([]);
  });

  it('guarda tutte le giornate dell\'erogazione, non solo la prima', () => {
    const fuori = giornateSottoTarget(
      [giorno('2026-08-18', 1040), giorno('2026-08-19', 1550), giorno('2026-08-20', 900)],
      1600,
      15,
    );
    expect(fuori.map((g) => g.data)).toEqual(['2026-08-18', '2026-08-20']);
  });

  it('una tolleranza scritta negativa in config_param vale come positiva (e zero non fa passare niente sotto)', () => {
    expect(giornateSottoTarget([giorno('2026-08-18', 1500)], 1600, -15)).toEqual([]);
    expect(giornateSottoTarget([giorno('2026-08-18', 1599)], 1600, 0)).toHaveLength(1);
  });

  /**
   * ⚠️ I NUMERI VERI DELLE FINESTRE, da `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`:
   * sono quote di `quoteKcalPerSlot` incrociate col catalogo che `struttura-per-digiuno` serve.
   * Se una di queste righe smette di essere segnalata, il difetto è tornato invisibile.
   */
  describe('i casi veri del digiuno e degli spuntini tolti (target 1600 kcal)', () => {
    const T = 1600;
    const casi: { nome: string; kcal: number[]; quota: number; segnalata: boolean }[] = [
      // salta la colazione → catalogo digiuno: pranzo .45 + merenda .10 + cena .45 = 100%
      { nome: 'salta la colazione (100%)', kcal: [720, 160, 720], quota: 1, segnalata: false },
      // salta la cena (Sonia) → 5 pasti: colazione .20 + sp. mattina .10 + pranzo .35 = 65%
      { nome: 'salta la cena — Sonia (65%)', kcal: [320, 160, 560], quota: 0.65, segnalata: true },
      // salta il pranzo → 5 pasti: .20 + .10 + .10 + .25 = 65%
      { nome: 'salta il pranzo (65%)', kcal: [320, 160, 160, 400], quota: 0.65, segnalata: true },
      // salta colazione e pranzo → digiuno: merenda .10 + cena .45 = 55%
      { nome: 'salta colazione e pranzo (55%)', kcal: [160, 720], quota: 0.55, segnalata: true },
      // salta cena e colazione → digiuno: solo pranzo .45 = 45%
      { nome: 'salta cena e colazione (45%)', kcal: [720], quota: 0.45, segnalata: true },
      // i due spuntini tolti da Vera, fuori dal digiuno: .20 + .35 + .25 = 80%
      { nome: 'i due spuntini tolti da Vera (80%)', kcal: [320, 560, 400], quota: 0.8, segnalata: true },
      // un solo spuntino tolto: 90% — dentro la tolleranza del 15%, e non è un allarme
      { nome: 'un solo spuntino tolto (90%)', kcal: [320, 160, 560, 400], quota: 0.9, segnalata: false },
    ];

    it.each(casi)('$nome', ({ kcal, quota, segnalata }) => {
      const fuori = giornateSottoTarget([giorno('2026-08-18', ...kcal)], T, 15);
      expect(fuori).toHaveLength(segnalata ? 1 : 0);
      if (segnalata) expect(fuori[0].quotaDelTarget).toBeCloseTo(quota, 2);
    });
  });
});

describe('laPeggiore', () => {
  it('è quella che si allontana di più dal target, non la prima', () => {
    const fuori = giornateSottoTarget(
      [giorno('2026-08-18', 1040), giorno('2026-08-19', 900), giorno('2026-08-20', 1100)],
      1600,
      15,
    );
    expect(laPeggiore(fuori)?.data).toBe('2026-08-19');
  });

  it('senza giornate fuori target è null', () => {
    expect(laPeggiore([])).toBeNull();
  });
});
