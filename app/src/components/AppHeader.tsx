import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Sheet from './Sheet';

/**
 * Header comune a tutte le schermate dell'app (come nel prototipo):
 * barra teal con angoli arrotondati in basso, "METABOLEAI" + titolo,
 * e 4 icone a destra: notifiche (collegate al server), da completare, shop, profilo.
 */

interface Notif {
  id: string;
  type: string;
  payload?: { title?: string; body?: string } | null;
  readAt: string | null;
  scheduledFor: string;
}

const TYPE_ICON: Record<string, [string, string, string]> = {
  // tipo → [icona, bg, colore]
  engine_daily: ['ti-lock-open', '#DCF0D8', '#3B6D11'],
  checkin_reminder: ['ti-mood-smile', '#DCEBE3', '#0E7C66'],
  measurement_reminder: ['ti-scale', '#E7EEF6', '#3A6EA5'],
  progress_cheer: ['ti-confetti', '#FBEEE7', '#E8825A'],
  rating_request: ['ti-star', '#F3E8DC', '#B8863B'],
  visit_reminder: ['ti-calendar-check', '#E7EEF6', '#3A6EA5'],
  pre_event: ['ti-calendar-heart', '#FBEEE7', '#E8825A'],
  mini_plan: ['ti-heart-handshake', '#DCEBE3', '#0E7C66'],
  chat_reply_coach: ['ti-message-2', '#DCEBE3', '#0E7C66'],
  chat_reply_nutritionist: ['ti-message-2', '#E7EEF6', '#3A6EA5'],
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ieri';
  if (d < 7) return `${d} giorni fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export default function AppHeader({
  title,
  alertBadge = 0,
  alertItems,
}: {
  title: string;
  alertBadge?: number;
  alertItems?: ReactNode;
}) {
  const nav = useNavigate();
  const [sheet, setSheet] = useState<null | 'bell' | 'alert'>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    api<Notif[]>('/me/notifications').then((r) => setNotifs(Array.isArray(r) ? r : [])).catch(() => setNotifs([]));
  }, []);

  const unread = notifs.filter((n) => !n.readAt).length;

  async function markRead(n: Notif) {
    if (n.readAt) return;
    setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    try {
      await api(`/me/notifications/${n.id}/read`, { method: 'PATCH' });
    } catch {
      /* la spunta è già applicata localmente */
    }
  }

  async function markAllRead() {
    const toMark = notifs.filter((n) => !n.readAt);
    setNotifs((list) => list.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    await Promise.all(
      toMark.map((n) => api(`/me/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})),
    );
  }

  return (
    <>
      <div className="app-header">
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div className="app-header-brand">METABOLE<span style={{ color: '#E4DBFF' }}>AI</span></div>
          <div className="app-header-title">{title}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <button className="hicon" aria-label="Notifiche" onClick={() => setSheet('bell')}>
            <i className="ti ti-bell" />
            {unread > 0 && <span className="hbadge">{unread}</span>}
          </button>
          <button className="hicon" aria-label="Da completare" onClick={() => setSheet('alert')}>
            <i className="ti ti-alert-triangle" />
            {alertBadge > 0 && <span className="hbadge">{alertBadge}</span>}
          </button>
          <button className="hicon" aria-label="Shop" onClick={() => nav('/shop')}>
            <i className="ti ti-shopping-bag" />
          </button>
          <button className="hicon hicon-user" aria-label="Profilo" onClick={() => nav('/profilo')}>
            <i className="ti ti-user" />
          </button>
        </div>
      </div>

      {sheet === 'bell' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-bell" /></span>
              <b style={{ fontSize: 15 }}>Notifiche</b>
            </div>
            {unread > 0 && <span className="link" style={{ margin: 0, cursor: 'pointer' }} onClick={markAllRead}>Segna lette</span>}
          </div>
          {notifs.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna notifica per ora.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifs.map((n) => {
                const [icon, bg, color] = TYPE_ICON[n.type] ?? ['ti-bell', '#F2F5F4', '#5F6E6B'];
                const title2 = n.payload?.title || 'Notifica';
                const body = n.payload?.body || '';
                return (
                  <div key={n.id} className="card" style={{ display: 'flex', gap: 11, alignItems: 'flex-start', opacity: n.readAt ? 0.6 : 1, cursor: n.readAt ? 'default' : 'pointer', margin: 0 }} onClick={() => markRead(n)}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <i className={`ti ${icon}`} style={{ fontSize: 19 }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {title2}
                        {!n.readAt && <span className="livedot" style={{ background: '#E8543C' }} />}
                      </div>
                      {body && <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 2 }}>{body}</div>}
                      <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{relTime(n.scheduledFor)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'alert' && (
        <Sheet onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span className="event-ic" style={{ background: '#FBEEE7', color: '#E8825A' }}><i className="ti ti-alert-triangle" /></span>
            <b style={{ fontSize: 15 }}>Da completare</b>
          </div>
          {alertItems ?? <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sei in pari: niente da completare adesso.</p>}
        </Sheet>
      )}
    </>
  );
}
