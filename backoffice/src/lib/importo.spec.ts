import { describe, expect, it } from 'vitest';
import { centesimiDaTesto } from './importo';

describe('centesimiDaTesto — l’importo del bonifico', () => {
  it('virgola decimale, all’italiana', () => {
    expect(centesimiDaTesto('217,25')).toBe(217_25);
    expect(centesimiDaTesto('1.217,25')).toBe(1217_25);
    expect(centesimiDaTesto('99,9')).toBe(99_90);
  });
  it('⚠️ il punto decimale NON diventa migliaia', () => {
    expect(centesimiDaTesto('217.25')).toBe(217_25);
    expect(centesimiDaTesto('32.5')).toBe(32_50);
  });
  it('punto con tre cifre dopo = migliaia', () => {
    expect(centesimiDaTesto('1.217')).toBe(1217_00);
  });
  it('interi, spazi e simbolo dell’euro', () => {
    expect(centesimiDaTesto(' 449 ')).toBe(449_00);
    expect(centesimiDaTesto('€ 449,55')).toBe(449_55);
  });
  it('quello che non è un importo è null', () => {
    for (const x of ['', 'abc', '12,345', '1,2,3', '-5', '12.3.4,5,6']) expect(centesimiDaTesto(x)).toBeNull();
  });
});
