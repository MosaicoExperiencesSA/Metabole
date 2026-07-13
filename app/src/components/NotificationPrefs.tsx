import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Preferenze notifiche del cliente: attiva/disattiva l'email e i singoli tipi.
 * Collegato a GET/PATCH /me/notifications/prefs.
 */

interface Prefs { disabledTypes: string[]; emailEnabled: boolean }

const TYPES: [string, string][] = [
  ['engine_daily', 'Aggiornamenti dal tuo piano'],
  ['checkin_reminder', 'Promemoria del check-in'],
  ['measurement_reminder', 'Promemoria delle misure'],
  ['progress_cheer', 'Complimenti sui progressi'],
  ['rating_request', 'Richieste di valutazione del menu'],
  ['visit_reminder', 'Promemoria delle visite'],
  ['pre_event', 'Preparazione agli eventi'],
  ['mini_plan', 'Mini-piano dopo gli eventi'],
  ['chat_reply_coach', 'Risposte della coach'],
  ['chat_reply_nutritionist', 'Risposte della nutrizionista'],
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', lineHeight: 0, flex: 'none' }}
    >
      <i className={`ti ${on ? 'ti-toggle-right' : 'ti-toggle-left'}`} style={{ fontSize: 30, color: on ? 'var(--teal)' : '#C6CFCB' }} />
    </button>
  );
}

export default function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    api<Prefs>('/me/notifications/prefs')
      .then((p) => setPrefs({ disabledTypes: p.disabledTypes ?? [], emailEnabled: !!p.emailEnabled }))
      .catch(() => setAvailable(false));
  }, []);

  async function save(next: Prefs) {
    setPrefs(next);
    try {
      await api('/me/notifications/prefs', { method: 'PATCH', body: JSON.stringify(next) });
    } catch {
      /* lo stato è già aggiornato localmente; riproverà al prossimo cambio */
    }
  }

  if (!available || !prefs) return null;

  const isOn = (type: string) => !prefs.disabledTypes.includes(type);
  function toggleType(type: string) {
    if (!prefs) return;
    const disabled = isOn(type)
      ? [...prefs.disabledTypes, type]
      : prefs.disabledTypes.filter((t) => t !== type);
    save({ ...prefs, disabledTypes: disabled });
  }

  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>Notifiche</div>
      <div className="card" style={{ padding: '4px 12px' }}>
        <div className="row-between" style={{ padding: '11px 0', borderBottom: '1px solid #F2F5F4' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Anche via email</div>
            <div className="muted" style={{ fontSize: 11 }}>Ricevi i promemoria principali nella tua casella.</div>
          </div>
          <Toggle on={prefs.emailEnabled} onClick={() => save({ ...prefs, emailEnabled: !prefs.emailEnabled })} />
        </div>
        {TYPES.map(([type, label], i) => (
          <div key={type} className="row-between" style={{ padding: '11px 0', borderBottom: i < TYPES.length - 1 ? '1px solid #F2F5F4' : 'none' }}>
            <span style={{ fontSize: 13 }}>{label}</span>
            <Toggle on={isOn(type)} onClick={() => toggleType(type)} />
          </div>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11, margin: '6px 2px 0' }}>
        Le notifiche di sicurezza e quelle del tuo team restano sempre attive.
      </div>
    </>
  );
}
