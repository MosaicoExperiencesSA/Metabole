import { normalizzaStato } from './stato-alimento';
import { statiCheTornanoIndietro, statoDalFoglio } from './stato-dal-foglio';

/**
 * ⛔ **IL DIFETTO CHE QUESTO MODULO ESISTE PER FERMARE.** Il foglio del 2/9 scrive «crudo /
 * naturale» su 238 righe di 262: `normalizzaStato` lo legge `altro` — cioè «non lo so» — perché
 * contiene una barra. Importarlo così rimetterebbe il 91% degli alimenti appena compilati dentro
 * l'elenco «Alimenti da correggere» da cui il foglio è nato.
 */
describe('⛔ la scrittura del foglio, letta dal motore', () => {
  it('⛔ «crudo / naturale» da solo è «non lo so»', () => {
    expect(normalizzaStato('crudo / naturale')).toBe('altro');
  });

  it('✅ tradotto, è crudo', () => {
    expect(normalizzaStato(statoDalFoglio('crudo / naturale')!)).toBe('crudo');
  });

  it('✅ e «lavorato / cotto» è cotto', () => {
    expect(normalizzaStato(statoDalFoglio('lavorato / cotto')!)).toBe('cotto');
  });
});

describe('statoDalFoglio', () => {
  it('⚠️ non guarda maiuscole e spazi ai bordi', () => {
    expect(statoDalFoglio('  Crudo / Naturale ')).toBe('crudo');
  });

  it('⚠️ le scritture che il motore già capisce passano intatte', () => {
    for (const s of ['bolliti', 'bollito', 'bollite', 'bollita', 'cotto', 'secco']) {
      expect(statoDalFoglio(s)).toBe(s);
    }
  });

  /** ⚠️ Vuoto resta vuoto: «nessuno l'ha guardato» è un'informazione, non un buco da riempire. */
  it('⚠️ una casella vuota resta vuota', () => {
    expect(statoDalFoglio('')).toBeNull();
    expect(statoDalFoglio('   ')).toBeNull();
    expect(statoDalFoglio(null)).toBeNull();
    expect(statoDalFoglio(undefined)).toBeNull();
  });

  /**
   * ⛔ **Quello che non si riconosce NON diventa crudo per comodità.** Una traduzione che indovina
   * è il modo in cui centinaia di righe prendono lo stato sbagliato tutte insieme, in silenzio.
   */
  it('⛔ una scrittura mai vista resta com\'è, e non diventa «crudo»', () => {
    expect(statoDalFoglio('marinato / affumicato')).toBe('marinato / affumicato');
    expect(statoDalFoglio('boh')).toBe('boh');
  });
});

/**
 * ⛔ **IL CONTROLLO CHE IMPEDISCE AL LAVORO DI TORNARE INDIETRO.** Chi importa si ferma e si fa
 * dire quale scrittura non era prevista, invece di scrivere righe che si rimetteranno in coda.
 */
describe('statiCheTornanoIndietro', () => {
  it('⛔ trova le scritture che il motore leggerebbe come «non lo so»', () => {
    const rotte = statiCheTornanoIndietro([
      { name: 'ceci', state: 'crudo / naturale' },
      { name: 'salmone', state: 'marinato / affumicato' },
      { name: 'tonno', state: 'crudo o cotto' },
    ]);
    expect(rotte.map((r) => r.name)).toEqual(['salmone', 'tonno']);
    expect(rotte[0].letto).toBe('altro');
  });

  it('✅ e non allarma su quelle tradotte o già buone', () => {
    expect(statiCheTornanoIndietro([
      { name: 'ceci', state: 'crudo / naturale' },
      { name: 'riso', state: 'bollito' },
      { name: 'pane', state: 'lavorato / cotto' },
    ])).toEqual([]);
  });

  /** ⚠️ Una casella vuota non è colpa della traduzione: è «non lo so» dichiarato dal foglio. */
  it('⚠️ e nemmeno su una casella vuota', () => {
    expect(statiCheTornanoIndietro([{ name: 'x', state: '' }, { name: 'y', state: null }])).toEqual([]);
  });

  /** ⚠️ `non_applicabile` è una dichiarazione, non un buco: passa. */
  it('⚠️ «non si applica» va benissimo', () => {
    expect(statiCheTornanoIndietro([{ name: 'olio', state: 'non_applicabile' }])).toEqual([]);
  });
});
