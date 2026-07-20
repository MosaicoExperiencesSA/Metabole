import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { fullName, shortDate, waLink } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, BackBar, Card, Section, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Stage { key: string; label: string }
interface LeadNote { id: string; body: string; createdAt: string; author: string | null }
interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  valueCents: number | null;
  assignedCoach?: { displayName: string | null } | null;
  notes?: LeadNote[];
}

/**
 * Scheda LEAD per la coach nell'app: dati di contatto, stato pipeline (cambiabile),
 * note. Stesse operazioni base del backoffice sul lead, dal telefono.
 */
export default function CoachLeadDetail() {
  const { id } = useParams();
  const state = useApi<Lead>(id ? `/crm/leads/${id}` : null);
  const stages = useApi<Stage[]>('/crm/stages');
  const [newNote, setNewNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeStage(stage: string) {
    if (!id) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api(`/crm/leads/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) });
      setMsg('Stato aggiornato.');
      state.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Cambio stato non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!id || !newNote.trim()) return;
    setErr(null);
    try {
      await api(`/crm/leads/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: newNote.trim() }) });
      setNewNote('');
      state.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Nota non salvata.');
    }
  }

  return (
    <StaffShell title="Scheda lead" tabs={COACH_TABS}>
      <BackBar label="Clienti" to="/clienti" />
      <Async state={state}>
        {(d) => {
          const name = d.name || fullName(null, null, d.email);
          return (
            <>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sf-row-name" style={{ fontSize: 16 }}>{name}</div>
                    <div className="sf-sub">{d.email ?? 'Nessuna email'}</div>
                  </div>
                </div>
                <div className="sf-acts">
                  {d.phone && (
                    <a className="sf-mini wa" href={waLink(d.phone)} target="_blank" rel="noreferrer">
                      <i className="ti ti-brand-whatsapp" /> WhatsApp
                    </a>
                  )}
                  {d.email && (
                    <a className="sf-mini b" href={`mailto:${d.email}`}>
                      <i className="ti ti-mail" /> Email
                    </a>
                  )}
                </div>
              </Card>

              {err && <Card><div style={{ color: '#B3261E', fontSize: 13 }}>{err}</div></Card>}
              {msg && <Card><div style={{ color: '#0E7C66', fontSize: 13 }}>{msg}</div></Card>}

              <Section title="Stato" />
              <Card>
                <Async state={stages}>
                  {(sts) => (
                    <select className="sf-inp" value={d.stage} disabled={busy} onChange={(e) => changeStage(e.target.value)}>
                      {sts.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  )}
                </Async>
              </Card>

              <Section title="Note" />
              <Card>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="sf-inp" style={{ flex: 1 }} placeholder="Aggiungi una nota…" value={newNote}
                    onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addNote(); }} />
                  <button className="sf-btn p" style={{ width: 'auto', padding: '0 14px' }} onClick={addNote} disabled={!newNote.trim()}>Aggiungi</button>
                </div>
                {(d.notes ?? []).length === 0 ? (
                  <p className="sf-sub" style={{ marginTop: 10 }}>Nessuna nota per ora.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {(d.notes ?? []).slice(0, 30).map((n) => (
                      <div key={n.id} style={{ background: '#F6F9F8', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 13, color: '#2E3E3B', lineHeight: 1.5 }}>{n.body}</div>
                        <div className="sf-sub" style={{ marginTop: 3 }}>{n.author ?? 'Staff'} · {shortDate(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          );
        }}
      </Async>
    </StaffShell>
  );
}
