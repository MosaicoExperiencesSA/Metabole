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
  /**
   * Campo condizionato: compare solo se un'altra risposta ha un certo valore.
   * Prima l'unico caso ("altra allergia") era una riga scritta a mano dentro il render;
   * ora la condizione viaggia con lo schema e il frontend non va toccato per aggiungerne.
   */
  showIf?: { key: string; equals: string | number };
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
  /** Motivo/nome del periodo (es. "Natale", "Matrimonio"). */
  label?: string;
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
  objective?: { targetWeightKg?: number; targetDate?: string } | null;
  objectiveValidation?: { accepted: boolean; ratePerWeek?: number; suggestedWeeks?: number };
  /**
   * Spezie scritte fra i "cibi non graditi" e NON registrate. Vedi `backend/src/menu/spezie.ts`:
   * escludere una spezia cancella dal ricettario tutti i piatti che la contengono, quindi non si
   * salva e si spiega perché. Presente solo quando c'è qualcosa da dire.
   */
  avvisiSpezie?: { tipo: 'specifica' | 'generica'; termine: string; titolo: string; testo: string }[];
  /**
   * Allergie o intolleranze che il reinvio del questionario avrebbe TOLTO, e che sono rimaste.
   * Dal questionario si aggiungono, non si tolgono: toglierle è una correzione su un dato
   * sanitario e la fa la nutrizionista. Va detto, o lei crede di averle tolte e i menu continuano
   * a escluderle.
   */
  avvisiEsclusioni?: string[];
  /**
   * Quello che ha scritto fra i cibi non graditi è una **frase** e non un alimento («pesce tranne
   * salmone»): il motore legge alimenti, quindi così com'è non toglie niente dal menu. ⚠️ Campo suo
   * e non dentro `avvisiEsclusioni`, che l'app mostra sotto il titolo «Allergie e intolleranze».
   * Le parole le costruisce il server (`common/esclusioni-scritte-bene.ts`), che è l'unico posto
   * dove quella regola vive.
   */
  aiutoEsclusioni?: string;
}
