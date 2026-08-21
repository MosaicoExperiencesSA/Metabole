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
    coach_coordinator: '',
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


export function usePagination<T>(items: T[], pageSize = 100) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { page, setPage, totalPages, total, pageItems, pageSize, from: total ? start + 1 : 0, to: Math.min(start + pageSize, total) };
}

export function Pager({ page, totalPages, total, from, to, onPage, sopra }: {
  page: number; totalPages: number; total: number; from: number; to: number; onPage: (p: number) => void;
  /**
   * `true` quando il selettore sta SOPRA la tabella (dall'11/8 le tabelle lunghe lo hanno da
   * entrambe le parti; dal 21/8 **tutte**). Sposta il filo di separazione dall'alto al basso:
   * sopra, un bordo superiore si sovrapporrebbe a quello della card e il blocco sembrerebbe
   * staccato dalla tabella che comanda.
   */
  sopra?: boolean;
}) {
  if (totalPages <= 1) return null;
  const filo = sopra ? { borderBottom: '1px solid var(--line,#eee)' } : { borderTop: '1px solid var(--line,#eee)' };
  /**
   * ⛔ **LA BARRA DI SOPRA È INCOLLATA IN ALTO, E SENZA QUESTO NON SERVIVA A NIENTE** (trovato in
   * revisione, 21/8 — dopo averla messa su tutte e ventisette le tabelle).
   *
   * La card che contiene una tabella **scorre dentro di sé**: `theme.css` le dà `overflow: auto` e
   * `max-height: calc(100vh - 240px)`. Una barra messa lì come primo figlio se ne va al primo
   * movimento di rotella — con cento righe per pagina resta invisibile per tutto il tempo in cui
   * servirebbe, e per cambiare pagina si torna a fare i due viaggi che questa barra doveva togliere.
   *
   * ⚠️ Il difetto c'era già dall'11/8 sulle sei tabelle che la barra ce l'avevano: *sembrava*
   * funzionare perché chi la provava non scorreva. E la mia prima correzione l'ha ripetuto
   * diciannove volte, perché avevo cercato l'`overflow` scritto nel JSX e quello sta nel **CSS**.
   *
   * ✅ Con `sticky` la barra resta dov'è mentre le righe scorrono sotto — dentro la card, senza
   * toccare nessuna delle ventisette pagine, e sistemando anche le sei di prima. ⚠️ `zIndex: 4`
   * perché l'intestazione incollata di `tabella.tsx` sta a **3**: sotto, le righe le passerebbero
   * sopra. E lo sfondo è pieno, o si vedrebbero le righe scorrere attraverso.
   *
   * ⚠️ **`left: 0` insieme a `top: 0`**, perché quei riquadri scorrono anche in orizzontale: le
   * tabelle larghe hanno `min-width: 900px` e preferiscono scorrere invece di comprimersi. Con il
   * solo `top` i comandi se ne andrebbero di lato appena si guarda una colonna in fondo.
   *
   * ⚠️ Quando la barra non ha nessun antenato che scorre, `sticky` non fa niente: si comporta come
   * una riga normale. Nessuna pagina va adattata.
   */
  const incollata: React.CSSProperties = sopra
    ? { position: 'sticky', top: 0, left: 0, zIndex: 4, background: 'var(--card, #fff)' }
    : {};
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: 8, ...incollata, ...filo }}>
      <span className="muted" style={{ fontSize: 13 }}>{from}–{to} di {total}</span>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <button className="btn ghost sm" onClick={() => onPage(1)} disabled={page <= 1} title="Prima pagina">«</button>
        <button className="btn ghost sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹ Prec</button>
        <select className="select" style={{ width: 'auto', padding: '4px 8px' }} value={page} onChange={(e) => onPage(Number(e.target.value))} title="Vai alla pagina">
          {Array.from({ length: totalPages }, (_, i) => (<option key={i + 1} value={i + 1}>Pagina {i + 1} di {totalPages}</option>))}
        </select>
        <button className="btn ghost sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Succ ›</button>
        <button className="btn ghost sm" onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Ultima pagina">»</button>
      </div>
    </div>
  );
}
