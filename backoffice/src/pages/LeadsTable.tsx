import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';

interface Stage {
  key: string;
  label: string;
  color: string | null;
  order: number;
}
interface Lead {
  id: string;
  clientId: string | null;
  email: string | null;
  name: string | null;
  stage: string;
  valueCents: number | null;
  historicalPaidCents: number | null;
  createdAt: string;
  owner: { displayName: string } | null;
  assignedCoachId: string | null;
  assignedCoach: { id: string; displayName: string } | null;
  assignmentStatus: string | null; // pending | accepted
  phone: string | null;
  lists: CrmList[];
  client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionistId: string | null; assignedNutritionist: { id: string; displayName: string } | null } | null } | null;
}
interface Coach { id: string; displayName: string }
interface CrmList { id: string; name: string; color: string | null; memberCount?: number }

function euro(cents: number | null): string {
  return cents == null ? '—' : '€ ' + (cents / 100).toFixed(2).replace('.', ',');
}
function parseEuro(v: string): number | null { const n = parseFloat(v.replace(',', '.')); return v.trim() && !isNaN(n) ? Math.round(n * 100) : null; }
function displayName(l: Lead): string {
  return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
}
// Classificazione persona coerente col marketing: cliente attivo, cliente storico (pre-Metabole) o lead.
function classify(l: Lead): { label: string; chip: string; title: string } {
  if (l.stage === 'paid') return { label: 'Cliente', chip: '', title: 'Cliente attivo Metabole' };
  if ((l.historicalPaidCents ?? 0) > 0) return { label: 'Storico', chip: 'violet', title: 'Cliente storico (pagamenti pre-Metabole)' };
  return { label: 'Lead', chip: 'amber', title: 'Lead: nessun pagamento registrato' };
}

export function LeadsTable() {
  const { impersonate, can } = useAuth();
  const canAssignCoach = can('assign_coach', 'manage');
  const canAssignNutri = can('assign_nutritionist', 'manage');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [nutritionists, setNutritionists] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [allLists, setAllLists] = useState<CrmList[]>([]);
  const [listFilter, setListFilter] = useState(''); // '' = tutte
  const [showLists, setShowLists] = useState(false);
  // Assegnazione massiva: id selezionati + coach scelta nella barra.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCoach, setBulkCoach] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  const prevQkey = useRef('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  // Filtri per colonna (in AND fra loro e con ricerca/etichetta).
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fStage, setFStage] = useState('');
  const [fCoach, setFCoach] = useState(''); // '' tutti · 'none' non assegnato · else coachId
  const [fNutri, setFNutri] = useState(''); // '' tutti · 'none' non assegnato · else nutriId
  const [fTipo, setFTipo] = useState(''); // '' · client · historical · lead
  const [fValMin, setFValMin] = useState('');
  const [fValMax, setFValMax] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  function clearFilters() {
    setFilter(''); setListFilter(''); setFName(''); setFEmail(''); setFStage(''); setFCoach(''); setFNutri(''); setFTipo('');
    setFValMin(''); setFValMax(''); setFDateFrom(''); setFDateTo(''); setPage(0);
  }
  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  async function assignCoach(l: Lead, coachStaffId: string) {
    if (!coachStaffId) return;
    setError(null);
    try {
      await api(`/crm/leads/${l.id}/assign-coach`, { method: 'POST', body: JSON.stringify({ coachStaffId }) });
      const coach = coaches.find((c) => c.id === coachStaffId) ?? null;
      setLeads((ls) => ls.map((x) => (x.id === l.id ? { ...x, assignedCoachId: coachStaffId, assignmentStatus: 'pending', assignedCoach: coach } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  async function assignNutritionist(l: Lead, nutritionistStaffId: string) {
    setError(null);
    try {
      await api(`/crm/leads/${l.id}/assign-nutritionist`, { method: 'POST', body: JSON.stringify({ nutritionistStaffId }) });
      const nutri = nutritionists.find((n) => n.id === nutritionistStaffId) ?? null;
      setLeads((ls) => ls.map((x) => (x.id === l.id && x.client?.clientProfile
        ? { ...x, client: { ...x.client, clientProfile: { ...x.client.clientProfile, assignedNutritionistId: nutritionistStaffId || null, assignedNutritionist: nutri } } }
        : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    setSelected((prev) => {
      const allSel = leads.length > 0 && leads.every((l) => prev.has(l.id));
      const n = new Set(prev);
      if (allSel) leads.forEach((l) => n.delete(l.id));
      else leads.forEach((l) => n.add(l.id));
      return n;
    });
  }
  async function bulkAssign() {
    const recordIds = leads.filter((l) => selected.has(l.id)).map((l) => l.id);
    if (!bulkCoach || recordIds.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await api<{ assigned: number }>('/crm/leads/assign-coach-bulk', {
        method: 'POST',
        body: JSON.stringify({ coachStaffId: bulkCoach, recordIds }),
      });
      const coach = coaches.find((c) => c.id === bulkCoach) ?? null;
      const idset = new Set(recordIds);
      setLeads((ls) => ls.map((x) => (idset.has(x.id) ? { ...x, assignedCoachId: bulkCoach, assignmentStatus: 'pending', assignedCoach: coach } : x)));
      setSelected(new Set());
      setBulkCoach('');
      setOkMsg(`${res.assigned} lead assegnati a ${coach?.displayName ?? 'coach'}. La coach deve accettarli entro 2 giorni.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione massiva non riuscita.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function doImpersonate(l: Lead) {
    if (!l.clientId) return;
    setError(null);
    try {
      await impersonate(l.clientId, l.client?.email ?? l.email ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonazione non riuscita.');
    }
  }

  async function load() {
    try {
      const [st, lists] = await Promise.all([
        api<Stage[]>('/crm/stages'),
        api<CrmList[]>('/crm/lists').catch(() => [] as CrmList[]),
      ]);
      setStages(st);
      setAllLists(lists);
      if (canAssignCoach) { try { setCoaches(await api<Coach[]>('/crm/coaches')); } catch { /* elenco coach opzionale */ } }
      if (canAssignNutri) { try { setNutritionists(await api<Coach[]>('/crm/nutritionists')); } catch { /* elenco nutrizionisti opzionale */ } }
    } catch { /* stage/liste non bloccano la tabella */ }
  }

  // Carica UNA pagina dal server, coi filtri/ordinamento applicati lato DB.
  async function fetchLeads(p: number) {
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', '100');
      const qv = filter.trim() || fEmail.trim() || fName.trim();
      if (qv) params.set('q', qv);
      if (fStage) params.set('stage', fStage);
      if (listFilter) params.set('listId', listFilter);
      if (fCoach) params.set('coachId', fCoach);
      if (fNutri) params.set('nutriId', fNutri);
      if (fTipo) params.set('tipo', fTipo);
      const mn = parseEuro(fValMin); if (mn != null) params.set('valueMin', String(mn));
      const mx = parseEuro(fValMax); if (mx != null) params.set('valueMax', String(mx));
      if (fDateFrom) params.set('dateFrom', fDateFrom);
      if (fDateTo) params.set('dateTo', fDateTo);
      if (sortKey) { params.set('sortKey', sortKey); params.set('sortDir', sortDir); }
      const r = await api<{ rows: Lead[]; total: number }>(`/crm/leads?${params.toString()}`);
      if (seq === searchSeq.current) { setLeads(r.rows ?? []); setTotal(r.total ?? 0); }
    } catch (err) {
      if (seq === searchSeq.current) setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      if (seq === searchSeq.current) { setSearching(false); setLoading(false); }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Paginazione + filtri + ordinamento LATO SERVER: si carica solo la pagina corrente.
  // Cambiando un filtro si torna a pagina 0; cambiando pagina si mantiene il filtro.
  const qkey = JSON.stringify([filter, fName, fEmail, fStage, fCoach, fNutri, fTipo, fValMin, fValMax, fDateFrom, fDateTo, listFilter, sortKey, sortDir]);
  useEffect(() => {
    const filtersChanged = prevQkey.current !== qkey;
    prevQkey.current = qkey;
    if (filtersChanged && page !== 0) { setPage(0); return; }
    const t = setTimeout(() => { void fetchLeads(page); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qkey, page]);

  async function changeStage(lead: Lead, stage: string) {
    try {
      await api(`/crm/leads/${lead.id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) });
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  const stageOf = (key: string) => stages.find((s) => s.key === key);
  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min(total, (page + 1) * pageSize);

  if (loading) return <Spinner />;

  const th = (label: string, key: string) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(key)} title="Clicca per ordinare">
      {label}{sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Cerca in tutto il DB (nome, email, tel)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {searching && <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>cerco nel database…</span>}
          <select className="select" style={{ maxWidth: 220 }} value={listFilter} onChange={(e) => setListFilter(e.target.value)} title="Filtra per lista">
            <option value="">Tutte le liste</option>
            {allLists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.memberCount != null ? ` (${l.memberCount})` : ''}</option>)}
          </select>
          <button className="btn ghost" onClick={() => setShowLists(true)}><i className="ti ti-tags" /> Gestisci liste</button>
          {(filter || listFilter || fName || fEmail || fStage || fCoach || fNutri || fTipo || fValMin || fValMax || fDateFrom || fDateTo) && (
            <button className="btn ghost" onClick={clearFilters} title="Rimuovi tutti i filtri"><i className="ti ti-filter-off" /> Azzera filtri</button>
          )}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {can('accounting', 'manage') && (
            <Link className="btn ghost" to="/crm/import"><i className="ti ti-database-import" /> Importa</Link>
          )}
          <Link className="btn" to="/crm/inserimento">
            <i className="ti ti-user-plus" /> Nuovo lead
          </Link>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {canAssignCoach && selected.size > 0 && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span><b>{selected.size}</b> lead selezionati</span>
          <select className="select" style={{ width: 200 }} value={bulkCoach} onChange={(e) => setBulkCoach(e.target.value)} title="Coach a cui assegnare i lead selezionati">
            <option value="">— scegli coach —</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
          <button className="btn" onClick={bulkAssign} disabled={!bulkCoach || bulkBusy}>
            <i className="ti ti-user-check" /> Assegna {selected.size} lead
          </button>
          <button className="btn ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>Deseleziona</button>
        </div>
      )}
      {showLists && <ListsManager lists={allLists} onClose={() => setShowLists(false)} onChanged={load} />}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="grid" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                {canAssignCoach && (
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every((l) => selected.has(l.id))}
                      onChange={toggleAllVisible}
                      title="Seleziona/deseleziona tutti i visibili"
                    />
                  </th>
                )}
                {th('Nome', 'name')}
                {th('Email', 'email')}
                {th('Stato', 'stage')}
                {th('Coach', 'coach')}
                {th('Nutrizionista', 'nutri')}
                {th('Tipo', 'tipo')}
                {th('Valore', 'value')}
                {th('Creato', 'created')}
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
              <tr>
                {canAssignCoach && <th style={{ padding: '4px 6px' }} />}
                <th style={{ padding: '4px 6px' }}>
                  <input className="input" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} placeholder="Nome…" value={fName} onChange={(e) => setFName(e.target.value)} />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input className="input" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} placeholder="Email o tel…" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fStage} onChange={(e) => setFStage(e.target.value)}>
                    <option value="">Tutti</option>
                    {stages.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fCoach} onChange={(e) => setFCoach(e.target.value)}>
                    <option value="">Tutte</option>
                    <option value="none">— non assegnato —</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fNutri} onChange={(e) => setFNutri(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="none">— non assegnato —</option>
                    {nutritionists.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)} title="Tipo persona">
                    <option value="">Tutti i tipi</option>
                    <option value="client">Cliente</option>
                    <option value="historical">Storico</option>
                    <option value="lead">Lead</option>
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="input" style={{ width: 58, padding: '4px 6px', fontWeight: 400 }} placeholder="min €" inputMode="decimal" value={fValMin} onChange={(e) => setFValMin(e.target.value)} title="Valore minimo (€)" />
                    <input className="input" style={{ width: 58, padding: '4px 6px', fontWeight: 400 }} placeholder="max €" inputMode="decimal" value={fValMax} onChange={(e) => setFValMax(e.target.value)} title="Valore massimo (€)" />
                  </div>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <input className="input" style={{ width: 130, padding: '3px 6px', fontWeight: 400, fontSize: 11 }} type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} title="Creato dal" />
                    <input className="input" style={{ width: 130, padding: '3px 6px', fontWeight: 400, fontSize: 11 }} type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} title="Creato al" />
                  </div>
                </th>
                <th style={{ padding: '4px 6px' }} />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={canAssignCoach ? 10 : 9} className="empty" style={{ padding: 24, textAlign: 'center' }}>
                    {searching ? 'Carico…' : 'Nessun lead con questi filtri. Modifica o azzera i filtri qui sopra.'}
                  </td>
                </tr>
              ) : leads.map((l) => {
                const st = stageOf(l.stage);
                return (
                  <tr key={l.id}>
                    {canAssignCoach && (
                      <td>
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} />
                      </td>
                    )}
                    <td>
                      {l.clientId ? (
                        <Link to={`/clienti/${l.clientId}`} style={{ fontWeight: 700, textDecoration: 'none' }}>
                          {displayName(l)}
                        </Link>
                      ) : (
                        <Link to={`/crm/lead/${l.id}`} style={{ fontWeight: 700, textDecoration: 'none' }} title="Apri la scheda del lead">
                          {displayName(l)}
                        </Link>
                      )}
                      {l.lists?.length > 0 && (
                        <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {l.lists.map((x) => (
                            <span key={x.id} className="chip" style={{ fontSize: 9.5, padding: '1px 6px', borderColor: x.color ?? undefined, color: x.color ?? undefined }}>{x.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="muted">{l.client?.email ?? l.email ?? l.phone ?? '—'}</td>
                    <td>
                      <select
                        className="select"
                        style={{ width: 180, padding: '6px 10px', borderColor: st?.color ?? undefined }}
                        value={l.stage}
                        onChange={(e) => changeStage(l, e.target.value)}
                      >
                        {stages.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                        {!st && <option value={l.stage}>{l.stage} (stato rimosso)</option>}
                      </select>
                    </td>
                    <td>
                      {canAssignCoach ? (
                        <>
                          <select
                            className="select"
                            style={{ width: 150, padding: '6px 10px' }}
                            value={l.assignedCoachId ?? ''}
                            onChange={(e) => assignCoach(l, e.target.value)}
                            title="Assegna la coach (dovrà accettare entro 2 giorni)"
                          >
                            <option value="">— assegna —</option>
                            {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                            {l.assignedCoachId && !coaches.some((c) => c.id === l.assignedCoachId) && (
                              <option value={l.assignedCoachId}>{l.assignedCoach?.displayName ?? 'Coach'}</option>
                            )}
                          </select>
                          {l.assignmentStatus === 'pending' && <div><span className="chip amber" style={{ fontSize: 10, marginTop: 3 }}>in attesa</span></div>}
                          {l.assignmentStatus === 'accepted' && <div><span className="chip" style={{ fontSize: 10, marginTop: 3 }}>accettato</span></div>}
                        </>
                      ) : (
                        <span className="muted">{l.assignedCoach?.displayName ?? l.client?.clientProfile?.assignedCoach?.displayName ?? '—'}</span>
                      )}
                    </td>
                    <td>
                      {canAssignNutri && l.clientId && l.client?.clientProfile ? (
                        <select
                          className="select"
                          style={{ width: 150, padding: '6px 10px' }}
                          value={l.client.clientProfile.assignedNutritionistId ?? ''}
                          onChange={(e) => assignNutritionist(l, e.target.value)}
                          title="Assegna il nutrizionista alla cliente"
                        >
                          <option value="">— assegna —</option>
                          {nutritionists.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
                          {l.client.clientProfile.assignedNutritionistId && !nutritionists.some((n) => n.id === l.client!.clientProfile!.assignedNutritionistId) && (
                            <option value={l.client.clientProfile.assignedNutritionistId}>{l.client.clientProfile.assignedNutritionist?.displayName ?? 'Nutrizionista'}</option>
                          )}
                        </select>
                      ) : (
                        <span className="muted">{l.client?.clientProfile?.assignedNutritionist?.displayName ?? '—'}</span>
                      )}
                    </td>
                    <td>{(() => { const k = classify(l); return <span className={`chip ${k.chip}`} style={{ fontSize: 10 }} title={k.title}>{k.label}</span>; })()}</td>
                    <td>{euro(l.valueCents ?? l.historicalPaidCents)}</td>
                    <td className="muted">{new Date(l.createdAt).toLocaleDateString('it-IT')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {l.clientId ? (
                        <button className="btn ghost sm" onClick={() => doImpersonate(l)} title="Entra nell'app come questa cliente">
                          <i className="ti ti-eye" /> Entra come
                        </button>
                      ) : (
                        <span className="chip amber" style={{ fontSize: 10 }}>solo lead</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        <Pager page={page + 1} totalPages={totalPages} total={total} from={fromRow} to={toRow} onPage={(p) => setPage(p - 1)} />
      </div>
    </>
  );
}

/** Crea, rinomina ed elimina le liste CRM. Alla chiusura ricarica la tabella. */
function ListsManager({ lists, onClose, onChanged }: { lists: CrmList[]; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [rows, setRows] = useState<CrmList[]>(lists);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try { setRows(await api<CrmList[]>('/crm/lists')); } catch { /* soft */ }
    await onChanged();
  }
  async function create() {
    if (!newName.trim()) return;
    setBusy(true); setError(null);
    try {
      await api('/crm/lists', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      setNewName('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Creazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function rename(l: CrmList, name: string) {
    if (!name.trim() || name === l.name) return;
    try { await api(`/crm/lists/${l.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Rinomina non riuscita.'); }
  }
  async function remove(l: CrmList) {
    if (!confirm(`Eliminare la lista "${l.name}"? I contatti restano, perdono solo questa etichetta.`)) return;
    try { await api(`/crm/lists/${l.id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.'); }
  }

  return (
    <Modal title="Gestisci liste CRM" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nessuna lista. Creane una qui sotto.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {rows.map((l) => (
            <div key={l.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input className="input" defaultValue={l.name} onBlur={(e) => rename(l, e.target.value)} style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12, minWidth: 70, textAlign: 'right' }}>{l.memberCount ?? 0} contatti</span>
              <button className="btn ghost sm" style={{ color: '#b3261e' }} onClick={() => remove(l)} title="Elimina lista"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Nuova lista</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Es. Clienti storici 2024" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </div>
        <button className="btn" onClick={create} disabled={busy || !newName.trim()} style={{ marginBottom: 0 }}><i className="ti ti-plus" /> Crea</button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Chiudi</button>
      </div>
    </Modal>
  );
}
