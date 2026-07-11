import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';

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
const NAV: NavSection[] = [
  {
    group: 'Generale',
    items: [{ key: 'dashboard', label: 'Dashboard', to: '/', icon: 'ti-layout-dashboard' }],
  },
  {
    group: 'CRM',
    icon: 'ti-address-book',
    collapsible: true,
    items: [
      { key: 'crm_leads', label: 'Gestione lead', to: '/crm/gestione', icon: 'ti-list-details' },
      { key: 'crm_leads', label: 'Inserimento lead', to: '/crm/inserimento', icon: 'ti-user-plus' },
      { key: 'crm_leads', label: 'Pipeline', to: '/crm/pipeline', icon: 'ti-layout-kanban' },
      { key: 'lead_acceptance', label: 'Lead da accettare', to: '/crm/da-accettare', icon: 'ti-user-check' },
      { key: 'crm_leads', label: 'Calendario', to: '/crm/calendario', icon: 'ti-calendar-event' },
    ],
  },
  {
    group: 'Percorso cliente',
    items: [
      { key: 'visits_agenda', label: 'Agenda visite', to: '/agenda', icon: 'ti-calendar' },
      { key: 'escalations', label: 'Segnalazioni', to: '/segnalazioni', icon: 'ti-alert-triangle' },
    ],
  },
  {
    group: 'Pagamenti',
    items: [
      { key: 'shop', label: 'Negozio', to: '/negozio', icon: 'ti-building-store' },
      { key: 'purchases', label: 'Acquisti', to: '/acquisti', icon: 'ti-shopping-cart' },
      { key: 'discounts', label: 'Buoni sconto', to: '/buoni-sconto', icon: 'ti-ticket' },
      { key: 'accounting', label: 'Bonifici & contabilità', to: '/pagamenti', icon: 'ti-cash' },
      { key: 'commissions', label: 'Provvigioni', to: '/provvigioni', icon: 'ti-percentage' },
      { key: 'compensation', label: 'Compensi staff', to: '/compensi', icon: 'ti-coin' },
    ],
  },
  {
    group: 'Contenuti',
    items: [
      { key: 'diets_catalog', label: 'Catalogo diete', to: '/diete', icon: 'ti-salad' },
      { key: 'engine_protocols', label: 'Protocolli motore', to: '/protocolli', icon: 'ti-cpu' },
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
      { key: 'permissions', label: 'Ruoli', to: '/ruoli', icon: 'ti-shield-half' },
      { key: 'permissions', label: 'Permessi', to: '/permessi', icon: 'ti-lock-cog' },
      { key: 'engine_config', label: 'Parametri', to: '/parametri', icon: 'ti-adjustments' },
      { key: 'audit_logs', label: 'Log attività', to: '/log', icon: 'ti-history' },
    ],
  },
];

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user, permissions, can, logout, impersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            <i className="ti ti-leaf" />
          </div>
          <div>
            <b>Metabole</b>
            <span>Backoffice</span>
          </div>
        </div>

        {NAV.map((section) => {
          const visible = section.items.filter((it) => it.key === 'dashboard' || can(it.key));
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
          <h1>{title}</h1>
          <div className="row">
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.email} · {permissions ? ROLE_LABEL[permissions.role] : ''}
            </span>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
