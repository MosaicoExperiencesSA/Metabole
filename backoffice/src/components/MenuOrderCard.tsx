import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { NAV } from './Layout';
import { orderNavItems, writeMenuOrderCache } from '../lib/menuOrder';

/**
 * Pannello Impostazioni per riordinare le voci del menu dentro ogni gruppo.
 * Default alfabetico; le frecce su/giù personalizzano; l'ordine si salva sul profilo.
 */
export function MenuOrderCard() {
  const { can } = useAuth();
  const groups = NAV
    .map((s) => ({ group: s.group, items: s.items.filter((it) => can(it.key)) }))
    .filter((g) => g.items.length > 0);

  const [order, setOrder] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ menuOrder: string[] | null }>('/me/preferences')
      .then((p) => setOrder(p.menuOrder && p.menuOrder.length ? p.menuOrder : null))
      .catch(() => setOrder(null));
  }, []);

  const view = groups.map((g) => ({ group: g.group, items: orderNavItems(g.items, order) }));

  async function persist(flat: string[] | null) {
    setOrder(flat);
    writeMenuOrderCache(flat);
    try {
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ menuOrder: flat ?? [] }) });
      setMsg('Ordine salvato.');
    } catch {
      setMsg('Salvato solo su questo dispositivo.');
    }
  }

  function move(groupIdx: number, itemIdx: number, dir: -1 | 1) {
    const next = view.map((g) => g.items.map((it) => it.to));
    const arr = next[groupIdx];
    const j = itemIdx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[itemIdx], arr[j]] = [arr[j], arr[itemIdx]];
    void persist(next.flat());
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Ordine del menu</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Di default le voci sono in ordine alfabetico dentro ogni gruppo. Usa le frecce per riordinarle: l'ordine si salva sul tuo profilo.
        {msg && <b style={{ color: 'var(--ok-ink)' }}> · {msg}</b>}
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        {view.map((g, gi) => (
          <div key={g.group}>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{g.group}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {g.items.map((it, ii) => (
                <div key={it.to} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--chip)' }}>
                  <i className={`ti ${it.icon}`} style={{ fontSize: 18 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{it.label}</span>
                  <button className="btn ghost sm" disabled={ii === 0} onClick={() => move(gi, ii, -1)} title="Sposta su"><i className="ti ti-chevron-up" /></button>
                  <button className="btn ghost sm" disabled={ii === g.items.length - 1} onClick={() => move(gi, ii, 1)} title="Sposta giù"><i className="ti ti-chevron-down" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => void persist(null)}>
        <i className="ti ti-arrows-sort" /> Ripristina ordine alfabetico
      </button>
    </div>
  );
}
