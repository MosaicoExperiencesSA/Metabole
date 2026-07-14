// R12 — Categorie standard delle segnalazioni e loro instradamento al ruolo giusto.
// Il ruolo "primary" riceve la segnalazione in carico; "also" indica ruoli da coinvolgere
// (per ora informativo: usato da chi vuole notificare anche l'altro ruolo).

export const ESCALATION_CATEGORIES = [
  'diet_blocked', // il motore non riesce a comporre un piano sicuro → nutrizionista (+ coach)
  'no_progress', // nessun calo da più cicli → nutrizionista (+ coach)
  'low_adherence', // scarsa aderenza (check-in/misure mancanti) → coach
  'mood_risk', // umore basso/rischio abbandono → coach
  'clinical', // dato clinico/farmaci → solo nutrizionista
  'other',
] as const;
export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

export type StaffRole = 'coach' | 'nutritionist';

export const ESCALATION_ROUTING: Record<EscalationCategory, { primary: StaffRole; also: StaffRole[] }> = {
  diet_blocked: { primary: 'nutritionist', also: ['coach'] },
  no_progress: { primary: 'nutritionist', also: ['coach'] },
  low_adherence: { primary: 'coach', also: [] },
  mood_risk: { primary: 'coach', also: [] },
  clinical: { primary: 'nutritionist', also: [] },
  other: { primary: 'nutritionist', also: [] },
};

export const ESCALATION_CATEGORY_LABEL: Record<EscalationCategory, string> = {
  diet_blocked: 'Piano bloccato',
  no_progress: 'Nessun progresso',
  low_adherence: 'Scarsa aderenza',
  mood_risk: 'Rischio umore/abbandono',
  clinical: 'Clinico',
  other: 'Altro',
};

export const isEscalationCategory = (v: string): v is EscalationCategory =>
  (ESCALATION_CATEGORIES as readonly string[]).includes(v);
