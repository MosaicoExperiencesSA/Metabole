import { describe, expect, it } from 'vitest';
import { normalizzaBilling, pianoPerCarrello } from './pianoCarrello';

/**
 * IL PRIMO ACQUISTO DEVE PORTARSI DIETRO `billing` (12/8).
 *
 * Il difetto: `PlanFlow` non lo passava al carrello, quindi al Checkout la scelta fra abbonamento e
 * pagamento unico non compariva mai — sulla strada da cui passa ogni nuova cliente.
 *
 * Il test che conta più di tutti è quello su `both`: si parte da **un mese solo**, perché in quella
 * schermata nessuno ha mostrato alla cliente le due forme.
 */
const piano = (over: Record<string, unknown> = {}) => ({
  id: 'p3m', name: 'Percorso Metabole 3 mesi', priceCents: 24900, period: '3m', ...over,
});

describe('pianoPerCarrello', () => {
  it('«both»: parte da UN MESE SOLO, e la cliente passa all\'abbonamento dal Checkout', () => {
    const c = pianoPerCarrello(piano({ billing: 'both' }));
    expect(c.billing).toBe('both');
    // Se questo diventasse `true`, metteremmo in carrello un addebito ricorrente per un'opzione che
    // nessuno le ha mostrato.
    expect(c.abbonamento).toBe(false);
  });

  it('«recurring»: abbonamento, perché non c’è niente da scegliere', () => {
    const c = pianoPerCarrello(piano({ billing: 'recurring' }));
    expect(c.billing).toBe('recurring');
    expect(c.abbonamento).toBe(true);
  });

  it('«one_time»: un mese solo', () => {
    const c = pianoPerCarrello(piano({ billing: 'one_time' }));
    expect(c).toMatchObject({ billing: 'one_time', abbonamento: false });
  });

  it('billing assente: si comporta come «one_time», non si indovina', () => {
    // È il caso di un piano vecchio o di una risposta parziale del server: davanti a un dato che non
    // c'è si sceglie la forma che non addebita niente nei mesi successivi.
    expect(pianoPerCarrello(piano())).toMatchObject({ billing: 'one_time', abbonamento: false });
    expect(pianoPerCarrello(piano({ billing: null }))).toMatchObject({ billing: 'one_time' });
  });

  it('porta con sé id, nome, prezzo e periodo senza toccarli', () => {
    expect(pianoPerCarrello(piano({ billing: 'both' }))).toMatchObject({
      id: 'p3m', name: 'Percorso Metabole 3 mesi', priceCents: 24900, period: '3m',
    });
  });
});

describe('normalizzaBilling', () => {
  it('riconosce le tre forme vere', () => {
    expect(normalizzaBilling('one_time')).toBe('one_time');
    expect(normalizzaBilling('recurring')).toBe('recurring');
    expect(normalizzaBilling('both')).toBe('both');
  });

  it('qualunque altra cosa vale «one_time»', () => {
    for (const v of [undefined, null, '', 'RECURRING', 'mensile', 0, {}, []]) {
      expect(normalizzaBilling(v)).toBe('one_time');
    }
  });
});
