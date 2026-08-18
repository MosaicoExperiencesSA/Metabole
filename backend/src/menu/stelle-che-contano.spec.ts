import { SOLO_STELLE_DATE, TAG_STELLE_NON_DATE, stellaData } from './stelle-che-contano';

/**
 * ⚠️ IL 3 CHE L'APP SCRIVE AL POSTO DELLA CLIENTE non è un'opinione, e fino a stanotte orientava il
 * motore: chi diceva soltanto «non l'ho seguita» risultava aver dato tre stelle a quel piatto, e se
 * lo rivedeva davanti con la faccia di uno che le era piaciuto.
 */
describe('le stelle che contano', () => {
  it('il filtro tiene fuori i voti col tag, e non guarda gli altri tag', () => {
    expect(SOLO_STELLE_DATE).toEqual({ NOT: { tags: { has: 'stelle_non_date' } } });
    expect(TAG_STELLE_NON_DATE).toBe('stelle_non_date');
  });

  it('un voto marcato non conta', () => {
    expect(stellaData({ tags: ['non_seguita', TAG_STELLE_NON_DATE] })).toBe(false);
  });

  it('un voto con altri tag conta: le stelle le ha date lei', () => {
    expect(stellaData({ tags: ['seguita'] })).toBe(true);
  });

  /**
   * ⚠️ I voti SENZA tag contano: sono tutti quelli scritti prima del 18/8, e non c'è modo di sapere
   * quali fossero valori di scorta. Trattarli come «non dati» butterebbe via la storia di chi le
   * stelle le ha date davvero, che è la parte buona del segnale.
   */
  it('⚠️ un voto senza tag conta: è la storia di prima, e non si butta', () => {
    expect(stellaData({})).toBe(true);
    expect(stellaData({ tags: [] })).toBe(true);
    expect(stellaData({ tags: null })).toBe(true);
  });
});
