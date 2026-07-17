import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';
import { ReminderCalendar } from '../components/ReminderCalendar';

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
  client: { email: string; phone: string | null; clientProfile: { name: string | null } | null } | null;
}

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Tipo di promemoria da registrare: telefonata, messaggio, mail (o generico).
const KIND: Record<string, { label: string; icon: string }> = {
  call: { label: 'Telefonata', icon: 'ti-phone' },
  message: { label: 'Messaggio', icon: 'ti-brand-whatsapp' },
  mail: { label: 'Email', icon: 'ti-mail' },
};

/** Numero per WhatsApp: solo cifre; se manca il prefisso internazionale si assume l'Italia (39). */
function waFrom(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^\d]/g, '');
  if (!d) return null;
  return d.startsWith('39') ? d : d.startsWith('0') ? '39' + d.replace(/^0+/, '') : '39' + d;
}

/** Azioni rapide di contatto (chiama / WhatsApp / email) per un lead collegato. */
function ContactActions({ phone, email }: { phone: string | null; email: string | null }) {
  const wa = waFrom(phone);
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="muted" style={{ fontSize: 12 }}>Contatta subito:</span>
      {phone ? (
        <a className="btn ghost sm" href={`tel:${phone}`} title={`Chiama ${phone}`} style={{ padding: '6px 10px' }}><i className="ti ti-phone" /></a>
      ) : (
        <button className="btn ghost sm" disabled title="Nessun telefono" style={{ padding: '6px 10px', opacity: 0.45 }}><i className="ti ti-phone" /></button>
      )}
      {wa ? (
        <a className="btn ghost sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" title="Scrivi su WhatsApp" style={{ padding: '6px 10px', color: '#25D366' }}><i className="ti ti-brand-whatsapp" /></a>
      ) : (
        <button className="btn ghost sm" disabled title="Nessun telefono" style={{ padding: '6px 10px', opacity: 0.45 }}><i className="ti ti-brand-whatsapp" /></button>
      )}
      {email ? (
        <a className="btn ghost sm" href={`mailto:${email}`} title={`Scrivi a ${email}`} style={{ padding: '6px 10px' }}><i className="ti ti-mail" /></a>
      ) : (
        <button className="btn ghost sm" disabled title="Nessuna email" style={{ padding: '6px 10px', opacity: 0.45 }}><i className="ti ti-mail" /></button>
      )}
    </div>
  );
}

/** Valore per <input type="datetime-local"> dal timestamp ISO (in ora locale). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Calendar() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);

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

  // Anagrafica lead per risolvere i contatti (telefono/email) del promemoria.
  // NB: /crm/leads è paginato lato server ({ rows, total }): si leggono le rows
  // (ultimi 500 lead). Robusto anche al vecchio formato array.
  useEffect(() => {
    api<{ rows?: LeadOption[] } | LeadOption[]>('/crm/leads?pageSize=500')
      .then((r) => setLeads(Array.isArray(r) ? r : (r.rows ?? [])))
      .catch(() => setLeads([]));
  }, []);

  function contactFor(r: Reminder): { phone: string | null; email: string | null } {
    const lead = r.crmRecordId ? leads.find((l) => l.id === r.crmRecordId) : null;
    return { phone: lead?.client?.phone ?? null, email: lead?.client?.email ?? lead?.email ?? null };
  }

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

  function Row({ r }: { r: Reminder }) {
    const late = !r.done && new Date(r.dueAt).getTime() < now;
    return (
      <div className="row" style={{ gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
        <button className={`toggle ${r.done ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); void toggle(r); }} title={r.done ? 'Fatto' : 'Segna come fatto'} style={{ marginTop: 2 }} />
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditing(r)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(r); } }}
          style={{ flex: 1, opacity: r.done ? 0.55 : 1, cursor: 'pointer' }}
          title="Apri per modificare, spostare o contattare"
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</b>
            <span className={`chip ${late ? 'red' : 'gray'}`} style={{ fontSize: 11 }}>{timeLabel(r.dueAt)}</span>
            {r.linkedName && <span className="chip" style={{ fontSize: 11 }}><i className="ti ti-user" /> {r.linkedName}</span>}
          </div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{r.note}</div>}
        </div>
        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); void remove(r); }} title="Elimina"><i className="ti ti-trash" /></button>
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

      {reminders.length > 0 && (
        <div className="card">
          <ReminderCalendar reminders={reminders} renderItem={(r) => <Row r={r as Reminder} />} persistKey="metabole_cal_view" />
        </div>
      )}

      {showCreate && (
        <CreateReminderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}

      {editing && (
        <EditReminderModal
          reminder={editing}
          contact={contactFor(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
          onDeleted={() => { setEditing(null); void load(); }}
        />
      )}
    </>
  );
}

function EditReminderModal({
  reminder,
  contact,
  onClose,
  onSaved,
  onDeleted,
}: {
  reminder: Reminder;
  contact: { phone: string | null; email: string | null };
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [dueAt, setDueAt] = useState(toLocalInput(reminder.dueAt));
  const [note, setNote] = useState(reminder.note ?? '');
  const [done, setDone] = useState(reminder.done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (title.trim().length < 2) { setError('Dai un titolo al promemoria.'); return; }
    if (!dueAt) { setError('Scegli data e ora.'); return; }
    setBusy(true);
    try {
      await api(`/crm/reminders/${reminder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim(), dueAt: new Date(dueAt).toISOString(), note: note.trim() || undefined, done }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Eliminare il promemoria "${reminder.title}"?`)) return;
    setBusy(true);
    try {
      await api(`/crm/reminders/${reminder.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Promemoria" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {reminder.linkedName && (
        <div className="field">
          <label>Cliente/lead collegato</label>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="chip"><i className="ti ti-user" /> {reminder.linkedName}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ContactActions phone={contact.phone} email={contact.email} />
          </div>
        </div>
      )}
      <div className="field">
        <label>Titolo</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Data e ora (sposta il promemoria)</label>
        <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <div className="field">
        <label>Note</label>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <label className="row" style={{ gap: 8, fontSize: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
        Completato
      </label>
      <div className="spread" style={{ marginTop: 14 }}>
        <button className="btn ghost danger" onClick={del} disabled={busy} title="Elimina promemoria"><i className="ti ti-trash" /> Elimina</button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
        </div>
      </div>
    </Modal>
  );
}

function CreateReminderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('');
  const [crmRecordId, setCrmRecordId] = useState('');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // /crm/leads è paginato ({ rows, total }): il selettore mostra gli ultimi 500 lead.
    api<{ rows?: LeadOption[] } | LeadOption[]>('/crm/leads?pageSize=500')
      .then((r) => setLeads(Array.isArray(r) ? r : (r.rows ?? [])))
      .catch(() => setLeads([]));
  }, []);

  function leadName(l: LeadOption) {
    return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
  }

  const selectedLead = leads.find((l) => l.id === crmRecordId) ?? null;
  const leadEmail = selectedLead ? (selectedLead.client?.email ?? selectedLead.email ?? null) : null;
  const leadPhone = selectedLead?.client?.phone ?? null;

  async function submit() {
    setError(null);
    if (title.trim().length < 2) { setError('Dai un titolo al promemoria.'); return; }
    if (!dueAt) { setError('Scegli data e ora.'); return; }
    setBusy(true);
    try {
      const finalTitle = kind ? `${KIND[kind].label} · ${title.trim()}` : title.trim();
      await api('/crm/reminders', {
        method: 'POST',
        body: JSON.stringify({ title: finalTitle, dueAt: new Date(dueAt).toISOString(), note: note.trim() || undefined, crmRecordId: crmRecordId || undefined }),
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
        <label>Tipo (facoltativo)</label>
        <div className="row" style={{ gap: 8 }}>
          {Object.entries(KIND).map(([k, v]) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                className={`btn ${on ? '' : 'ghost'} sm`}
                onClick={() => { setKind(on ? '' : k); if (!on && !title.trim()) setTitle(v.label); }}
                title={`Registra: ${v.label}`}
              >
                <i className={`ti ${v.icon}`} /> {v.label}
              </button>
            );
          })}
        </div>
      </div>
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
        {selectedLead && (
          <div style={{ marginTop: 8 }}>
            <ContactActions phone={leadPhone} email={leadEmail} />
          </div>
        )}
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
