import { pagatoNelPeriodo } from './pagato-per-mese';

describe('pagatoNelPeriodo — un pagamento si scala dal mese più vecchio', () => {
  // Inserite in disordine apposta: l'ordine dei mesi non deve venire dalla Map.
  const mesi = new Map([['2026-10', 99_90], ['2026-08', 50_00], ['2026-09', 30_00]]);

  it('il caso di Stella: tutto di ottobre, pagato tutto', () => {
    expect(pagatoNelPeriodo(new Map([['2026-10', 99_90]]), 99_90, '2026-10')).toEqual({ maturatoCents: 99_90, pagatoCents: 99_90, daPagareCents: 0 });
  });

  it('si coprono prima agosto e settembre, quello che avanza va su ottobre', () => {
    expect(pagatoNelPeriodo(mesi, 100_00, '2026-08')).toEqual({ maturatoCents: 50_00, pagatoCents: 50_00, daPagareCents: 0 });
    expect(pagatoNelPeriodo(mesi, 100_00, '2026-09')).toEqual({ maturatoCents: 30_00, pagatoCents: 30_00, daPagareCents: 0 });
    expect(pagatoNelPeriodo(mesi, 100_00, '2026-10')).toEqual({ maturatoCents: 99_90, pagatoCents: 20_00, daPagareCents: 79_90 });
  });

  it('senza pagamenti tutto è da pagare; un pagamento in eccesso non va sotto zero', () => {
    expect(pagatoNelPeriodo(mesi, 0, '2026-10')).toEqual({ maturatoCents: 99_90, pagatoCents: 0, daPagareCents: 99_90 });
    expect(pagatoNelPeriodo(mesi, 999_00, '2026-10')).toEqual({ maturatoCents: 99_90, pagatoCents: 99_90, daPagareCents: 0 });
  });

  it('«Tutto»: maturato totale meno pagato', () => {
    expect(pagatoNelPeriodo(mesi, 100_00, null)).toEqual({ maturatoCents: 179_90, pagatoCents: 100_00, daPagareCents: 79_90 });
  });

  it('un mese di soli storni lascia più pagato per i mesi dopo', () => {
    const conStorno = new Map([['2026-08', 50_00], ['2026-09', -20_00], ['2026-10', 99_90]]);
    expect(pagatoNelPeriodo(conStorno, 50_00, '2026-10')).toEqual({ maturatoCents: 99_90, pagatoCents: 20_00, daPagareCents: 79_90 });
    expect(pagatoNelPeriodo(conStorno, 50_00, '2026-09')).toEqual({ maturatoCents: -20_00, pagatoCents: 0, daPagareCents: 0 });
  });

  it('un mese senza righe: niente maturato, niente da pagare', () => {
    expect(pagatoNelPeriodo(mesi, 100_00, '2026-07')).toEqual({ maturatoCents: 0, pagatoCents: 0, daPagareCents: 0 });
  });
});
