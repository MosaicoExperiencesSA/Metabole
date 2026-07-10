// Etichette in italiano per ruoli e sezioni del backoffice.

export type Role = 'client' | 'coach' | 'nutritionist' | 'head_nutritionist' | 'sales' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente',
  coach: 'Coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
  sales: 'Commerciale',
  admin: 'Admin',
};

/** Ruoli assegnabili allo staff dal backoffice (il cliente si registra da sé). */
export const STAFF_ROLES: Role[] = ['coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin'];
export const ALL_ROLES: Role[] = ['admin', 'head_nutritionist', 'nutritionist', 'coach', 'sales', 'client'];

export const PAGE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clienti',
  diets_catalog: 'Catalogo diete',
  recipes: 'Ricette',
  engine_protocols: 'Protocolli motore',
  engine_reviews: 'Verifiche motore',
  escalations: 'Segnalazioni',
  visits_agenda: 'Agenda visite',
  chat: 'Chat',
  health_documents: 'Documenti sanitari',
  crm_leads: 'CRM / Lead',
  lead_acceptance: 'Lead da accettare',
  accounting: 'Bonifici & contabilità',
  purchases: 'Acquisti',
  discounts: 'Buoni sconto',
  commissions: 'Provvigioni',
  compensation: 'Compensi staff',
  users: 'Utenti',
  assignments: 'Assegnazioni',
  engine_config: 'Parametri motore',
  audit_logs: 'Log attività',
  permissions: 'Permessi',
  email_templates: 'Modelli email',
  email_log: 'Log email',
};

export function pageLabel(key: string): string {
  return PAGE_LABEL[key] ?? key;
}
