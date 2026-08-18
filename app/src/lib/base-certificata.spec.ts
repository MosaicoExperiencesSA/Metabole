import { describe, expect, it } from 'vitest';
import { baseDaMostrare, firmaCorta, fraseQuante, IN_LAVORAZIONE } from './base-certificata';

describe('baseDaMostrare', () => {
  it('base pronta: quante sono, con la versione e la firma accorciata', () => {
    const d = baseDaMostrare({ status: 'ready', totalSafe: 148, certificate: { version: 3, signature: 'a1b2c3d4e5f6a7b8c9' } });
    expect(d).toEqual({ tipo: 'pronta', quante: 148, versione: 3, firma: 'a1b2c3d4e5f6…' });
  });

  it('pronta senza certificato: il numero si dice lo stesso', () => {
    // Il certificato può non esserci ancora; il conto delle ricette sicure sì, ed è quello che
    // risponde alla sua domanda.
    const d = baseDaMostrare({ status: 'ready', totalSafe: 12 });
    expect(d).toEqual({ tipo: 'pronta', quante: 12, versione: null, firma: null });
  });

  it('bloccata: si dice il testo del server, non una frase nostra', () => {
    expect(baseDaMostrare({ status: 'blocked', message: 'Ci stiamo lavorando con la tua nutrizionista.' }))
      .toEqual({ tipo: 'in_lavorazione', testo: 'Ci stiamo lavorando con la tua nutrizionista.' });
  });

  it('bloccata senza testo: si ripiega su quello del socio, non sul silenzio', () => {
    expect(baseDaMostrare({ status: 'blocked' })).toEqual({ tipo: 'in_lavorazione', testo: IN_LAVORAZIONE });
  });

  it('⚠️ «pronta» con ZERO ricette non è pronta', () => {
    // Qualunque cosa sia successa dietro, per chi legge «pronta, 0 piatti» non vuol dire niente di
    // buono. Si dice che ci stiamo lavorando, che dal suo punto di vista è la verità.
    expect(baseDaMostrare({ status: 'ready', totalSafe: 0 })?.tipo).toBe('in_lavorazione');
    expect(baseDaMostrare({ status: 'ready' })?.tipo).toBe('in_lavorazione');
  });

  it('⚠️ se la lettura non riesce non si scrive NIENTE', () => {
    // «0 ricette certificate sicure per te» detto perché una chiamata è andata storta è la frase
    // più spaventosa che questa schermata possa contenere, e sarebbe falsa.
    expect(baseDaMostrare(null)).toBeNull();
    expect(baseDaMostrare(undefined)).toBeNull();
  });

  it('uno stato che non conosciamo non si interpreta', () => {
    expect(baseDaMostrare({ status: 'boh', totalSafe: 10 })).toBeNull();
  });
});

describe('le frasi', () => {
  it('al singolare non si scrive «1 ricette»', () => {
    expect(fraseQuante(1)).toContain('Una ricetta');
    expect(fraseQuante(1)).not.toContain('1 ricette');
    expect(fraseQuante(148)).toContain('148 ricette');
  });

  it('la firma corta mette i puntini solo se c\'è davvero altro dopo', () => {
    expect(firmaCorta('abc')).toBe('abc');
    expect(firmaCorta('abcdefghijkl')).toBe('abcdefghijkl'); // esattamente 12: niente puntini
    expect(firmaCorta('abcdefghijklm')).toBe('abcdefghijkl…');
    expect(firmaCorta('')).toBe('');
  });
});
