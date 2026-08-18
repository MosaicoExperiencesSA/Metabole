import {
  TETTI_PREDEFINITI,
  porzioneLeggibile,
  porzioniScalate,
  quantitaScalata,
  tettoDelloSlot,
} from './porzione-scalata';

/** La giornata di Sonia: «salta la cena», restano colazione, spuntino e pranzo. */
const GIORNATA_SONIA = [
  { slot: 'breakfast', kcal: 320 },
  { slot: 'morning_snack', kcal: 160 },
  { slot: 'lunch', kcal: 560 },
];

describe('tettoDelloSlot', () => {
  it('pranzo e cena reggono di più, la colazione un po\' meno, lo spuntino poco', () => {
    expect(tettoDelloSlot('lunch')).toBe(1.8);
    expect(tettoDelloSlot('dinner')).toBe(1.8);
    expect(tettoDelloSlot('breakfast')).toBe(1.6);
    expect(tettoDelloSlot('morning_snack')).toBe(1.25);
    expect(tettoDelloSlot('afternoon_snack')).toBe(1.25);
  });

  /**
   * ⚠️ Su una scala che moltiplica il cibo di una persona, un nome che non riconosciamo deve
   * costare prudenza. Il valore di scorta sbagliato in eccesso è quello che si nota solo nel piatto.
   */
  it('⚠️ uno slot sconosciuto prende il tetto PIÙ BASSO, non il più alto', () => {
    expect(tettoDelloSlot('merenda_serale')).toBe(1.25);
    expect(tettoDelloSlot('')).toBe(1.25);
  });

  it('i tetti si possono passare da fuori: arrivano da `config_param`', () => {
    expect(tettoDelloSlot('lunch', { principale: 2, colazione: 1.5, spuntino: 1.1 })).toBe(2);
  });
});

describe('porzioniScalate — il caso Sonia', () => {
  it('⚠️ 1040 kcal su un fabbisogno di 1600: ci arriva, e nessuno slot sfonda il suo tetto', () => {
    const e = porzioniScalate(GIORNATA_SONIA, 1600);
    expect(e.kcalPrima).toBe(1040);
    expect(e.scalata).toBe(true);
    expect(e.restaCorta).toBe(false);
    expect(e.kcalDopo).toBeGreaterThanOrEqual(1599);
    e.fattori.forEach((f, i) => {
      expect(f).toBeLessThanOrEqual(tettoDelloSlot(GIORNATA_SONIA[i].slot) + 1e-9);
    });
  });

  /**
   * ⚠️ IL MOTIVO DEI TETTI PER TIPO DI PASTO. Con un tetto unico a ×1,6 lo spuntino da 160 kcal
   * diventerebbe 256: non è più uno spuntino, è un pasto. Qui si ferma a ×1,25 (200 kcal) e la
   * differenza va su colazione e pranzo — che è quello che farebbe a mano una nutrizionista.
   */
  it('⚠️ lo spuntino resta uno spuntino: si ferma al suo tetto e il resto va sui pasti', () => {
    const e = porzioniScalate(GIORNATA_SONIA, 1600);
    const [colazione, spuntino, pranzo] = e.fattori;
    expect(spuntino).toBeCloseTo(1.25, 5);
    expect(Math.round(160 * spuntino)).toBe(200);
    expect(e.alTetto).toEqual(['morning_snack']);
    // Colazione e pranzo prendono più del fattore uniforme di partenza (1600/1040 = 1,538)...
    expect(colazione).toBeGreaterThan(1.538);
    expect(pranzo).toBeGreaterThan(1.538);
    /**
     * ⚠️ ...e prendono LO STESSO fattore fra loro. Il rapporto fra colazione e pranzo lo ha deciso
     * la dieta, non noi: chi non è al tetto cresce della stessa percentuale di chiunque altro non
     * sia al tetto. Una ridistribuzione «in proporzione al margine» darebbe 478/929 invece di
     * 509/891, cioè sposterebbe cibo dalla colazione al pranzo senza che nessuno l'abbia deciso.
     */
    expect(colazione).toBeCloseTo(pranzo, 6);
    expect(Math.round(320 * colazione)).toBe(509);
    expect(Math.round(560 * pranzo)).toBe(891);
  });
});

describe('porzioniScalate — quando NON si tocca niente', () => {
  it('la giornata è già sopra il fabbisogno: fattori a 1', () => {
    const e = porzioniScalate(GIORNATA_SONIA, 900);
    expect(e.fattori).toEqual([1, 1, 1]);
    expect(e.scalata).toBe(false);
  });

  /**
   * ⚠️ Non si RIMPICCIOLISCE mai, ed è una scelta dichiarata: scalare all'ingiù toccherebbe il menu
   * di tutte le clienti sotto i 1500 kcal, che è una decisione clinica diversa da quella presa.
   */
  it('⚠️ e infatti nemmeno di poco: 1040 su un target di 800 resta 1040', () => {
    expect(porzioniScalate(GIORNATA_SONIA, 800).kcalDopo).toBe(1040);
  });

  it('⚠️ un target che non c\'è vale «non lo so», e su «non lo so» non si tocca niente', () => {
    for (const t of [0, -100, NaN, undefined as unknown as number, null as unknown as number]) {
      expect(porzioniScalate(GIORNATA_SONIA, t).scalata).toBe(false);
    }
  });

  it('nessun pasto, o pasti a zero kcal: non esplode e non inventa', () => {
    expect(porzioniScalate([], 1600).fattori).toEqual([]);
    expect(porzioniScalate([{ slot: 'lunch', kcal: 0 }], 1600).scalata).toBe(false);
  });
});

describe('porzioniScalate — quando i tetti non bastano', () => {
  /**
   * ⚠️ «Salta cena e colazione»: resta il solo pranzo. 560 kcal su 1600 vorrebbero ×2,86, e il
   * tetto del pranzo è ×1,8. Non si scala oltre in silenzio: `restaCorta` lo dice, e chi chiama
   * continua a scrivere `daily_kcal_below_target` — che da oggi vuol dire una cosa più grave e più
   * rara di prima, cioè «resta corta ANCHE col moltiplicatore».
   */
  it('⚠️ il solo pranzo su 1600 kcal: si arriva al tetto e si DICE che resta corta', () => {
    const e = porzioniScalate([{ slot: 'lunch', kcal: 560 }], 1600);
    expect(e.fattori[0]).toBeCloseTo(1.8, 5);
    expect(e.kcalDopo).toBe(1008);
    expect(e.restaCorta).toBe(true);
    expect(e.alTetto).toEqual(['lunch']);
    expect(Math.round(e.quota * 100)).toBe(63);
  });

  it('e non si sfonda il tetto nemmeno di un capello', () => {
    const e = porzioniScalate([{ slot: 'afternoon_snack', kcal: 100 }], 5000);
    expect(e.fattori[0]).toBe(1.25);
    expect(e.kcalDopo).toBe(125);
  });
});

describe('porzioniScalate — i conti che la cliente rifà a mano', () => {
  /**
   * ⚠️ `kcalDopo` è la somma dei valori ARROTONDATI per pasto, non il totale teorico: è il numero
   * che viene fuori sommando le righe del menu. Scrivendo il totale esatto, la giornata direbbe
   * 1600 e le tre righe ne farebbero 1599 — e chi lo nota non si fida più di nessuno dei due.
   */
  it('⚠️ il totale è la somma delle righe arrotondate, non il totale teorico', () => {
    const e = porzioniScalate(GIORNATA_SONIA, 1600);
    const somma = GIORNATA_SONIA.reduce((s, p, i) => s + Math.round(p.kcal * e.fattori[i]), 0);
    expect(e.kcalDopo).toBe(somma);
  });

  it('un mezzo kcal di scarto non fa suonare l\'allarme', () => {
    const e = porzioniScalate([{ slot: 'lunch', kcal: 1000 }], 1001);
    expect(e.restaCorta).toBe(false);
  });
});

describe('porzioniScalate — le cinque finestre, per tabella', () => {
  const P = { breakfast: 320, morning_snack: 160, lunch: 560, afternoon_snack: 160, dinner: 400 };
  const giornata = (...slot: (keyof typeof P)[]) => slot.map((s) => ({ slot: s, kcal: P[s] }));
  const casi: { nome: string; pasti: { slot: string; kcal: number }[]; arriva: boolean }[] = [
    { nome: 'salta la colazione', pasti: giornata('lunch', 'afternoon_snack', 'dinner'), arriva: true },
    { nome: 'salta la cena', pasti: giornata('breakfast', 'morning_snack', 'lunch'), arriva: true },
    { nome: 'salta il pranzo', pasti: giornata('breakfast', 'morning_snack', 'afternoon_snack', 'dinner'), arriva: true },
    { nome: 'salta colazione e pranzo (solo cena)', pasti: giornata('afternoon_snack', 'dinner'), arriva: false },
    { nome: 'salta cena e colazione', pasti: giornata('morning_snack', 'lunch'), arriva: false },
  ];

  it.each(casi)('$nome', ({ pasti, arriva }) => {
    const e = porzioniScalate(pasti, 1600);
    expect(!e.restaCorta).toBe(arriva);
  });

  /** ⚠️ Le due finestre a un pasto solo restano corte anche coi tetti: è la riga del foglio che
   *  dice «un pranzo che vale l'intera giornata non è una porzione, è una scelta clinica». */
  it('⚠️ e le due finestre strette lo dicono, invece di far finta', () => {
    const e = porzioniScalate(giornata('morning_snack', 'lunch'), 1600);
    expect(e.restaCorta).toBe(true);
    expect(e.alTetto.sort()).toEqual(['lunch', 'morning_snack']);
  });
});

describe('porzioneLeggibile', () => {
  it('un decimale, perché due non si leggono', () => {
    expect(porzioneLeggibile(1.5384)).toBe(1.5);
    expect(porzioneLeggibile(1.25)).toBe(1.3);
    expect(porzioneLeggibile(1)).toBe(1);
  });
});

describe('i tetti predefiniti sono quelli del foglio', () => {
  it('§4 colonna B: principali ×1,8 · colazione ×1,6 · spuntini ×1,25', () => {
    expect(TETTI_PREDEFINITI).toEqual({ principale: 1.8, colazione: 1.6, spuntino: 1.25 });
  });
});

describe('quantitaScalata — la lista della spesa deve bastare fino a domenica', () => {
  it('a peso si arrotonda all\'intero: 80 g × 1,5909 = 127 g, non 127,3', () => {
    expect(quantitaScalata(80, 1.5909, 'g')).toBe(127);
    expect(quantitaScalata(200, 1.25, 'ml')).toBe(250);
  });

  /**
   * ⚠️ I PEZZI RESTANO UN PROBLEMA APERTO, e il numero vero è meno dannoso di un numero comodo:
   * «1,5 uova» si vede e si discute, «2 uova» scritto di nascosto no. La decisione (accettare
   * l'arrotondamento o togliere le ricette a pezzo dalla scalatura) è della nutrizionista.
   */
  it('⚠️ i pezzi tengono il decimale, invece di far finta che 1,5 mele siano 2', () => {
    expect(quantitaScalata(1, 1.5, 'pz')).toBe(1.5);
    expect(quantitaScalata(2, 1.25, 'cucchiai')).toBe(2.5);
  });

  it('senza fattore, o con un fattore che non torna, la quantità resta quella di catalogo', () => {
    expect(quantitaScalata(80, undefined, 'g')).toBe(80);
    expect(quantitaScalata(80, 1, 'g')).toBe(80);
    expect(quantitaScalata(80, 0, 'g')).toBe(80);
    expect(quantitaScalata(80, NaN, 'g')).toBe(80);
  });

  it('«quanto basta» resta «quanto basta»: senza quantità non si inventa un numero', () => {
    expect(quantitaScalata(null, 1.8, 'g')).toBeNull();
    expect(quantitaScalata(undefined, 1.8, null)).toBeNull();
  });
});
