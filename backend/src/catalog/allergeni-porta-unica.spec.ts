import { suggestAllergens } from './allergens';
import { allergeniFalsiDaTogliere, contaRiparazione, parolaCheContiene, paroleCheContengono } from './allergeni-porta-unica';

/**
 * ⛔ **LA PORTA UNICA, E QUELLO CHE SI LASCIA DIETRO.**
 *
 * Queste prove tengono ferme due cose diverse: che la porta unica **funzioni** (le parole del
 * riquadro del 4/9 non fanno più scattare niente, e quelle vere sì), e che la riparazione tolga
 * **solo** quello di cui si sa il perché. La seconda decide una scrittura sul catalogo.
 */

const dedotti = (i: unknown) => suggestAllergens(i).map((a) => a.allergen);

describe('la porta unica: «questa chiave vale?» adesso è una sola', () => {
  /**
   * ⛔ **LE PAROLE MISURATE SUL CATALOGO VERO, 4/9**: 190 ricette su 23 726, tutte col tag scritto.
   * Otto coppie, e Simone le ha lette una per una: tutte e otto «no».
   */
  it('⛔ «melograno» non ha più il glutine, «melagrana» e «sgranati» non hanno più il latte', () => {
    expect(dedotti([{ name: 'melograno sgranato' }])).not.toContain('glutine');
    expect(dedotti([{ name: 'melagrana fresca' }])).not.toContain('latte');
    expect(dedotti([{ name: 'edamame sgranati' }])).not.toContain('latte');
  });

  /**
   * ⛔ **Diciassette piatti di CARNE risultavano contenere PESCE**, perché la zucca è «dorata». E
   * uno era la «corata di coniglio», che è una frattaglia.
   */
  it('⛔ «dorata» e «corata» non sono più pesce', () => {
    expect(dedotti([{ name: 'zucca dorata al forno' }])).not.toContain('pesce');
    expect(dedotti([{ name: 'corata di coniglio' }])).not.toContain('pesce');
  });

  /**
   * ⚠️ **La controprova, e conta più delle altre**: la porta unica non deve togliere protezione dove
   * la parola comincia davvero. Se questa riga diventasse rossa, la correzione starebbe togliendo un
   * allergene a chi ce l'ha per davvero.
   */
  it('⛔ ma «grana padano» resta latte, «grano duro» resta glutine, «orata» resta pesce', () => {
    expect(dedotti([{ name: 'grana padano grattugiato' }])).toContain('latte');
    expect(dedotti([{ name: 'semola di grano duro' }])).toContain('glutine');
    expect(dedotti([{ name: 'filetto di orata' }])).toContain('pesce');
  });

  /** ⚠️ E quello che la vecchia copia già faceva bene non si è perso: omonime e frasi restano. */
  it('⚠️ «bovino» non è vino e «latte di mandorla» non è latte', () => {
    expect(dedotti([{ name: 'straccetti di bovino' }])).not.toContain('solfiti');
    expect(dedotti([{ name: 'latte di mandorla' }])).not.toContain('latte');
  });
});

describe('la parola da far leggere a una persona', () => {
  it('torna la parola INTERA che contiene la chiave, non la chiave', () => {
    expect(parolaCheContiene('melograno sgranato', 'grano')).toBe('melograno');
  });

  it('⛔ e niente quando la chiave comincia la parola: lì non c\'è niente da decidere', () => {
    expect(parolaCheContiene('grana padano', 'grana')).toBeNull();
  });

  /**
   * ⛔ **TUTTE le parole, non la prima.** Su «melagrana e piselli sgranati» la prima stesura rendeva
   * `melagrana` e basta: si perdeva una riga dell'elenco da leggere, e una parola che compare sempre
   * accanto a un'altra non compariva mai.
   */
  it('⛔ rende tutte le parole, non solo la prima', () => {
    expect(paroleCheContengono('melagrana e piselli sgranati', 'grana')).toEqual(['melagrana', 'sgranati']);
  });

  it('⚠️ e la stessa parola ripetuta esce una volta sola', () => {
    expect(paroleCheContengono('melagrana e succo di melagrana', 'grana')).toEqual(['melagrana']);
  });
});

describe('la riparazione: si toglie solo quello di cui si sa il perché', () => {
  it('⛔ toglie l\'allergene falso, e dice quale parola lo faceva scattare', () => {
    const falsi = allergeniFalsiDaTogliere({
      id: '1', name: 'Vellutata di melograno', ingredients: [{ name: 'melograno' }], allergens: ['glutine'],
    });
    expect(falsi).toEqual([{ allergen: 'glutine', chiave: 'grano', parola: 'melograno', ingrediente: 'melograno' }]);
  });

  /**
   * ⛔ **QUESTA È LA PROVA CHE PROTEGGE IL CATALOGO.** `setRecipeAllergens` esiste, ed è la porta per
   * gli allergeni che dagli ingredienti non si vedono: un condimento pronto, una contaminazione di
   * lavorazione. Riscrivere l'elenco con la deduzione li cancellerebbe **tutti**, in silenzio — cioè
   * per togliere una protezione falsa se ne toglierebbero di vere.
   */
  it('⛔ NON tocca un allergene aggiunto a mano, di cui non si sa il perché', () => {
    const falsi = allergeniFalsiDaTogliere({
      id: '2', name: 'Insalata di ceci', ingredients: [{ name: 'ceci lessi' }, { name: 'rucola' }], allergens: ['sesamo'],
    });
    expect(falsi).toEqual([]);
  });

  /** ⚠️ E non tocca quello che la deduzione trova ancora: lì il tag è giusto. */
  it('⚠️ non tocca gli allergeni che la deduzione trova ancora', () => {
    const falsi = allergeniFalsiDaTogliere({
      id: '3', name: 'Pasta al pomodoro', ingredients: [{ name: 'pasta di grano duro' }], allergens: ['glutine'],
    });
    expect(falsi).toEqual([]);
  });

  /** ⚠️ Una ricetta senza niente scritto non ha niente da riparare, e non si legge nemmeno. */
  it('⚠️ senza allergeni scritti non c\'è niente da riparare', () => {
    expect(allergeniFalsiDaTogliere({ id: '4', name: 'x', ingredients: [{ name: 'melograno' }], allergens: [] })).toEqual([]);
  });

  const CATALOGO = [
    { id: '1', name: 'Vellutata di melograno', ingredients: [{ name: 'melograno' }], allergens: ['glutine'], allergensReviewed: true },
    { id: '2', name: 'Edamame arrostiti', ingredients: [{ name: 'edamame sgranati' }], allergens: ['latte', 'soia'], allergensReviewed: true },
    { id: '3', name: 'Pasta al pomodoro', ingredients: [{ name: 'pasta di grano duro' }], allergens: ['glutine'], allergensReviewed: false },
  ];

  it('⛔ conta le ricette da riparare e quante portano la spunta', () => {
    const c = contaRiparazione(CATALOGO);
    expect(c.esaminate).toBe(3);
    expect(c.daRiparare).toBe(2);
    expect(c.confermate).toBe(2);
  });

  /** ⚠️ E la soia dell'edamame resta: si toglie il latte, non l'elenco. */
  it('⚠️ sull\'edamame toglie il latte e lascia la soia', () => {
    const falsi = allergeniFalsiDaTogliere(CATALOGO[1]).map((f) => f.allergen);
    expect(falsi).toEqual(['latte']);
  });

  it('⚠️ raggruppa per (allergene, parola) col nome della ricetta come esempio', () => {
    const c = contaRiparazione(CATALOGO);
    expect(c.coppie.map((x) => x.parola).sort()).toEqual(['melograno', 'sgranati']);
    expect(c.coppie.find((x) => x.parola === 'sgranati')!.esempi).toEqual(['Edamame arrostiti']);
  });
});

/**
 * ⛔ **QUELLO CHE LA RIPARAZIONE NON PUÒ SAPERE GUARDANDO LA RICETTA — e come si difende.**
 *
 * Una revisione avversariale ha misurato due famiglie di casi. Sono diverse, e la prima stesura le
 * trattava uguali.
 *
 * · **La vecchia porta NON aveva scritto niente** — «solfiti» su «straccetti di bovino», «glutine»
 *   su «rapanelli»: le omonime le conosceva dal 20/8. Se quel tag c'è, ce l'ha messo una persona, e
 *   il criterio giusto lo salva da solo.
 * · **La vecchia porta lo scriveva, ma poteva volerlo anche una persona** — «glutine» su «chicchi di
 *   melograno + salsa di soia» (il frumento della salsa), «pesce» su «zucca dorata + salsa
 *   Worcestershire» (le acciughe). ⛔ Dagli ingredienti le due cose sono **indistinguibili**, e
 *   togliere è irreversibile. Lì non decide la macchina: si guarda se qualcuno ha messo le mani.
 */
describe('⛔ la riparazione non tocca gli allergeni messi a mano', () => {
  /** ⚠️ Prima famiglia: il criterio li salva da solo, senza bisogno di sapere altro. */
  const salvatiDalCriterio = [
    { nome: 'Brasato al vino rosso', ing: ['straccetti di bovino', 'rosmarino'], tag: 'solfiti', perche: '«vino» dentro «bovino»' },
    { nome: 'Insalata di rapanelli', ing: ['rapanelli', 'crostini pronti'], tag: 'glutine', perche: '«pane» dentro «rapanelli»' },
  ];
  for (const c of salvatiDalCriterio) {
    it(`⛔ tiene ${c.tag} su «${c.nome}»: ${c.perche} la vecchia porta non lo scriveva`, () => {
      expect(allergeniFalsiDaTogliere({
        id: 'x', name: c.nome, ingredients: c.ing.map((name) => ({ name })), allergens: [c.tag],
      })).toEqual([]);
    });
  }

  /**
   * ⛔ **Seconda famiglia, ed è quella che fa male.** Qui il criterio da solo **toglie**, e
   * toglierebbe le acciughe della salsa Worcestershire. La difesa non è una regola più furba: è
   * sapere che qualcuno ha scelto quella lista a mano (`catalog.recipe.allergens.set` nel registro).
   */
  const soloConLaTraccia = [
    { nome: 'Bowl con salsa di soia', ing: ['chicchi di melograno', 'salsa di soia'], tag: 'glutine' },
    { nome: 'Zucca con worcestershire', ing: ['zucca dorata', 'salsa worcestershire'], tag: 'pesce' },
  ];
  for (const c of soloConLaTraccia) {
    it(`⛔ su «${c.nome}» il criterio da solo toglierebbe ${c.tag}: e per questo serve la traccia`, () => {
      const senza = allergeniFalsiDaTogliere({
        id: 'y', name: c.nome, ingredients: c.ing.map((name) => ({ name })), allergens: [c.tag],
      });
      expect(senza.map((f) => f.allergen)).toEqual([c.tag]);
      const con = allergeniFalsiDaTogliere({
        id: 'y', name: c.nome, ingredients: c.ing.map((name) => ({ name })), allergens: [c.tag], toccataAMano: true,
      });
      expect(con).toEqual([]);
    });
  }

  /** ⚠️ E la controprova: quello che la vecchia porta scriveva davvero si toglie ancora. */
  it('⚠️ ma toglie ancora il glutine falso del melograno, quando e lui a portarlo', () => {
    const falsi = allergeniFalsiDaTogliere({
      id: 'z', name: 'Vellutata di melograno', ingredients: [{ name: 'melograno' }], allergens: ['glutine'],
    });
    expect(falsi.map((f) => f.allergen)).toEqual(['glutine']);
  });
});
