import { PAROLE_CANDIDATE, contaCandidati, contaDivergenzeSulCatalogo, contaSenza, divergenze } from './vocabolario-allergeni';
import { EU_ALLERGENS } from './allergens';

/**
 * ⛔ **IL VOCABOLARIO DEGLI ALLERGENI, MISURATO PRIMA DI ALLARGARLO.** Tre conti: le parole che
 * mancano (taleggio, seppie), le forme «senza ‹allergene›» che portano il tag lo stesso, e quanto
 * divergono i due vocabolari. Il giudizio sta qui, con queste prove, non nello script.
 */
describe('contaCandidati', () => {
  const CATALOGO = [
    { id: '1', name: 'Crostini con taleggio', ingredients: [{ name: 'taleggio' }, { name: 'pane' }], allergens: ['glutine'] },
    { id: '2', name: 'Risotto al taleggio', ingredients: [{ name: 'taleggio dop' }], allergens: ['latte'] },
    { id: '3', name: 'Seppie in umido', ingredients: [{ name: 'seppie pulite' }, { name: 'piselli' }], allergens: [] },
    { id: '4', name: 'Edamame al sale', ingredients: [{ name: 'edamame' }], allergens: ['soia'] },
  ];

  it('⛔ conta le ricette con la parola, e quante sono SENZA il tag: quello è il numero che decide', () => {
    const c = contaCandidati(CATALOGO);
    const taleggio = c.find((x) => x.parola === 'taleggio')!;
    expect(taleggio).toMatchObject({ allergene: 'latte', ricette: 2, senzaTag: 1, esempi: ['Crostini con taleggio'] });
    const seppie = c.find((x) => x.parola === 'seppi')!;
    expect(seppie).toMatchObject({ allergene: 'molluschi', ricette: 1, senzaTag: 1 });
  });

  it('⛔ le parole candidate non stanno già in EU_ALLERGENS (altrimenti non sarebbero candidate)', () => {
    for (const [code, parole] of Object.entries(PAROLE_CANDIDATE)) {
      const def = EU_ALLERGENS.find((d) => d.code === code)!;
      for (const p of parole) expect(def.keywords).not.toContain(p);
    }
  });

  /** ⛔ «edam» dentro «edamame» avrebbe messo il latte sulla soia: non deve stare fra i candidati. */
  it('⛔ nessuna parola candidata scatta su «edamame»', () => {
    const c = contaCandidati(CATALOGO);
    expect(c.some((x) => x.esempi.includes('Edamame al sale'))).toBe(false);
  });
});

describe('contaSenza', () => {
  const CATALOGO = [
    { id: '1', name: 'Pasta senza glutine al pomodoro', ingredients: [{ name: 'pasta senza glutine' }, { name: 'pomodoro' }], allergens: ['glutine'] },
    // ⚠️ Il tag qui è GIUSTO: viene dal pangrattato, non dalla pasta.
    { id: '2', name: 'Cotoletta con pasta senza glutine', ingredients: [{ name: 'pasta senza glutine' }, { name: 'pangrattato' }], allergens: ['glutine'] },
    { id: '3', name: 'Latte senza lattosio', ingredients: [{ name: 'latte senza lattosio' }], allergens: ['latte'] },
  ];

  it('⛔ conta chi ha «senza glutine» e il tag, e separa chi lo avrebbe comunque da un altro ingrediente', () => {
    const c = contaSenza(CATALOGO);
    const g = c.find((x) => x.forma === 'senza glutine')!;
    expect(g).toMatchObject({ allergene: 'glutine', colTagLoStesso: 2, giustificate: 1, esempi: ['Pasta senza glutine al pomodoro'] });
  });

  /** ⛔ «senza lattosio» NON è «senza latte»: non è una forma, e la ricetta 3 non compare. */
  it('⛔ «senza lattosio» non è una forma di «senza latte»', () => {
    expect(contaSenza(CATALOGO).some((x) => x.allergene === 'latte')).toBe(false);
  });
});

describe('divergenze fra i due vocabolari', () => {
  it('⛔ misura le parole in un solo vocabolario, ed è > 0 oggi (scamorza, burrata, provola stanno solo nelle esclusioni)', () => {
    const d = divergenze();
    const latte = d.find((x) => x.allergene === 'latte')!;
    expect(latte.soloNelleEsclusioni).toEqual(expect.arrayContaining(['scamorza', 'burrata', 'provola']));
  });

  it('⚠️ e quello che sta in tutti e due non compare', () => {
    const latte = divergenze().find((x) => x.allergene === 'latte')!;
    expect(latte.soloNeiTag).not.toContain('formagg');
    expect(latte.soloNelleEsclusioni).not.toContain('formaggio');
  });
});

describe('contaDivergenzeSulCatalogo: quanto costa unificare', () => {
  it('⛔ la cernia senza tag pesce si conta: è il piatto che la porta dei tag lascia passare', () => {
    const c = contaDivergenzeSulCatalogo([
      { id: '1', name: 'Cernia al forno', ingredients: [{ name: 'cernia filetto' }], allergens: [] },
      { id: '2', name: 'Spigola al sale', ingredients: [{ name: 'spigola' }], allergens: ['pesce'] },
    ]);
    expect(c.find((x) => x.parola === 'cernia')).toMatchObject({ allergene: 'pesce', ricette: 1, senzaTag: 1 });
    expect(c.find((x) => x.parola === 'spigola')).toMatchObject({ ricette: 1, senzaTag: 0 });
  });
});
