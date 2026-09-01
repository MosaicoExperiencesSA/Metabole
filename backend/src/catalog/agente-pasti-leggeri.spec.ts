import {
  GIRI_A_VUOTO_MAX, OBIETTIVO_PER_PASTO, PER_GIRO_MAX, eUnPastoLeggero, grammiDi,
  pianoDiRiempimento, quanteChiederne, vaglia,
} from './agente-pasti-leggeri';

const CAT: Record<string, string> = {
  'uova': 'proteici', 'avena': 'cereali', 'yogurt greco': 'latticini', 'mela': 'frutta',
  'zucchine': 'verdura', 'broccoli': 'verdura', 'ricotta': 'latticini', 'pane integrale': 'cereali',
};
const cat = (n: string) => CAT[n.toLowerCase()] ?? null;
const g = (name: string, qty: number | null, unit = 'g') => ({ name, qty, unit });

describe('il piano di riempimento', () => {
  const cella = (famiglia: string, slot: string, ora: number, clienti = 0) =>
    ({ famiglia, regime: 'omnivore', slot, ora, obiettivo: OBIETTIVO_PER_PASTO, clienti });

  it('⚠️ le celle già a posto non entrano: un piano con dentro lavoro fatto non si legge', () => {
    expect(pianoDiRiempimento([cella('Mediterranea', 'breakfast', 120)])).toEqual([]);
    expect(pianoDiRiempimento([cella('Mediterranea', 'breakfast', 84)])).toEqual([]);
  });

  it('e dice quante ne mancano', () => {
    expect(pianoDiRiempimento([cella('Keto', 'breakfast', 8)])[0].mancano).toBe(76);
  });

  /**
   * ⛔ Prima quelle con clienti sopra: un paniere con otto colazioni e nessuna cliente non fa male a
   * nessuno oggi; lo stesso paniere con dodici clienti sta già servendo lo stesso piatto ogni pochi
   * giorni.
   */
  it('⛔ l\'ordine mette davanti chi ha clienti sopra, poi chi sta peggio', () => {
    const p = pianoDiRiempimento([
      cella('Vuoto senza clienti', 'breakfast', 2, 0),
      cella('Quasi pieno con clienti', 'breakfast', 80, 12),
      cella('Mezzo senza clienti', 'breakfast', 40, 0),
    ]);
    expect(p.map((x) => x.famiglia)).toEqual([
      'Quasi pieno con clienti', 'Vuoto senza clienti', 'Mezzo senza clienti',
    ]);
  });

  it('i tre pasti leggeri sono quelli e solo quelli', () => {
    expect(['breakfast', 'morning_snack', 'afternoon_snack'].every(eUnPastoLeggero)).toBe(true);
    expect(['lunch', 'dinner'].some(eUnPastoLeggero)).toBe(false);
  });
});

describe('quante chiederne', () => {
  it('⚠️ più di quante ne servono, perché una parte verrà scartata', () => {
    expect(quanteChiederne(4)).toBe(6);
  });

  /** ⛔ Ogni ricetta chiesta è una chiamata pagata: senza tetto, una notte costa quanto un mese. */
  it('⛔ ma mai più del tetto', () => {
    expect(quanteChiederne(1000)).toBe(PER_GIRO_MAX);
    expect(PER_GIRO_MAX).toBeLessThanOrEqual(20);
  });

  it('e zero quando non manca niente', () => {
    expect(quanteChiederne(0)).toBe(0);
    expect(quanteChiederne(-5)).toBe(0);
  });

  it('il numero di giri a vuoto prima di lasciar perdere è dichiarato', () => {
    expect(GIRI_A_VUOTO_MAX).toBeGreaterThanOrEqual(2);
    expect(GIRI_A_VUOTO_MAX).toBeLessThanOrEqual(5);
  });
});

describe('⛔ il vaglio: si rilegge quello che l\'AI ha risposto', () => {
  const gia = new Set<string>(['porridge di avena e mela']);

  it('tiene quelle che rispettano il criterio', () => {
    const v = vaglia([{ name: 'Yogurt greco con avena e mela', ingredients: [g('yogurt greco', 150), g('avena', 40)] }], cat, gia);
    expect(v.buone.map((b) => b.name)).toEqual(['Yogurt greco con avena e mela']);
    expect(v.scartate).toEqual([]);
  });

  /**
   * ⛔ È il difetto che questo modulo esiste per non ripetere: chiedere all'AI di rispettare un
   * criterio non è farglielo rispettare. Il 31/8 il catalogo aveva «Merluzzo crudo in tartare» a
   * colazione perché nessuno aveva mai riletto.
   */
  it.each([
    ['Tartare di merluzzo', [g('merluzzo', 150), g('pane integrale', 30)], 'pesce'],
    ['Vellutata di broccoli', [g('broccoli', 200), g('ricotta', 40)], 'verdura'],
    ['Petto di pollo con avena', [g('petto di pollo', 150), g('avena', 30)], 'carne'],
  ])('⛔ «%s» viene scartata: %s', (name, ingredients, motivo) => {
    const v = vaglia([{ name, ingredients }], cat, gia);
    expect(v.buone).toEqual([]);
    expect(v.scartate).toEqual([{ name, motivo }]);
  });

  it('⛔ e «non si sa» si scarta come nel tabulato: non si riempie un numero con un piatto non guardato', () => {
    const v = vaglia([{ name: 'Cosa strana', ingredients: [g('trancio misto', 200)] }], cat, gia);
    expect(v.scartate).toEqual([{ name: 'Cosa strana', motivo: 'non si sa' }]);
  });

  it('⚠️ un doppione non aggiunge scelta a nessuno: si scarta e si dice', () => {
    const v = vaglia([{ name: 'Porridge di Avena e Mela', ingredients: [g('avena', 60)] }], cat, gia);
    expect(v.scartate).toEqual([{ name: 'Porridge di Avena e Mela', motivo: 'doppione' }]);
  });

  it('⚠️ e nemmeno due volte la stessa dentro la stessa risposta', () => {
    const r = { name: 'Porridge nuovo', ingredients: [g('avena', 60)] };
    const v = vaglia([r, { ...r }], cat, gia);
    expect(v.buone).toHaveLength(1);
    expect(v.scartate).toEqual([{ name: 'Porridge nuovo', motivo: 'doppione' }]);
  });

  it.each([
    [{ ingredients: [g('avena', 60)] }, 'senza nome'],
    [{ name: 'Senza niente', ingredients: [] }, 'senza ingredienti'],
    [{ name: 'Senza niente', ingredients: 'avena' }, 'senza ingredienti'],
  ])('scarta le risposte malformate (%p) invece di salvarle', (r, motivo) => {
    expect(vaglia([r as never], cat, gia).scartate[0].motivo).toBe(motivo);
  });

  it('⚠️ le grammature in pezzi non contano: «2 pz» non si confronta con «150 g»', () => {
    expect(grammiDi(g('uova', 2, 'pz'))).toBeNull();
    expect(grammiDi(g('uova', 120))).toBe(120);
    expect(grammiDi(g('sale', null, 'q.b.'))).toBeNull();
  });
});
