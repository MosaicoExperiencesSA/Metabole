/**
 * §16.7 — le regole della prenotazione, quelle che decidono se una cliente resta senza visita o
 * senza soldi.
 */
import {
  ORE_PER_MODIFICARE,
  creditoVisite,
  oreAll,
  siPuoModificare,
  testoTroppoTardi,
  visiteConcesseDa,
} from './prenotazioni';

const ADESSO = new Date('2026-09-10T10:00:00Z');
const fraOre = (h: number) => new Date(ADESSO.getTime() + h * 3_600_000);

describe('le 24 ore per spostare o disdire', () => {
  it('sono ventiquattro, deciso da Simone il 12/8', () => {
    expect(ORE_PER_MODIFICARE).toBe(24);
  });

  it('un appuntamento fra tre giorni si tocca', () => {
    expect(siPuoModificare(fraOre(72), ADESSO)).toBe(true);
  });

  it('esattamente 24 ore prima si tocca ancora: la soglia è inclusa', () => {
    expect(siPuoModificare(fraOre(24), ADESSO)).toBe(true);
  });

  it('a 23 ore no', () => {
    expect(siPuoModificare(fraOre(23), ADESSO)).toBe(false);
  });

  it('un appuntamento già passato non si tocca', () => {
    expect(siPuoModificare(fraOre(-1), ADESSO)).toBe(false);
  });

  describe('e quando è tardi si dice QUANTO manca', () => {
    it('«mancano 3 ore» spiega da sé perché il pulsante non c\'è', () => {
      const t = testoTroppoTardi(fraOre(3), ADESSO);
      expect(t).toContain('3 ore');
      expect(t).toContain('24 ore prima');
      expect(t).toContain('coach');
    });

    it('sotto l\'ora non dice «0 ore»', () => {
      expect(testoTroppoTardi(fraOre(0.5), ADESSO)).toContain("meno di un'ora");
    });

    it('il singolare è singolare', () => {
      expect(testoTroppoTardi(fraOre(1.5), ADESSO)).toContain('1 ora');
    });

    it('già passato lo dice e basta', () => {
      expect(testoTroppoTardi(fraOre(-2), ADESSO)).toBe("Quell'appuntamento è già passato.");
    });
  });

  it('le ore mancanti si contano anche all\'indietro', () => {
    expect(oreAll(fraOre(5), ADESSO)).toBe(5);
    expect(oreAll(fraOre(-5), ADESSO)).toBe(-5);
  });
});

describe('il diritto a prenotare', () => {
  const prodotti = new Map([
    ['p-visita', 1],
    ['p-pacchetto3', 3],
  ]);

  it('un prodotto «visita» dà una visita', () => {
    expect(visiteConcesseDa([{ productId: 'p-visita', qty: 1 }], prodotti)).toBe(1);
  });

  it('un pacchetto da tre ne dà tre, e due pacchetti sei', () => {
    expect(visiteConcesseDa([{ productId: 'p-pacchetto3', qty: 1 }], prodotti)).toBe(3);
    expect(visiteConcesseDa([{ productId: 'p-pacchetto3', qty: 2 }], prodotti)).toBe(6);
  });

  it('gli integratori non danno visite', () => {
    expect(visiteConcesseDa([{ productId: 'p-omega3', qty: 4 }], prodotti)).toBe(0);
  });

  it('⚠️ una quantità mancante o storta vale UNO, non zero', () => {
    // `items` è un JSON scritto da un altro pezzo di codice: leggere «zero visite» da un ordine
    // che una visita l'ha pagata vorrebbe dire una cliente che ha pagato e non può prenotare,
    // senza nessun errore da nessuna parte. Nel dubbio si concede.
    expect(visiteConcesseDa([{ productId: 'p-visita' }], prodotti)).toBe(1);
    expect(visiteConcesseDa([{ productId: 'p-visita', qty: 0 }], prodotti)).toBe(1);
    expect(visiteConcesseDa([{ productId: 'p-visita', qty: null }], prodotti)).toBe(1);
    expect(visiteConcesseDa([{ productId: 'p-visita', qty: -3 }], prodotti)).toBe(1);
  });

  it('righe vuote o senza prodotto non fanno cadere niente', () => {
    expect(visiteConcesseDa([], prodotti)).toBe(0);
    expect(visiteConcesseDa([{ qty: 2 }], prodotti)).toBe(0);
    expect(visiteConcesseDa(undefined as never, prodotti)).toBe(0);
  });

  describe('il credito', () => {
    it('è quello che ha comprato meno quello che ha già fissato', () => {
      expect(creditoVisite(3, 1)).toBe(2);
      expect(creditoVisite(1, 1)).toBe(0);
    });

    it('non va mai sotto zero, nemmeno se qualcuno ha fissato visite a mano', () => {
      // Il nutrizionista può creare visite dal suo lato senza che nessuno le abbia comprate.
      expect(creditoVisite(1, 4)).toBe(0);
    });
  });
});
