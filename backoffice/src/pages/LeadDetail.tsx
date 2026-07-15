import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

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
}
interface Coach { id: string; displayName: string }
interface CrmList { id: string; name: string; color: string | null; memberCount?: number }

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Scheda di un lead puro (senza account cliente) o della parte CRM di un cliente. */
export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, impersonate } = useAuth();
  const canAssignCoach = can('assign_coach', 'manage');

  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice('Dati salvati.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(stage: string) {
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

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <Link to="/crm/gestione" className="btn ghost sm"><i className="ti ti-arrow-left" /> Gestione lead</Link>
        {lead.clientId && (
          <div className="row" style={{ gap: 8 }}>
            <Link to={`/clienti/${lead.clientId}`} className="btn ghost sm"><i className="ti ti-user" /> Scheda cliente</Link>
            <button className="btn ghost sm" onClick={doImpersonate} title="Entra nell'app come questa cliente">
              <i className="ti ti-eye" /> Entra come
            </button>
          </div>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>{displayName}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {lead.client?.email ?? lead.email ?? '—'}
              {(lead.client?.phone ?? lead.phone) && <span> · {lead.client?.phone ?? lead.phone}</span>}
              {!lead.client && <span className="chip amber" style={{ marginLeft: 8, fontSize: 10 }}>lead</span>}
            </p>
            {lead.lists.length > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {lead.lists.map((l) => (
                  <span key={l.id} className="chip" style={{ fontSize: 11, borderColor: l.color ?? undefined, color: l.color ?? undefined }}>
                    <i className="ti ti-tag" style={{ fontSize: 12, marginRight: 3 }} />{l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }} className="muted">
            <div>Creato il {fmtDate(lead.createdAt)}</div>
            {lead.owner && <div>Responsabile: {lead.owner.displayName}</div>}
          </div>
        </div>

        <div className="row" style={{ gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Stato</label>
            <select className="select" style={{ borderColor: st?.color ?? undefined }} value={lead.stage} onChange={(e) => changeStage(e.target.value)}>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              {!st && <option value={lead.stage}>{lead.stage} (stato rimosso)</option>}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Coach</label>
            {canAssignCoach ? (
              <>
                <select className="select" value={lead.assignedCoachId ?? ''} onChange={(e) => assignCoach(e.target.value)} title="Assegna la coach (dovrà accettare entro 2 giorni)">
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
              <span style={{ paddingTop: 8 }}>{lead.assignedCoach?.displayName ?? lead.client?.clientProfile?.assignedCoach?.displayName ?? '—'}</span>
            )}
          </div>
          {lead.client?.clientProfile?.assignedNutritionist && (
            <div className="field" style={{ minWidth: 200 }}>
              <label>Nutrizionista</label>
              <span style={{ paddingTop: 8 }}>{lead.client.clientProfile.assignedNutritionist.displayName}</span>
            </div>
          )}
        </div>
      </div>

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
        <h2 style={{ marginTop: 0 }}>Dati del lead</h2>
        {lead.clientId ? (
          <p className="hint">
            Questo lead è diventato cliente: l'anagrafica si gestisce dalla <Link to={`/clienti/${lead.clientId}`}>scheda cliente</Link>. Qui puoi aggiornare il valore stimato.
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
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={saveInfo} disabled={saving}>
            <i className="ti ti-device-floppy" /> {saving ? 'Salvataggio…' : 'Salva'}
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
    </>
  );
}
