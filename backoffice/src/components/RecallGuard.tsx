import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * "Da ricontattare" con appuntamento OBBLIGATORIO + blocco sugli scaduti.
 *
 * 1) Quando un lead viene spostato in uno stato di ricontatto (pipeline, tabella o
 *    scheda), si apre un popup calendario dove fissare un appuntamento è obbligatorio:
 *    senza data il cambio di stato non avviene.
 * 2) Se un appuntamento scade e non viene gestito, un popup a schermo intero blocca
 *    il backoffice finché non si segna "Fatto" o non si rimanda a una nuova data.
 */

/** Riconosce lo stato "da ricontattare" dal nome (gli stati sono gestiti dall'admin). */
export const isRecallStage = (s?: { key: string; label: string } | null) =>
  !!s && /ricontatt|richiam/i.test(`${s.key} ${s.label}`);

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(12,36,32,.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const boxStyle: React.CSSProperties = {
  background: 'var(--card, #fff)', borderRadius: 14, padding: 20, width: 'min(560px, 96vw)',
  maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 18px 60px rgba(0,0,0,.28)',
};

/** Popup calendario per fissare l'appuntamento di ricontatto (obbligatorio). */
export function AppointmentModal({ leadName, stageLabel, onConfirm, onCancel }: {
  leadName: string;
  stageLabel: string;
  onConfirm: (title: string, dueAtIso: string, note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(`Ricontattare ${leadName}`);
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    if (!title.trim() || !due) return;
    setBusy(true); setErr(null);
    try {
      await onConfirm(title.trim(), new Date(due).toISOString(), note.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}><i className="ti ti-calendar-due" /> Fissa il ricontatto</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Stai spostando <b>{leadName}</b> in "<b>{stageLabel}</b>": per completare lo spostamento è
          <b> obbligatorio</b> fissare un appuntamento. Se scade senza essere gestito, il backoffice lo ricorderà con un blocco.
        </p>
        {err && <p style={{ color: '#b3261e', fontSize: 13 }}>{err}</p>}
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Titolo</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Quando (obbligatorio)</label>
          <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Nota (opzionale)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. preferisce essere chiamata di sera" maxLength={300} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Annulla (non sposta)</button>
          <button className="btn" onClick={confirm} disabled={busy || !title.trim() || !due}>
            <i className="ti ti-calendar-check" /> {busy ? 'Salvo…' : 'Fissa e sposta'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OverdueReminder {
  id: string; title: string; dueAt: string; note: string | null; done: boolean;
  crmRecordId: string | null; linkedName: string | null; createdById?: string | null;
}

const GATE_ROLES = ['coach', 'sales', 'nutritionist', 'head_nutritionist', 'admin'];
// I ruoli manager vedono TUTTI i promemoria: il blocco vale solo per quelli creati da loro,
// così l'admin/manager non resta ostaggio dei promemoria trascurati delle coach.
const MANAGER_ROLES = ['sales', 'head_nutritionist', 'admin'];

/**
 * Blocco globale: se ci sono appuntamenti SCADUTI non gestiti, copre il backoffice
 * finché ognuno non viene segnato "Fatto" o rimandato a una nuova data.
 */
export function OverdueGate() {
  const { user } = useAuth();
  const [overdue, setOverdue] = useState<OverdueReminder[]>([]);
  const [snooze, setSnooze] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const enabled = !!user && GATE_ROLES.includes(user.role);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await api<OverdueReminder[]>(`/crm/reminders?includeDone=false&to=${encodeURIComponent(new Date().toISOString())}`);
      const mine = MANAGER_ROLES.includes(user!.role)
        ? (rows ?? []).filter((r) => r.createdById === user!.id)
        : (rows ?? []);
      setOverdue(mine);
    } catch { /* endpoint non raggiungibile per questo ruolo: nessun blocco */ }
  }, [enabled, user]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [enabled, load]);

  if (!enabled || overdue.length === 0) return null;

  async function markDone(r: OverdueReminder) {
    setBusyId(r.id);
    try { await api(`/crm/reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) }); } catch { /* riprova al reload */ }
    setBusyId(null);
    void load();
  }
  async function reschedule(r: OverdueReminder) {
    const v = snooze[r.id];
    if (!v) return;
    setBusyId(r.id);
    try { await api(`/crm/reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ dueAt: new Date(v).toISOString() }) }); } catch { /* riprova */ }
    setBusyId(null);
    setSnooze((s) => ({ ...s, [r.id]: '' }));
    void load();
  }

  const fmt = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 4, color: '#b3261e' }}>
          <i className="ti ti-alarm" /> Appuntamenti scaduti da gestire
        </h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Hai {overdue.length} appuntamento/i di ricontatto <b>scaduti</b>. Per continuare a usare il
          backoffice segna ognuno come <b>Fatto</b> oppure <b>rimandalo</b> a una nuova data.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {overdue.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div className="spread" style={{ gap: 10 }}>
                <span>
                  <b style={{ fontSize: 14 }}>{r.title}</b>
                  {r.linkedName && <span className="muted" style={{ fontSize: 13 }}> · {r.linkedName}</span>}
                  {r.note && <div className="muted" style={{ fontSize: 12 }}>{r.note}</div>}
                </span>
                <span className="chip red" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>scaduto {fmt(r.dueAt)}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn sm" onClick={() => markDone(r)} disabled={busyId === r.id}>
                  <i className="ti ti-check" /> Fatto
                </button>
                <input className="input" type="datetime-local" style={{ width: 210 }}
                  value={snooze[r.id] ?? ''} onChange={(e) => setSnooze((s) => ({ ...s, [r.id]: e.target.value }))} />
                <button className="btn ghost sm" onClick={() => reschedule(r)} disabled={busyId === r.id || !snooze[r.id]}>
                  <i className="ti ti-clock-forward" /> Rimanda
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
