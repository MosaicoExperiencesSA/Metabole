import { ingredientiScoperti, usiNegliIngredienti } from './ingredienti-scoperti';

const ric = (...nomi: string[]) => ({ ingredients: nomi.map((name) => ({ name, qty: 100, unit: 'g' })) });

const TABELLA = [
  { name: 'olio extravergine di oliva', synonyms: ['olio evo'], state: 'crudo' },
  { name: 'lenticchie', synonyms: [], state: 'bollito' },
  { name: 'sedano', synonyms: [], state: null },
  { name: 'spinaci', synonyms: [], state: 'crudo' },
];

describe('quante ricette usano ciascun ingrediente', () => {
  it('conta le ricette, non le righe', () => {
    const usi = usiNegliIngredienti([ric('spinaci', 'olio'), ric('spinaci')]);
    expect(usi.get('spinaci')).toBe(2);
    expect(usi.get('olio')).toBe(1);
  });

  /** ⚠️ Lo stesso ingrediente due volte nella stessa ricetta è UNA ricetta che lo usa, non due. */
  it('⚠️ un piatto che ripete l\'olio non lo fa salire in cima da solo', () => {
    expect(usiNegliIngredienti([ric('olio', 'olio', 'olio')]).get('olio')).toBe(1);
  });

  it('normalizza: maiuscole, accenti e apostrofi non fanno due righe', () => {
    const usi = usiNegliIngredienti([ric('Olio Extravergine d\'Oliva'), ric('olio extravergine d oliva')]);
    expect(usi.get('olio extravergine d oliva')).toBe(2);
  });

  it('quello che non è scritto non conta, e non esplode', () => {
    expect(usiNegliIngredienti([{ ingredients: null }, { ingredients: [{}] }, ric('')]).size).toBe(0);
  });
});

describe('l\'elenco di lavoro degli ingredienti scoperti', () => {
  const scoperti = (usi: [string, number][]) => ingredientiScoperti(new Map(usi), TABELLA);

  it('quello che si conta bene non è nell\'elenco: è lavoro finito', () => {
    expect(scoperti([['spinaci', 10]])).toEqual([]);
  });

  /** ⚠️ Il caso che fa risparmiare il lavoro: una riga di sinonimo chiude migliaia di ricette. */
  it('⚠️ un nome fuori tabella che si abbinerebbe SUGGERISCE la riga: si chiude con un sinonimo', () => {
    const [x] = scoperti([['olio extravergine d oliva', 2486]]);
    expect(x.motivo).toBe('non_in_tabella');
    expect(x.suggerito).toBe('olio extravergine di oliva');
  });

  /** E quando non si abbinerebbe a niente, non si inventa: la riga va scritta. */
  it('un nome che non porta da nessuna parte non ha suggerimenti', () => {
    const [x] = scoperti([['melanzane', 1025]]);
    expect(x).toMatchObject({ motivo: 'non_in_tabella', suggerito: null });
  });

  /**
   * ⚠️ La convenzione del crudo: «lenticchie» in tabella è **bollita**, e la ricetta che dice
   * «lenticchie 80 g» intende le secche. Contarla bollita sbaglia di tre volte, quindi la riga
   * manca davvero — anche se il nome c'è.
   */
  it('⚠️ la riga che c\'è ma solo da cotto è lavoro, non lavoro finito', () => {
    expect(scoperti([['lenticchie', 300]])[0]).toMatchObject({ motivo: 'solo_da_cotto', suggerito: 'lenticchie' });
  });

  /** ⚠️ «Senza stato» non è «cotto»: è «non lo so», e va dichiarato invece che taciuto. */
  it('⚠️ la riga senza stato è un terzo caso, e si chiude in un altro modo', () => {
    expect(scoperti([['sedano', 40]])[0]).toMatchObject({ motivo: 'senza_stato' });
  });

  /** ⚠️ In cima quello che pesa di più, e «pesa» è un FATTO: quante ricette lo usano. */
  it('⚠️ ordinato per quante ricette lo usano', () => {
    const e = scoperti([['sedano', 40], ['melanzane', 1025], ['lenticchie', 300]]);
    expect(e.map((x) => x.nome)).toEqual(['melanzane', 'lenticchie', 'sedano']);
  });

  it('a pari uso l\'ordine è stabile e leggibile, non quello della memoria', () => {
    const e = scoperti([['zucchine', 5], ['melanzane', 5]]);
    expect(e.map((x) => x.nome)).toEqual(['melanzane', 'zucchine']);
  });
});
