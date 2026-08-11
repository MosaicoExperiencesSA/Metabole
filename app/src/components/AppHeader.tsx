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
  // Peso in aumento: icona e colori neutri di proposito. Nessun coriandolo, nessun rosso
  // d'allarme — la riga non deve dare un giudizio prima ancora di essere letta.
  progress_support: ['ti-chart-line', '#E7EEF6', '#3A6EA5'],
  rating_request: ['ti-star', '#F3E8DC', '#B8863B'],
  visit_reminder: ['ti-calendar-check', '#E7EEF6', '#3A6EA5'],
  pre_event: ['ti-calendar-heart', '#FBEEE7', '#E8825A'],
  mini_plan: ['ti-heart-handshake', '#DCEBE3', '#0E7C66'],
  chat_reply_coach: ['ti-message-2', '#DCEBE3', '#0E7C66'],
  chat_reply_nutritionist: ['ti-message-2', '#E7EEF6', '#3A6EA5'],
};

// Ogni tipo di notifica porta alla funzione giusta al tap (deep-link in-app).
// Es: "ti è piaciuto il cibo?" (rating_request) → pagina del menu con le stelline.
const TYPE_ROUTE: Record<string, string> = {
  engine_daily: '/menu',
  checkin_reminder: '/',
  measurement_reminder: '/obiettivo',
  progress_cheer: '/percorso',
  progress_support: '/percorso',
  rating_request: '/menu',
  visit_reminder: '/calendario',
  pre_event: '/calendario',
  mini_plan: '/percorso',
  chat_reply_coach: '/contatti',
  chat_reply_nutritionist: '/contatti',
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
  plain = false,
}: {
  title: string;
  alertBadge?: number;
  alertItems?: ReactNode;
  /** Header "semplice": solo barra teal + brand + titolo, senza le 4 icone né le
   *  notifiche. Per le pagine pubbliche/di servizio (login, reset password, ecc.)
   *  dove l'utente non è (ancora) autenticato e le API /me non sono disponibili. */
  plain?: boolean;
}) {
  const nav = useNavigate();
  const [sheet, setSheet] = useState<null | 'bell' | 'alert'>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    if (plain) return;
    api<Notif[]>('/me/notifications').then((r) => setNotifs(Array.isArray(r) ? r : [])).catch(() => setNotifs([]));
  }, [plain]);

  const unread = notifs.filter((n) => !n.readAt).length;
  const read = notifs.length - unread;

  async function markRead(n: Notif) {
    if (n.readAt) return;
    setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    try {
      await api(`/me/notifications/${n.id}/read`, { method: 'PATCH' });
    } catch {
      /* la spunta è già applicata localmente */
    }
  }

  // Tap su una notifica: la segna letta e apre la funzione collegata (se mappata).
  function openNotif(n: Notif) {
    void markRead(n);
    const route = TYPE_ROUTE[n.type];
    if (route) { setSheet(null); nav(route); }
  }

  async function markAllRead() {
    const toMark = notifs.filter((n) => !n.readAt);
    setNotifs((list) => list.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    await Promise.all(
      toMark.map((n) => api(`/me/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})),
    );
  }

  /* «Nella campanella avere la possibilità di poter cancellare la cronologia, una sfilza di
     messaggi.» Il server ARCHIVIA, non cancella: qui sparisce, ma il messaggio resta nel
     database — è la traccia di cosa il sistema ha comunicato alla cliente. */
  async function archive(n: Notif) {
    setNotifs((list) => list.filter((x) => x.id !== n.id));
    try {
      await api(`/me/notifications/${n.id}/archive`, { method: 'PATCH' });
    } catch {
      setNotifs((list) => (list.some((x) => x.id === n.id) ? list : [...list, n].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))));
    }
  }

  // Svuota SOLO le lette: una campanella ripulita non deve poter far sparire un messaggio
  // che la cliente non ha mai aperto (un promemoria misure, una risposta della coach).
  async function archiveAllRead() {
    const before = notifs;
    setNotifs((list) => list.filter((x) => !x.readAt));
    try {
      await api('/me/notifications/archive-read', { method: 'POST' });
    } catch {
      setNotifs(before);
    }
  }

  return (
    <>
      <div className="app-header">
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div className="app-header-brand">METABOLE<span style={{ color: '#E4DBFF' }}>AI</span></div>
          <div className="app-header-title">{title}</div>
        </div>
        {!plain && (
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
        )}
      </div>

      {sheet === 'bell' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-bell" /></span>
              <b style={{ fontSize: 15 }}>Notifiche</b>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {unread > 0 && <span className="link" style={{ margin: 0, cursor: 'pointer' }} onClick={markAllRead}>Segna lette</span>}
              {read > 0 && (
                <span className="link" style={{ margin: 0, cursor: 'pointer' }} onClick={archiveAllRead}>
                  Svuota le lette
                </span>
              )}
            </div>
          </div>
          {notifs.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna notifica per ora.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifs.map((n) => {
                const [icon, bg, color] = TYPE_ICON[n.type] ?? ['ti-bell', '#F2F5F4', '#5F6E6B'];
                const title2 = n.payload?.title || 'Notifica';
                const body = n.payload?.body || '';
                const hasRoute = !!TYPE_ROUTE[n.type];
                return (
                  <div key={n.id} className="card" style={{ display: 'flex', gap: 11, alignItems: 'flex-start', opacity: n.readAt ? 0.6 : 1, cursor: hasRoute || !n.readAt ? 'pointer' : 'default', margin: 0 }} onClick={() => openNotif(n)}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <i className={`ti ${icon}`} style={{ fontSize: 19 }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {title2}
                        {!n.readAt && <span className="livedot" style={{ background: '#E8543C' }} />}
                      </div>
                      {body && <div className="notif-testo" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>{body}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <div className="muted" style={{ fontSize: 10 }}>{relTime(n.scheduledFor)}</div>
                        {hasRoute && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--teal)' }}>Apri <i className="ti ti-chevron-right" style={{ fontSize: 11, verticalAlign: '-1px' }} /></span>}
                      </div>
                    </div>
                    {/* Chiusura della singola notifica. `stopPropagation` è indispensabile:
                        senza, il tap archivierebbe E aprirebbe la pagina collegata. */}
                    <button
                      aria-label="Togli dalla campanella"
                      onClick={(e) => { e.stopPropagation(); void archive(n); }}
                      style={{ flex: 'none', background: 'none', border: 0, padding: 4, margin: -4, color: '#9AA8A5', cursor: 'pointer', lineHeight: 1 }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 15 }} />
                    </button>
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
