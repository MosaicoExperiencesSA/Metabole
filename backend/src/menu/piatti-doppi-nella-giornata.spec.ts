import {
  GIORNATE_MINIME, QUOTA_CHE_CAMBIA_LA_STRADA, aRischioGemelli, contaDoppioni,
  doppioniDellaGiornata, doveCorreggere, type PastoLetto,
} from './piatti-doppi-nella-giornata';

const p = (slot: string, recipeId: string, name = `Piatto ${recipeId}`): PastoLetto => ({ slot, recipeId, name });

describe('lo stesso piatto due volte nella stessa giornata', () => {
  it('una giornata normale non ha doppioni', () => {
    expect(doppioniDellaGiornata([p('breakfast', 'c1'), p('lunch', 'p1'), p('dinner', 'd1')])).toEqual([]);
  });

  /**
   * ⛔ Il caso che ha aperto la voce: dopo `allargaAiGemelli` le liste di spuntino e merenda sono
   * identiche, e niente vieta a `dayCombo` di pescare due volte la stessa.
   */
  it('⛔ spuntino e merenda con lo stesso piatto: doppione di specie «gemelli»', () => {
    const out = doppioniDellaGiornata([p('morning_snack', 's1'), p('afternoon_snack', 's1'), p('lunch', 'p1')]);
    expect(out).toHaveLength(1);
    expect(out[0].recipeId).toBe('s1');
    expect(out[0].slot).toEqual(['morning_snack', 'afternoon_snack']);
    expect(out[0].specie).toBe('gemelli');
  });

  /**
   * ⚠️ Pranzo e cena **non** sono gemelli: quel doppione non nasce dall'allargamento, e la
   * correzione è un'altra.
   */
  it('⚠️ pranzo e cena con lo stesso piatto: specie «altri-pasti», causa diversa', () => {
    expect(doppioniDellaGiornata([p('lunch', 'x'), p('dinner', 'x')])[0].specie).toBe('altri-pasti');
  });

  /**
   * ⛔ **La prima stesura chiamava questa specie «principali»**, e `MAIN_SLOTS` sono colazione,
   * pranzo e cena: il tabulato stampava «⛔ N giornate hanno il doppione fra PASTI PRINCIPALI» su
   * una coppia cena+spuntino, mandando chi legge a cercare un difetto pranzo/cena che non c'era.
   */
  it('⛔ cena e spuntino NON sono «pasti principali»: la categoria si chiama «altri-pasti»', () => {
    expect(doppioniDellaGiornata([p('dinner', 'y'), p('morning_snack', 'y')])[0].specie).toBe('altri-pasti');
  });

  it('⛔ tre slot di cui due gemelli: è «misto», non «gemelli» e non «altri-pasti»', () => {
    const out = doppioniDellaGiornata([p('morning_snack', 'x'), p('afternoon_snack', 'x'), p('breakfast', 'x')]);
    expect(out[0].slot).toHaveLength(3);
    expect(out[0].specie).toBe('misto');
  });

  it('⚠️ tre pasti NON gemelli restano «altri-pasti»', () => {
    const out = doppioniDellaGiornata([p('breakfast', 'x'), p('lunch', 'x'), p('dinner', 'x')]);
    expect(out[0].specie).toBe('altri-pasti');
  });

  it('due doppioni nella stessa giornata si contano tutti e due', () => {
    const out = doppioniDellaGiornata([
      p('morning_snack', 's1'), p('afternoon_snack', 's1'), p('lunch', 'x'), p('dinner', 'x'),
    ]);
    expect(out.map((d) => d.recipeId).sort()).toEqual(['s1', 'x']);
  });

  /**
   * ⚠️ Lo stesso pasto scritto due volte è un guasto della **scrittura**, non un piatto ripetuto:
   * contarlo qui direbbe «doppione» di una giornata che ne ha zero.
   */
  it('⚠️ lo stesso SLOT ripetuto non è un doppione di piatto', () => {
    expect(doppioniDellaGiornata([p('lunch', 'x'), p('lunch', 'x')])).toEqual([]);
  });

  /**
   * ⛔ E uno slot ripetuto **insieme** a un doppione vero non deve finire nell'elenco degli slot:
   * senza i distinti la combinazione diventerebbe «dinner + lunch + lunch», una riga spazzatura nel
   * tabulato che nessuno sa leggere.
   */
  it('⛔ slot ripetuto insieme a un doppione vero: l\'elenco resta pulito', () => {
    const out = doppioniDellaGiornata([p('lunch', 'x'), p('lunch', 'x'), p('dinner', 'x')]);
    expect(out).toHaveLength(1);
    expect(out[0].slot).toEqual(['lunch', 'dinner']);
  });

  it('⚠️ le righe senza recipeId o senza slot si saltano, non fanno coppia fra loro', () => {
    expect(doppioniDellaGiornata([
      { slot: 'lunch', recipeId: null }, { slot: 'dinner', recipeId: '' }, { slot: null, recipeId: 'x' },
    ])).toEqual([]);
  });

  /**
   * ⚠️ **Il nome è quello della PRIMA comparsa.** Le due righe portano lo stesso `recipeId`, quindi
   * dovrebbero avere lo stesso nome — se non ce l'hanno, quella che si tiene è la prima, e non è
   * indifferente: il tabulato la usa per ritrovare il piatto a mano.
   */
  it('porta il nome del piatto, quello della prima comparsa', () => {
    const out = doppioniDellaGiornata([
      p('morning_snack', 's1', 'Yogurt e mandorle'), p('afternoon_snack', 's1', 'un altro nome'),
    ]);
    expect(out[0].nome).toBe('Yogurt e mandorle');
  });
});

/**
 * ⛔ **IL DENOMINATORE.** Su una giornata da tre pasti il doppione fra gemelli è **impossibile**,
 * non raro: contarla sotto la linea di frazione abbassa il tasso di quanto è grande la fetta a tre
 * pasti, che nessuno controlla.
 */
describe('quali giornate mettono il difetto alla prova', () => {
  it('⛔ una giornata da tre pasti non può avere il doppione fra gemelli', () => {
    expect(aRischioGemelli([p('breakfast', 'c'), p('lunch', 'l'), p('dinner', 'd')])).toBe(false);
  });

  it('⛔ e nemmeno una da digiuno, che di gemelli ne ha uno solo', () => {
    expect(aRischioGemelli([p('lunch', 'l'), p('afternoon_snack', 's'), p('dinner', 'd')])).toBe(false);
  });

  it('una da cinque pasti sì: ha spuntino e merenda', () => {
    expect(aRischioGemelli([
      p('breakfast', 'c'), p('morning_snack', 's'), p('lunch', 'l'), p('afternoon_snack', 'm'), p('dinner', 'd'),
    ])).toBe(true);
  });

  it('⚠️ e non serve che il doppione ci sia: «a rischio» vuol dire «può capitare»', () => {
    expect(aRischioGemelli([p('morning_snack', 'a'), p('afternoon_snack', 'b')])).toBe(true);
  });
});

describe('il conto su più giornate', () => {
  const gio = (clientId: string, data: string, pasti: PastoLetto[]) => ({ clientId, data, pasti });
  /** Una giornata da cinque pasti col piatto ripetuto fra spuntino e merenda. */
  const doppia = (id: string) => [
    p('breakfast', 'c'), p('morning_snack', id), p('lunch', 'p1'), p('afternoon_snack', id), p('dinner', 'd'),
  ];
  const cinque = (id: string) => [
    p('breakfast', `c${id}`), p('morning_snack', `s${id}`), p('lunch', `p${id}`),
    p('afternoon_snack', `m${id}`), p('dinner', `d${id}`),
  ];
  const tre = (id: string) => [p('breakfast', `c${id}`), p('lunch', `p${id}`), p('dinner', `d${id}`)];

  it('conta le giornate, quelle col doppione, quante clienti tocca e su quante lette', () => {
    const c = contaDoppioni([
      gio('a', '2026-09-01', doppia('s1')), gio('a', '2026-09-02', cinque('2')), gio('b', '2026-09-01', doppia('s2')),
    ]);
    expect(c.giornate).toBe(3);
    expect(c.giornateARischioGemelli).toBe(3);
    expect(c.giornateConDoppione).toBe(2);
    expect(c.clientiLette).toBe(2);
    expect(c.clientiConDoppione).toBe(2);
    expect(c.perSpecie.gemelli).toBe(2);
    expect(c.perSpecie['altri-pasti']).toBe(0);
  });

  it('⛔ le giornate da tre pasti restano nel totale ma NON fra quelle a rischio', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', tre('1')), gio('b', '2026-09-01', doppia('s1'))]);
    expect(c.giornate).toBe(2);
    expect(c.giornateARischioGemelli).toBe(1);
  });

  it('⛔ una giornata con due specie conta UNA volta come giornata e una per specie', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', [
      p('morning_snack', 's1'), p('afternoon_snack', 's1'), p('lunch', 'x'), p('dinner', 'x'),
    ])]);
    expect(c.giornateConDoppione).toBe(1);
    expect(c.perSpecie.gemelli).toBe(1);
    expect(c.perSpecie['altri-pasti']).toBe(1);
  });

  /**
   * ⛔ **`perSpecie` conta GIORNATE, non doppioni**, ed è la differenza che la prova qui sopra non
   * vede: lì le due specie sono una per tipo, quindi contare per doppione darebbe lo stesso numero.
   */
  it('⛔ due doppioni della STESSA specie nella stessa giornata contano una volta', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', [
      p('breakfast', 'x'), p('lunch', 'x'), p('dinner', 'y'), p('morning_snack', 'y'),
    ])]);
    expect(c.giornateConDoppione).toBe(1);
    expect(c.perSpecie['altri-pasti']).toBe(1);
  });

  it('la stessa cliente su più giornate conta una volta sola fra le clienti', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', doppia('s1')), gio('a', '2026-09-02', doppia('s1'))]);
    expect(c.giornateConDoppione).toBe(2);
    expect(c.clientiConDoppione).toBe(1);
    expect(c.clientiLette).toBe(1);
  });

  /**
   * ⚠️ **La combinazione più rara si legge PER PRIMA**, di proposito: senza l'ordinamento la mappa
   * renderebbe le coppie nell'ordine in cui le ha incontrate, e il tabulato direbbe che il caso
   * frequente è quello raro.
   */
  it('le coppie escono ordinate per frequenza, non per ordine di lettura', () => {
    const c = contaDoppioni([
      gio('c', '2026-09-01', [p('lunch', 'x'), p('dinner', 'x')]),   // ← letta per prima, ma è la rara
      gio('a', '2026-09-01', doppia('s1')), gio('b', '2026-09-01', doppia('s2')),
    ]);
    expect(c.coppie[0].slot).toBe('afternoon_snack + morning_snack');
    expect(c.coppie[0].giornate).toBe(2);
    expect(c.coppie[1].slot).toBe('dinner + lunch');
  });

  /**
   * ⚠️ **L'etichetta in italiano**: il tabulato lo legge una persona, e `morning_snack` non è una
   * parola che si usa parlando. `etichettaSlot` esiste da sempre proprio per questo.
   */
  it('⚠️ le coppie portano anche l\'etichetta in italiano', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', doppia('s1'))]);
    expect(c.coppie[0].etichetta).toBe('merenda + spuntino');
  });

  it('⚠️ a pari merito l\'ordine è alfabetico, non quello di lettura', () => {
    const c = contaDoppioni([
      gio('a', '2026-09-01', [p('lunch', 'x'), p('dinner', 'x')]),
      gio('b', '2026-09-01', [p('breakfast', 'y'), p('lunch', 'y')]),
    ]);
    expect(c.coppie.map((x) => x.slot)).toEqual(['breakfast + lunch', 'dinner + lunch']);
  });

  it('⚠️ due doppioni sulla STESSA coppia di slot contano una giornata sola', () => {
    const c = contaDoppioni([gio('a', '2026-09-01', [
      p('breakfast', 'x'), p('lunch', 'x'), p('breakfast', 'y'), p('lunch', 'y'),
    ])]);
    expect(c.giornateConDoppione).toBe(1);
    expect(c.coppie).toEqual([{ slot: 'breakfast + lunch', etichetta: 'colazione + pranzo', giornate: 1 }]);
  });

  /**
   * ⛔ **Il tetto degli esempi è per GIORNATA, non per doppione.** Col tetto per doppione, una sola
   * giornata patologica con dodici doppioni si mangiava tutto il budget e il tabulato mostrava
   * dodici righe con la stessa data e la stessa cliente, sotto un titolo che faceva credere a uno
   * spaccato.
   */
  it('⛔ il tetto degli esempi conta le GIORNATE: una giornata patologica non se lo mangia', () => {
    const patologica = [
      p('breakfast', 'x'), p('lunch', 'x'), p('morning_snack', 'y'), p('afternoon_snack', 'y'),
      p('dinner', 'z'),
    ];
    const c = contaDoppioni([
      gio('a', '2026-09-01', patologica), gio('b', '2026-09-02', doppia('s1')), gio('c', '2026-09-03', doppia('s2')),
    ], 2);
    expect(new Set(c.esempi.map((e) => e.clientId))).toEqual(new Set(['a', 'b']));
    expect(c.esempi.length).toBeGreaterThan(2); // la giornata «a» porta due righe, ed è giusto
  });

  it('gli esempi si fermano al numero di giornate chiesto', () => {
    const tante = Array.from({ length: 30 }, (_, i) => gio(`c${i}`, '2026-09-01', doppia(`s${i}`)));
    expect(new Set(contaDoppioni(tante, 5).esempi.map((e) => e.clientId)).size).toBe(5);
    expect(new Set(contaDoppioni(tante).esempi.map((e) => e.clientId)).size).toBe(12);
  });

  /**
   * ⚠️ **La data dell'esempio è l'unica cosa che lo rende verificabile a mano nel database**, e
   * nella prima stesura non la guardava nessuna prova: si poteva svuotare `giorno()` e restare
   * verdi.
   */
  it('⚠️ ogni esempio porta la data e la cliente: senza, non si ritrova niente', () => {
    const c = contaDoppioni([{ clientId: 'ada', data: new Date('2026-09-01T22:00:00Z'), pasti: doppia('s1') }]);
    expect(c.esempi[0].data).toBe('2026-09-01');
    expect(c.esempi[0].clientId).toBe('ada');
  });

  it('⚠️ e il conto dice su che periodo ha misurato', () => {
    const c = contaDoppioni([
      gio('a', '2026-09-03', doppia('s1')), gio('b', '2026-08-30', cinque('2')), gio('c', '2026-09-01', tre('3')),
    ]);
    expect(c.dal).toBe('2026-08-30');
    expect(c.al).toBe('2026-09-03');
  });

  it('nessuna giornata: zero dappertutto, non un errore', () => {
    const c = contaDoppioni([]);
    expect(c.giornate).toBe(0);
    expect(c.giornateConDoppione).toBe(0);
    expect(c.coppie).toEqual([]);
    expect(c.dal).toBeNull();
  });
});

/**
 * ⛔ **IL VERDETTO, E LE SUE PROVE.** Sta nel modulo e non nello script perché è la cosa che decide
 * dove va la correzione — e un giudizio in un file di `prisma/` che nessun test guarda è il tabulato
 * dei panieri dell'1/9, che diceva «⛔ non spostare» in cima e «✅ si può spostare» dodici righe
 * sotto.
 */
describe('dove va la correzione', () => {
  const cinquePasti = (i: number) => [
    p('breakfast', `c${i}`), p('morning_snack', `s${i}`), p('lunch', `p${i}`),
    p('afternoon_snack', `m${i}`), p('dinner', `d${i}`),
  ];
  const conDoppioGemelli = (i: number) => [
    p('breakfast', `c${i}`), p('morning_snack', `s${i}`), p('lunch', `p${i}`),
    p('afternoon_snack', `s${i}`), p('dinner', `d${i}`),
  ];
  const conDoppioAltri = (i: number) => [p('breakfast', `x${i}`), p('lunch', `x${i}`), p('dinner', `d${i}`)];

  const conto = (aRischio: number, gemelli: number, altri = 0) => contaDoppioni([
    ...Array.from({ length: gemelli }, (_, i) => ({ clientId: `g${i}`, data: '2026-09-01', pasti: conDoppioGemelli(i) })),
    ...Array.from({ length: aRischio - gemelli }, (_, i) => ({ clientId: `s${i}`, data: '2026-09-01', pasti: cinquePasti(i) })),
    ...Array.from({ length: altri }, (_, i) => ({ clientId: `a${i}`, data: '2026-09-01', pasti: conDoppioAltri(i) })),
  ]);

  it('⚠️ senza giornate non si dà un verdetto: «non misurato» non è «non serve»', () => {
    expect(doveCorreggere(contaDoppioni([]))).toBe('non misurato');
  });

  /**
   * ⛔ **Zero giornate a rischio è «non misurato», non «✅ non capita».** Se in quella finestra le
   * clienti erano tutte su diete da tre pasti, il difetto non è stato messo alla prova nemmeno una
   * volta — e «non capita» sarebbe la bugia più comoda di tutto il tabulato.
   */
  it('⛔ nessuna giornata con spuntino E merenda: non misurato, non «non serve»', () => {
    const c = contaDoppioni(Array.from({ length: 500 }, (_, i) =>
      ({ clientId: `t${i}`, data: '2026-09-01', pasti: [p('breakfast', `c${i}`), p('lunch', `l${i}`), p('dinner', `d${i}`)] })));
    expect(c.giornate).toBe(500);
    expect(c.giornateARischioGemelli).toBe(0);
    expect(doveCorreggere(c)).toBe('non misurato');
  });

  /**
   * ⛔ Tre giornate con un doppione fanno il 33%, e su tre casi quel 33% sta insieme sia a «sotto
   * soglia» sia a «capita quasi sempre». Un verdetto perentorio su un campione così ha la faccia di
   * una misura senza esserlo.
   */
  it('⛔ campione minuscolo: non si dà un verdetto perentorio', () => {
    expect(doveCorreggere(conto(3, 1))).toBe('campione troppo piccolo');
    expect(GIORNATE_MINIME).toBe(100);
  });

  it('nessun doppione fra gemelli, con campione abbastanza grande: non serve correggere', () => {
    expect(doveCorreggere(conto(200, 0))).toBe('non serve');
  });

  it('⚠️ sotto la soglia: basta una guardia a valle', () => {
    expect(doveCorreggere(conto(200, 8))).toBe('guardia a valle');
  });

  it('⛔ dalla soglia in su: si corregge nella composizione', () => {
    expect(doveCorreggere(conto(200, 10))).toBe('nella composizione');
  });

  /**
   * ⛔ **IL VERDETTO GUARDA I GEMELLI, NON IL TOTALE.** La prima stesura decideva su
   * `giornateConDoppione`, che somma tutte le specie: su un campione con **zero** doppioni fra
   * gemelli e sessanta fra gli altri pasti diceva «correggi `dayCombo`» per un difetto che in quel
   * campione non era mai capitato. Il file intero dice che due cause non si sommano, e poi le
   * sommava proprio dove decideva.
   */
  it('⛔ i doppioni fra pasti NON gemelli non spostano il verdetto', () => {
    const c = conto(200, 0, 300);
    expect(c.perSpecie['altri-pasti']).toBe(300);
    expect(c.giornateConDoppione).toBe(300);
    expect(doveCorreggere(c)).toBe('non serve');
  });

  /**
   * ⛔ **E non lo spostano nemmeno quando i gemelli ci sono, ma pochi.** La prova qui sopra non lo
   * vede: con zero gemelli il verdetto esce prima, sul ramo «non serve», e il confronto sulla
   * soglia non viene nemmeno raggiunto — la mutazione che rimette il totale al posto dei gemelli
   * sopravviveva.
   *
   * Qui i gemelli sono 4 su 200 (2%, sotto soglia: «guardia a valle»), ma il totale con gli altri
   * pasti è 304, che sullo stesso denominatore farebbe il 152%: «nella composizione», cioè il
   * verdetto opposto, per un difetto che fra spuntino e merenda capita nel due per cento dei casi.
   */
  it('⛔ e nemmeno quando i gemelli ci sono ma sono pochi: il verdetto è il loro', () => {
    const c = conto(200, 4, 300);
    expect(c.perSpecie.gemelli).toBe(4);
    expect(c.giornateConDoppione).toBe(304);
    expect(doveCorreggere(c)).toBe('guardia a valle');
  });

  /**
   * ⛔ **E il denominatore sono le giornate A RISCHIO, non tutte.** Con 800 giornate da tre pasti e
   * 200 da cinque di cui 30 col doppione, il tasso vero è il 15% e sul totale sarebbe il 3%: sotto
   * soglia, cioè il verdetto opposto, con la faccia di un numero preciso.
   */
  it('⛔ le giornate dove il difetto è impossibile non diluiscono il tasso', () => {
    const tre = Array.from({ length: 800 }, (_, i) =>
      ({ clientId: `t${i}`, data: '2026-09-01', pasti: [p('breakfast', `c${i}`), p('lunch', `l${i}`), p('dinner', `d${i}`)] }));
    const cinque = Array.from({ length: 30 }, (_, i) => ({ clientId: `g${i}`, data: '2026-09-01', pasti: conDoppioGemelli(i) }));
    const sane = Array.from({ length: 170 }, (_, i) => ({ clientId: `s${i}`, data: '2026-09-01', pasti: cinquePasti(i) }));
    const c = contaDoppioni([...tre, ...cinque, ...sane]);
    expect(c.giornate).toBe(1000);
    expect(c.giornateARischioGemelli).toBe(200);
    // 30/200 = 15%, sopra soglia. Su 30/1000 = 3% sarebbe stato «guardia a valle».
    expect(doveCorreggere(c)).toBe('nella composizione');
  });

  /**
   * ⚠️ **Il confronto è `>=`, non `>`**: esattamente alla soglia si sceglie la strada più solida.
   */
  it('⚠️ esattamente alla soglia vale la strada più solida', () => {
    expect(QUOTA_CHE_CAMBIA_LA_STRADA).toBe(0.05);
    expect(doveCorreggere(conto(100, 5))).toBe('nella composizione');
    expect(doveCorreggere(conto(100, 4))).toBe('guardia a valle');
  });

  it('soglia e numerosità minima si possono spostare da chi chiama: sono numeri di prodotto', () => {
    expect(doveCorreggere(conto(200, 8), 0.02)).toBe('nella composizione');
    expect(doveCorreggere(conto(200, 20), 0.5)).toBe('guardia a valle');
    expect(doveCorreggere(conto(10, 1), undefined, 5)).toBe('nella composizione');
  });
});
