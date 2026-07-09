/**
 * Valutatore di regole DETERMINISTICO (spec 7.2: prima le regole trasparenti
 * e testabili; l'AI generativa arriverà dopo, solo come layer di supporto).
 *
 * Una regola: { priority, conditions: [{field, op, value}] (AND), action }.
 * Vince la prima regola (per priorità crescente) con tutte le condizioni vere.
 * Nessuna dipendenza: puro e testabile.
 */

/** Sintesi dei 5 segnali della cliente al momento della valutazione. */
export interface EngineSignals {
  // Corpo (su media mobile)
  stallDays: number;
  weeklyRateKg: number | null; // positivo = calo
  direction: 'down' | 'flat' | 'up' | 'unknown';
  rapidLoss: boolean;
  progressPercent: number | null;
  measurementsCount: number;
  // Testa (ultimi 7 giorni)
  moodAvg: number | null; // 1 (stressed) .. 5 (great)
  energyAvg: number | null; // 1..5
  stressAvg: number | null; // 1..5
  lowEnergyChronic: boolean;
  checkinsLast7: number;
  // Vita (dal profilo)
  cookingTime: string | null; // very_little | some | love_cooking
  busyLifestyle: boolean; // lavoro a turni/viaggi o pranzo fuori/al volo
  // Agenda (eventi/pause — arriverà col calendario; per ora sempre neutro)
  upcomingEvent: boolean;
  pausePeriodActive: boolean;
  // Gusto
  avgRating: number | null;
  adherenceLast7: number; // check-in fatti / 7
}

export interface RuleCondition {
  field: keyof EngineSignals;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is_true' | 'is_false' | 'is_null' | 'not_null';
  value?: unknown;
}

export interface RuleAction {
  menu: 'keep' | 'practical' | 'correction' | 'lighten_before_event' | 'increase_calories' | 'celebrate_step';
  tone: 'supportive' | 'neutral' | 'encouraging' | 'celebratory' | 'gentle';
  timing: 'morning' | 'lunch' | 'evening';
  levelDelta?: number; // -1 alleggerisce/alza kcal, +1 stringe (dentro i livelli dieta)
  flagForReview?: boolean;
  note?: string;
}

export interface EngineRule {
  id: string;
  name: string;
  priority: number; // più basso = valutato prima
  conditions: RuleCondition[];
  action: RuleAction;
}

export const DEFAULT_ACTION: RuleAction = {
  menu: 'keep',
  tone: 'neutral',
  timing: 'morning',
};

export function evaluateCondition(signals: EngineSignals, cond: RuleCondition): boolean {
  const actual = signals[cond.field] as unknown;
  switch (cond.op) {
    case 'is_true':
      return actual === true;
    case 'is_false':
      return actual === false;
    case 'is_null':
      return actual === null || actual === undefined;
    case 'not_null':
      return actual !== null && actual !== undefined;
    case 'eq':
      return actual === cond.value;
    case 'ne':
      return actual !== cond.value;
    case 'in':
      return Array.isArray(cond.value) && (cond.value as unknown[]).includes(actual);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (typeof actual !== 'number' || typeof cond.value !== 'number') return false;
      if (cond.op === 'gt') return actual > cond.value;
      if (cond.op === 'gte') return actual >= cond.value;
      if (cond.op === 'lt') return actual < cond.value;
      return actual <= cond.value;
    }
    default:
      return false;
  }
}

export interface EvaluationResult {
  rule: EngineRule | null; // null = nessuna regola: azione di default
  action: RuleAction;
  explanation: string;
}

/** Prima regola vincente per priorità; a parità vince la prima in elenco. */
export function evaluateRules(signals: EngineSignals, rules: EngineRule[]): EvaluationResult {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (rule.conditions.length > 0 && rule.conditions.every((c) => evaluateCondition(signals, c))) {
      return {
        rule,
        action: rule.action,
        explanation: `Regola "${rule.name}": ${rule.conditions
          .map((c) => `${c.field} ${c.op} ${JSON.stringify(c.value ?? '')}`.trim())
          .join(' E ')}`,
      };
    }
  }
  return {
    rule: null,
    action: DEFAULT_ACTION,
    explanation: 'Nessuna regola applicabile: si mantiene il piano corrente.',
  };
}
