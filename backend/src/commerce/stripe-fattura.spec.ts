import { subscriptionIdDaFattura } from './commerce.service';

/**
 * Il difetto che questi test bloccano è il peggiore che avessimo scritto ieri, perché **non
 * dava errore**.
 *
 * Fino all'API Stripe 2025 la fattura aveva `invoice.subscription`. Dalla `2026-06-24.dahlia`
 * — la predefinita dell'SDK 22 che abbiamo installato — quel campo non esiste più: l'abbonamento
 * sta in `invoice.parent.subscription_details.subscription`. `handleInvoicePaid` leggeva solo il
 * campo vecchio, quindi ogni rinnovo usciva subito con «fattura non legata a un abbonamento»:
 * Stripe incassava €49 al mese, e da noi non nasceva nessun pagamento, nessuna provvigione,
 * nessuna ricevuta — e la scadenza non si spostava, quindi la cliente **pagante** si sarebbe
 * vista scadere il percorso. Con la webhook che risponde 200 e i soldi che arrivano lo stesso.
 *
 * Si leggono entrambe le forme perché la versione API con cui Stripe consegna gli eventi dipende
 * dall'account, non dall'SDK.
 */

describe('subscriptionIdDaFattura', () => {
  it('forma NUOVA (API 2026): parent.subscription_details.subscription', () => {
    const inv = { id: 'in_1', parent: { subscription_details: { subscription: 'sub_ABC' } } };
    expect(subscriptionIdDaFattura(inv)).toBe('sub_ABC');
  });

  it('forma VECCHIA (API ≤ 2025): invoice.subscription', () => {
    expect(subscriptionIdDaFattura({ id: 'in_1', subscription: 'sub_ABC' })).toBe('sub_ABC');
  });

  it('la forma nuova ha la precedenza se ci sono entrambe', () => {
    const inv = {
      id: 'in_1',
      subscription: 'sub_VECCHIO',
      parent: { subscription_details: { subscription: 'sub_NUOVO' } },
    };
    expect(subscriptionIdDaFattura(inv)).toBe('sub_NUOVO');
  });

  it('accetta anche l’oggetto espanso, non solo l’id', () => {
    expect(subscriptionIdDaFattura({ parent: { subscription_details: { subscription: { id: 'sub_X' } } } })).toBe('sub_X');
    expect(subscriptionIdDaFattura({ subscription: { id: 'sub_Y' } })).toBe('sub_Y');
  });

  it('fattura non legata a un abbonamento → null (e il webhook la ignora, giustamente)', () => {
    expect(subscriptionIdDaFattura({ id: 'in_1' })).toBeNull();
    expect(subscriptionIdDaFattura({ id: 'in_1', subscription: null })).toBeNull();
    expect(subscriptionIdDaFattura({ id: 'in_1', parent: { subscription_details: null } })).toBeNull();
    expect(subscriptionIdDaFattura({ id: 'in_1', parent: null })).toBeNull();
  });

  it('non esplode su input assurdi: il webhook non deve morire per una fattura strana', () => {
    expect(subscriptionIdDaFattura(null)).toBeNull();
    expect(subscriptionIdDaFattura(undefined)).toBeNull();
    expect(subscriptionIdDaFattura({})).toBeNull();
  });
});
