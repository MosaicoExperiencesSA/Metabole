import { TAGLIA_MASSIMA, TAGLIA_MINIMA, fraseTaglia, tagliaDalFabbisogno } from './taglia-dal-fabbisogno';

describe('tagliaDalFabbisogno', () => {
  it('la mediana, arrotondata a 50', () => {
    const e = tagliaDalFabbisogno([1580, 1620, 1990], 1500);
    expect(e.mediana).toBe(1620);
    expect(e.taglia).toBe(1600);
    expect(e.motivo).toBe('dal_fabbisogno');
    expect(e.quante).toBe(3);
  });

  /**
   * ⚠️ LA RAGIONE DI TUTTO IL MODULO. Una cliente a 3200 in mezzo a dieci a 1600 sposterebbe la
   * MEDIA a ~1745, e il catalogo con lei: dieci persone riceverebbero piatti pensati per una. La
   * mediana è la persona in mezzo, e non si lascia spostare da un caso estremo.
   */
  it('⚠️ un caso estremo NON sposta la taglia: è la mediana, non la media', () => {
    const dieci = Array.from({ length: 10 }, () => 1600);
    const e = tagliaDalFabbisogno([...dieci, 3200], 1500);
    expect(e.taglia).toBe(1600);
    // La media sarebbe stata 1745: la differenza è quello che questa scelta protegge.
    const media = [...dieci, 3200].reduce((a, b) => a + b, 0) / 11;
    expect(Math.round(media)).toBe(1745);
  });

  it('con un numero pari di clienti prende il punto di mezzo fra le due centrali', () => {
    expect(tagliaDalFabbisogno([1400, 1600, 1800, 2000], 1500).mediana).toBe(1700);
  });

  /**
   * ⚠️ «Nessun fabbisogno noto» non è «il fabbisogno è quello di scorta»: un numero calcolato sul
   * nulla ha lo stesso aspetto di un numero calcolato bene, e chi legge deve poterli distinguere.
   */
  it('⚠️ senza nessun fabbisogno resta la taglia del preset, E LO DICE', () => {
    const e = tagliaDalFabbisogno([], 1800);
    expect(e).toMatchObject({ taglia: 1800, motivo: 'nessun_fabbisogno_noto', quante: 0, mediana: null });
  });

  it('i valori che non sono numeri veri non contano, e se restano zero si ripiega', () => {
    const e = tagliaDalFabbisogno([null, undefined, NaN, 0, -100], 1500);
    expect(e.motivo).toBe('nessun_fabbisogno_noto');
    expect(e.quante).toBe(0);
  });

  it('resta dentro i limiti del parametro, in tutt\'e due i versi', () => {
    expect(tagliaDalFabbisogno([100, 120], 1500).taglia).toBe(TAGLIA_MINIMA);
    expect(tagliaDalFabbisogno([9000, 9500], 1500).taglia).toBe(TAGLIA_MASSIMA);
  });
});

describe('⚠️ quante restano fuori banda anche con la taglia scelta', () => {
  it('un gruppo stretto: nessuna fuori', () => {
    expect(tagliaDalFabbisogno([1550, 1600, 1650], 1500, 15).fuoriBanda).toBe(0);
  });

  /**
   * ⚠️ È il numero che dice se serve una SECONDA TAGLIA (`Diet.levels` nasce per questo, e il
   * livello 2 non è mai stato usato). Con un gruppo largo la mediana resta la scelta migliore
   * possibile — non una soluzione, e la differenza va detta prima, non scoperta dai menu.
   */
  it('⚠️ un gruppo largo: la mediana è la scelta migliore, ma non basta — e si conta', () => {
    const e = tagliaDalFabbisogno([1400, 1500, 1700, 2400, 2900], 1500, 15);
    expect(e.taglia).toBe(1700);
    expect(e.minimo).toBe(1400);
    expect(e.massimo).toBe(2900);
    // ⚠️ TRE, non due: con la taglia a 1700 e la banda al 15% il pavimento è 1445, quindi anche
    // la cliente a 1400 resta fuori — riceve piatti troppo grandi. Avevo scritto «2» pensando solo
    // a chi sta sopra, e l'ha corretto il test: è esattamente l'errore che `fuoriBanda` conta in
    // tutt'e due i versi per non far commettere a chi genera.
    expect(e.fuoriBanda).toBe(3); // 1400 (sotto), 2400 e 2900 (sopra)
  });

  /**
   * ⚠️ Si conta in TUTT'E DUE i versi. Contare solo chi sta sopra farebbe sembrare che alzare la
   * taglia non costi niente — e invece chi ha il fabbisogno basso si ritroverebbe piatti troppo
   * grandi, che è lo stesso difetto girato.
   */
  it('⚠️ anche chi sta troppo SOTTO conta: alzare la taglia non è gratis', () => {
    const e = tagliaDalFabbisogno([1000, 2000, 2100, 2200], 1500, 15);
    expect(e.fuoriBanda).toBeGreaterThanOrEqual(1);
  });
});

describe('fraseTaglia — chi genera deve saperlo PRIMA', () => {
  it('dice su quante è calcolata, e che stanno tutte dentro', () => {
    expect(fraseTaglia(tagliaDalFabbisogno([1580, 1620, 1650], 1500))).toContain('Tutte e 3 stanno dentro la banda');
  });

  it('⚠️ e quando una taglia sola non basta lo dice, col minimo e il massimo', () => {
    const f = fraseTaglia(tagliaDalFabbisogno([1400, 1500, 1700, 2400, 2900], 1500, 15));
    expect(f).toContain('3 su 5 restano comunque fuori banda');
    expect(f).toContain('da 1400 a 2900 kcal');
    expect(f).toContain('una taglia sola non le serve tutte');
  });

  it('senza clienti dice che il numero è quello del preset, non un calcolo', () => {
    expect(fraseTaglia(tagliaDalFabbisogno([], 1800))).toContain('resta quella del preset');
  });
});
