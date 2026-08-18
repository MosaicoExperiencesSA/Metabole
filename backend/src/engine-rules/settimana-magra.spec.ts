import {
  primaSettimanaMagra,
  piattiPerSettimana,
  settimanaGiaPiena,
  settimaneFatteDa,
  settimanaMagra,
  type GiornataInCiclo,
} from './settimana-magra';

const SLOT = ['breakfast', 'lunch', 'dinner'];

/** Una settimana piena: 7 giornate, ognuna con tre pasti e piatti tutti diversi. */
function settimanaPiena(w: number, prefisso = 'r'): GiornataInCiclo[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex: (w - 1) * 7 + i + 1,
    meals: SLOT.map((slot) => ({ slot, recipeId: `${prefisso}-${w}-${slot}-${i}` })),
  }));
}

describe('settimaneFatteDa', () => {
  it('conta fin dove si arriva, non quanto è pieno', () => {
    expect(settimaneFatteDa([{ dayIndex: 8, meals: [] }])).toBe(2);
    expect(settimaneFatteDa([])).toBe(0);
    expect(settimaneFatteDa([{ dayIndex: 7, meals: [] }])).toBe(1);
  });
});

describe('settimanaMagra', () => {
  it('una settimana che non esiste è magra: c\'è da lavorarci', () => {
    expect(settimanaMagra(undefined, SLOT)).toBe(true);
  });

  it('sette piatti diversi per pasto: piena', () => {
    const perSett = piattiPerSettimana(settimanaPiena(1));
    expect(settimanaMagra(perSett.get(1), SLOT)).toBe(false);
  });

  it('⚠️ sette giornate ma piatti ripetuti: magra lo stesso', () => {
    // È il caso vero delle varianti nate col metodo vecchio: 28 giornate, 19 piatti per pasto.
    // A contare le giornate erano a posto; a tavola era la stessa colazione cinque volte al mese.
    const giornate: GiornataInCiclo[] = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i + 1,
      meals: SLOT.map((slot) => ({ slot, recipeId: `${slot}-${i % 3}` })),
    }));
    expect(settimanaMagra(piattiPerSettimana(giornate).get(1), SLOT)).toBe(true);
  });

  it('un pasto atteso che manca del tutto: magra', () => {
    const giornate: GiornataInCiclo[] = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i + 1,
      meals: [{ slot: 'breakfast', recipeId: `b${i}` }, { slot: 'lunch', recipeId: `l${i}` }],
    }));
    expect(settimanaMagra(piattiPerSettimana(giornate).get(1), SLOT)).toBe(true);
  });
});

describe('primaSettimanaMagra', () => {
  it('la più bassa fra quelle esistenti, non l\'ultima', () => {
    const giornate = [...settimanaPiena(1), ...settimanaPiena(2).slice(0, 4), ...settimanaPiena(3)];
    expect(primaSettimanaMagra(giornate, SLOT)).toBe(2);
  });

  it('tutte piene: null (e allora la prossima è nuova, la decide chi chiama)', () => {
    expect(primaSettimanaMagra([...settimanaPiena(1), ...settimanaPiena(2)], SLOT)).toBeNull();
  });

  it('catalogo vuoto: null, non zero', () => {
    expect(primaSettimanaMagra([], SLOT)).toBeNull();
  });
});

describe('settimanaGiaPiena', () => {
  it('⚠️ quattro giornate su sette NON sono «c\'è già»', () => {
    // Il difetto che questo modulo chiude: il pulsante *genera* rispondeva «c'è già» perché una
    // giornata con quel numero esisteva, e la settimana restava a metà per sempre.
    const giornate = settimanaPiena(2).slice(0, 4);
    expect(settimaneFatteDa(giornate)).toBe(2);
    expect(settimanaGiaPiena(giornate, 2, SLOT)).toBe(false);
  });

  it('sette giornate piene: sì, c\'è già', () => {
    expect(settimanaGiaPiena(settimanaPiena(2), 2, SLOT)).toBe(true);
  });
});
