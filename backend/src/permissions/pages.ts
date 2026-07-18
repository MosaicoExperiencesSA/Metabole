import { Role } from '../common/roles';

/**
 * Sezioni del backoffice. La matrice ruolo × pagina vive nella tabella
 * role_page_permission (default dal seed, modificabile dall'admin a runtime).
 */
export const BACKOFFICE_PAGES = [
  'dashboard',
  'notifications',
  'posta',
  'clients',
  'diets_catalog',
  'recipes',
  'engine_protocols',
  'engine_reviews',
  'escalations',
  'visits_agenda',
  'chat',
  'health_documents',
  'crm_leads',
  'lead_acceptance',
  'marketing',
  'accounting',
  'accounting_costs',
  'purchases',
  'shop',
  'discounts',
  'commissions',
  'compensation',
  'users',
  'assignments',
  'assign_coach',
  'assign_nutritionist',
  'engine_config',
  'engine_rules',
  'audit_logs',
  'permissions',
  'email_templates',
  'email_log',
  'pdf_templates',
  'charts',
  'withdrawals',
  // Schermate separate per una gestione granulare dei permessi (ereditano l'accesso dalla pagina "genitore").
  'crm_lead_new',       // Inserimento lead (da crm_leads)
  'crm_import',         // Import liste (da crm_leads)
  'crm_pipeline',       // Pipeline (da crm_leads)
  'crm_calendar',       // Calendario CRM (da crm_leads)
  'testimonials',       // Testimonianze (da marketing)
  'publisher',          // Publisher social (da marketing)
  'agents',             // Registro Agenti AI (da marketing)
  'coach_tasks',        // Attività coach (task generati dal cron: prova, fine piano)
  'equivalence_groups', // Gruppi di equivalenza (da diets_catalog)
  'allergens',          // Allergeni ricette (da recipes)
  'roles',              // Ruoli (da permissions)
  'creation_validation', // Pagina guidata Creazione e validazione
  'diet_workspace',      // Gestione dieta: hub ricette/allergeni/gruppi per dieta (da diets_catalog)
  'fix_measures',        // Correzione misure del cliente dalla scheda (flag dedicato, richiesta Simone)
  'change_diet_type',    // Cambio del TIPO DI DIETA (regime + stile) dalla scheda cliente (flag dedicato)
] as const;

export type PageKey = (typeof BACKOFFICE_PAGES)[number];

type Perm = { view?: true; manage?: true };

/**
 * Default della specifica (sez. 4):
 * - la coach NON vede note cliniche né documenti sanitari;
 * - il nutrizionista gestisce cartelle, protocolli, verifiche, televisite;
 * - il capo approva le diete nel catalogo e supervisiona il team;
 * - il commerciale vede CRM e incassi, mai dati sanitari clinici;
 * - l'admin gestisce utenti/parametri/contabilità ma NON i dati clinici.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<PageKey, Perm>>> = {
  client: {},
  coach: {
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true },
    crm_leads: { view: true, manage: true }, // pipeline: la coach sposta i clienti tra gli stati
    lead_acceptance: { view: true, manage: true }, // casella dei lead da accettare
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    visits_agenda: { view: true },
  },
  // Coordinatrice Coach: come una coach (le SUE clienti) + visibilità sul suo team
  // (la portata "propria + team" è applicata nei servizi, non qui).
  coach_coordinator: {
    coach_tasks: { view: true, manage: true },
    assign_coach: { view: true, manage: true }, // assegna i lead del SUO perimetro alle SUE coach

    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true },
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true, manage: true },
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    visits_agenda: { view: true },
  },
  nutritionist: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
    fix_measures: { view: true, manage: true }, // corregge le misure inserite male dal cliente
    change_diet_type: { view: true, manage: true }, // cambia il tipo di dieta (regime/stile)
    diets_catalog: { view: true, manage: true }, // propone (l'approvazione resta al capo)
    recipes: { view: true, manage: true },
    engine_protocols: { view: true, manage: true },
    engine_reviews: { view: true, manage: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true, manage: true },
    chat: { view: true, manage: true },
    health_documents: { view: true, manage: true },
  },
  head_nutritionist: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
    fix_measures: { view: true, manage: true },
    change_diet_type: { view: true, manage: true },
    diets_catalog: { view: true, manage: true }, // approvazione nel catalogo
    recipes: { view: true, manage: true },
    engine_protocols: { view: true, manage: true },
    engine_reviews: { view: true, manage: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true, manage: true },
    chat: { view: true, manage: true },
    health_documents: { view: true, manage: true },
    assignments: { view: true },
    assign_nutritionist: { view: true, manage: true }, // il capo nutrizionisti assegna il nutrizionista
    engine_config: { view: true },
    engine_rules: { view: true, manage: true }, // regole del motore: le gestisce SOLO il capo nutrizionista
    lead_acceptance: { view: true },
  },
  sales: {
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true },
    accounting: { view: true }, // dashboard incassi/conversioni
    purchases: { view: true },
    assign_coach: { view: true, manage: true }, // Resp. Coach Team: assegna le coach
  },
  // Reparto Marketing (nessun accesso a dati sanitari): campagne, segmenti, KPI, consensi.
  marketing: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true }, // vede i lead (fonte/canale/campagna), non gestisce la pipeline clinica
    marketing: { view: true, manage: true },
    agents: { view: true },
  },
  head_marketing: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true, manage: true },
    marketing: { view: true, manage: true },
    agents: { view: true, manage: true },
    accounting: { view: true }, // budget/spesa marketing (dashboard incassi/conversioni)
    email_templates: { view: true, manage: true },
    email_log: { view: true },
  },
  admin: {
    dashboard: { view: true, manage: true },
    notifications: { view: true },
    posta: { view: true },
    clients: { view: true },
    diets_catalog: { view: true, manage: true },
    recipes: { view: true, manage: true },
    engine_protocols: { view: true },
    engine_reviews: { view: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true },
    chat: { view: true },
    // health_documents: nessun accesso di default (note cliniche riservate)
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true },
    accounting: { view: true, manage: true },
    accounting_costs: { view: true, manage: true },
    purchases: { view: true, manage: true },
    shop: { view: true, manage: true },
    discounts: { view: true, manage: true },
    commissions: { view: true, manage: true },
    compensation: { view: true, manage: true },
    users: { view: true, manage: true },
    assignments: { view: true, manage: true },
    assign_coach: { view: true, manage: true },
    assign_nutritionist: { view: true, manage: true },
    engine_config: { view: true, manage: true },
    engine_rules: { view: true, manage: true }, // l'admin gestisce le regole del motore (oltre al capo nutrizionista)
    audit_logs: { view: true },
    permissions: { view: true, manage: true },
    email_templates: { view: true, manage: true },
    email_log: { view: true, manage: true },
    pdf_templates: { view: true, manage: true },
    charts: { view: true, manage: true },
    withdrawals: { view: true, manage: true },
    fix_measures: { view: true, manage: true },
    change_diet_type: { view: true, manage: true },
  },
};

/**
 * Le schermate "figlie" ereditano di default l'accesso della loro pagina "genitore",
 * così separare una schermata nei Permessi non toglie accesso a nessuno. L'admin può
 * poi differenziarle a runtime dalla UI Permessi.
 */
/**
 * Pagine "hub": chi ha il permesso su di esse può usare anche le API dei domini
 * collegati, così un ruolo può gestire tutto da poche voci di menu senza vedere
 * le pagine dei singoli cataloghi. Es.: dando SOLO "Gestione dieta" +
 * "Creazione e validazione" al nutrizionista, gli editor diete/ricette/allergeni
 * dentro quegli hub funzionano lo stesso. (I gruppi di equivalenza non hanno
 * @RequirePage, bastano già col ruolo.)
 */
export const PAGE_GRANTS: Record<string, PageKey[]> = {
  diet_workspace: ['diets_catalog', 'recipes'],
  creation_validation: ['diets_catalog', 'recipes'],
};

export const INHERIT_DEFAULTS: Record<string, PageKey> = {
  crm_lead_new: 'crm_leads',
  crm_import: 'crm_leads',
  crm_pipeline: 'crm_leads',
  crm_calendar: 'crm_leads',
  testimonials: 'marketing',
  publisher: 'marketing',
  equivalence_groups: 'diets_catalog',
  allergens: 'recipes',
  roles: 'permissions',
  creation_validation: 'diets_catalog',
  diet_workspace: 'diets_catalog',
};

for (const role of Object.keys(DEFAULT_PERMISSIONS) as Role[]) {
  const perms = DEFAULT_PERMISSIONS[role];
  for (const [child, parent] of Object.entries(INHERIT_DEFAULTS) as [PageKey, PageKey][]) {
    const p = perms[parent];
    if (p && !perms[child]) perms[child] = { ...p };
  }
}
