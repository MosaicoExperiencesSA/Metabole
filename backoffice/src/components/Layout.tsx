import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';
import { UserMenu } from './UserMenu';
import { api } from '../api/client';
import { readMenuOrderCache, writeMenuOrderCache, orderNavItems } from '../lib/menuOrder';

interface NavItem {
  key: string; // pageKey dei permessi
  label: string;
  to: string;
  icon: string;
}
interface NavSection {
  group: string;
  icon?: string;
  collapsible?: boolean;
  items: NavItem[];
}

/** Voci del menu: sezione ↔ pageKey dei permessi ↔ rotta ↔ icona. */
export const NAV: NavSection[] = [
  {
    group: 'Generale',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'ti-layout-dashboard' },
      { key: 'posta', label: 'Posta', to: '/posta', icon: 'ti-mail' },
      { key: 'charts', label: 'Grafici', to: '/grafici', icon: 'ti-chart-histogram' },
      // Impostazioni spostate nel menu utente in alto (avatar) → non più in sidebar.
    ],
  },
  {
    group: 'CRM',
    icon: 'ti-address-book',
    collapsible: true,
    items: [
      { key: 'crm_leads', label: 'Gestione lead', to: '/crm/gestione', icon: 'ti-list-details' },
      { key: 'crm_lead_new', label: 'Inserimento lead', to: '/crm/inserimento', icon: 'ti-user-plus' },
      { key: 'crm_import', label: 'Import liste', to: '/crm/import', icon: 'ti-database-import' },
      { key: 'crm_pipeline', label: 'Pipeline', to: '/crm/pipeline', icon: 'ti-layout-kanban' },
      { key: 'lead_acceptance', label: 'Lead da accettare', to: '/crm/da-accettare', icon: 'ti-user-check' },
      { key: 'crm_calendar', label: 'Calendario', to: '/crm/calendario', icon: 'ti-calendar-event' },
    ],
  },
  {
    group: 'Percorso cliente',
    items: [
      { key: 'clients', label: 'Clienti', to: '/clienti', icon: 'ti-users' },
      { key: 'visits_agenda', label: 'Agenda visite', to: '/agenda', icon: 'ti-calendar' },
      { key: 'escalations', label: 'Segnalazioni', to: '/segnalazioni', icon: 'ti-alert-triangle' },
      { key: 'chat', label: 'Chat', to: '/chat', icon: 'ti-messages' },
    ],
  },
  {
    group: 'Pagamenti',
    items: [
      { key: 'shop', label: 'Negozio', to: '/negozio', icon: 'ti-building-store' },
      { key: 'purchases', label: 'Acquisti', to: '/acquisti', icon: 'ti-shopping-cart' },
      { key: 'discounts', label: 'Buoni sconto', to: '/buoni-sconto', icon: 'ti-ticket' },
      { key: 'accounting', label: 'Bonifici & contabilità', to: '/pagamenti', icon: 'ti-cash' },
      { key: 'accounting_costs', label: 'Contabilità', to: '/contabilita', icon: 'ti-report-money' },
      { key: 'commissions', label: 'Provvigioni', to: '/provvigioni', icon: 'ti-percentage' },
      { key: 'compensation', label: 'Compensi staff', to: '/compensi', icon: 'ti-coin' },
      { key: 'withdrawals', label: 'Richieste prelievo', to: '/prelievi', icon: 'ti-wallet' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { key: 'marketing', label: 'Marketing', to: '/marketing', icon: 'ti-speakerphone' },
      { key: 'testimonials', label: 'Testimonianze', to: '/testimonianze', icon: 'ti-quote' },
      { key: 'publisher', label: 'Publisher social', to: '/publisher', icon: 'ti-send' },
    ],
  },
  {
    group: 'Contenuti',
    items: [
      { key: 'creation_validation', label: 'Creazione e validazione', to: '/creazione-validazione', icon: 'ti-wand' },
      { key: 'diets_catalog', label: 'Catalogo diete', to: '/diete', icon: 'ti-salad' },
      { key: 'recipes', label: 'Catalogo ricette', to: '/ricette', icon: 'ti-tools-kitchen-2' },
      { key: 'allergens', label: 'Allergeni ricette', to: '/tag-allergeni', icon: 'ti-alert-triangle' },
      { key: 'equivalence_groups', label: 'Gruppi di equivalenza', to: '/gruppi-equivalenza', icon: 'ti-arrows-shuffle' },
      { key: 'engine_protocols', label: 'Protocolli motore', to: '/protocolli', icon: 'ti-cpu' },
      { key: 'engine_rules', label: 'Regole motore', to: '/regole-motore', icon: 'ti-adjustments-cog' },
    ],
  },
  {
    group: 'Comunicazioni',
    items: [
      { key: 'email_templates', label: 'Modelli email', to: '/email-modelli', icon: 'ti-mail-cog' },
      { key: 'email_log', label: 'Log email', to: '/email-log', icon: 'ti-mail-check' },
      { key: 'pdf_templates', label: 'Grafica PDF', to: '/grafica-pdf', icon: 'ti-file-type-pdf' },
    ],
  },
  {
    group: 'Amministrazione',
    items: [
      { key: 'users', label: 'Utenti', to: '/utenti', icon: 'ti-id-badge-2' },
      { key: 'roles', label: 'Ruoli', to: '/ruoli', icon: 'ti-shield-half' },
      { key: 'permissions', label: 'Permessi', to: '/permessi', icon: 'ti-lock-cog' },
      { key: 'engine_config', label: 'Parametri', to: '/parametri', icon: 'ti-adjustments' },
      { key: 'audit_logs', label: 'Log attività', to: '/log', icon: 'ti-history' },
    ],
  },
];

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { can, logout, impersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuOrder, setMenuOrder] = useState<string[] | null>(() => readMenuOrderCache());
  useEffect(() => {
    api<{ menuOrder: string[] | null }>('/me/preferences')
      .then((p) => { const o = p.menuOrder && p.menuOrder.length ? p.menuOrder : null; setMenuOrder(o); writeMenuOrderCache(o); })
      .catch(() => { /* uso la cache locale */ });
  }, []);
  const [navOpen, setNavOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('metabole_bo_nav') !== 'closed'; } catch { return true; }
  });
  function toggleNav() {
    setNavOpen((o) => {
      const n = !o;
      try { localStorage.setItem('metabole_bo_nav', n ? 'open' : 'closed'); } catch { /* no-op */ }
      return n;
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function link(it: NavItem, nested = false) {
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === '/'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        style={nested ? { paddingLeft: 26, fontSize: 13.5 } : undefined}
      >
        <i className={`ti ${it.icon}`} />
        {it.label}
      </NavLink>
    );
  }

  return (
    <div className={`app-shell${navOpen ? '' : ' nav-closed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            <i className="ti ti-leaf" />
          </div>
          <div style={{ flex: 1 }}>
            <b>Metabole</b>
            <span>Backoffice</span>
          </div>
          <button className="nav-collapse" onClick={toggleNav} title="Chiudi il menu">
            <i className="ti ti-chevron-left" />
          </button>
        </div>

        {NAV.map((section) => {
          const visible = orderNavItems(section.items.filter((it) => can(it.key)), menuOrder);
          if (visible.length === 0) return null;

          if (section.collapsible) {
            const hasActive = visible.some((it) => location.pathname.startsWith(it.to));
            const isOpen = collapsed[section.group] ?? hasActive ?? true;
            return (
              <div key={section.group}>
                <button
                  className="nav-item"
                  style={{ fontWeight: 700, marginTop: 8 }}
                  onClick={() => setCollapsed((c) => ({ ...c, [section.group]: !(c[section.group] ?? hasActive) }))}
                >
                  {section.icon && <i className={`ti ${section.icon}`} />}
                  {section.group}
                  <i className={`ti ti-chevron-${isOpen ? 'down' : 'right'}`} style={{ marginLeft: 'auto', fontSize: 15 }} />
                </button>
                {isOpen && visible.map((it) => link(it, true))}
              </div>
            );
          }

          return (
            <div key={section.group}>
              <div className="nav-sep">{section.group}</div>
              {visible.map((it) => link(it))}
            </div>
          );
        })}

        <div className="sidebar-foot">
          <button className="nav-item" onClick={handleLogout}>
            <i className="ti ti-logout" />
            Esci
          </button>
        </div>
      </aside>

      <div className="main">
        {impersonating && (
          <div className="imp-bar">
            <span>
              <i className="ti ti-eye" /> Stai vedendo l'app come <b>{impersonating.email}</b> (
              {ROLE_LABEL[impersonating.role]})
            </span>
            <button onClick={stopImpersonation}>Torna admin</button>
          </div>
        )}
        <div className="topbar">
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <button className="nav-toggle" onClick={toggleNav} title={navOpen ? 'Chiudi il menu' : 'Apri il menu'}>
              <i className="ti ti-menu-2" />
            </button>
            <h1>{title}</h1>
          </div>
          <div className="row">
            <UserMenu />
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
