/** Moduli "anteprima" della dashboard: riquadri mezza schermata per le pagine abilitate. */
export interface DashboardModule {
  id: string;
  pageKey: string;
  to: string;
  icon: string;
  label: string;
  preview: string;
  /** Chiave dei dati di anteprima (default = pageKey). Serve quando più moduli
   *  condividono lo stesso permesso ma mostrano dati diversi (es. CRM vs Lead da accettare). */
  previewKey?: string;
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  { id: 'm_clienti', pageKey: 'clients', to: '/clienti', icon: 'ti-users', label: 'Clienti', preview: 'Percorsi in corso, schede e progressi dei clienti.' },
  { id: 'm_grafici', pageKey: 'charts', to: '/grafici', icon: 'ti-chart-histogram', label: 'Grafici', preview: 'Kg persi nel mese, perdita media, fatturato e classifiche.' },
  { id: 'm_pagamenti', pageKey: 'accounting', to: '/pagamenti', icon: 'ti-cash', label: 'Bonifici & contabilità', preview: 'Contabili da verificare e incassi.' },
  { id: 'm_crm', pageKey: 'crm_leads', to: '/crm/gestione', icon: 'ti-list-details', label: 'CRM / Lead', preview: 'Lead, pipeline e conversioni.' },
  { id: 'm_lead_accept', pageKey: 'lead_acceptance', previewKey: 'lead_accept', to: '/crm/da-accettare', icon: 'ti-user-check', label: 'Lead da accettare', preview: 'Lead assegnati in attesa di accettazione.' },
  { id: 'm_calendario', pageKey: 'crm_leads', to: '/crm/calendario', icon: 'ti-calendar-event', label: 'Calendario', preview: 'Promemoria e appuntamenti: lista, settimana o mese.' },
  { id: 'm_agenda', pageKey: 'visits_agenda', to: '/agenda', icon: 'ti-calendar', label: 'Agenda visite', preview: 'Televisite e appuntamenti in programma.' },
  { id: 'm_segnalazioni', pageKey: 'escalations', to: '/segnalazioni', icon: 'ti-alert-triangle', label: 'Segnalazioni', preview: 'Situazioni del motore da gestire.' },
  { id: 'm_diete', pageKey: 'diets_catalog', to: '/diete', icon: 'ti-salad', label: 'Catalogo diete', preview: 'Diete e ricette approvate.' },
  { id: 'm_acquisti', pageKey: 'purchases', to: '/acquisti', icon: 'ti-shopping-cart', label: 'Acquisti', preview: 'Storico acquisti e ricevute.' },
  { id: 'm_compensi', pageKey: 'compensation', to: '/compensi', icon: 'ti-coin', label: 'Compensi staff', preview: 'Provvigioni e compensi del team.' },
  { id: 'm_chat', pageKey: 'chat', to: '/chat', icon: 'ti-messages', label: 'Chat', preview: 'Ultimi messaggi dei clienti.' },
  { id: 'm_posta', pageKey: 'posta', to: '/posta', icon: 'ti-mail', label: 'Posta', preview: 'La tua casella @metabole.eu: posta in arrivo e invio.' },
  { id: 'm_negozio', pageKey: 'shop', to: '/negozio', icon: 'ti-building-store', label: 'Negozio', preview: 'Piani e prodotti in vendita.' },
  { id: 'm_buoni', pageKey: 'discounts', to: '/buoni-sconto', icon: 'ti-ticket', label: 'Buoni sconto', preview: 'Codici attivi e utilizzi.' },
  { id: 'm_contabilita', pageKey: 'accounting_costs', to: '/contabilita', icon: 'ti-report-money', label: 'Contabilità', preview: 'Ultimi movimenti di entrata e uscita.' },
  { id: 'm_provvigioni', pageKey: 'commissions', to: '/provvigioni', icon: 'ti-percentage', label: 'Provvigioni', preview: 'Provvigioni in sospeso da attribuire.' },
  { id: 'm_prelievi', pageKey: 'withdrawals', to: '/prelievi', icon: 'ti-wallet', label: 'Richieste prelievo', preview: 'Richieste di prelievo da evadere.' },
  { id: 'm_testimonianze', pageKey: 'marketing', previewKey: 'testimonials', to: '/testimonianze', icon: 'ti-quote', label: 'Testimonianze', preview: 'Ultime testimonianze dei clienti.' },
  // Contenuti / motore
  { id: 'm_ricette', pageKey: 'recipes', to: '/ricette', icon: 'ti-tools-kitchen-2', label: 'Catalogo ricette', preview: 'Ricette e tag allergeni.' },
  { id: 'm_protocolli', pageKey: 'engine_protocols', to: '/protocolli', icon: 'ti-cpu', label: 'Protocolli motore', preview: 'Protocolli a regole del motore.' },
  { id: 'm_regole_motore', pageKey: 'engine_rules', to: '/regole-motore', icon: 'ti-adjustments-cog', label: 'Regole motore', preview: 'Regole globali, regole suggerite per nutrizione e proposte.' },
  { id: 'm_parametri', pageKey: 'engine_config', to: '/parametri', icon: 'ti-adjustments', label: 'Parametri motore', preview: 'Soglie e parametri del motore.' },
  // Comunicazioni
  { id: 'm_email_modelli', pageKey: 'email_templates', to: '/email-modelli', icon: 'ti-mail-cog', label: 'Modelli email', preview: 'Template delle email automatiche.' },
  { id: 'm_email_log', pageKey: 'email_log', to: '/email-log', icon: 'ti-mail-check', label: 'Log email', preview: 'Email inviate e stato di consegna.' },
  { id: 'm_pdf', pageKey: 'pdf_templates', to: '/grafica-pdf', icon: 'ti-file-type-pdf', label: 'Grafica PDF', preview: 'Template grafici dei PDF.' },
  // Amministrazione
  { id: 'm_utenti', pageKey: 'users', to: '/utenti', icon: 'ti-id-badge-2', label: 'Utenti', preview: 'Staff, ruoli e accessi.' },
  { id: 'm_ruoli', pageKey: 'permissions', to: '/ruoli', icon: 'ti-shield-half', label: 'Ruoli e permessi', preview: 'Ruoli personalizzati e visibilità per ruolo.' },
  { id: 'm_log', pageKey: 'audit_logs', to: '/log', icon: 'ti-history', label: 'Log attività', preview: 'Storico delle azioni dello staff.' },
];

/** Moduli mostrati di default se l'utente non ha ancora personalizzato. */
export const DEFAULT_MODULE_IDS = ['m_clienti', 'm_grafici', 'm_pagamenti', 'm_agenda'];

/** Catalogo dei grafici disponibili nel modulo "Grafici" (max 3 selezionabili). */
export interface ChartMetric {
  key: string;
  label: string;
  unit: 'kg' | 'cm' | 'int' | 'euro';
  color: string;
}
export const CHART_METRICS: ChartMetric[] = [
  { key: 'kgLost', label: 'Kg persi / mese', unit: 'kg', color: 'var(--teal)' },
  { key: 'cmWaistLost', label: 'Cm vita persi / mese', unit: 'cm', color: '#3A6EA5' },
  { key: 'avgLossKg', label: 'Perdita media / cliente', unit: 'kg', color: 'var(--teal)' },
  { key: 'newClients', label: 'Nuovi clienti / mese', unit: 'int', color: 'var(--violet)' },
  { key: 'activeSubscriptions', label: 'Abbonamenti attivi', unit: 'int', color: 'var(--teal)' },
  { key: 'revenueCents', label: 'Fatturato / mese', unit: 'euro', color: 'var(--gold)' },
  { key: 'cumulativeRevenueCents', label: 'Fatturato cumulato', unit: 'euro', color: 'var(--gold)' },
];
export const DEFAULT_CHART_KEYS = ['kgLost', 'revenueCents', 'newClients'];
