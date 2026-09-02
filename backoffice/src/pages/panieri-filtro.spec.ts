import { describe, expect, it } from 'vitest';
import { NESSUN_FILTRO, comeSiLegge, mostraTutto, numeriDaMostrare, passaIlFiltro } from './panieri-filtro';

const TUTTO = NESSUN_FILTRO;
const SOLO_ATTIVE = { attive: true, bozze: false };
const SOLO_BOZZE = { attive: false, bozze: true };
const TUTTI_E_DUE = { attive: true, bozze: true };

describe('⛔ entrambi spenti e entrambi accesi vogliono dire la stessa cosa', () => {
  it('nessun pulsante premuto mostra tutto', () => {
    expect(mostraTutto(TUTTO)).toBe(true);
  });

  /**
   * ⛔ «Attive» e «bozze» sono le uniche due possibilità: la loro unione **è** il totale. Un terzo
   * stato che mostrasse meno sarebbe una bugia.
   */
  it('⛔ e premerli tutti e due pure', () => {
    expect(mostraTutto(TUTTI_E_DUE)).toBe(true);
  });

  it('⚠️ uno solo no', () => {
    expect(mostraTutto(SOLO_ATTIVE)).toBe(false);
    expect(mostraTutto(SOLO_BOZZE)).toBe(false);
  });
});

describe('passaIlFiltro — l’elenco delle ricette', () => {
  it('senza filtro passano tutte', () => {
    expect(passaIlFiltro(true, TUTTO)).toBe(true);
    expect(passaIlFiltro(false, TUTTO)).toBe(true);
  });

  it('⛔ «solo attive» nasconde le bozze', () => {
    expect(passaIlFiltro(true, SOLO_ATTIVE)).toBe(true);
    expect(passaIlFiltro(false, SOLO_ATTIVE)).toBe(false);
  });

  it('⛔ «solo in bozza» nasconde le attive', () => {
    expect(passaIlFiltro(false, SOLO_BOZZE)).toBe(true);
    expect(passaIlFiltro(true, SOLO_BOZZE)).toBe(false);
  });

  it('⚠️ e coi due pulsanti premuti passano di nuovo tutte', () => {
    expect(passaIlFiltro(true, TUTTI_E_DUE)).toBe(true);
    expect(passaIlFiltro(false, TUTTI_E_DUE)).toBe(true);
  });
});

describe('numeriDaMostrare — i numeri della matrice', () => {
  const cella = { piatti: 84, attivi: 60 };

  it('senza filtro: 84 (60), come prima', () => {
    expect(numeriDaMostrare(cella, TUTTO)).toEqual({ quanti: 84, fraParentesi: 60 });
  });

  /**
   * ⛔ **Il numero fra parentesi sparisce col filtro acceso**, e deve sparire: `60 (60)` non
   * aggiunge niente e fa pensare a due misure diverse che tornano per caso. Le parentesi
   * rispondono a «quanti di questi arrivano davvero?», che con un filtro acceso non si pone più.
   */
  it('⛔ «solo attive»: 60, senza parentesi', () => {
    expect(numeriDaMostrare(cella, SOLO_ATTIVE)).toEqual({ quanti: 60, fraParentesi: null });
  });

  it('⛔ «solo in bozza»: la differenza, senza parentesi', () => {
    expect(numeriDaMostrare(cella, SOLO_BOZZE)).toEqual({ quanti: 24, fraParentesi: null });
  });

  /**
   * ⛔ **Mai un negativo.** I due numeri vengono da due conteggi distinti dell'API: se divergessero,
   * «−3 piatti in bozza» sarebbe un numero che non vuol dire niente, scritto dove qualcuno decide
   * cosa mangiano le clienti. Zero è falso in modo innocuo; un negativo manda a cercare un guasto
   * che non c'è.
   */
  it('⛔ se gli attivi superassero i piatti, zero e non un negativo', () => {
    expect(numeriDaMostrare({ piatti: 3, attivi: 9 }, SOLO_BOZZE)).toEqual({ quanti: 0, fraParentesi: null });
  });

  it('⚠️ un paniere vuoto resta zero in tutti e tre i modi', () => {
    const vuoto = { piatti: 0, attivi: 0 };
    expect(numeriDaMostrare(vuoto, TUTTO)).toEqual({ quanti: 0, fraParentesi: 0 });
    expect(numeriDaMostrare(vuoto, SOLO_ATTIVE).quanti).toBe(0);
    expect(numeriDaMostrare(vuoto, SOLO_BOZZE).quanti).toBe(0);
  });
});

/**
 * ⛔ **Un filtro acceso senza una frase che lo dica è un numero sbagliato.** Chi arriva su questa
 * pagina da un segnalibro, o ci torna dopo dieci minuti, legge «498 piatti» e non ha modo di sapere
 * che ne sta guardando un pezzo.
 */
describe('comeSiLegge', () => {
  it('senza filtro non dice niente', () => {
    expect(comeSiLegge(TUTTO)).toBeNull();
    expect(comeSiLegge(TUTTI_E_DUE)).toBeNull();
  });

  it('⛔ col filtro acceso spiega cosa sono i numeri', () => {
    expect(comeSiLegge(SOLO_ATTIVE)).toMatch(/solo le ricette ATTIVE/);
    expect(comeSiLegge(SOLO_BOZZE)).toMatch(/solo le BOZZE/);
  });
});
