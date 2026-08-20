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
  /**
   * ⚠️ **QUESTO TEST DICEVA IL CONTRARIO FINO AL 20/8, E IL CONTRARIO ERA SBAGLIATO.**
   *
   * Diceva: «un nome fuori tabella che si abbinerebbe **suggerisce** la riga», e verificava che
   * finisse in elenco con `motivo: 'non_in_tabella'`. ⛔ Ma se l'abbinamento ci arriva **il conto
   * della ricetta funziona già** — `cercaPerIngrediente` fa esattamente questi due passi. Quindi
   * l'elenco chiedeva a una persona di sistemare cose che nessuno doveva sistemare, e le metteva
   * **davanti** a quelle vere.
   *
   * ⚠️ *Un elenco di lavoro che contiene cose già fatte non è lungo: è falso.* E il costo lo paga
   * chi ci lavora, che dopo tre righe inutili smette di fidarsi anche delle altre.
   */
  it('⚠️ un nome che l\'abbinamento risolve NON è un lavoro: esce dall\'elenco', () => {
    expect(scoperti([['olio extravergine d oliva', 2486]])).toEqual([]);
  });

  /**
   * ⚠️ **MA SOLO SE QUELLA RIGA SI PUÒ DAVVERO USARE.** Se l'abbinamento porta a una riga bollita il
   * problema c'è eccome — ed è **quello**, non «il nome non c'è». Dirlo col motivo giusto è l'unica
   * cosa che rende l'elenco azionabile: «aggiungi la riga a crudo» è un'istruzione, «non in
   * tabella» su un nome che in tabella ci arriva è una caccia al tesoro.
   */
  it('⚠️ se l\'abbinamento porta a una riga solo da cotto, il motivo è QUELLO', () => {
    const righe = [{ name: 'lenticchie', synonyms: [], state: 'bollite' }];
    const [x] = ingredientiScoperti(new Map([['lenticchie bio', 12]]), righe);
    expect(x.motivo).toBe('solo_da_cotto');
    expect(x.suggerito).toBe('lenticchie');
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
