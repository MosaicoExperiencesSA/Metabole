import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import { AppointmentModal, isRecallStage } from '../components/RecallGuard';

interface Stage {
  key: string;
  label: string;
  color: string | null;
  order: number;
}
interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  note: string | null;
  done: boolean;
}
interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  author: string | null;
}
interface LeadDetailData {
  id: string;
  clientId: string | null;
  email: string | null;
  name: string | null;
  stage: string;
  stageDates: Record<string, { at?: string; byUserId?: string | null; meta?: { source?: string; message?: string; channel?: string } }>;
  valueCents: number | null;
  createdAt: string;
  owner: { displayName: string } | null;
  assignedCoachId: string | null;
  assignedCoach: { id: string; displayName: string } | null;
  assignmentStatus: string | null;
  phone: string | null;
  previousStatus: string | null;
  historicalPaidCents: number | null;
  codiceFiscale: string | null;
  address: string | null;
  tags: string[];
  lists: CrmList[];
  client: {
    email: string;
    phone: string | null;
    createdAt: string;
    clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionist: { displayName: string } | null } | null;
  } | null;
  reminders: Reminder[];
  notes?: LeadNote[];
}
interface Coach { id: string; displayName: string }
interface CrmList { id: string; name: string; color: string | null; memberCount?: number }

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const euro = (cents?: number | null) => (cents != null ? `${(cents / 100).toLocaleString('it-IT')} €` : '—');

/** Riga etichetta/valore in stile scheda cliente. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="spread" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5, gap: 16 }}>
      <span className="muted" style={{ flex: 'none' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/**
 * Scheda LEAD con la stessa struttura della scheda cliente: intestazione verde con
 * Modifica/Salva, stato e assegnazione, NOTE dello staff (editor + storico), dati in
 * lettura con modifica a scheda intera, liste, promemoria e storico stati.
 */
export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, impersonate, user } = useAuth();
  const canAssignCoach = can('assign_coach', 'manage');
  const isAdmin = user?.role === 'admin';

  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Campi modificabili (solo lead puro: l'anagrafica del cliente vive nella scheda cliente)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [valueEuro, setValueEuro] = useState('');
  const [prevStatus, setPrevStatus] = useState('');
  const [histPaidEuro, setHistPaidEuro] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  // Note dello staff (come scheda cliente)
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Liste CRM
  const [allLists, setAllLists] = useState<CrmList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [listBusy, setListBusy] = useState(false);

  // Nuovo promemoria
  const [remTitle, setRemTitle] = useState('');
  const [remDue, setRemDue] = useState('');
  const [addingRem, setAddingRem] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [l, st, lists] = await Promise.all([
        api<LeadDetailData>(`/crm/leads/${id}`),
        api<Stage[]>('/crm/stages'),
        api<CrmList[]>('/crm/lists').catch(() => [] as CrmList[]),
      ]);
      setLead(l);
      setStages(st);
      setAllLists(lists);
      setNotes(l.notes ?? []);
      setName(l.name ?? '');
      setEmail(l.email ?? '');
      setValueEuro(l.valueCents != null ? String(l.valueCents / 100) : '');
      setPrevStatus(l.previousStatus ?? '');
      setHistPaidEuro(l.historicalPaidCents != null ? String(l.historicalPaidCents / 100) : '');
      setCodiceFiscale(l.codiceFiscale ?? '');
      setAddress(l.address ?? '');
      setTags(l.tags ?? []);
      if (canAssignCoach) { try { setCoaches(await api<Coach[]>('/crm/coaches')); } catch { /* elenco coach opzionale */ } }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function saveInfo() {
    if (!lead) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const valueCents = valueEuro.trim() === '' ? undefined : Math.round(Number(valueEuro.replace(',', '.')) * 100);
      if (valueCents !== undefined && (!Number.isFinite(valueCents) || valueCents < 0)) {
        setError('Valore non valido.');
        return;
      }
      const histCents = histPaidEuro.trim() === '' ? null : Math.round(Number(histPaidEuro.replace(',', '.')) * 100);
      if (histCents !== null && (!Number.isFinite(histCents) || histCents < 0)) {
        setError('Totale storico non valido.');
        return;
      }
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        previousStatus: prevStatus.trim(),
        historicalPaidCents: histCents,
        codiceFiscale: codiceFiscale.trim(),
        address: address.trim(),
        tags,
      };
      if (valueCents !== undefined) body.valueCents = valueCents;
      const updated = await api<LeadDetailData>(`/crm/leads/${lead.id}/info`, { method: 'PATCH', body: JSON.stringify(body) });
      setLead({ ...lead, name: updated.name, email: updated.email, valueCents: updated.valueCents, previousStatus: updated.previousStatus, historicalPaidCents: updated.historicalPaidCents, codiceFiscale: updated.codiceFiscale, address: updated.address, tags: updated.tags });
      setEditing(false);
      setNotice('Scheda aggiornata.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!lead || !newNote.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      const created = await api<LeadNote>(`/crm/leads/${lead.id}/notes`, { method: 'POST', body: JSON.stringify({ body: newNote.trim() }) });
      setNotes((ns) => [created, ...ns]);
      setNewNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio della nota non riuscito.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!lead) return;
    // eslint-disable-next-line no-alert
    if (!confirm('Eliminare questa nota?')) return;
    try {
      await api(`/crm/leads/${lead.id}/notes/${noteId}`, { method: 'DELETE' });
      setNotes((ns) => ns.filter((n) => n.id !== noteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  // Cambio verso "da ricontattare": prima si fissa l'appuntamento (obbligatorio).
  const [pendingRecall, setPendingRecall] = useState<{ stage: string; stageLabel: string } | null>(null);

  async function changeStage(stage: string) {
    if (!lead) return;
    const stageObj = stages.find((s) => s.key === stage) ?? null;
    if (isRecallStage(stageObj)) {
      setPendingRecall({ stage, stageLabel: stageObj?.label ?? stage });
      return; // il cambio avviene solo dopo la conferma dell'appuntamento
    }
    await doChangeStage(stage);
  }

  async function doChangeStage(stage: string) {
    if (!lead) return;
    setError(null);
    try {
      await api(`/crm/leads/${lead.id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) });
      setLead({ ...lead, stage, stageDates: { ...lead.stageDates, [stage]: { at: new Date().toISOString() } } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function assignCoach(coachStaffId: string) {
    if (!lead || !coachStaffId) return;
    setError(null);
    try {
      await api(`/crm/leads/${lead.id}/assign-coach`, { method: 'POST', body: JSON.stringify({ coachStaffId }) });
      const coach = coaches.find((c) => c.id === coachStaffId) ?? null;
      setLead({ ...lead, assignedCoachId: coachStaffId, assignedCoach: coach, assignmentStatus: 'pending' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  async function addReminder() {
    if (!lead || !remTitle.trim() || !remDue) return;
    setAddingRem(true);
    setError(null);
    try {
      await api('/crm/reminders', {
        method: 'POST',
        body: JSON.stringify({ title: remTitle.trim(), dueAt: new Date(remDue).toISOString(), crmRecordId: lead.id }),
      });
      setRemTitle('');
      setRemDue('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promemoria non creato.');
    } finally {
      setAddingRem(false);
    }
  }

  async function toggleReminder(r: Reminder) {
    if (!lead) return;
    try {
      await api(`/crm/reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ done: !r.done }) });
      setLead({ ...lead, reminders: lead.reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggiornamento non riuscito.');
    }
  }

  // Attiva/disattiva l'appartenenza del lead a una lista (set = rimpiazza).
  async function toggleList(listId: string) {
    if (!lead) return;
    setListBusy(true);
    setError(null);
    try {
      const current = new Set(lead.lists.map((l) => l.id));
      if (current.has(listId)) current.delete(listId);
      else current.add(listId);
      const updated = await api<LeadDetailData>(`/crm/leads/${lead.id}/lists`, { method: 'POST', body: JSON.stringify({ listIds: [...current] }) });
      setLead({ ...lead, lists: updated.lists });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggiornamento liste non riuscito.');
    } finally {
      setListBusy(false);
    }
  }

  // Crea una nuova lista e ci aggiunge subito il lead.
  async function createAndAddList() {
    if (!lead || !newListName.trim()) return;
    setListBusy(true);
    setError(null);
    try {
      const created = await api<CrmList>('/crm/lists', { method: 'POST', body: JSON.stringify({ name: newListName.trim() }) });
      setAllLists((ls) => [...ls, created].sort((a, b) => a.name.localeCompare(b.name)));
      const ids = [...new Set([...lead.lists.map((l) => l.id), created.id])];
      const updated = await api<LeadDetailData>(`/crm/leads/${lead.id}/lists`, { method: 'POST', body: JSON.stringify({ listIds: ids }) });
      setLead({ ...lead, lists: updated.lists });
      setNewListName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione lista non riuscita.');
    } finally {
      setListBusy(false);
    }
  }

  async function doImpersonate() {
    if (!lead?.clientId) return;
    setError(null);
    try {
      await impersonate(lead.clientId, lead.client?.email ?? lead.email ?? '');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonazione non riuscita.');
    }
  }

  if (loading) return <Spinner />;
  if (!lead) return <Banner kind="err">{error ?? 'Lead non trovato.'}</Banner>;

  const displayName = lead.client?.clientProfile?.name ?? lead.name ?? lead.client?.email ?? lead.email ?? 'Senza nome';
  const st = stages.find((s) => s.key === lead.stage);
  const history = Object.entries(lead.stageDates ?? {})
    .map(([key, v]) => ({ key, at: v?.at, byUserId: v?.byUserId, meta: v?.meta }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const leadEmail = lead.client?.email ?? lead.email;
  const leadPhone = lead.client?.phone ?? lead.phone;

  return (
    <>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <i className="ti ti-arrow-left" /> Indietro
      </button>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Intestazione — stessa grafica della scheda cliente */}
      <div className="card" style={{ background: 'linear-gradient(120deg,#10403a,#12a386)', color: '#fff', border: 'none' }}>
        <div className="spread">
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, margin: 0 }}>{displayName}</h2>
            {leadEmail && <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{leadEmail}</p>}
            {leadPhone && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-phone" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {leadPhone}</p>}
            {lead.address && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {lead.address}</p>}
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                CRM: {st?.label ?? lead.stage}
              </span>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {lead.client ? 'Cliente registrato' : 'Lead'}
              </span>
              {(lead.historicalPaidCents ?? 0) > 0 && (
                <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Storico: {euro(lead.historicalPaidCents)}</span>
              )}
              {lead.lists.map((l) => (
                <span key={l.id} className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 11 }}>
                  <i className="ti ti-tag" style={{ fontSize: 12, marginRight: 3 }} />{l.name}
                </span>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!editing ? (
              <button className="btn ghost" onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-edit" /> Modifica
              </button>
            ) : (
              <>
                <button className="btn" onClick={saveInfo} disabled={saving} style={{ background: '#fff', color: '#0e7c66' }}>
                  <i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}
                </button>
                <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving} style={{ background: 'rgba(255,255,255,.9)' }}>Annulla</button>
              </>
            )}
            {lead.clientId && !editing && (
              <>
                <Link to={`/clienti/${lead.clientId}`} className="btn ghost" style={{ background: 'rgba(255,255,255,.9)' }}>
                  <i className="ti ti-user" /> Scheda cliente
                </Link>
                <button className="btn ghost" onClick={doImpersonate} title="Entra nell'app come questa cliente" style={{ background: 'rgba(255,255,255,.9)' }}>
                  <i className="ti ti-eye" /> Entra come
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stato e assegnazione — come "Team assegnato" della scheda cliente */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Stato e assegnazione</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Stato</div>
            <select className="select" style={{ width: '100%', borderColor: st?.color ?? undefined }} value={lead.stage} onChange={(e) => changeStage(e.target.value)}>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              {!st && <option value={lead.stage}>{lead.stage} (stato rimosso)</option>}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Coach</div>
            {canAssignCoach ? (
              <>
                <select className="select" style={{ width: '100%' }} value={lead.assignedCoachId ?? ''} onChange={(e) => assignCoach(e.target.value)} title="Assegna la coach (dovrà accettare entro 2 giorni)">
                  <option value="">— assegna —</option>
                  {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                  {lead.assignedCoachId && !coaches.some((c) => c.id === lead.assignedCoachId) && (
                    <option value={lead.assignedCoachId}>{lead.assignedCoach?.displayName ?? 'Coach'}</option>
                  )}
                </select>
                {lead.assignmentStatus === 'pending' && <span className="chip amber" style={{ fontSize: 10, marginTop: 4 }}>in attesa di accettazione</span>}
                {lead.assignmentStatus === 'accepted' && <span className="chip" style={{ fontSize: 10, marginTop: 4 }}>accettato</span>}
              </>
            ) : (
              <b>{lead.assignedCoach?.displayName ?? lead.client?.clientProfile?.assignedCoach?.displayName ?? '—'}</b>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nutrizionista</div>
            <b>{lead.client?.clientProfile?.assignedNutritionist?.displayName ?? '—'}</b>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Responsabile</div>
            <b>{lead.owner?.displayName ?? '—'}</b>
          </div>
        </div>
      </div>

      {/* Note dello staff: editor a sinistra, storico a destra — come la scheda cliente */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Note</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
              placeholder="Scrivi una nota su questo contatto: telefonate, accordi, preferenze…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                <i className="ti ti-device-floppy" /> {savingNote ? 'Salvataggio…' : 'Salva nota'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Storico note</div>
            {notes.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna nota ancora.</p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                    {isAdmin && (
                      <button
                        onClick={() => deleteNote(n.id)}
                        title="Elimina nota"
                        style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', paddingRight: isAdmin ? 20 : 0 }}>{n.body}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {n.author ?? 'Staff'} · {fmtDateTime(n.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dati: lettura come la scheda cliente; "Modifica" apre la scheda campi */}
      {!editing ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Dati del contatto</h2>
          {lead.clientId && (
            <p className="hint" style={{ marginTop: 0 }}>
              Questo contatto è diventato cliente: l'anagrafica completa si gestisce dalla <Link to={`/clienti/${lead.clientId}`}>scheda cliente</Link>.
            </p>
          )}
          <Row label="Nome" value={displayName} />
          <Row label="Email" value={leadEmail ?? '—'} />
          <Row label="Telefono" value={leadPhone ?? '—'} />
          <Row label="Valore stimato" value={euro(lead.valueCents)} />
          <Row label="Stato precedente (storico)" value={lead.previousStatus ?? '—'} />
          <Row label="Totale già pagato (storico)" value={euro(lead.historicalPaidCents)} />
          <Row label="Codice fiscale" value={lead.codiceFiscale ?? '—'} />
          <Row label="Indirizzo" value={lead.address ?? '—'} />
          <Row label="Etichette" value={lead.tags.length ? lead.tags.join(', ') : '—'} />
          <Row label="Creato il" value={fmtDate(lead.createdAt)} />
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Modifica scheda</h2>
          {lead.clientId ? (
            <p className="hint">
              Questo lead è diventato cliente: l'anagrafica si gestisce dalla <Link to={`/clienti/${lead.clientId}`}>scheda cliente</Link>. Qui puoi aggiornare il valore stimato e i dati storici.
            </p>
          ) : (
            <p className="hint">Contatto non ancora registrato: puoi correggere nome, email e valore stimato.</p>
          )}
          <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
            {!lead.clientId && (
              <>
                <div className="field" style={{ minWidth: 200 }}>
                  <label>Nome</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Anna Bianchi" />
                </div>
                <div className="field" style={{ minWidth: 220 }}>
                  <label>Email</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.com" />
                </div>
              </>
            )}
            <div className="field" style={{ maxWidth: 160 }}>
              <label>Valore stimato (€)</label>
              <input className="input" inputMode="decimal" value={valueEuro} onChange={(e) => setValueEuro(e.target.value)} placeholder="Es. 290" />
            </div>
          </div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label>Stato precedente (storico)</label>
              <input className="input" value={prevStatus} onChange={(e) => setPrevStatus(e.target.value)} placeholder="Es. Cliente 2023, disdetto" />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label>Totale già pagato (storico €)</label>
              <input className="input" inputMode="decimal" value={histPaidEuro} onChange={(e) => setHistPaidEuro(e.target.value)} placeholder="Es. 1490" />
            </div>
          </div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Codice fiscale</label>
              <input className="input" value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501U" maxLength={20} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="field" style={{ minWidth: 260, flex: 1 }}>
              <label>Indirizzo</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via Roma 1, Milano" maxLength={200} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 4 }}>
            <label>Etichette (per la segmentazione marketing)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              {tags.map((t) => (
                <span key={t} className="chip" style={{ gap: 4 }}>{t}<i className="ti ti-x" style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => setTags((ts) => ts.filter((x) => x !== t))} /></span>
              ))}
              <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = newTag.trim(); if (v && !tags.includes(v)) setTags((ts) => [...ts, v]); setNewTag(''); } }}
                placeholder="aggiungi etichetta + Invio" style={{ width: 200 }} maxLength={40} />
            </div>
          </div>
          <p className="hint">I campi "storico" arrivano dalle liste importate (esperienze precedenti del cliente): sono solo informativi, non entrano nella contabilità Metabole. Codice fiscale e indirizzo servono per fatturazione/spedizione.</p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving}>Annulla</button>
            <button className="btn" onClick={saveInfo} disabled={saving}>
              <i className="ti ti-device-floppy" /> {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Liste</h2>
        <p className="hint">Raggruppa questo contatto in una o più liste. Le liste servono a filtrare le viste CRM.</p>
        {allLists.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nessuna lista ancora. Creane una qui sotto.</p>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {allLists.map((l) => {
              const on = lead.lists.some((x) => x.id === l.id);
              return (
                <button
                  key={l.id}
                  className={`chip ${on ? '' : 'gray'}`}
                  disabled={listBusy}
                  onClick={() => toggleList(l.id)}
                  style={{ cursor: 'pointer', borderColor: on ? l.color ?? undefined : undefined, color: on ? l.color ?? undefined : undefined }}
                  title={on ? 'Rimuovi dalla lista' : 'Aggiungi alla lista'}
                >
                  <i className={`ti ${on ? 'ti-check' : 'ti-plus'}`} style={{ fontSize: 12, marginRight: 3 }} />{l.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Nuova lista</label>
            <input className="input" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Es. Clienti storici 2024" onKeyDown={(e) => { if (e.key === 'Enter') createAndAddList(); }} />
          </div>
          <button className="btn ghost" onClick={createAndAddList} disabled={listBusy || !newListName.trim()} style={{ marginBottom: 14 }}>
            <i className="ti ti-plus" /> Crea e aggiungi
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Promemoria</h2>
        {lead.reminders.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nessun promemoria per questo lead.</p>
        ) : (
          <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
            {lead.reminders.map((r) => (
              <label key={r.id} className="spread" style={{ fontSize: 13.5, padding: '7px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer', gap: 10 }}>
                <span className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={r.done} onChange={() => toggleReminder(r)} />
                  <span style={{ textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.6 : 1 }}>
                    <b style={{ fontWeight: 600 }}>{r.title}</b>
                    {r.note && <span className="muted"> · {r.note}</span>}
                  </span>
                </span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.dueAt)}</span>
              </label>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Nuovo promemoria</label>
            <input className="input" value={remTitle} onChange={(e) => setRemTitle(e.target.value)} placeholder="Es. Richiamare per il piano 3 mesi" />
          </div>
          <div className="field">
            <label>Quando</label>
            <input className="input" type="datetime-local" value={remDue} onChange={(e) => setRemDue(e.target.value)} />
          </div>
          <button className="btn ghost" onClick={addReminder} disabled={addingRem || !remTitle.trim() || !remDue} style={{ marginBottom: 14 }}>
            <i className="ti ti-plus" /> Aggiungi
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Storico stati</h2>
        {history.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nessun passaggio registrato.</p>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {history.map((h) => {
              const hs = stages.find((s) => s.key === h.key);
              return (
                <div key={h.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
                  <div className="spread">
                    <span>
                      <span className="chip" style={{ fontSize: 11, borderColor: hs?.color ?? undefined }}>{hs?.label ?? h.key}</span>
                    </span>
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</span>
                  </div>
                  {h.meta?.message && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Messaggio: {h.meta.message}</div>}
                  {h.meta?.source && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Fonte: {h.meta.source}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {pendingRecall && lead && (
        <AppointmentModal
          leadName={displayName}
          stageLabel={pendingRecall.stageLabel}
          onCancel={() => setPendingRecall(null)}
          onConfirm={async (title, dueAtIso, note) => {
            await api('/crm/reminders', { method: 'POST', body: JSON.stringify({ title, dueAt: dueAtIso, note: note || undefined, crmRecordId: lead.id }) });
            const { stage } = pendingRecall;
            setPendingRecall(null);
            await doChangeStage(stage);
            await load(); // aggiorna anche i promemoria in scheda
          }}
        />
      )}
    </>
  );
}
