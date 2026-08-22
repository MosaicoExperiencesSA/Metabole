/**
 * ⛔ **IL CASO CHE ROMPE UN RENDERER SCRITTO IN FRETTA: il testo SENZA grassetto.**
 *
 * `TestoConGrassetto` esiste perché la pagina Lavori disegnava `**grassetto**` con gli asterischi in
 * mezzo (103 voci su 155). La trappola di una funzione così è la **coda**: se si aggiungono solo i
 * pezzi trovati dalla regex, un testo che non contiene nessun `**` esce **vuoto** — cioè il caso
 * più comune sarebbe l'unico rotto, e su una pagina di lavori vorrebbe dire vederli sparire tutti.
 *
 * ⚠️ Qui non si monta React: si guarda l'**albero** che la funzione produce. Basta a provare le due
 * cose che contano — che niente si perde per strada, e che il testo non diventa mai markup.
 */
import { describe, expect, it } from 'vitest';
import { TestoConGrassetto } from './TestoConGrassetto';

/** I pezzi prodotti: le stringhe così come sono, i grassetti come `<b>testo</b>`. */
function pezzi(testo: string): string[] {
  const el = TestoConGrassetto({ testo }) as unknown as { props: { children: unknown[] } };
  return (el.props.children ?? []).map((p) => {
    if (typeof p === 'string') return p;
    const b = p as { props?: { children?: string } };
    return `<b>${b.props?.children ?? ''}</b>`;
  });
}

const intero = (testo: string): string => pezzi(testo).join('');

describe('⛔ niente si perde per strada', () => {
  /** ⛔ Il caso che rompe: nessun asterisco. Senza la coda, questo tornerebbe vuoto. */
  it('⛔ un testo senza grassetto esce INTERO', () => {
    expect(pezzi('Nessun grassetto qui.')).toEqual(['Nessun grassetto qui.']);
  });

  it('⛔ e anche la coda dopo l\'ultimo grassetto', () => {
    expect(intero('prima **dentro** dopo')).toBe('prima <b>dentro</b> dopo');
  });

  it('⚠️ due grassetti di fila', () => {
    expect(intero('**uno** e **due**')).toBe('<b>uno</b> e <b>due</b>');
  });

  it('⚠️ grassetto in testa, niente prima', () => {
    expect(pezzi('**subito** poi')).toEqual(['<b>subito</b>', ' poi']);
  });

  it('⚠️ testo vuoto: niente, non un errore', () => {
    expect(intero('')).toBe('');
  });

  /**
   * ⚠️ **Un asterisco spaiato resta un asterisco.** Il testo delle voci è scritto a mano: prima o
   * poi qualcuno ne scrive uno solo, e la riga non deve né sparire né mangiarsi il resto.
   */
  it('⚠️ asterisco spaiato: il testo resta tutto', () => {
    expect(intero('un ** solo asterisco')).toBe('un ** solo asterisco');
    expect(intero('3 * 4 = 12')).toBe('3 * 4 = 12');
  });

  /**
   * ⛔ **UN ASTERISCO DENTRO NON APRE UN GRASSETTO, ed è una scelta.** La regex è `[^*]+` e non
   * `.+?`: se fra i due `**` c'è un altro asterisco, non si indovina — il testo resta com'è.
   *
   * ⚠️ Con `.+?` (la stesura ovvia) `**3 * 4**` diventerebbe grassetto mangiandosi l'asterisco di
   * mezzo, e su un campo scritto a mano quello è il modo in cui una formula diventa formattazione.
   * ⛔ La mutazione `[^*]+` → `.+?` sopravviveva a tutti gli altri test: questo è il caso che la
   * distingue.
   */
  it('⛔ un asterisco DENTRO non diventa grassetto: si lascia il testo com\'è', () => {
    expect(intero('**3 * 4**')).toBe('**3 * 4**');
    expect(pezzi('**3 * 4**')).toEqual(['**3 * 4**']);
  });

  /** ⚠️ I ritorni a capo non si toccano: la pagina li disegna con `pre-wrap`. */
  it('⚠️ i ritorni a capo restano', () => {
    expect(intero('riga uno\n\n**riga due**')).toBe('riga uno\n\n<b>riga due</b>');
  });
});

describe('⛔ il testo non diventa mai markup', () => {
  /**
   * ⛔ **È la ragione per cui non si usa `dangerouslySetInnerHTML`.** Il dettaglio di un lavoro si
   * scrive dalla pagina: è testo di una persona. Qui deve restare una **stringa**, non un tag.
   */
  it('⛔ un tag scritto nel testo resta testo', () => {
    const p = pezzi('prima <script>alert(1)</script> dopo');
    expect(p).toEqual(['prima <script>alert(1)</script> dopo']);
    expect(typeof p[0]).toBe('string');
  });

  it('⛔ e anche dentro un grassetto', () => {
    const p = pezzi('**<img onerror=x>**');
    expect(p).toEqual(['<b><img onerror=x></b>']);
  });
});
