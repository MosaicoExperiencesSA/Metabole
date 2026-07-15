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
  { code: 'menu_daycombo_kcal_target', label: 'Kcal target giornata', description: 'Kcal target della giornata usate dal generatore di catalogo/bozze e dalla composizione DayCombo (per-dieta).', category: 'macro', kind: 'number', default: 1500, min: 600, max: 4000, step: 10, unit: 'kcal', perDiet: true },
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

  // --- Sicurezza / segnalazioni (R12) ---
  { code: 'stall_days_before_coach_alert', label: 'Giorni di stallo', description: 'Da quanti giorni la media mobile del peso non migliora prima di considerare uno stallo.', category: 'sicurezza', kind: 'number', default: 6, min: 2, max: 30, step: 1, unit: 'giorni' },
  { code: 'no_progress_escalation', label: 'Segnala "Nessun progresso"', description: 'Se attivo, quando la cliente è in stallo (oltre i "Giorni di stallo") apre in automatico una segnalazione "Nessun progresso" al nutrizionista (coach informata). Di norma OFF.', category: 'sicurezza', kind: 'boolean', default: false },
  { code: 'low_adherence_days', label: 'Giorni per "Scarsa aderenza"', description: 'Giorni consecutivi senza check-in oltre i quali aprire una segnalazione "Scarsa aderenza" alla coach. 0 = spenta.', category: 'sicurezza', kind: 'number', default: 0, min: 0, max: 60, step: 1, unit: 'giorni' },
  { code: 'max_weight_change_alert_kg_week', label: 'Calo rapido (kg/settimana)', description: 'Ritmo di calo settimanale oltre il quale scatta l’allerta clinica al nutrizionista.', category: 'sicurezza', kind: 'number', default: 1.5, min: 0.5, max: 5, step: 0.1, unit: 'kg/sett' },
];

export const ENGINE_RULE_BY_CODE = new Map(ENGINE_RULES.map((r) => [r.code, r]));

/**
 * Le 12 REGOLE BASE del "Metodo del Motore Intelligente" (percorsi/METODO_MOTORE_INTELLIGENTE.md).
 * Sono i pilastri del motore, in 2 fasi: A = costruzione base (nutrizionista+strumenti),
 * B = motore intelligente (agente AI del percorso). Mostrate come riferimento sotto le
 * regole globali. Non sono singoli interruttori: molte sono comportamenti sempre attivi o
 * flussi; i parametri fini che le regolano stanno nelle regole globali qui sopra.
 */
export interface BaseRule {
  code: string; // R1..R12
  phase: 'A' | 'B';
  title: string;
  description: string;
}

export const BASE_RULES: BaseRule[] = [
  { code: 'R1', phase: 'A', title: 'Raccolta menu', description: 'Il nutrizionista raccoglie i menu del percorso: è la materia prima della base.' },
  { code: 'R2', phase: 'A', title: 'Catalogo diviso per pasto', description: 'Piatti divisi per pasto (colazione, pranzo, cena, spuntini), con la stagione dove il percorso lo richiede.' },
  { code: 'R3', phase: 'A', title: 'Calorie per piatto (interne)', description: 'Ogni piatto porta le sue kcal, calcolate internamente: servono al bilanciamento, non si mostrano alla cliente.' },
  { code: 'R4', phase: 'A', title: 'Gruppi di equivalenza', description: 'Alimenti intercambiabili a struttura e kcal invariate (es. pesci grassi): base per sostituzioni e nuovi piatti/menu.' },
  { code: 'R5', phase: 'A', title: 'Metodi di cottura', description: '3–5 cotture per piatto a kcal invariate: alimentano la ripetizione bigiornaliera con preparazioni diverse.' },
  { code: 'R6', phase: 'A', title: 'Bilanciamento della giornata', description: 'Giornata bilanciata (colazione+pranzo+cena a totale ~costante); porzioni standard, niente fame.' },
  { code: 'R7', phase: 'A', title: 'Approvazione del nutrizionista', description: 'La base diventa ufficiale e ISOLATA per il prodotto solo dopo l’approvazione del nutrizionista.' },
  { code: 'R8', phase: 'B', title: 'Base personale + Agente Esclusioni', description: 'Allergie = blocco duro; intolleranze e non graditi = sostituzione via gruppi di equivalenza; se non sostituibile → blocca ed escala.' },
  { code: 'R9', phase: 'B', title: 'Partenza differenziata + unicità certificata', description: 'Partenza personalizzata per cliente con seme, collision check e certificato: due clienti non hanno la stessa dieta.' },
  { code: 'R10', phase: 'B', title: 'Ciclo bigiornaliero + monitoraggio', description: 'Erogazione ogni 2 giorni (stessi alimenti, 2 cotture); a fine ciclo misura peso/cm separati, seguito sì/no, gradimento (max stelle).' },
  { code: 'R11', phase: 'B', title: 'Agente Adattamento', description: 'Scelta per efficacia×gradimento, apprendimento che isola il pasto, e stati (conforto, rientro, pre/post-evento, plateau).' },
  { code: 'R12', phase: 'B', title: 'Obiettivo, segnalazioni ed accessi', description: 'Obiettivo dimagrimento/mantenimento, matrice delle segnalazioni (coach/nutrizionista) e accessi (RBAC, kcal nascoste, cifratura).' },
];

export const RULE_CATEGORIES: { key: EngineRule['category']; label: string }[] = [
  { key: 'composizione', label: 'Composizione del ciclo' },
  { key: 'macro', label: 'Macro e bilanciamento' },
  { key: 'varieta', label: 'Varietà e ripetizione' },
  { key: 'selezione', label: 'Selezione ricette' },
  { key: 'agente', label: 'Agente AI' },
  { key: 'sicurezza', label: 'Sicurezza' },
];
