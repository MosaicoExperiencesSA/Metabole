import type { TabItem } from './ui';

/** Tab bar del coach (come nel prototipo: dashboard, guadagni, clienti, chat, agenda).
 *  Gli alert restano raggiungibili dalla dashboard ("Vedi tutte"). */
export const COACH_TABS: TabItem[] = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Dashboard', end: true },
  { to: '/guadagni', icon: 'ti-wallet', label: 'Guadagni' },
  { to: '/clienti', icon: 'ti-users', label: 'Clienti' },
  { to: '/chat', icon: 'ti-message-2', label: 'Chat' },
  { to: '/agenda', icon: 'ti-calendar-heart', label: 'Agenda' },
];

/** Tab bar del nutrizionista (dashboard, pazienti, diete, agenda, guadagni). */
export const NUTRI_TABS: TabItem[] = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Dashboard', end: true },
  { to: '/pazienti', icon: 'ti-users', label: 'Pazienti' },
  { to: '/diete', icon: 'ti-salad', label: 'Diete' },
  { to: '/agenda', icon: 'ti-calendar-heart', label: 'Agenda' },
  { to: '/guadagni', icon: 'ti-cash', label: 'Guadagni' },
];

/** Ruoli che vedono le schermate coach. */
export const COACH_ROLES = new Set(['coach', 'coach_coordinator', 'sales']);
/** Ruoli che vedono le schermate nutrizionista. */
export const NUTRI_ROLES = new Set(['nutritionist', 'head_nutritionist']);
