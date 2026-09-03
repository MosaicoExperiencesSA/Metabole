import { describe, expect, it } from 'vitest';
/**
 * ⛔ **Il sorgente si importa con `?raw`, non si legge con `node:fs`.** Il backoffice non ha
 * `@types/node` (l'app sì), quindi un `import { readFileSync } from 'node:fs'` qui **compila
 * rosso** — e siccome Vitest non typecheck-a, i test restano verdi mentre `npm run build` (che è
 * `tsc -b && vite build`, cioè il job «Backoffice · build» della CI) si spegne. È lo stesso modo in
 * cui il 31/8 una consegna ha rotto il build dell'app con sei prove verdi: *nessuna prova che legge
 * il sorgente come testo si accorge che il sorgente non compila*.
 */
import sorgenteClientDetail from '../pages/ClientDetail.tsx?raw';
import { giornoDellaRiga, leggiFrase, serveChiedere } from './pesataDaConfermare';

describe('leggiFrase — storto vuol dire «non chiedere», mai «non salvare»', () => {
  it('la frase del server si mostra com\'è scritta lì', () => {
    const f = 'Il 26/08/2026 la pesata è 73 kg. Con 113 kg il 03/09/2026 sarebbero 40 kg in 8 giorni. Confermi il valore?';
    expect(leggiFrase({ frase: f })).toBe(f);
  });

  it.each([
    ['il numero torna', null],
    ['nessuna risposta', undefined],
    ['una forma che non conosco', { messaggio: 'boh' }],
    ['una frase che non è una stringa', { frase: 3 }],
    ['una frase di soli spazi', { frase: '   ' }],
  ])('non si chiede niente: %s', (_t, risposta) => {
    expect(leggiFrase(risposta)).toBeNull();
  });
});

describe('serveChiedere', () => {
  it('la prima volta si chiede; per lo stesso numero non si richiede', () => {
    expect(serveChiedere(null, 113)).toBe(true);
    expect(serveChiedere({ frase: 'x', pesoScritto: 113 }, 113)).toBe(false);
  });

  it('⛔ cambiato il numero, il «confermo» di prima parlava di un altro peso', () => {
    expect(serveChiedere({ frase: 'x', pesoScritto: 113 }, 73)).toBe(true);
  });
});

/**
 * ⛔ Il giorno della riga è **la cosa che distingue questa schermata dall'app**: qui si corregge
 * anche una pesata di due mesi fa, e senza il giorno il server confronterebbe il numero con le
 * righe di adesso — cioè risponderebbe su due misure che non c'entrano con quella che si ha davanti.
 */
describe('giornoDellaRiga', () => {
  it.each([
    ['2026-08-26T00:00:00.000Z', '2026-08-26'],
    ['2026-08-26', '2026-08-26'],
  ])('%s → %s', (dentro, fuori) => {
    expect(giornoDellaRiga(dentro)).toBe(fuori);
  });

  /** ⚠️ Senza una data buona si manda **niente** e il server prende oggi: mai una data inventata. */
  it.each([[null], [undefined], [''], ['ieri'], ['26/08/2026']])('%s → nessuna data', (dentro) => {
    expect(giornoDellaRiga(dentro as string | null)).toBeUndefined();
  });
});

/**
 * ⚠️ Il modale non si può montare nei test (`environment: 'node'`), quindi del sorgente si guardano
 * le due proprietà che una riscrittura distratta romperebbe **verso il danno**: una correzione che
 * non parte più, o una domanda fatta sul giorno sbagliato.
 *
 * ⚠️ I commenti si tolgono prima di cercare: il 31/8 una prova ha trovato quello che cercava dentro
 * il commento che spiegava la regola, ed è rimasta verde con il codice tolto.
 */
describe('⚠️ FixMeasureModal: quello che da qui non si vede', () => {
  const senzaCommenti = sorgenteClientDetail
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const modale = senzaCommenti.slice(senzaCommenti.indexOf('function FixMeasureModal'));

  it('⛔ la verifica ha un `catch` che risponde «non chiedere»: non è un cancello', () => {
    const corpo = modale.slice(modale.indexOf('async function chiediSeTorna'));
    expect(corpo.slice(0, corpo.indexOf('\n  }'))).toMatch(/catch\s*\{\s*return null;/);
  });

  it('⛔ manda al server il giorno della riga che sta correggendo', () => {
    expect(modale).toContain('giornoDellaRiga(measure.date)');
  });
});
