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

/**
 * UNA VOCE CHE NE CONTIENE DUE — caso Jolanda Todde, 17/8.
 *
 * Il campo del questionario è a tag, una voce per alimento, ma in scheda le è arrivata una voce
 * sola: `"Carne .ceci"`. Non escludeva niente, perché quella stringa non compare in nessun piatto.
 * Il taglio sta in `filtraSpezie` perché è **la porta** da cui passano i cibi non graditi prima di
 * essere salvati, dal questionario e dal profilo dell'app.
 */
describe('filtraSpezie — le voci con più alimenti dentro', () => {
  it('«Carne .ceci» si salva come due voci', () => {
    expect(filtraSpezie(['Carne .ceci']).tenuti).toEqual(['Carne', 'ceci']);
  });

  it('⚠️ e adesso il controllo sulle spezie vede anche quello che sta DENTRO la voce', () => {
    // Prima classificava la stringa intera: «pepe, ceci» non era una spezia riconosciuta, quindi
    // passava tutta, e l'avviso sul pepe non è mai stato dato a nessuno che scrivesse così.
    const { tenuti, avvisi } = filtraSpezie(['pepe, ceci']);
    expect(tenuti).toEqual(['ceci']);
    expect(avvisi).toHaveLength(1);
  });

  it('⚠️ un alimento dal nome composto resta intero: non si spezza sugli spazi', () => {
    expect(filtraSpezie(['frutta a guscio', 'insalata russa']).tenuti).toEqual(['frutta a guscio', 'insalata russa']);
  });

  it('un elenco già pulito non cambia', () => {
    expect(filtraSpezie(['funghi', 'ceci']).tenuti).toEqual(['funghi', 'ceci']);
  });
});
