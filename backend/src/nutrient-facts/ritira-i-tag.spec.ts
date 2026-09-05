import { allergeniDopoIlRitiro, tagDaRitirare, type RicettaOggi } from './ritira-i-tag';

/**
 * ⛔ **IL GESTO INVERSO.** Ogni prova qui è un modo in cui togliere un tag sarebbe **sbagliato**: il
 * ritiro è il gesto che si fa dopo aver scoperto un errore, ed è proprio nei momenti così che si
 * combina il danno più grosso — togliere anche quello che non c'entra.
 */

const ric = (o: Partial<RicettaOggi> & { id: string }): RicettaOggi => ({
  name: `Ricetta ${o.id}`, allergens: [], dedottoDalleParole: [], ...o,
});

const registro = [
  { recipeId: 'r1', aggiunti: [{ allergen: 'latte', ingrediente: 'pesto pronto', alimento: 'pesto pronto' }] },
  { recipeId: 'r2', aggiunti: [{ allergen: 'latte', ingrediente: 'pesto pronto', alimento: 'pesto pronto' }] },
];

describe('tagDaRitirare', () => {
  it('✅ toglie il tag arrivato da quell\'alimento', () => {
    const out = tagDaRitirare('pesto pronto', registro, new Map([
      ['r1', ric({ id: 'r1', allergens: ['latte', 'glutine'] })],
    ]));
    expect(out.daRitirare).toEqual([expect.objectContaining({ recipeId: 'r1', allergen: 'latte', label: 'Latte e derivati' })]);
    expect(out.ricette).toBe(1);
  });

  it('⛔ NON lo toglie se la ricetta lo avrebbe comunque dalle parole: sarebbe un falso negativo', () => {
    const out = tagDaRitirare('pesto pronto', registro.slice(0, 1), new Map([
      ['r1', ric({ id: 'r1', allergens: ['latte'], dedottoDalleParole: ['latte'] })],
    ]));
    expect(out.daRitirare).toEqual([]);
    expect(out.tenuti).toEqual([expect.objectContaining({ allergen: 'latte', perche: 'dedotto_dalle_parole' })]);
  });

  /**
   * ⛔ **IL CASO DELLE LASAGNE** (revisione del 5/9). Besciamella pronta e pesto pronto, tutte e due
   * dichiarate `latte` in tabella: la propagazione scrive **una sola** origine, il pesto. Nessuna
   * delle due è una parola del vocabolario, quindi la deduzione non salva niente. Senza questa
   * guardia, disfare il pesto toglierebbe `latte` a un piatto con la besciamella dentro — e il
   * piatto diventerebbe proponibile a un'allergica al latte fino alla notte dopo.
   */
  it('⛔ NON lo toglie se un ALTRO alimento della tabella lo dà ancora', () => {
    const out = tagDaRitirare('pesto pronto', registro.slice(0, 1), new Map([
      ['r1', ric({ id: 'r1', allergens: ['latte'], datoDaAltri: ['latte'] })],
    ]));
    expect(out.daRitirare).toEqual([]);
    expect(out.tenuti).toEqual([expect.objectContaining({ allergen: 'latte', perche: 'dato_da_un_altro_alimento' })]);
  });

  it('⛔ NON tocca una ricetta che qualcuno ha guardato a mano', () => {
    const out = tagDaRitirare('pesto pronto', registro.slice(0, 1), new Map([
      ['r1', ric({ id: 'r1', allergens: ['latte'], toccataAMano: true })],
    ]));
    expect(out.daRitirare).toEqual([]);
    expect(out.tenuti[0].perche).toBe('toccata_a_mano');
  });

  it('⚠️ un tag già sparito nel frattempo non è un errore: si dice e si passa oltre', () => {
    const out = tagDaRitirare('pesto pronto', registro.slice(0, 1), new Map([['r1', ric({ id: 'r1', allergens: [] })]]));
    expect(out.daRitirare).toEqual([]);
    expect(out.tenuti[0].perche).toBe('non_c_e_piu');
  });

  it('⛔ tocca SOLO l\'alimento chiesto: gli altri tag della stessa ricetta non si toccano', () => {
    const misto = [{
      recipeId: 'r1',
      aggiunti: [
        { allergen: 'latte', ingrediente: 'pesto pronto', alimento: 'pesto pronto' },
        { allergen: 'pesce', ingrediente: 'colatura', alimento: 'colatura di alici' },
      ],
    }];
    const out = tagDaRitirare('pesto pronto', misto, new Map([['r1', ric({ id: 'r1', allergens: ['latte', 'pesce'] })]]));
    expect(out.daRitirare.map((t) => t.allergen)).toEqual(['latte']);
  });

  it('⚠️ due righe di registro sulla stessa coppia ricetta+allergene contano una volta sola', () => {
    const doppio = [registro[0], registro[0]];
    const out = tagDaRitirare('pesto pronto', doppio, new Map([['r1', ric({ id: 'r1', allergens: ['latte'] })]]));
    expect(out.daRitirare).toHaveLength(1);
  });
});

describe('allergeniDopoIlRitiro', () => {
  const tolto = (recipeId: string, allergen: string) => ({
    recipeId, ricetta: `Ricetta ${recipeId}`, allergen, label: allergen, ingrediente: 'pesto pronto',
  });

  it('toglie solo quelli elencati, e non riordina il resto', () => {
    expect(allergeniDopoIlRitiro('r1', ['glutine', 'latte', 'uova'], [tolto('r1', 'latte')])).toEqual(['glutine', 'uova']);
  });

  /**
   * ⛔ **OGNI RICETTA PERDE SOLO I SUOI**, e questa prova è il motivo per cui la firma vuole il
   * `recipeId`: con l'elenco intero e nessun filtro, la seconda ricetta perderebbe il `glutine` che
   * era stato ritirato dalla prima — un allergene tolto a un piatto che non c'entrava niente.
   */
  it('⛔ i tag ritirati da un\'ALTRA ricetta non toccano questa', () => {
    const tutti = [tolto('r1', 'glutine'), tolto('r2', 'latte')];
    expect(allergeniDopoIlRitiro('r2', ['glutine', 'latte'], tutti)).toEqual(['glutine']);
    expect(allergeniDopoIlRitiro('r1', ['glutine', 'latte'], tutti)).toEqual(['latte']);
  });
});
