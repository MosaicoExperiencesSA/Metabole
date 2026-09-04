import { describe, expect, it } from 'vitest';
import { NESSUN_FILTRO, comeSiLegge, mostraTutto, numeriDaMostrare, passaIlFiltro } from './panieri-filtro';

const TUTTO = NESSUN_FILTRO;
const SOLO_ATTIVE = { attive: true, bozze: false, nascondiVerificate: false };
const SOLO_BOZZE = { attive: false, bozze: true, nascondiVerificate: false };
const TUTTI_E_DUE = { attive: true, bozze: true, nascondiVerificate: false };
/** ⚠️ Il terzo asse, che si combina con gli altri due invece di sostituirli. */
const senzaSpunta = <T extends object>(f: T) => ({ ...f, nascondiVerificate: true });

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
  const cella = { piatti: 84, attivi: 60, verificate: 0, attiveVerificate: 0 };

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
    expect(numeriDaMostrare({ piatti: 3, attivi: 9, verificate: 0, attiveVerificate: 0 }, SOLO_BOZZE)).toEqual({ quanti: 0, fraParentesi: null });
  });

  it('⚠️ un paniere vuoto resta zero in tutti e tre i modi', () => {
    const vuoto = { piatti: 0, attivi: 0, verificate: 0, attiveVerificate: 0 };
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

/**
 * ⛔ **IL TERZO PULSANTE: «nascondi verificate»** — Simone, 4/9.
 *
 * ⚠️ È un **asse a parte**, e queste prove sono qui per quello: non sostituisce «attive»/«bozze», si
 * incrocia con loro. «Solo attive» più questo chiede *le attive che restano da verificare*, che è la
 * domanda per cui il pulsante esiste — e che nella stessa terna non si sarebbe potuta fare.
 */
describe('⛔ nascondere le verificate', () => {
  it('⛔ nell\'elenco toglie le verificate, e lascia le altre', () => {
    expect(passaIlFiltro(true, senzaSpunta(TUTTO), true)).toBe(false);
    expect(passaIlFiltro(true, senzaSpunta(TUTTO), false)).toBe(true);
  });

  /** ⛔ E si incrocia: una bozza verificata sparisce anche a «solo in bozza». */
  it('⛔ si combina con gli altri due invece di sostituirli', () => {
    expect(passaIlFiltro(false, senzaSpunta(SOLO_BOZZE), true)).toBe(false);
    expect(passaIlFiltro(false, senzaSpunta(SOLO_BOZZE), false)).toBe(true);
    expect(passaIlFiltro(true, senzaSpunta(SOLO_BOZZE), false)).toBe(false);
  });

  /**
   * ⚠️ **«Non lo so» vale «non verificata»**: una schermata che ancora non manda il campo non deve
   * far sparire dei piatti che ci sono. Il ripiego mostra **di più**, che è l'errore innocuo.
   */
  it('⚠️ senza il campo non nasconde niente', () => {
    expect(passaIlFiltro(true, senzaSpunta(TUTTO))).toBe(true);
  });

  /**
   * ⛔ **E i numeri della matrice seguono**, come per gli altri due: un filtro che cambiasse
   * l'elenco sotto e lasciasse i numeri sopra farebbe leggere due verità diverse nella stessa
   * schermata. Su 10 piatti, 6 attivi, 4 verificati di cui 3 attivi:
   */
  const C = { piatti: 10, attivi: 6, verificate: 4, attiveVerificate: 3 };

  it('⛔ senza altri filtri: 6 non verificate, di cui 3 attive', () => {
    expect(numeriDaMostrare(C, senzaSpunta(TUTTO))).toEqual({ quanti: 6, fraParentesi: 3 });
  });

  it('⛔ con «solo attive»: le attive non verificate', () => {
    expect(numeriDaMostrare(C, senzaSpunta(SOLO_ATTIVE))).toEqual({ quanti: 3, fraParentesi: null });
  });

  /** 4 bozze in tutto, di cui 1 verificata (4 verificate − 3 attive verificate) → 3. */
  it('⛔ con «solo in bozza»: le bozze non verificate', () => {
    expect(numeriDaMostrare(C, senzaSpunta(SOLO_BOZZE))).toEqual({ quanti: 3, fraParentesi: null });
  });

  /** ⚠️ E la frase lo dice: senza, un filtro acceso è un numero sbagliato. */
  it('⚠️ e la spiegazione lo dice, sommandosi all\'altra', () => {
    expect(comeSiLegge(senzaSpunta(TUTTO))).toContain('VERIFICATE');
    const due = comeSiLegge(senzaSpunta(SOLO_ATTIVE))!;
    expect(due).toContain('ATTIVE');
    expect(due).toContain('VERIFICATE');
  });
});
