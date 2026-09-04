/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — le etichette. Manuale: kit/manuale/03-permessi.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠️ **Una chiave senza etichetta compare GREZZA nella matrice dei permessi** — e chi deve
 * concedere si trova davanti `accounting_costs` invece di «Contabilità», e non sa cosa sta
 * concedendo. È il passo 2 dei tre del capitolo 03, ed è quello che si dimentica.
 *
 * ⚠️ E il contrario: un'etichetta senza chiave è un interruttore fantasma. Il test
 * `matrice-dice-la-verita.spec.ts` tiene ferme tutte e due le direzioni.
 */
export const PAGE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  notifications: 'Notifiche',

  shop: 'Negozio',
  purchases: 'Acquisti',
  accounting: 'Bonifici',
  accounting_costs: 'Contabilità',
  discounts: 'Buoni sconto',
  commissions: 'Provvigioni',
  compensation: 'Compensi staff',
  withdrawals: 'Richieste prelievo',

  users: 'Utenti',
  roles: 'Ruoli',
  permissions: 'Permessi',
  engine_config: 'Parametri',
  audit_logs: 'Log attività',
  dev_backlog: 'Lavori',
  email_templates: 'Modelli email',
  email_log: 'Log email',

  set_user_password: 'Imposta password di un utente',
  impersonate: 'Entra come un altro utente',
  change_user_email: 'Cambia email di un utente',
};

/** Le etichette dei ruoli di sistema. I ruoli personalizzati portano la propria. */
export const ROLE_LABEL: Record<string, string> = {
  user: 'Utente',
  staff: 'Staff',
  manager: 'Responsabile',
  admin: 'Amministratore',
};
