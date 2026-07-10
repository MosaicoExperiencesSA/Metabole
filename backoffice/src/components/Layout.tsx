import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';

/** Voci del menu: sezione backoffice ↔ pageKey dei permessi ↔ rotta ↔ icona. */
const NAV: { group: string; items: { key: string; label: string; to: string; icon: string }[] }[] = [
  {
    group: 'Operatività',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'ti-layout-dashboard' },
      { key: 'crm_leads', label: 'Clienti / Lead', to: '/crm', icon: 'ti-layout-kanban' },
      { key: 'visits_agenda', label: 'Agenda visite', to: '/agenda', icon: 'ti-calendar' },
      { key: 'escalations', label: 'Segnalazioni', to: '/segnalazioni', icon: 'ti-alert-triangle' },
    ],
  },
  {
    group: 'Pagamenti',
    items: [
      { key: 'accounting', label: 'Bonifici & contabilità', to: '/pagamenti', icon: 'ti-cash' },
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

  async function handleLogout() {
    await logout();
    navigate('/login');
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
          return (
            <div key={section.group}>
              <div className="nav-sep">{section.group}</div>
              {visible.map((it) => (
                <NavLink
                  key={it.key}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <i className={`ti ${it.icon}`} />
                  {it.label}
                </NavLink>
              ))}
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
