/**
 * CHI VA RICONTATTATA SULLE ALLERGIE — §7.1 dell'handoff.
 *
 * I due test che contano sono quelli sulla **sovrapposizione** e su **chi non ha finito il
 * questionario**: da questi numeri si decide se mandare centinaia di notifiche, e un totale gonfiato
 * o una popolazione sbagliata portano a mandarle alle persone sbagliate.
 */
import { contaRicontatti, motivoRicontatto } from './da-ricontattare';

const UE = ['glutine', 'latte', 'uova', 'frutta_a_guscio'];
const FATTO = new Date('2026-06-01T00:00:00Z');

const profilo = (over: Record<string, unknown> = {}) => ({
  allergies: [],
  allergiesOther: [],
  allergieDichiarateIl: new Date('2026-06-01T00:00:00Z'),
  intolerances: [],
  intolerancesOther: [],
  onboardingCompletedAt: FATTO,
  ...over,
});

describe('perché una cliente va ricontattata', () => {
  it('⚠️ «Altro» fra le intolleranze senza aver detto cosa: è la più urgente', () => {
    // Fino al 13/8 il campo dove scriverlo non esisteva: non è distrazione sua.
    expect(motivoRicontatto(profilo({ intolerances: ['lactose', 'other'] }), UE)).toBe('intolleranza_ignota');
  });

  it('e appena lo dice, esce dall\'elenco', () => {
    expect(
      motivoRicontatto(profilo({ intolerances: ['lactose', 'other'], intolerancesOther: ['i fichi'] }), UE),
    ).toBeNull();
  });

  it('un\'allergia scritta a mano e mai codificata', () => {
    expect(motivoRicontatto(profilo({ allergies: ['latte', 'fragole'] }), UE)).toBe('allergie_da_codificare');
  });

  it('tutto codificato: non si disturba', () => {
    expect(motivoRicontatto(profilo({ allergies: ['latte', 'uova'] }), UE)).toBeNull();
  });

  it('⚠️ questionario finito e mai una risposta: «non ne ho» e «ho saltato» sono la stessa cosa', () => {
    expect(motivoRicontatto(profilo({ allergieDichiarateIl: null }), UE)).toBe('mai_risposto');
  });

  it('⚠️ ma «non ne ho» DETTO vale come risposta, e la toglie dall\'elenco', () => {
    // È a cosa serve l'opzione «Non ho allergie» aggiunta al questionario il 13/8.
    expect(motivoRicontatto(profilo({ allergieDichiarateIl: FATTO }), UE)).toBeNull();
  });

  it('⚠️ chi il questionario non l\'ha ancora finito NON si ricontatta', () => {
    // Non ha saltato la pagina: non ci è ancora arrivata. Una notifica su una domanda che sta per
    // vedere insegna solo a ignorare le notifiche.
    expect(motivoRicontatto(profilo({ onboardingCompletedAt: null, allergieDichiarateIl: null }), UE)).toBeNull();
  });
});

describe('il conteggio da cui si decide', () => {
  it('⚠️ chi ha DUE problemi conta UNA volta: i tre numeri si devono poter sommare', () => {
    // Senza questo, la somma di tre elenchi che si sovrappongono sarebbe più grande del numero di
    // clienti che esistono — ed è il numero su cui si decide se fare la campagna.
    const doppia = profilo({ intolerances: ['other'], allergies: ['fragole'], allergieDichiarateIl: null });
    const c = contaRicontatti([doppia], UE);
    expect(c.intolleranza_ignota).toBe(1);
    expect(c.allergie_da_codificare).toBe(0);
    expect(c.mai_risposto).toBe(0);
    expect(c.totaleDaRicontattare).toBe(1);
  });

  it('e il totale non supera mai le clienti esaminate', () => {
    const c = contaRicontatti(
      [
        profilo({ intolerances: ['other'] }),
        profilo({ allergies: ['fragole'] }),
        profilo({ allergieDichiarateIl: null }),
        profilo({ allergies: ['latte'] }),
      ],
      UE,
    );
    expect(c).toMatchObject({
      intolleranza_ignota: 1,
      allergie_da_codificare: 1,
      mai_risposto: 1,
      aPosto: 1,
      totaleDaRicontattare: 3,
      esaminate: 4,
    });
    expect(c.totaleDaRicontattare + c.aPosto).toBe(c.esaminate);
  });

  it('nessuna cliente: nessun numero inventato', () => {
    expect(contaRicontatti([], UE)).toMatchObject({ esaminate: 0, totaleDaRicontattare: 0, aPosto: 0 });
  });

  it('campi mancanti (clienti vecchie) non fanno cadere il conto', () => {
    expect(motivoRicontatto({}, UE)).toBeNull();
    expect(contaRicontatti([{}, { allergies: null, intolerances: null }], UE).esaminate).toBe(2);
  });
});
