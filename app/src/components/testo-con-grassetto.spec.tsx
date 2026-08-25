import { describe, expect, it } from 'vitest';
import { TestoConGrassetto } from './TestoConGrassetto';

/**
 * ⛔ **GLI ASTERISCHI CHE LE CLIENTI LEGGEVANO** (voce del 22/8, chiusa il 25/8): in chat si leggeva
 * «Hai qualche \*\*allergia\*\* alimentare?».
 *
 * ⚠️ Qui non c'è un DOM: i test guardano gli **elementi React** che il componente costruisce, che è
 * anche il punto — quello che non è grassetto resta testo, e non c'è nessuna strada per cui una cosa
 * scritta da una persona in chat diventi markup.
 */
type Nodo = string | { props: { children: string } };
const parti = (testo: string): Nodo[] => {
  const out = (TestoConGrassetto({ testo }) as unknown as { props: { children: Nodo[] } }).props.children;
  return out;
};
/** Come si legge la frase per una persona: il grassetto senza asterischi attorno. */
const letto = (testo: string): string =>
  parti(testo).map((p) => (typeof p === 'string' ? p : p.props.children)).join('');
const grassetti = (testo: string): string[] =>
  parti(testo).filter((p): p is { props: { children: string } } => typeof p !== 'string').map((p) => p.props.children);

describe('il grassetto nelle bolle di chat', () => {
  it('⛔ «Hai qualche **allergia** alimentare?» si legge senza asterischi', () => {
    const frase = 'Hai qualche **allergia** alimentare?';
    expect(letto(frase)).toBe('Hai qualche allergia alimentare?');
    expect(grassetti(frase)).toEqual(['allergia']);
  });

  /**
   * ⚠️ **Il caso più comune è il testo SENZA asterischi**, ed è quello che una prima stesura
   * sbagliata romperebbe per primo: dimenticando la coda, una frase normale uscirebbe vuota — cioè
   * la chat si svuoterebbe.
   */
  it('⚠️ un testo senza grassetto esce intero', () => {
    expect(letto('Ciao, come stai?')).toBe('Ciao, come stai?');
    expect(grassetti('Ciao, come stai?')).toEqual([]);
  });

  it('regge più grassetti nella stessa frase, e quello in fondo', () => {
    expect(letto('**uno** in mezzo **due**')).toBe('uno in mezzo due');
    expect(grassetti('**uno** in mezzo **due**')).toEqual(['uno', 'due']);
  });

  it('⚠️ un asterisco spaiato resta com\'è: non si indovina dove finirebbe', () => {
    expect(letto('costa **10 euro')).toBe('costa **10 euro');
    expect(grassetti('costa **10 euro')).toEqual([]);
  });

  it('e il testo vuoto non esplode', () => {
    expect(letto('')).toBe('');
  });
});
