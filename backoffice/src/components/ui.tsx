import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={wide ? { maxWidth: 760 } : undefined}>
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


/**
 * Paginazione lato client riutilizzabile: 100 righe/pagina di default.
 * Ritorna la fetta della pagina corrente e "aggancia" la pagina all'intervallo
 * valido (se i filtri riducono le righe, la pagina non resta fuori scala).
 */
export function usePagination<T>(items: T[], pageSize = 100) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    page,
    setPage,
    totalPages,
    total,
    pageItems,
    pageSize,
    from: total ? start + 1 : 0,
    to: Math.min(start + pageSize, total),
  };
}

/** Barra di paginazione: prima/prec, selettore pagina, succ/ultima. Nascosta se c'è una pagina sola. */
export function Pager({
  page,
  totalPages,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--line,#eee)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{from}–{to} di {total}</span>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <button className="btn ghost sm" onClick={() => onPage(1)} disabled={page <= 1} title="Prima pagina">«</button>
        <button className="btn ghost sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹ Prec</button>
        <select className="select" style={{ width: 'auto', padding: '4px 8px' }} value={page} onChange={(e) => onPage(Number(e.target.value))} title="Vai alla pagina">
          {Array.from({ length: totalPages }, (_, i) => (
            <option key={i + 1} value={i + 1}>Pagina {i + 1} di {totalPages}</option>
          ))}
        </select>
        <button className="btn ghost sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Succ ›</button>
        <button className="btn ghost sm" onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Ultima pagina">»</button>
      </div>
    </div>
  );
}
