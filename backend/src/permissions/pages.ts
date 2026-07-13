import { Role } from '../common/roles';

/**
 * Sezioni del backoffice. La matrice ruolo × pagina vive nella tabella
 * role_page_permission (default dal seed, modificabile dall'admin a runtime).
 */
export const BACKOFFICE_PAGES = [
  'dashboard',
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
  'audit_logs',
  'permissions',
  'email_templates',
  'email_log',
  'pdf_templates',
  'charts',
  'withdrawals',
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
    dashboard: { view: true },
    charts: { view: true },
    clients: { view: true },
    crm_leads: { view: true, manage: true }, // pipeline: la coach sposta i clienti tra gli stati
    lead_acceptance: { view: true, manage: true }, // casella dei lead da accettare
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    visits_agenda: { view: true },
  },
  nutritionist: {
    dashboard: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
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
    charts: { view: true },
    clients: { view: true, manage: true },
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
    lead_acceptance: { view: true },
  },
  sales: {
    dashboard: { view: true },
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
    charts: { view: true },
    crm_leads: { view: true }, // vede i lead (fonte/canale/campagna), non gestisce la pipeline clinica
    marketing: { view: true, manage: true },
  },
  head_marketing: {
    dashboard: { view: true },
    charts: { view: true },
    crm_leads: { view: true, manage: true },
    marketing: { view: true, manage: true },
    accounting: { view: true }, // budget/spesa marketing (dashboard incassi/conversioni)
    email_templates: { view: true, manage: true },
    email_log: { view: true },
  },
  admin: {
    dashboard: { view: true, manage: true },
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
    audit_logs: { view: true },
    permissions: { view: true, manage: true },
    email_templates: { view: true, manage: true },
    email_log: { view: true, manage: true },
    pdf_templates: { view: true, manage: true },
    charts: { view: true, manage: true },
    withdrawals: { view: true, manage: true },
  },
};
