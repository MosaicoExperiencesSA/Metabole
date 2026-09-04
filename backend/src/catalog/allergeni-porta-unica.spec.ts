import { suggestAllergens } from './allergens';
import { allergeniConPortaUnica, contaPortaUnica, parolaCheContiene, paroleCheContengono } from './allergeni-porta-unica';

/**
 * ⛔ **LA MISURA PRIMA DELLA DECISIONE — e la prova che la misura misura la cosa giusta.**
 *
 * Il conto dice a Simone quante ricette cambiano etichetta accendendo la porta unica. Se il conto
 * sbagliasse, sbaglierebbe **una decisione sul catalogo**, non un tabulato.
 */

const oggi = (i: unknown) => suggestAllergens(i).map((a) => ({ allergen: a.allergen, matched: a.matched }));

describe('la seconda copia di «questa chiave vale?»', () => {
  /**
   * ⛔ **LE TRE PAROLE DEL RIQUADRO DEL 4/9.** Sono la ragione per cui `SOLO_A_INIZIO_PAROLA`
   * esiste: 239 occorrenze su 24 mila ricette, e nessuna ha a che vedere col formaggio o col
   * frumento. La regola era scritta e la leggeva **una porta sola**.
   */
  it('⛔ oggi «melograno» ha il glutine e «melagrana» il latte; con la porta unica no', () => {
    const casi = [
      { ingrediente: 'melograno sgranato', allergene: 'glutine' },
      { ingrediente: 'melagrana fresca', allergene: 'latte' },
      { ingrediente: 'piselli sgranati', allergene: 'latte' },
    ];
    for (const c of casi) {
      const prima = oggi([{ name: c.ingrediente }]).map((a) => a.allergen);
      const dopo = allergeniConPortaUnica([{ name: c.ingrediente }]).map((a) => a.allergen);
      expect(prima).toContain(c.allergene);
      expect(dopo).not.toContain(c.allergene);
    }
  });

  /**
   * ⚠️ **La controprova, e conta più della prima**: la porta unica non deve **togliere protezione**
   * dove la parola comincia davvero. «grana padano» è formaggio, «grano saraceno» è cereale, e se
   * questa riga diventasse rossa la correzione toglierebbe un allergene a chi ce l'ha per davvero.
   */
  it('⛔ ma «grana padano» resta latte e «grano duro» resta glutine', () => {
    expect(allergeniConPortaUnica([{ name: 'grana padano grattugiato' }]).map((a) => a.allergen)).toContain('latte');
    expect(allergeniConPortaUnica([{ name: 'semola di grano duro' }]).map((a) => a.allergen)).toContain('glutine');
  });

  /** ⚠️ E quello che le due copie già facevano uguale non cambia: le omonime e le frasi restano. */
  it('⚠️ le omonime e le frasi valgono ancora: «bovino» non è vino, «latte di mandorla» non è latte', () => {
    expect(allergeniConPortaUnica([{ name: 'straccetti di bovino' }]).map((a) => a.allergen)).not.toContain('solfiti');
    expect(allergeniConPortaUnica([{ name: 'latte di mandorla' }]).map((a) => a.allergen)).not.toContain('latte');
  });
});

describe('la parola da far leggere a una persona', () => {
  it('torna la parola INTERA che contiene la chiave, non la chiave', () => {
    expect(parolaCheContiene('melograno sgranato', 'grano')).toBe('melograno');
    expect(parolaCheContiene('piselli sgranati', 'grana')).toBe('sgranati');
  });

  /**
   * ⛔ **`null` quando la chiave comincia una parola**, e non è un dettaglio: senza, il tabulato
   * elencherebbe «grana padano» accanto a «melagrana» e chi legge dovrebbe separarli a mano. *Un
   * elenco di lavoro che contiene lavoro già fatto è un elenco che si smette di leggere.*
   */
  it('⛔ e niente quando la chiave comincia la parola: lì non c\'è niente da decidere', () => {
    expect(parolaCheContiene('grana padano', 'grana')).toBeNull();
    expect(parolaCheContiene('grano saraceno', 'grano')).toBeNull();
  });

  /** ⚠️ E se la chiave compare due volte, si guarda anche la seconda: la prima può essere a posto. */
  it('⚠️ trova l\'occorrenza dentro una parola anche se la prima è a inizio', () => {
    expect(parolaCheContiene('grano saraceno e melograno', 'grano')).toBe('melograno');
  });

  /**
   * ⛔ **TUTTE le parole, non la prima.** La prima stesura ne rendeva una sola: su «melagrana e
   * piselli sgranati» tornava `melagrana`, e `sgranati` per quella ricetta non esisteva. Non si
   * perde un esempio — si perde una **riga dell'elenco da leggere**, e una parola che compare
   * sempre accanto a un'altra non compare mai.
   */
  it('⛔ rende TUTTE le parole che contengono la chiave, non solo la prima', () => {
    expect(paroleCheContengono('melagrana e piselli sgranati', 'grana')).toEqual(['melagrana', 'sgranati']);
  });

  /** ⚠️ E la stessa parola due volte si conta una: è un elenco da leggere, non un conteggio. */
  it('⚠️ la stessa parola ripetuta non esce due volte', () => {
    expect(paroleCheContengono('melagrana e succo di melagrana', 'grana')).toEqual(['melagrana']);
  });
});

describe('il conto che decide', () => {
  const RICETTE = [
    { id: '1', name: 'Insalata di melagrana e finocchi', ingredients: [{ name: 'melagrana' }, { name: 'finocchi' }], allergens: ['latte'] },
    { id: '2', name: 'Vellutata di melograno', ingredients: [{ name: 'melograno' }], allergens: [] },
    { id: '3', name: 'Pasta al grano saraceno', ingredients: [{ name: 'grano saraceno' }], allergens: ['glutine'] },
  ];

  /**
   * ⛔ **I due numeri hanno denominatori diversi ed è tutto il punto.** «Cambiano» conta l'elenco
   * dedotto; «cambiano davvero» conta chi quell'allergene ce l'ha **scritto** in catalogo, cioè chi
   * torna servibile a un'allergica. Confonderli fa sembrare grosso un lavoro che non c'è, o
   * piccolo uno che c'è.
   */
  it('⛔ separa «cambia la deduzione» da «cambia quello che è scritto»', () => {
    const c = contaPortaUnica(RICETTE, oggi);
    expect(c.esaminate).toBe(3);
    expect(c.cambiano).toBe(2);
    expect(c.cambianoDavvero).toBe(1);
  });

  /**
   * ⛔ **`guadagnati` deve restare ZERO.** La porta unica aggiunge un filtro: se qualcosa
   * guadagnasse un allergene vorrebbe dire che le due copie divergevano in un modo che nessuno
   * aveva capito, e la misura andrebbe riletta prima di toccare il catalogo. È la sentinella del
   * tabulato, non una curiosità.
   */
  it('⛔ non si guadagna mai un allergene: la porta unica toglie e basta', () => {
    expect(contaPortaUnica(RICETTE, oggi).guadagnati).toBe(0);
  });

  it('⚠️ raggruppa per (allergene, parola) e dice quante ricette e quante scritte', () => {
    const c = contaPortaUnica(RICETTE, oggi);
    const melagrana = c.coppie.find((x) => x.parola === 'melagrana');
    expect(melagrana).toMatchObject({ allergen: 'latte', chiave: 'grana', ricette: 1, scritte: 1 });
    expect(melagrana!.esempi[0]).toBe('Insalata di melagrana e finocchi');
    /** ⚠️ E «grano saraceno» non compare: lì la chiave comincia la parola, non c'è niente da leggere. */
    expect(c.coppie.some((x) => x.parola.includes('saraceno'))).toBe(false);
  });

  /** ⚠️ Prima quelle che cambiano davvero: chi legge parte da dove il conto pesa. */
  it('⚠️ le coppie escono in ordine di quante ricette toccano DAVVERO', () => {
    const c = contaPortaUnica(RICETTE, oggi);
    expect(c.coppie[0].scritte).toBeGreaterThanOrEqual(c.coppie[c.coppie.length - 1].scritte);
  });

  /** ⚠️ E chi quell'allergene non ce l'ha scritto conta nelle ricette e non nelle scritte. */
  it('⚠️ «scritte» conta solo chi ha il tag in catalogo', () => {
    const c = contaPortaUnica(RICETTE, oggi);
    const melograno = c.coppie.find((x) => x.parola === 'melograno');
    expect(melograno).toMatchObject({ ricette: 1, scritte: 0 });
  });

  /**
   * ⛔ **UNA RICETTA VALE UNO, anche se quella parola le compare in tre ingredienti.** La prima
   * stesura contava i **nomi di ingrediente**: in catalogo gli elenchi sono scritti così, e
   * `ricette = 3` su una ricetta sola gonfiava il tabulato **nel verso che fa sembrare grosso un
   * lavoro che non c'è**. Chi sommava le righe otteneva un numero diverso da «cambiano davvero».
   */
  it('⛔ la stessa parola in tre ingredienti conta una ricetta, non tre', () => {
    const c = contaPortaUnica(
      [{
        id: 'x',
        name: 'Vellutata di melograno',
        ingredients: [{ name: 'melograno' }, { name: 'succo di melograno' }, { name: 'chicchi di melograno' }],
        allergens: ['glutine'],
      }],
      oggi,
    );
    const riga = c.coppie.find((x) => x.parola === 'melograno');
    expect(riga).toMatchObject({ ricette: 1, scritte: 1 });
    expect(riga!.esempi).toEqual(['Vellutata di melograno']);
  });

  /**
   * ⛔ **NELL'ELENCO CI VA SOLO LA CHIAVE CHE LA PORTA UNICA SCARTA DAVVERO.** La prima stesura
   * girava su **tutte** le keyword dell'allergene perso: su «insalata di rapanelli e melograno»
   * usciva anche «pane» dentro «rapanelli», che con la perdita del glutine non c'entra niente —
   * quella la toglie `grano` — e per giunta è una coppia chiusa nelle omonime dal 4/9.
   */
  it('⛔ non mette in elenco le chiavi che con la perdita non c\'entrano', () => {
    const c = contaPortaUnica(
      [{ id: 'y', name: 'Insalata di rapanelli e melograno', ingredients: [{ name: 'insalata di rapanelli e melograno' }], allergens: ['glutine'] }],
      oggi,
    );
    expect(c.coppie.map((x) => x.parola)).toEqual(['melograno']);
  });

  /**
   * ⛔ **LA SENTINELLA `guadagnati` DEVE MORDERE, e sul campione vero non mordeva**: lo zero era
   * vero anche cancellando il codice che lo calcola. Qui la deduzione «di oggi» è finta e rende
   * **meno** di quella con la porta unica: se il conto non se ne accorge, il tabulato direbbe
   * «tutto a posto» proprio nel caso in cui le due copie divergono in un modo che nessuno ha capito.
   */
  it('⛔ se qualcosa GUADAGNASSE un allergene, il conto lo dice', () => {
    const c = contaPortaUnica(
      [{ id: 'z', name: 'Pane integrale', ingredients: [{ name: 'farina di grano' }], allergens: [] }],
      () => [],
    );
    expect(c.guadagnati).toBe(1);
  });
});
