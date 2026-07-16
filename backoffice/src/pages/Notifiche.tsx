import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Spinner } from '../components/ui';

interface Notif {
  id: string;
  type: string;
  payload?: { title?: string; body?: string } | null;
  readAt: string | null;
  createdAt: string;
}

const dateTime = (s: string) =>
  new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Modulo Notifiche del backoffice: elenco completo delle notifiche dell'utente. */
export function Notifiche() {
  const [items, setItems] = useState<Notif[] | null>(null);

  async function load() {
    try {
      const r = await api<Notif[]>('/me/notifications');
      setItems(Array.isArray(r) ? r : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => { void load(); }, []);

  async function markRead(n: Notif) {
    if (n.readAt) return;
    setItems((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    try {
      await api(`/me/notifications/${n.id}/read`, { method: 'PATCH' });
    } catch {
      /* spunta già applicata localmente */
    }
  }

  async function markAll() {
    const toMark = (items ?? []).filter((n) => !n.readAt);
    setItems((list) => (list ?? []).map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    await Promise.all(toMark.map((n) => api(`/me/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})));
  }

  if (items === null) return <Spinner />;
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Notifiche</h2>
        {unread > 0 && (
          <button className="btn ghost sm" onClick={markAll}>
            <i className="ti ti-checks" /> Segna tutte lette
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="empty">Nessuna notifica.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 4px',
                borderBottom: '1px solid var(--line, #f0f0f0)',
                cursor: n.readAt ? 'default' : 'pointer',
              }}
            >
              <span style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', marginTop: 6, background: n.readAt ? 'var(--line, #ddd)' : '#12a386' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: n.readAt ? 500 : 700, fontSize: 14 }}>{n.payload?.title || n.type}</div>
                {n.payload?.body && <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{n.payload.body}</div>}
                <div className="muted" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{dateTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
