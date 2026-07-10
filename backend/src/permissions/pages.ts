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
  'accounting',
  'compensation',
  'users',
  'assignments',
  'engine_config',
  'audit_logs',
  'permissions',
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
    clients: { view: true },
    crm_leads: { view: true, manage: true }, // pipeline: la coach sposta i clienti tra gli stati
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    visits_agenda: { view: true },
  },
  nutritionist: {
    dashboard: { view: true },
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
    engine_config: { view: true },
  },
  sales: {
    dashboard: { view: true },
    crm_leads: { view: true, manage: true },
    accounting: { view: true }, // dashboard incassi/conversioni
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
    accounting: { view: true, manage: true },
    compensation: { view: true, manage: true },
    users: { view: true, manage: true },
    assignments: { view: true, manage: true },
    engine_config: { view: true, manage: true },
    audit_logs: { view: true },
    permissions: { view: true, manage: true },
  },
};
