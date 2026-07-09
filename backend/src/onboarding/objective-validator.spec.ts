import {
  computeScreeningFlag,
  validateObjective,
} from './objective-validator';

const config = {
  sustainableRateMaxKgWeek: 0.7,
  ambitiousRateMaxKgWeek: 1.0,
  unrealAction: 'warn',
};

describe('validateObjective (ritmo sostenibile — Appendice A)', () => {
  it('6 kg in 18 settimane = sostenibile (0.33 kg/sett)', () => {
    const r = validateObjective({ weightToLoseKg: 6, weeks: 18, ...config });
    expect(r.pace).toBe('sustainable');
    expect(r.accepted).toBe(true);
    expect(r.ratePerWeek).toBeCloseTo(0.33, 2);
  });

  it('esattamente alla soglia (0.7 kg/sett) è ancora sostenibile', () => {
    const r = validateObjective({ weightToLoseKg: 7, weeks: 10, ...config });
    expect(r.pace).toBe('sustainable');
  });

  it('tra 0.7 e 1.0 kg/sett = ambizioso ma accettato', () => {
    const r = validateObjective({ weightToLoseKg: 9, weeks: 10, ...config });
    expect(r.pace).toBe('ambitious');
    expect(r.accepted).toBe(true);
  });

  it('oltre 1.0 kg/sett con action=warn: accettato con avviso e settimane suggerite', () => {
    const r = validateObjective({ weightToLoseKg: 15, weeks: 10, ...config });
    expect(r.pace).toBe('unreal');
    expect(r.accepted).toBe(true);
    expect(r.suggestedWeeks).toBe(Math.ceil(15 / 0.7)); // 22
    expect(r.message).toContain('22');
  });

  it('action=block_propose_date: rifiutato con data proposta', () => {
    const r = validateObjective({
      weightToLoseKg: 15,
      weeks: 10,
      ...config,
      unrealAction: 'block_propose_date',
    });
    expect(r.accepted).toBe(false);
    expect(r.suggestedWeeks).toBe(22);
  });

  it('action=require_nutritionist: accettato ma con presa in carico', () => {
    const r = validateObjective({
      weightToLoseKg: 15,
      weeks: 10,
      ...config,
      unrealAction: 'require_nutritionist',
    });
    expect(r.accepted).toBe(true);
    expect(r.requiresNutritionist).toBe(true);
  });

  it('le soglie sono davvero configurabili (non hardcodate)', () => {
    const strict = validateObjective({
      weightToLoseKg: 5,
      weeks: 10,
      ...config,
      sustainableRateMaxKgWeek: 0.4,
    });
    expect(strict.pace).toBe('ambitious'); // 0.5 kg/sett supera la soglia ridotta
  });
});

describe('computeScreeningFlag (screening sanitario)', () => {
  it('nessuna condizione, nessun farmaco → non supervisionato', () => {
    expect(computeScreeningFlag({ hasConditions: 'no', takesMedications: 'no' })).toBe(false);
  });

  it('patologia dichiarata → supervisionato', () => {
    expect(computeScreeningFlag({ hasConditions: 'yes', takesMedications: 'no' })).toBe(true);
  });

  it('"lo dico in visita" → supervisionato per prudenza', () => {
    expect(
      computeScreeningFlag({ hasConditions: 'tell_in_visit', takesMedications: 'no' }),
    ).toBe(true);
  });

  it('farmaci → supervisionato', () => {
    expect(computeScreeningFlag({ hasConditions: 'no', takesMedications: 'yes' })).toBe(true);
  });
});
