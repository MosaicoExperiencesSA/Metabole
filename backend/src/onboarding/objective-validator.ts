/**
 * Validazione dell'obiettivo secondo il "ritmo sostenibile" (specifica sez. 7.4).
 * Pura e testabile: le soglie arrivano da config_param, mai hardcodate qui.
 */
export type ObjectivePace = 'sustainable' | 'ambitious' | 'unreal';

export interface ObjectiveValidationInput {
  weightToLoseKg: number;
  weeks: number;
  sustainableRateMaxKgWeek: number; // config: sustainable_rate_max_kg_week
  ambitiousRateMaxKgWeek: number; //  config: ambitious_rate_max_kg_week
  unrealAction: string; //            config: unreal_objective_action
}

export interface ObjectiveValidationResult {
  pace: ObjectivePace;
  ratePerWeek: number;
  accepted: boolean;
  requiresNutritionist: boolean;
  /** Settimane necessarie a ritmo sostenibile, proposto quando l'obiettivo è irreale. */
  suggestedWeeks?: number;
  message: string;
}

export function validateObjective(input: ObjectiveValidationInput): ObjectiveValidationResult {
  const rate = input.weightToLoseKg / input.weeks;
  const rounded = Math.round(rate * 100) / 100;

  if (rate <= input.sustainableRateMaxKgWeek) {
    return {
      pace: 'sustainable',
      ratePerWeek: rounded,
      accepted: true,
      requiresNutritionist: false,
      message: 'Obiettivo sostenibile: ottimo ritmo.',
    };
  }

  if (rate <= input.ambitiousRateMaxKgWeek) {
    return {
      pace: 'ambitious',
      ratePerWeek: rounded,
      accepted: true,
      requiresNutritionist: false,
      message: 'Obiettivo ambizioso ma raggiungibile: servirà costanza.',
    };
  }

  const suggestedWeeks = Math.ceil(input.weightToLoseKg / input.sustainableRateMaxKgWeek);
  const base = {
    pace: 'unreal' as const,
    ratePerWeek: rounded,
    suggestedWeeks,
  };

  switch (input.unrealAction) {
    case 'block_propose_date':
      return {
        ...base,
        accepted: false,
        requiresNutritionist: false,
        message: `Questo ritmo non è sostenibile. Con un ritmo sano servono circa ${suggestedWeeks} settimane: ti propongo quella data.`,
      };
    case 'require_nutritionist':
      return {
        ...base,
        accepted: true,
        requiresNutritionist: true,
        message: 'Ritmo oltre la soglia: l\'obiettivo va confermato dal nutrizionista.',
      };
    case 'warn':
    default:
      return {
        ...base,
        accepted: true,
        requiresNutritionist: false,
        message: `Attenzione: ritmo oltre la soglia sostenibile. A ritmo sano servono circa ${suggestedWeeks} settimane.`,
      };
  }
}

/** Screening sanitario: condizioni dichiarate o farmaci → percorso supervisionato. */
export function computeScreeningFlag(health: {
  hasConditions: string;
  takesMedications: string;
}): boolean {
  return (
    health.hasConditions === 'yes' ||
    health.hasConditions === 'tell_in_visit' ||
    health.takesMedications === 'yes'
  );
}
