// Etichette in italiano per ruoli e sezioni del backoffice.

export type Role = 'client' | 'coach' | 'coach_coordinator' | 'nutritionist' | 'head_nutritionist' | 'sales' | 'marketing' | 'head_marketing' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente',
  coach: 'Coach',
  coach_coordinator: 'Coordinatrice Coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
  sales: 'Responsabile Coach',
  marketing: 'Marketing',
  head_marketing: 'Responsabile Marketing',
  admin: 'Admin',
};

/** Ruoli assegnabili allo staff dal backoffice (il cliente si registra da sé). */
// Stesso ordine della matrice permessi: la catena di pagamento, admin in fondo.
export const STAFF_ROLES: Role[] = ['coach', 'coach_coordinator', 'sales', 'nutritionist', 'head_nutritionist', 'marketing', 'head_marketing', 'admin'];
export const ALL_ROLES: Role[] = ['admin', 'head_nutritionist', 'nutritionist', 'coach_coordinator', 'coach', 'sales', 'head_marketing', 'marketing', 'client'];

export const PAGE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  notifications: 'Notifiche',
  posta: 'Posta',
  clients: 'Clienti',
  diets_catalog: 'Catalogo diete',
  diet_workspace: 'Gestione dieta',
  recipes: 'Catalogo ricette',
  engine_protocols: 'Protocolli motore',
  engine_reviews: 'Verifiche motore',
  escalations: 'Segnalazioni',
  visits_agenda: 'Agenda visite',
  chat: 'Chat',
  health_documents: 'Documenti sanitari',
  crm_leads: 'Gestione lead',
  lead_acceptance: 'Lead da accettare',
  accounting: 'Bonifici & contabilità',
  accounting_costs: 'Contabilità',
  marketing: 'Marketing',
  purchases: 'Acquisti',
  shop: 'Negozio',
  discounts: 'Buoni sconto',
  commissions: 'Provvigioni',
  compensation: 'Compensi staff',
  users: 'Utenti',
  assignments: 'Assegnazioni',
  assign_coach: 'Assegna coach (in lista)',
  assign_nutritionist: 'Assegna nutrizionista (in lista)',
  engine_config: 'Parametri motore',
  engine_rules: 'Regole motore',
  audit_logs: 'Log attività',
  permissions: 'Permessi',
  roles: 'Ruoli',
  creation_validation: 'Creazione e validazione',
  crm_lead_new: 'Inserimento lead',
  crm_import: 'Import liste',
  crm_pipeline: 'Pipeline',
  crm_calendar: 'Calendario CRM',
  testimonials: 'Testimonianze',
  publisher: 'Publisher social',
  agents: 'Agenti AI',
  coach_tasks: 'Attività coach',
  equivalence_groups: 'Gruppi di equivalenza',
  allergens: 'Allergeni ricette',
  email_templates: 'Modelli email',
  email_log: 'Log email',
  pdf_templates: 'Grafica PDF',
  charts: 'Grafici',
  withdrawals: 'Richieste prelievo',
};

export function pageLabel(key: string): string {
  return PAGE_LABEL[key] ?? key;
}
