import { classificaSpezia, eUnaSpezia, filtraSpezie } from './spezie';

/**
 * La regola è della nutrizionista, e nasce da un caso reale: una cliente con trenta esclusioni
 * — fra cui curry e cumino — riceveva lo stesso pranzo per quattro giorni di fila, perché ogni
 * spezia esclusa cancella dal ricettario TUTTI i piatti che la contengono.
 *
 * Qui si fissano le due risposte e, soprattutto, i confini: allergeni mai toccati e confronto
 * esatto (non per sottostringa), perché «noce moscata» e «noce» sono due cose molto diverse.
 */

describe('classificaSpezia — spezia precisa', () => {
  it.each(['curry', 'cumino', 'cannella', 'curcuma', 'zafferano', 'paprika', 'zenzero', 'peperoncino'])(
    '«%s» non entra fra i cibi esclusi',
    (s) => {
      const e = classificaSpezia(s);
      expect(e.tipo).toBe('specifica');
      expect(e.testo).toContain('Sostituiscila con le spezie che più ti piacciono');
    },
  );

  it('vale anche con articolo, maiuscole e parole di contorno', () => {
    expect(classificaSpezia('Il Curry').tipo).toBe('specifica');
    expect(classificaSpezia('pepe nero macinato').tipo).toBe('specifica');
    expect(classificaSpezia('  PEPERONCINO piccante ').tipo).toBe('specifica');
    expect(classificaSpezia('la cannella in polvere').tipo).toBe('specifica');
  });

  it('le erbe aromatiche seguono la stessa regola', () => {
    expect(classificaSpezia('basilico').tipo).toBe('specifica');
    expect(classificaSpezia('rosmarino fresco').tipo).toBe('specifica');
  });

  it('il titolo nomina il termine come l\'ha scritto la cliente', () => {
    expect(classificaSpezia('Curry').titolo).toContain('Curry');
  });
});

describe('classificaSpezia — "spezie" in generale', () => {
  it.each(['spezie', 'le spezie', 'spezie varie', 'tutte le spezie', 'aromi', 'erbe aromatiche'])(
    '«%s» manda dalla coach',
    (s) => {
      const e = classificaSpezia(s);
      expect(e.tipo).toBe('generica');
      expect(e.testo).toContain('Contatta la tua coach');
    },
  );
});

describe('classificaSpezia — quello che NON è una spezia', () => {
  it('il cibo vero passa e resta escludibile', () => {
    for (const c of ['funghi', 'verza', 'lenticchie', 'patata dolce', 'tacchino', 'avena', 'melanzane']) {
      expect(classificaSpezia(c).tipo).toBe('nessuna');
      expect(eUnaSpezia(c)).toBe(false);
    }
  });

  it('gli allergeni UE non diventano mai spezie: quella è sicurezza, non gusto', () => {
    for (const a of ['senape', 'sesamo', 'sedano', 'solfiti', 'lupini', 'soia']) {
      expect(classificaSpezia(a).tipo).toBe('nessuna');
    }
  });

  it('il confronto è esatto: «noce» e «peperoni» non sono «noce moscata» e «pepe»', () => {
    expect(classificaSpezia('noce moscata').tipo).toBe('specifica');
    expect(classificaSpezia('noci').tipo).toBe('nessuna'); // frutta a guscio
    expect(classificaSpezia('noce').tipo).toBe('nessuna');
    expect(classificaSpezia('pepe').tipo).toBe('specifica');
    expect(classificaSpezia('peperoni').tipo).toBe('nessuna'); // verdura
    expect(classificaSpezia('peperone').tipo).toBe('nessuna');
    expect(classificaSpezia('finocchio').tipo).toBe('nessuna'); // verdura
    expect(classificaSpezia('finocchietto').tipo).toBe('specifica'); // aroma
  });

  it('aglio e cipolla restano cibo: si usano a peso, non a pizzichi', () => {
    expect(classificaSpezia('aglio').tipo).toBe('nessuna');
    expect(classificaSpezia('cipolla').tipo).toBe('nessuna');
  });

  it('il vuoto non è niente', () => {
    expect(classificaSpezia('').tipo).toBe('nessuna');
    expect(classificaSpezia('   ').tipo).toBe('nessuna');
  });
});

describe('filtraSpezie', () => {
  it('tiene il cibo e scarta le spezie, con un avviso per ognuna', () => {
    const { tenuti, avvisi } = filtraSpezie(['funghi', 'curry', 'verza', 'cannella']);
    expect(tenuti).toEqual(['funghi', 'verza']);
    expect(avvisi.map((a) => a.tipo)).toEqual(['specifica', 'specifica']);
  });

  it('l\'avviso generico si dice una volta sola', () => {
    const { avvisi } = filtraSpezie(['spezie', 'aromi', 'le spezie']);
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0].tipo).toBe('generica');
  });

  it('salta i vuoti senza inventare avvisi', () => {
    const { tenuti, avvisi } = filtraSpezie(['', '  ', null, undefined, 'funghi']);
    expect(tenuti).toEqual(['funghi']);
    expect(avvisi).toHaveLength(0);
  });
});
