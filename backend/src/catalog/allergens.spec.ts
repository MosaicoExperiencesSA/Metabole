import { EU_ALLERGEN_CODES, suggestAllergens } from './allergens';

const ing = (...names: string[]) => names.map((name) => ({ name }));
const codes = (r: { allergen: string }[]) => r.map((x) => x.allergen);

describe('Allergeni — pre-tag dagli ingredienti (R8)', () => {
  it('rileva il pesce', () => {
    expect(codes(suggestAllergens(ing('Filetto di salmone', 'Asparagi')))).toContain('pesce');
  });

  it('rileva latte E derivati (burro, formaggio)', () => {
    const c = codes(suggestAllergens(ing('Burro', 'Parmigiano', 'Spinaci')));
    expect(c).toContain('latte');
  });

  it('rileva arachidi, frutta a guscio, crostacei, molluschi distintamente', () => {
    expect(codes(suggestAllergens(ing('Burro di arachidi')))).toContain('arachidi');
    expect(codes(suggestAllergens(ing('Mandorle a lamelle')))).toContain('frutta_a_guscio');
    expect(codes(suggestAllergens(ing('Gamberi')))).toContain('crostacei');
    expect(codes(suggestAllergens(ing('Calamari')))).toContain('molluschi');
  });

  it('rileva glutine, uova, soia', () => {
    expect(codes(suggestAllergens(ing('Pane proteico')))).toContain('glutine');
    expect(codes(suggestAllergens(ing('Uova strapazzate')))).toContain('uova');
    expect(codes(suggestAllergens(ing('Tofu alla griglia')))).toContain('soia');
  });

  it('nessun suggerimento su ingredienti senza allergeni noti', () => {
    expect(suggestAllergens(ing('Zucchine', 'Olio EVO', 'Sale'))).toHaveLength(0);
  });

  it('gestisce input vuoto o malformato', () => {
    expect(suggestAllergens([])).toHaveLength(0);
    expect(suggestAllergens(null)).toHaveLength(0);
    expect(suggestAllergens(undefined)).toHaveLength(0);
  });

  it('tutti i codici suggeriti sono tra i 14 UE', () => {
    const c = codes(suggestAllergens(ing('salmone', 'burro', 'gamberi', 'mandorle', 'pane')));
    for (const code of c) expect(EU_ALLERGEN_CODES).toContain(code);
  });
});
