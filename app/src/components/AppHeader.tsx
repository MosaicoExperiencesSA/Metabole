import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sheet from './Sheet';

/**
 * Header comune a tutte le schermate dell'app (come nel prototipo):
 * barra teal con angoli arrotondati in basso, "METABOLEAI" + titolo,
 * e 4 icone a destra: notifiche, da completare, shop, profilo.
 */
export default function AppHeader({
  title,
  bellBadge = 0,
  alertBadge = 0,
  alertItems,
  notifItems,
}: {
  title: string;
  bellBadge?: number;
  alertBadge?: number;
  alertItems?: ReactNode;
  notifItems?: ReactNode;
}) {
  const nav = useNavigate();
  const [sheet, setSheet] = useState<null | 'bell' | 'alert'>(null);

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
            {bellBadge > 0 && <span className="hbadge">{bellBadge}</span>}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-bell" /></span>
            <b style={{ fontSize: 15 }}>Notifiche</b>
          </div>
          {notifItems ?? <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna nuova notifica per ora.</p>}
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
