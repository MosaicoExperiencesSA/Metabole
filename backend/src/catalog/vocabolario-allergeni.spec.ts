import { PAROLE_CANDIDATE, contaCandidati, contaDivergenzeSulCatalogo, contaSenza, divergenze } from './vocabolario-allergeni';
import { EU_ALLERGENS, suggestAllergens } from './allergens';

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

  /** ⛔ Dal 5/9 le parole misurate STANNO nel vocabolario: la lista resta per misurare la riparazione. */
  it('⛔ le parole candidate stanno ormai in EU_ALLERGENS, e la deduzione le trova', () => {
    for (const [code, parole] of Object.entries(PAROLE_CANDIDATE)) {
      const def = EU_ALLERGENS.find((d) => d.code === code)!;
      for (const p of parole) expect(def.keywords.some((kw) => p.startsWith(kw) || kw.startsWith(p))).toBe(true);
    }
    expect(suggestAllergens([{ name: 'taleggio' }]).map((a) => a.allergen)).toContain('latte');
    expect(suggestAllergens([{ name: 'seppie pulite' }]).map((a) => a.allergen)).toContain('molluschi');
    expect(suggestAllergens([{ name: 'burrata' }]).map((a) => a.allergen)).toContain('latte');
  });

  /** ⛔ «tellin» dentro «tortellini»: la tabella del 5/9 l'ha preso, e non deve più. */
  it('⛔ i tortellini non sono molluschi, e l\'edamame non è latte', () => {
    expect(suggestAllergens([{ name: 'tortellini di ricotta' }]).map((a) => a.allergen)).not.toContain('molluschi');
    expect(suggestAllergens([{ name: 'edamame' }]).map((a) => a.allergen)).not.toContain('latte');
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

  /** ⛔ E la deduzione lo applica: «pasta senza glutine» da sola non porta il glutine; col pangrattato sì. */
  it('⛔ «pasta senza glutine» non porta il glutine; «latte senza lattosio» resta latte', () => {
    expect(suggestAllergens([{ name: 'pasta senza glutine' }]).map((a) => a.allergen)).not.toContain('glutine');
    expect(suggestAllergens([{ name: 'pasta senza glutine' }, { name: 'pangrattato' }]).map((a) => a.allergen)).toContain('glutine');
    expect(suggestAllergens([{ name: 'latte senza lattosio' }]).map((a) => a.allergen)).toContain('latte');
    expect(suggestAllergens([{ name: 'muffin (senza uova)' }]).map((a) => a.allergen)).not.toContain('uova');
  });

  /** ⛔ «senza lattosio» NON è «senza latte»: non è una forma, e la ricetta 3 non compare. */
  it('⛔ «senza lattosio» non è una forma di «senza latte»', () => {
    expect(contaSenza(CATALOGO).some((x) => x.allergene === 'latte')).toBe(false);
  });
});

describe('divergenze fra i due vocabolari — unificati il 5/9', () => {
  /** ⛔ Il 5/9 mattina: pesce 15 contro 67, 616 ricette senza tag. Se questa riga torna rossa, i vocabolari si sono staccati di nuovo. */
  it('⛔ nessuna parola sta SOLO nelle esclusioni, per nessun allergene', () => {
    for (const d of divergenze()) expect({ allergene: d.allergene, solo: d.soloNelleEsclusioni }).toEqual({ allergene: d.allergene, solo: [] });
    expect(suggestAllergens([{ name: 'cernia filetto' }]).map((a) => a.allergen)).toContain('pesce');
    expect(suggestAllergens([{ name: 'sardine fresche' }]).map((a) => a.allergen)).toContain('pesce');
  });

  /** ⚠️ Le omonime delle esclusioni valgono anche per i tag, perché passano dalla stessa porta. */
  it('⚠️ «carpaccio di manzo» non è carpa, «stromboli» non è rombo', () => {
    expect(suggestAllergens([{ name: 'carpaccio di manzo' }]).map((a) => a.allergen)).not.toContain('pesce');
    expect(suggestAllergens([{ name: 'stromboli' }]).map((a) => a.allergen)).not.toContain('pesce');
  });

  it('⚠️ e quello che sta in tutti e due non compare', () => {
    const latte = divergenze().find((x) => x.allergene === 'latte')!;
    expect(latte.soloNeiTag).not.toContain('formagg');
    expect(latte.soloNelleEsclusioni).not.toContain('formaggio');
  });
});

describe('contaDivergenzeSulCatalogo: quanto costava unificare', () => {
  /** ⚠️ Dopo l'unificazione non c'è più niente da contare qui: la tabella 4 della diagnostica deve uscire vuota. */
  it('⛔ a vocabolari unificati il conto è vuoto, e la cernia porta il tag dalla deduzione', () => {
    expect(contaDivergenzeSulCatalogo([
      { id: '1', name: 'Cernia al forno', ingredients: [{ name: 'cernia filetto' }], allergens: [] },
    ])).toEqual([]);
    expect(suggestAllergens([{ name: 'cernia filetto' }]).map((a) => a.allergen)).toContain('pesce');
  });
});
