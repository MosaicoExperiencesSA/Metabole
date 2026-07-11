/** Moduli "anteprima" della dashboard: riquadri mezza schermata per le pagine abilitate. */
export interface DashboardModule {
  id: string;
  pageKey: string;
  to: string;
  icon: string;
  label: string;
  preview: string;
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  { id: 'm_clienti', pageKey: 'clients', to: '/clienti', icon: 'ti-users', label: 'Clienti', preview: 'Percorsi in corso, schede e progressi dei clienti.' },
  { id: 'm_grafici', pageKey: 'charts', to: '/grafici', icon: 'ti-chart-histogram', label: 'Grafici', preview: 'Kg persi nel mese, perdita media, fatturato e classifiche.' },
  { id: 'm_pagamenti', pageKey: 'accounting', to: '/pagamenti', icon: 'ti-cash', label: 'Bonifici & contabilità', preview: 'Contabili da verificare e incassi.' },
  { id: 'm_crm', pageKey: 'crm_leads', to: '/crm/gestione', icon: 'ti-list-details', label: 'CRM / Lead', preview: 'Lead, pipeline e conversioni.' },
  { id: 'm_agenda', pageKey: 'visits_agenda', to: '/agenda', icon: 'ti-calendar', label: 'Agenda visite', preview: 'Televisite e appuntamenti in programma.' },
  { id: 'm_segnalazioni', pageKey: 'escalations', to: '/segnalazioni', icon: 'ti-alert-triangle', label: 'Segnalazioni', preview: 'Situazioni del motore da gestire.' },
  { id: 'm_diete', pageKey: 'diets_catalog', to: '/diete', icon: 'ti-salad', label: 'Catalogo diete', preview: 'Diete e ricette approvate.' },
  { id: 'm_acquisti', pageKey: 'purchases', to: '/acquisti', icon: 'ti-shopping-cart', label: 'Acquisti', preview: 'Storico acquisti e ricevute.' },
  { id: 'm_compensi', pageKey: 'compensation', to: '/compensi', icon: 'ti-coin', label: 'Compensi staff', preview: 'Provvigioni e compensi del team.' },
];

/** Moduli mostrati di default se l'utente non ha ancora personalizzato. */
export const DEFAULT_MODULE_IDS = ['m_clienti', 'm_grafici', 'm_pagamenti', 'm_agenda'];
