import { motivoRifiutoPagamento, residuoDaPagare } from './pagamento-manuale';

/** Il giudizio del pagamento registrato dall'admin (19/10): i casi, senza Prisma. */
describe('pagamento-manuale — residuo e motivi di rifiuto', () => {
  const sit = (maturatoCents: number, pagatoCents: number) => ({ maturatoCents, pagatoCents });
  const ok = (amountCents: number, situazione = sit(449_55, 0), pagatoIl = '2026-10-19') =>
    motivoRifiutoPagamento({ amountCents, pagatoIl, oggi: '2026-10-19', situazione });

  it('il residuo è maturato meno pagato, e non va mai sotto zero', () => {
    expect(residuoDaPagare(sit(217_25, 100_00))).toBe(117_25);
    expect(residuoDaPagare(sit(100_00, 150_00))).toBe(0);
  });

  it('si può pagare esattamente il residuo, non un centesimo di più', () => {
    expect(ok(449_55)).toBeNull();
    expect(ok(449_56)).toMatch(/superiore a quanto resta da pagare \(449,55 €\)/);
  });

  it('il già pagato riduce il tetto', () => {
    expect(ok(349_55, sit(449_55, 100_00))).toBeNull();
    expect(ok(349_56, sit(449_55, 100_00))).not.toBeNull();
  });

  it('importo zero, negativo o con frazioni di centesimo: rifiutato', () => {
    expect(ok(0)).toBe('Importo non valido.');
    expect(ok(-5)).toBe('Importo non valido.');
    expect(ok(10.5)).toBe('Importo non valido.');
  });

  it('la data: valida, non nel futuro — oggi e ieri vanno bene, domani no', () => {
    expect(ok(100, sit(449_55, 0), '2026-10-19')).toBeNull();
    expect(ok(100, sit(449_55, 0), '2026-10-18')).toBeNull();
    expect(ok(100, sit(449_55, 0), '2026-10-20')).toMatch(/futuro/);
    expect(ok(100, sit(449_55, 0), '19/10/2026')).toMatch(/Data/);
    expect(ok(100, sit(449_55, 0), '2026-13-45')).toMatch(/Data/);
  });
});
