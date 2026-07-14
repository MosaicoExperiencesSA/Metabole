/**
 * CATALOGO delle regole del motore (fonte di verità in codice). Ogni voce descrive
 * un parametro/regola realmente usato dal motore: il capo nutrizionista le vede in una
 * pagina unica, ne cambia il valore GLOBALE (config_param) e/o lo sovrascrive per una
 * singola dieta (ProductRule). Le regole nuove (comportamenti nuovi) NON si aggiungono
 * qui da UI: si "propongono" (RuleProposal) e le implementiamo noi.
 */
export type RuleKind = 'boolean' | 'number';

export interface EngineRule {
  code: string;
  label: string;
  description: string;
  category: 'composizione' | 'macro' | 'varieta' | 'selezione' | 'agente' | 'sicurezza';
  kind: RuleKind;
  default: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // '%', 'giorni', 'frazione', 'peso'
  perDiet?: boolean; // sovrascrivibile per dieta via ProductRule
}

export const ENGINE_RULES: EngineRule[] = [
  // --- Composizione del ciclo ---
  { code: 'menu_days_delivered', label: 'Giorni erogati per ciclo', description: 'Quanti giorni di menù vengono consegnati insieme (di norma 2, "bigiornaliero").', category: 'composizione', kind: 'number', default: 2, min: 1, max: 7, step: 1, unit: 'giorni' },
  { code: 'menu_visible_days_before_start', label: 'Anticipo di visibilità', description: 'Quanti giorni prima dell’inizio piano il menù diventa visibile alla cliente.', category: 'composizione', kind: 'number', default: 2, min: 0, max: 7, step: 1, unit: 'giorni' },
  { code: 'menu_daycombo_enabled', label: 'Composizione giornata bilanciata (DayCombo)', description: 'Compone la giornata dal pool della dieta puntando alle kcal del livello, invece del solo template.', category: 'composizione', kind: 'boolean', default: false, perDiet: true },

  // --- Macro / bilanciamento ---
  { code: 'menu_kcal_balance_tolerance_pct', label: 'Tolleranza kcal (%)', description: 'Scarto percentuale ammesso attorno alle kcal target del livello.', category: 'macro', kind: 'number', default: 15, min: 5, max: 30, step: 1, unit: '%', perDiet: true },
  { code: 'menu_daycombo_protein_min', label: 'Quota proteica minima', description: 'Frazione minima di proteine sui macro della giornata (0–1). Es. 0,20 = 20%.', category: 'macro', kind: 'number', default: 0.2, min: 0, max: 1, step: 0.01, unit: 'frazione', perDiet: true },
  { code: 'menu_daycombo_protein_max', label: 'Quota proteica massima', description: 'Frazione massima di proteine sui macro della giornata (0–1). Es. 0,40 = 40%.', category: 'macro', kind: 'number', default: 0.45, min: 0, max: 1, step: 0.01, unit: 'frazione', perDiet: true },

  // --- Varietà / ripetizione ---
  { code: 'menu_penalty_repeat', label: 'Penalità di ripetizione (varietà)', description: 'Quanto penalizzare una ricetta servita di recente per favorire la varietà (0 = spenta).', category: 'varieta', kind: 'number', default: 0, min: 0, max: 5, step: 0.5, perDiet: true },
  { code: 'menu_repeat_window_days', label: 'Finestra varietà (giorni)', description: 'Su quanti giorni contare le ripetizioni recenti per la penalità di varietà.', category: 'varieta', kind: 'number', default: 14, min: 1, max: 60, step: 1, unit: 'giorni' },
  { code: 'menu_repeat_two_days_default', label: 'Ripetizione bigiornaliera (default globale)', description: 'Il 2° giorno ripropone gli stessi alimenti con ricetta diversa. Di norma OFF: si accende per dieta.', category: 'varieta', kind: 'boolean', default: false, perDiet: true },
  { code: 'repeat_twin_kcal_tolerance_pct', label: 'Tolleranza kcal "gemella" (%)', description: 'Scarto kcal ammesso per accettare la ricetta gemella nella ripetizione bigiornaliera.', category: 'varieta', kind: 'number', default: 15, min: 5, max: 30, step: 1, unit: '%' },

  // --- Selezione ricette (efficacia vs gradimento) ---
  { code: 'menu_select_w_eff', label: 'Peso efficacia', description: 'Quanto pesa l’efficacia appresa (calo peso) nella scelta della ricetta.', category: 'selezione', kind: 'number', default: 1, min: 0, max: 5, step: 0.1, perDiet: true },
  { code: 'menu_select_w_grad', label: 'Peso gradimento', description: 'Quanto pesa il gradimento (stelle) nella scelta della ricetta.', category: 'selezione', kind: 'number', default: 1, min: 0, max: 5, step: 0.1, perDiet: true },
  { code: 'menu_maintenance_w_eff', label: 'Peso efficacia in mantenimento', description: 'Peso dell’efficacia quando l’obiettivo è mantenimento: ridotto ma non nullo (es. 0,1).', category: 'selezione', kind: 'number', default: 0.1, min: 0, max: 2, step: 0.05 },

  // --- Agente AI (stati e modulazioni) ---
  { code: 'menu_state_boost', label: 'Boost dello stato agente', description: 'Moltiplicatore quando l’agente è in uno stato attivo (conforto/plateau/…).', category: 'agente', kind: 'number', default: 1.8, min: 1, max: 4, step: 0.1 },
  { code: 'menu_pre_event_protein_bonus', label: 'Bonus proteico pre-evento', description: 'Spinta sulle ricette proteiche nei giorni pre-evento.', category: 'agente', kind: 'number', default: 0.6, min: 0, max: 2, step: 0.1 },
  { code: 'agent_comfort_max_days', label: 'Durata stato "conforto" (giorni)', description: 'Per quanti giorni l’agente resta in modalità conforto (più gradimento).', category: 'agente', kind: 'number', default: 3, min: 1, max: 14, step: 1, unit: 'giorni' },
  { code: 'agent_plateau_cycles', label: 'Cicli per rilevare plateau', description: 'Dopo quanti cicli senza calo l’agente considera un plateau.', category: 'agente', kind: 'number', default: 3, min: 1, max: 10, step: 1 },
  { code: 'agent_pre_event_days', label: 'Anticipo pre-evento (giorni)', description: 'Quanti giorni prima di un evento attivare la modalità pre-evento.', category: 'agente', kind: 'number', default: 3, min: 1, max: 14, step: 1, unit: 'giorni' },
  { code: 'agent_post_event_days', label: 'Durata post-evento (giorni)', description: 'Per quanti giorni dopo un evento restare in modalità recupero.', category: 'agente', kind: 'number', default: 2, min: 1, max: 14, step: 1, unit: 'giorni' },
  { code: 'agent_reentry_days', label: 'Durata rientro (giorni)', description: 'Per quanti giorni gestire il rientro dopo una pausa.', category: 'agente', kind: 'number', default: 3, min: 1, max: 14, step: 1, unit: 'giorni' },
];

export const ENGINE_RULE_BY_CODE = new Map(ENGINE_RULES.map((r) => [r.code, r]));

export const RULE_CATEGORIES: { key: EngineRule['category']; label: string }[] = [
  { key: 'composizione', label: 'Composizione del ciclo' },
  { key: 'macro', label: 'Macro e bilanciamento' },
  { key: 'varieta', label: 'Varietà e ripetizione' },
  { key: 'selezione', label: 'Selezione ricette' },
  { key: 'agente', label: 'Agente AI' },
  { key: 'sicurezza', label: 'Sicurezza' },
];
