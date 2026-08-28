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
  escalations: 'Segnalazioni',
  visits_agenda: 'Agenda visite',
  chat: 'Chat',
  client_conversations: 'Conversazioni della cliente',
  nutrient_facts: 'Valori nutrizionali',
  catalog_coverage: 'Copertura catalogo',
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
  // ⚠️ Non «Attività coach»: dal 22/8 la stessa pagina la apre anche la nutrizionista, coi suoi
  // quattro tipi. Il nome sta in tre posti (menu, titolo pagina, pagina Permessi) e vanno insieme.
  coach_tasks: 'Attività da fare',
  equivalence_groups: 'Gruppi di equivalenza',
  food_swaps: 'Sostituzioni',
  nutri_assistant: 'Assistente (Vera)',
  allergens: 'Allergeni ricette',
  colazioni: 'Colazioni dolci e salate',
  email_templates: 'Modelli email',
  email_log: 'Log email',
  pdf_templates: 'Grafica PDF',
  charts: 'Grafici',
  withdrawals: 'Richieste prelievo',
  fix_measures: 'Correggi misure cliente',
  // ⚠️ L'etichetta nomina i pasti e il digiuno dal 28/8: chi assegna i permessi deve sapere che
  // dietro questa casella c'è anche «mettere una cliente a digiuno intermittente».
  change_diet_type: 'Cambia tipo di dieta (regime, stile, pasti, digiuno)',
  change_allergies: 'Modifica allergie',
  change_plan_start: 'Cambia data inizio piano',
  change_fasting_window: 'Cambia i pasti del digiuno',
  set_client_password: 'Imposta password cliente',
  impersonate: 'Entra come cliente (sola lettura)',
  cancel_subscription: 'Annulla un abbonamento (× sulla pastiglia del piano)',
  // Il nome che ha la card in scheda cliente dal 24/8: «Sospensioni». Nella tabella dei permessi
  // deve leggersi lo stesso nome che si legge nella pagina, altrimenti si concede una cosa
  // credendo di concederne un'altra.
  travel_mode: 'Sospensioni (fermano i menu e allungano il piano)',
  dev_backlog: 'Lavori (elenco e storico)',
};

export function pageLabel(key: string): string {
  return PAGE_LABEL[key] ?? key;
}
