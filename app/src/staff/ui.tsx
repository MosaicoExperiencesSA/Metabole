import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { initials } from './format';

/** Voce della tab bar in basso. */
export interface TabItem {
  to: string;
  icon: string; // classe tabler senza prefisso, es. "ti-users"
  label: string;
  end?: boolean;
}

/** Guscio schermata staff: header teal + contenuto scrollabile + tab bar. */
export function StaffShell({
  title,
  tabs,
  children,
  headerBadge,
}: {
  title: string;
  tabs: TabItem[];
  children: ReactNode;
  headerBadge?: number;
}) {
  return (
    <div className="sf-frame">
      <header className="sf-header">
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div className="sf-header-brand">
            METABOLE<span style={{ color: '#E4DBFF' }}>AI</span>
          </div>
          <div className="sf-header-title">{title}</div>
        </div>
        <div className="sf-header-actions">
          <NavLink to="/notifiche" className="sf-hicon" aria-label="Notifiche">
            <i className="ti ti-bell" />
            {headerBadge ? <span className="sf-hbadge">{headerBadge}</span> : null}
          </NavLink>
          <NavLink to="/chat" className="sf-hicon" aria-label="Messaggi">
            <i className="ti ti-message-2" />
          </NavLink>
          <NavLink to="/profilo" className="sf-hicon sf-hicon-user" aria-label="Profilo">
            <i className="ti ti-user" />
          </NavLink>
        </div>
      </header>
      <main className="sf-body">{children}</main>
      <nav className="sf-tabbar">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            aria-label={t.label}
            title={t.label}
            className={({ isActive }) => 'sf-tab' + (isActive ? ' on' : '')}
          >
            <i className={`ti ${t.icon}`} />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Barra "← Torna" per le schermate di dettaglio. */
export function BackBar({ label = 'Indietro', to }: { label?: string; to?: string }) {
  const nav = useNavigate();
  return (
    <button className="sf-back" onClick={() => (to ? nav(to) : nav(-1))}>
      <i className="ti ti-chevron-left" /> {label}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sf-card ${className}`}>{children}</div>;
}

export function Section({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="sf-sec">
      <span>{title}</span>
      {action}
    </div>
  );
}

export function Avatar({ name, color }: { name: string | null | undefined; color?: string }) {
  return (
    <span className="sf-av" style={color ? { background: color + '22', color } : undefined}>
      {initials(name)}
    </span>
  );
}

export function Pill({
  children,
  bg,
  fg,
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
}) {
  return (
    <span className="sf-pill" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

/** KPI cliccabile con icona, valore, etichetta. */
export function Kpi({
  icon,
  value,
  label,
  bg,
  fg,
  onClick,
}: {
  icon: string;
  value: ReactNode;
  label: string;
  bg: string;
  fg: string;
  onClick?: () => void;
}) {
  return (
    <button className="sf-kpi" style={{ background: bg }} onClick={onClick} disabled={!onClick}>
      <span className="sf-kpi-ic" style={{ color: fg }}>
        <i className={`ti ${icon}`} />
      </span>
      <span className="sf-kpi-val" style={{ color: fg }}>
        {value}
      </span>
      <span className="sf-kpi-lab">{label}</span>
    </button>
  );
}

export function Spinner() {
  return (
    <div className="sf-center">
      <div className="sf-spin" />
    </div>
  );
}

/** Stato di caricamento/errore/vuoto attorno a un blocco di contenuto. */
export function Async<T>({
  state,
  empty,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void };
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { data, error, loading, reload } = state;
  if (loading && data === null) return <Spinner />;
  if (error && data === null)
    return (
      <div className="sf-empty">
        <i className="ti ti-alert-circle" />
        <p>{error}</p>
        <button className="sf-mini" onClick={reload}>
          Riprova
        </button>
      </div>
    );
  if (data === null) return <>{empty ?? null}</>;
  if (Array.isArray(data) && data.length === 0 && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="sf-empty">
      <i className={`ti ${icon}`} />
      <p>{text}</p>
    </div>
  );
}
