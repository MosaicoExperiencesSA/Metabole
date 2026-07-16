import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Notif {
  id: string;
  type: string;
  payload?: { title?: string; body?: string } | null;
  readAt: string | null;
  createdAt: string;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ora';
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} g fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/**
 * Campanella notifiche nell'header del backoffice: badge non lette, dropdown con
 * le ultime notifiche, segna letta al clic, link al modulo Notifiche.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await api<Notif[]>('/me/notifications');
      setItems(Array.isArray(r) ? r : []);
    } catch {
      /* silenzioso: la campanella non deve mai rompere l'header */
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(n: Notif) {
    if (n.readAt) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    try {
      await api(`/me/notifications/${n.id}/read`, { method: 'PATCH' });
    } catch {
      /* la spunta è già applicata localmente */
    }
  }

  async function markAll() {
    const toMark = items.filter((n) => !n.readAt);
    setItems((list) => list.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    await Promise.all(toMark.map((n) => api(`/me/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})));
  }

  return (
    <div className="notif-bell" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="nav-toggle"
        title="Notifiche"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <i className="ti ti-bell" />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#e5484d',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 340,
            maxWidth: '90vw',
            background: 'var(--card, #fff)',
            border: '1px solid var(--line, #e5e5e5)',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,.12)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          <div className="row-between" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line, #eee)' }}>
            <b style={{ fontSize: 14 }}>Notifiche</b>
            {unread > 0 && (
              <button className="link" style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 12, color: 'var(--teal, #12a386)' }} onClick={markAll}>
                Segna tutte lette
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div className="muted" style={{ padding: '22px 12px', textAlign: 'center', fontSize: 13 }}>
                Nessuna notifica.
              </div>
            ) : (
              items.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--line, #f0f0f0)',
                    cursor: n.readAt ? 'default' : 'pointer',
                    background: n.readAt ? 'transparent' : 'rgba(18,163,134,.06)',
                  }}
                >
                  <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: n.readAt ? 'transparent' : '#12a386' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: n.readAt ? 500 : 700, fontSize: 13 }}>{n.payload?.title || n.type}</div>
                    {n.payload?.body && <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>{n.payload.body}</div>}
                    <div className="muted" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{relTime(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/notifiche'); }}
            style={{ width: '100%', padding: '10px 12px', background: 'none', border: 0, borderTop: '1px solid var(--line, #eee)', cursor: 'pointer', fontSize: 13, color: 'var(--teal, #12a386)', fontWeight: 600 }}
          >
            Vedi tutte
          </button>
        </div>
      )}
    </div>
  );
}
