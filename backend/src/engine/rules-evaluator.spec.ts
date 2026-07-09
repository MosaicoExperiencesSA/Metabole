import {
  EngineRule,
  EngineSignals,
  evaluateCondition,
  evaluateRules,
} from './rules-evaluator';

const baseSignals = (over: Partial<EngineSignals> = {}): EngineSignals => ({
  stallDays: 0,
  weeklyRateKg: 0.5,
  direction: 'down',
  rapidLoss: false,
  progressPercent: 30,
  measurementsCount: 10,
  moodAvg: 3.5,
  energyAvg: 3.5,
  stressAvg: 2.5,
  lowEnergyChronic: false,
  checkinsLast7: 6,
  cookingTime: 'some',
  busyLifestyle: false,
  upcomingEvent: false,
  pausePeriodActive: false,
  avgRating: 4,
  adherenceLast7: 0.86,
  ...over,
});

// Le regole della tabella decisionale (spec 7.2), come nel seed.
const SPEC_RULES: EngineRule[] = [
  {
    id: 'p1',
    name: 'Calo troppo rapido con energia bassa',
    priority: 10,
    conditions: [
      { field: 'rapidLoss', op: 'is_true' },
      { field: 'energyAvg', op: 'lte', value: 3 },
    ],
    action: { menu: 'increase_calories', tone: 'gentle', timing: 'morning', levelDelta: -1, flagForReview: true },
  },
  {
    id: 'p2',
    name: 'Stallo con umore basso e vita intensa',
    priority: 20,
    conditions: [
      { field: 'stallDays', op: 'gte', value: 6 },
      { field: 'moodAvg', op: 'lte', value: 2.5 },
      { field: 'busyLifestyle', op: 'is_true' },
    ],
    action: { menu: 'practical', tone: 'supportive', timing: 'evening' },
  },
  {
    id: 'p3',
    name: 'Stallo con serenità e tempo per cucinare',
    priority: 30,
    conditions: [
      { field: 'stallDays', op: 'gte', value: 6 },
      { field: 'moodAvg', op: 'gte', value: 3.5 },
      { field: 'cookingTime', op: 'in', value: ['some', 'love_cooking'] },
    ],
    action: { menu: 'correction', tone: 'encouraging', timing: 'morning', levelDelta: 1 },
  },
  {
    id: 'p4',
    name: 'In calo con evento in agenda',
    priority: 40,
    conditions: [
      { field: 'direction', op: 'eq', value: 'down' },
      { field: 'upcomingEvent', op: 'is_true' },
    ],
    action: { menu: 'lighten_before_event', tone: 'neutral', timing: 'morning', levelDelta: -1 },
  },
  {
    id: 'p5',
    name: 'Aderente, umore alto, obiettivo vicino',
    priority: 50,
    conditions: [
      { field: 'adherenceLast7', op: 'gte', value: 0.8 },
      { field: 'moodAvg', op: 'gte', value: 4 },
      { field: 'progressPercent', op: 'gte', value: 75 },
    ],
    action: { menu: 'celebrate_step', tone: 'celebratory', timing: 'morning' },
  },
];

describe('evaluateCondition (operatori)', () => {
  const s = baseSignals();
  it.each([
    [{ field: 'rapidLoss', op: 'is_false' } as const, true],
    [{ field: 'stallDays', op: 'gte', value: 0 } as const, true],
    [{ field: 'moodAvg', op: 'lte', value: 3 } as const, false],
    [{ field: 'cookingTime', op: 'in', value: ['some'] } as const, true],
    [{ field: 'direction', op: 'eq', value: 'down' } as const, true],
    [{ field: 'avgRating', op: 'not_null' } as const, true],
  ])('%o → %s', (cond, expected) => {
    expect(evaluateCondition(s, cond as never)).toBe(expected);
  });

  it('confronto numerico con valore null → false (mai crash)', () => {
    expect(
      evaluateCondition(baseSignals({ energyAvg: null }), { field: 'energyAvg', op: 'lte', value: 3 }),
    ).toBe(false);
  });
});

describe('evaluateRules (tabella decisionale spec 7.2)', () => {
  it('stallo + umore basso + settimana intensa → menu pratici e sostegno, correzione rimandata', () => {
    const result = evaluateRules(
      baseSignals({ stallDays: 8, moodAvg: 2, busyLifestyle: true, direction: 'flat' }),
      SPEC_RULES,
    );
    expect(result.rule?.id).toBe('p2');
    expect(result.action.menu).toBe('practical');
    expect(result.action.tone).toBe('supportive');
  });

  it('stallo + sereno + tempo per cucinare → variante di correzione', () => {
    const result = evaluateRules(
      baseSignals({ stallDays: 7, moodAvg: 4, cookingTime: 'love_cooking', direction: 'flat' }),
      SPEC_RULES,
    );
    expect(result.rule?.id).toBe('p3');
    expect(result.action.levelDelta).toBe(1);
  });

  it('in calo + evento in agenda → alleggerisce prima', () => {
    const result = evaluateRules(baseSignals({ upcomingEvent: true }), SPEC_RULES);
    expect(result.rule?.id).toBe('p4');
    expect(result.action.menu).toBe('lighten_before_event');
  });

  it('calo troppo rapido + energia bassa → alza calorie e flag (priorità massima)', () => {
    const result = evaluateRules(
      baseSignals({ rapidLoss: true, energyAvg: 2, stallDays: 8, moodAvg: 2, busyLifestyle: true }),
      SPEC_RULES,
    );
    expect(result.rule?.id).toBe('p1'); // vince sulla regola dello stallo per priorità
    expect(result.action.flagForReview).toBe(true);
  });

  it('aderente + umore alto + obiettivo vicino → celebra', () => {
    const result = evaluateRules(
      baseSignals({ adherenceLast7: 1, moodAvg: 4.5, progressPercent: 80 }),
      SPEC_RULES,
    );
    expect(result.rule?.id).toBe('p5');
    expect(result.action.tone).toBe('celebratory');
  });

  it('nessuna regola applicabile → azione di default spiegata', () => {
    const result = evaluateRules(baseSignals(), SPEC_RULES);
    expect(result.rule).toBeNull();
    expect(result.action.menu).toBe('keep');
    expect(result.explanation).toContain('Nessuna regola');
  });

  it('la spiegazione cita la regola e le condizioni (decisione spiegabile)', () => {
    const result = evaluateRules(baseSignals({ upcomingEvent: true }), SPEC_RULES);
    expect(result.explanation).toContain('In calo con evento in agenda');
    expect(result.explanation).toContain('direction');
  });
});
