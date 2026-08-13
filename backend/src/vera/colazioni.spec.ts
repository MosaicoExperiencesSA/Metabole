/**
 * Le colazioni dolci e salate — la proposta del sistema (`Decisioni_Simone_20260813.md` §12).
 *
 * I blocchi importanti sono i NO: il conflitto che resta conflitto, le parole ambigue che non
 * propongono niente, «insalata» che non diventa salata per via della sottostringa.
 */
import {
  TAG_DOLCE,
  TAG_SALATO,
  classificaColazione,
  nomiIngredienti,
  tagsDopoScelta,
  tipoConfermato,
} from './colazioni';

describe('classificaColazione', () => {
  it('propone salato quando gli indizi vanno tutti da una parte', () => {
    const r = classificaColazione('Toast con uova strapazzate', ['uova', 'pane integrale']);
    expect(r.proposta).toBe('salato');
    expect(r.indizi).toContain('uova');
  });

  it('propone dolce da nome e ingredienti insieme', () => {
    const r = classificaColazione('Fette con confettura', ['fette biscottate', 'confettura di albicocche']);
    expect(r.proposta).toBe('dolce');
  });

  it('il conflitto resta conflitto: «torta salata» non si classifica', () => {
    const r = classificaColazione('Torta salata con spinaci', ['farina', 'spinaci']);
    expect(r.proposta).toBeNull();
    expect(r.indizi.length).toBeGreaterThan(0); // il conflitto si mostra, non si nasconde
  });

  it('il conflitto NON si risolve contando gli indizi', () => {
    const r = classificaColazione('Pancake banana e cacao con uova', ['banana', 'cacao', 'uova', 'farina']);
    expect(r.proposta).toBeNull();
  });

  it('le parole ambigue non propongono niente: ricotta, pane, yogurt, pancake', () => {
    for (const nome of ['Pancake alla ricotta', 'Yogurt greco', 'Pane tostato']) {
      expect(classificaColazione(nome, []).proposta).toBeNull();
    }
  });

  it('«insalata» non contiene «salato»: la sottostringa non inganna', () => {
    expect(classificaColazione('Insalata di frutta', ['frutta mista']).proposta).toBeNull();
  });

  it('senza nessun indizio: nessuna proposta, nessun indizio', () => {
    const r = classificaColazione('Bowl energetica', ['semi di chia', 'latte di mandorla']);
    expect(r.proposta).toBeNull();
    expect(r.indizi).toEqual([]);
  });
});

describe('tipoConfermato', () => {
  it('legge il tag confermato e ignora gli altri tag', () => {
    expect(tipoConfermato(['dieta:mediterranea', TAG_SALATO])).toBe('salato');
    expect(tipoConfermato([TAG_DOLCE])).toBe('dolce');
    expect(tipoConfermato(['dieta:keto'])).toBeNull();
    expect(tipoConfermato(null)).toBeNull();
  });

  it('tutti e due i tag = dato sporco, vale nessuno', () => {
    expect(tipoConfermato([TAG_DOLCE, TAG_SALATO])).toBeNull();
  });
});

describe('tagsDopoScelta', () => {
  it('scrive il tag senza toccare gli altri', () => {
    expect(tagsDopoScelta(['dieta:keto'], 'salato')).toEqual(['dieta:keto', TAG_SALATO]);
  });

  it('cambiare idea sostituisce, non accumula', () => {
    expect(tagsDopoScelta([TAG_DOLCE, 'dieta:keto'], 'salato')).toEqual(['dieta:keto', TAG_SALATO]);
  });

  it('`null` toglie la classificazione e basta', () => {
    expect(tagsDopoScelta([TAG_SALATO, 'dieta:keto'], null)).toEqual(['dieta:keto']);
  });
});

describe('nomiIngredienti', () => {
  it('estrae i nomi dal Json e sopravvive ai dati storti', () => {
    expect(nomiIngredienti([{ name: 'uova', qty: 2, unit: 'pz' }, { qty: 1 }, null, 'stringa'])).toEqual(['uova']);
    expect(nomiIngredienti(null)).toEqual([]);
    expect(nomiIngredienti('non un array')).toEqual([]);
  });
});
