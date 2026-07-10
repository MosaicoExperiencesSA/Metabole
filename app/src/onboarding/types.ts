/** Schema del questionario servito da GET /onboarding/questions. */
export type FieldType =
  | 'text'
  | 'number'
  | 'choice'
  | 'multi_choice'
  | 'tags'
  | 'date_ranges'
  | 'color';

export interface Field {
  key: string;
  type: FieldType;
  label?: string;
  min?: number;
  max?: number;
  required?: boolean;
  options?: (string | number)[];
  labels?: string[];
}

export interface Page {
  key: string;
  title: string;
  subtitle?: string;
  fields: Field[];
}

export interface Questions {
  version: number;
  pages: Page[];
}

export interface DateRange {
  start: string;
  end: string;
}

/** Risultato di GET /onboarding/result dopo il completamento. */
export interface OnboardingResult {
  path: { name: string; tags: string[] };
  supervisedPath?: boolean;
  screeningFlag?: boolean;
  team: {
    coach: { id: string; displayName: string } | null;
    nutritionist: { id: string; displayName: string } | null;
  };
  firstVisit: { type: string; note: string };
  objective?: { targetWeightKg?: number; targetDate?: string } | null;
  objectiveValidation?: { accepted: boolean; ratePerWeek?: number; suggestedWeeks?: number };
}
