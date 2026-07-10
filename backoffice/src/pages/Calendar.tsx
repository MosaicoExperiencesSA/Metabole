import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  note: string | null;
  done: boolean;
  crmRecordId: string | null;
  linkedName: string | null;
}
interface LeadOption {
  id: string;
  name: string | null;
  email: string | null;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff === -1) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export function Calendar() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setReminders(await api<Reminder[]>(`/crm/reminders?includeDone=${showDone}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDone]);

  async function toggle(r: Reminder) {
    setReminders((rs) => rs.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/crm/reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ done: !r.done }) });
      if (!showDone) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
      await load();
    }
  }

  async function remove(r: Reminder) {
    if (!confirm(`Eliminare il promemoria "${r.title}"?`)) return;
    try {
      await api(`/crm/reminders/${r.id}`, { method: 'DELETE' });
      setReminders((rs) => rs.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const now = Date.now();
  const overdue = reminders.filter((r) => !r.done && new Date(r.dueAt).getTime() < now);
  const upcoming = reminders.filter((r) => r.done || new Date(r.dueAt).getTime() >= now);
  const byDay = new Map<string, Reminder[]>();
  for (const r of upcoming) {
    const k = startOfDay(new Date(r.dueAt)).toISOString();
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(r);
  }
  const days = [...byDay.keys()].sort();

  function Row({ r }: { r: Reminder }) {
    const late = !r.done && new Date(r.dueAt).getTime() < now;
    return (
      <div className="row" style={{ gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
        <button className={`toggle ${r.done ? 'on' : ''}`} onClick={() => toggle(r)} title={r.done ? 'Fatto' : 'Segna come fatto'} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, opacity: r.done ? 0.55 : 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</b>
            <span className={`chip ${late ? 'red' : 'gray'}`} style={{ fontSize: 11 }}>{timeLabel(r.dueAt)}</span>
            {r.linkedName && <span className="chip" style={{ fontSize: 11 }}><i className="ti ti-user" /> {r.linkedName}</span>}
          </div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{r.note}</div>}
        </div>
        <button className="btn ghost sm" onClick={() => remove(r)} title="Elimina"><i className="ti ti-trash" /></button>
      </div>
    );
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <label className="row" style={{ gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Mostra completati
        </label>
        <button className="btn" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus" /> Nuovo promemoria
        </button>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      {reminders.length === 0 && (
        <div className="card"><div className="empty">Nessun promemoria. Creane uno con "Nuovo promemoria".</div></div>
      )}

      {overdue.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <h2 style={{ color: 'var(--coral-dark)' }}>In ritardo ({overdue.length})</h2>
          {overdue.map((r) => <Row key={r.id} r={r} />)}
        </div>
      )}

      {days.map((k) => (
        <div className="card" key={k}>
          <h2 style={{ textTransform: 'capitalize' }}>{dayLabel(new Date(k))}</h2>
          {byDay.get(k)!.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((r) => <Row key={r.id} r={r} />)}
        </div>
      ))}

      {showCreate && (
        <CreateReminderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}
    </>
  );
}

function CreateReminderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [crmRecordId, setCrmRecordId] = useState('');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LeadOption[]>('/crm/leads').then(setLeads).catch(() => setLeads([]));
  }, []);

  function leadName(l: LeadOption) {
    return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
  }

  async function submit() {
    setError(null);
    if (title.trim().length < 2) { setError('Dai un titolo al promemoria.'); return; }
    if (!dueAt) { setError('Scegli data e ora.'); return; }
    setBusy(true);
    try {
      await api('/crm/reminders', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), dueAt: new Date(dueAt).toISOString(), note: note.trim() || undefined, crmRecordId: crmRecordId || undefined }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo promemoria" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Titolo</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Richiamare per il rinnovo" autoFocus />
      </div>
      <div className="field">
        <label>Data e ora</label>
        <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <div className="field">
        <label>Cliente/lead collegato (facoltativo)</label>
        <select className="select" value={crmRecordId} onChange={(e) => setCrmRecordId(e.target.value)}>
          <option value="">— Nessuno —</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>{leadName(l)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Note (facoltative)</label>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !title.trim() || !dueAt}>{busy ? 'Salvo…' : 'Crea promemoria'}</button>
      </div>
    </Modal>
  );
}
