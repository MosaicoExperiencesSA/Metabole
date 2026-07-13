import type { ReactNode } from 'react';
import { ROLE_LABEL, type Role } from '../lib/labels';

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spin" />
    </div>
  );
}

export function Banner({ kind, children }: { kind: 'err' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function RoleChip({ role }: { role: Role }) {
  const cls: Record<Role, string> = {
    admin: 'red',
    head_nutritionist: 'violet',
    nutritionist: 'violet',
    coach: '',
    sales: 'amber',
    marketing: 'amber',
    head_marketing: 'amber',
    client: 'gray',
  };
  return <span className={`chip ${cls[role]}`}>{ROLE_LABEL[role]}</span>;
}

export function StatusChip({ status }: { status: string }) {
  if (status === 'active') return <span className="chip">Attivo</span>;
  if (status === 'suspended') return <span className="chip red">Sospeso</span>;
  return <span className="chip gray">{status}</span>;
}

export function Toggle({
  on,
  onChange,
  disabled,
  title,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onChange(!on)}
      aria-pressed={on}
    />
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="spread" style={{ marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      </div>
      {actions}
    </div>
  );
}
