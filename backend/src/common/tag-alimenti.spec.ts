import { haPiuAlimenti, spezzaTagAlimenti } from './tag-alimenti';

/**
 * DUE ALIMENTI IN UN TAG SOLO, LATO SCRITTURA — caso Jolanda Todde, 17/8.
 *
 * ⚠️ La regola che governa ogni riga di questo file: **spezzare troppo è peggio che non spezzare**.
 * Non spezzare lascia un'esclusione che non esclude — grave, ma il lato lettura ormai la recupera.
 * Spezzare «frutta a guscio» in «frutta» e «guscio» toglie alla cliente tutta la frutta, e lo fa
 * mentre crediamo di star correggendo qualcosa. Fra i due errori si sceglie sempre lo stesso.
 */

describe('spezzaTagAlimenti', () => {
  it('«Carne .ceci» diventa due voci — è il caso vero da cui nasce', () => {
    expect(spezzaTagAlimenti(['Carne .ceci'])).toEqual(['Carne', 'ceci']);
  });

  it('i separatori che escono da una tastiera vera', () => {
    for (const t of ['carne, ceci', 'carne; ceci', 'carne. ceci', 'carne / ceci', 'carne e ceci']) {
      expect(spezzaTagAlimenti([t])).toEqual(['carne', 'ceci']);
    }
  });

  it('⚠️ NON si spezza sugli spazi: sono alimenti dal nome composto', () => {
    expect(spezzaTagAlimenti(['frutta a guscio'])).toEqual(['frutta a guscio']);
    expect(spezzaTagAlimenti(['insalata russa'])).toEqual(['insalata russa']);
    expect(spezzaTagAlimenti(['latte di mandorla'])).toEqual(['latte di mandorla']);
  });

  it('⚠️ si salva com\'è scritto: la scheda la legge una persona', () => {
    expect(spezzaTagAlimenti(['Ceci, Funghi'])).toEqual(['Ceci', 'Funghi']);
  });

  it('i doppioni spariscono, anche fra maiuscole e minuscole, e l\'ordine resta', () => {
    expect(spezzaTagAlimenti(['ceci', 'funghi, Ceci'])).toEqual(['ceci', 'funghi']);
  });

  it('vuoti e spazi non diventano voci', () => {
    expect(spezzaTagAlimenti(['', '   ', null, undefined])).toEqual([]);
    expect(spezzaTagAlimenti(['ceci,,, funghi'])).toEqual(['ceci', 'funghi']);
  });

  it('⚠️ una voce di una lettera non è un alimento e non fa scattare il taglio', () => {
    // «vitamina b» non deve diventare «vitamina» e «b».
    expect(spezzaTagAlimenti(['vitamina b'])).toEqual(['vitamina b']);
  });

  it('un elenco già pulito esce identico', () => {
    expect(spezzaTagAlimenti(['ceci', 'funghi', 'frutta a guscio'])).toEqual(['ceci', 'funghi', 'frutta a guscio']);
  });
});

describe('haPiuAlimenti', () => {
  it('dice se in quella voce ce n\'è più d\'uno', () => {
    expect(haPiuAlimenti('Carne .ceci')).toBe(true);
    expect(haPiuAlimenti('carne e ceci')).toBe(true);
    expect(haPiuAlimenti('frutta a guscio')).toBe(false);
    expect(haPiuAlimenti('ceci')).toBe(false);
  });
});
