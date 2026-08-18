import { describe, it, expect } from 'vitest';
import { valutazioniDaChiedere, type PastoDaValutare } from './valutazioni-da-chiedere';

const p = (o: Partial<PastoDaValutare> & { recipeId: string }): PastoDaValutare => ({
  date: '2026-08-17',
  slot: 'lunch',
  name: 'Piatto',
  ...o,
});

describe('valutazioniDaChiedere', () => {
  it('tiene solo i pasti del giorno chiesto: la rotta ne torna tre, il popup ne chiede uno', () => {
    const out = valutazioniDaChiedere(
      [p({ recipeId: 'a' }), p({ recipeId: 'b', date: '2026-08-16' }), p({ recipeId: 'c', date: '2026-08-15' })],
      '2026-08-17',
    );
    expect(out.map((x) => x.recipeId)).toEqual(['a']);
  });

  it('⚠️ lo stesso piatto in due pasti dello stesso giorno si chiede UNA volta: la valutazione è unica per (ricetta, giorno)', () => {
    const out = valutazioniDaChiedere(
      [p({ recipeId: 'a', slot: 'lunch' }), p({ recipeId: 'a', slot: 'dinner' })],
      '2026-08-17',
    );
    expect(out).toHaveLength(1);
    expect(out[0].slot).toBe('lunch'); // il primo, non l'ultimo
  });

  it('⚠️ quello che il server NON manda non si chiede: è già stato votato, anche da un altro telefono', () => {
    // Il popup non deve più dedurre l'elenco dal menu del giorno.
    expect(valutazioniDaChiedere([], '2026-08-17')).toEqual([]);
  });

  it('una data con l\'ora dentro si confronta lo stesso', () => {
    expect(valutazioniDaChiedere([p({ recipeId: 'a', date: '2026-08-17T00:00:00.000Z' })], '2026-08-17')).toHaveLength(1);
  });

  it('niente dal server, o righe rotte: nessuna domanda e nessun errore', () => {
    expect(valutazioniDaChiedere(null, '2026-08-17')).toEqual([]);
    expect(valutazioniDaChiedere(undefined, '2026-08-17')).toEqual([]);
    expect(valutazioniDaChiedere([{ date: '', slot: '', recipeId: '', name: '' }], '2026-08-17')).toEqual([]);
  });
});
