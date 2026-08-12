/**
 * Il prezzo mostrato dev'essere quello addebitato (Simone, 12/8).
 *
 * Il test che conta è il secondo: con la promo **scaduta** il carrello addebita il listino pieno, e
 * il Negozio mostrava ancora il prezzo scontato. Oggi non si vede perché nessun piano ha un listino
 * valorizzato — si accende con un singolo salvataggio da Gestione Negozio.
 */
import { describe, expect, it } from 'vitest';
import { prezzoBarrato, prezzoDaPagare } from './prezzoPiano';

describe('prezzoDaPagare', () => {
  it('senza listino è il prezzo del piano', () => {
    expect(prezzoDaPagare({ priceCents: 29700 })).toBe(29700);
  });

  it('⚠️ vince sempre quello che dice il server, che è quello che incassa', () => {
    // Promo scaduta: il server ha già riportato il prezzo al listino pieno. Prima qui si mostrava
    // 24900 e allo scontrino ne arrivavano 29700.
    expect(prezzoDaPagare({ priceCents: 24900, effectivePriceCents: 29700, listPriceCents: 29700 })).toBe(29700);
  });

  it('in promo i due coincidono', () => {
    expect(prezzoDaPagare({ priceCents: 24900, effectivePriceCents: 24900, promoActive: true })).toBe(24900);
  });

  it('⚠️ le risposte vecchie senza quel campo continuano a funzionare', () => {
    // Un'app aggiornata contro un backend che non lo manda ancora non deve mostrare «undefined».
    expect(prezzoDaPagare({ priceCents: 29700, effectivePriceCents: null })).toBe(29700);
    expect(prezzoDaPagare({ priceCents: 29700, effectivePriceCents: undefined })).toBe(29700);
  });

  it('zero è un prezzo (la prova gratuita), non un campo mancante', () => {
    expect(prezzoDaPagare({ priceCents: 9900, effectivePriceCents: 0 })).toBe(0);
  });
});

describe('prezzoBarrato', () => {
  it('in promo si barra il listino', () => {
    expect(prezzoBarrato({ priceCents: 24900, effectivePriceCents: 24900, listPriceCents: 29700, promoActive: true })).toBe(29700);
  });

  it('⚠️ a promo SCADUTA non si barra niente', () => {
    // Il listino non è più uno sconto mancato: è il prezzo. Mostrarlo sbarrato vorrebbe dire
    // vantare uno sconto che non si sta facendo.
    expect(prezzoBarrato({ priceCents: 24900, effectivePriceCents: 29700, listPriceCents: 29700, promoActive: false })).toBeNull();
  });

  it('un listino non maggiore del prezzo non si barra', () => {
    expect(prezzoBarrato({ priceCents: 29700, effectivePriceCents: 29700, listPriceCents: 19900, promoActive: true })).toBeNull();
  });

  it('senza listino non c\'è niente da barrare', () => {
    expect(prezzoBarrato({ priceCents: 29700, promoActive: true })).toBeNull();
  });
});
