import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';

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
    setLoading(true);
    try {
      const [ls, st, lists] = await Promise.all([
        api<Lead[]>('/crm/leads'),
        api<Stage[]>('/crm/stages'),
        api<CrmList[]>('/crm/lists').catch(() => [] as CrmList[]),
      ]);
      setLeads(ls);
      setStages(st);
      setAllLists(lists);
      if (canAssignCoach) { try { setCoaches(await api<Coach[]>('/crm/coaches')); } catch { /* elenco coach opzionale */ } }
      if (canAssignNutri) { try { setNutritionists(await api<Coach[]>('/crm/nutritionists')); } catch { /* elenco nutrizionisti opzionale */ } }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function changeStage(lead: Lead, stage: string) {
    try {
      await api(`/crm/leads/${lead.id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) });
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  const stageOf = (key: string) => stages.find((s) => s.key === key);
  const filtered = leads.filter((l) => {
    if (listFilter && !l.lists?.some((x) => x.id === listFilter)) return false;
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return displayName(l).toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q) || (l.client?.email ?? '').toLowerCase().includes(q);
  });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Cerca per nome o email…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="select" style={{ maxWidth: 220 }} value={listFilter} onChange={(e) => setListFilter(e.target.value)} title="Filtra per lista">
            <option value="">Tutte le liste</option>
            {allLists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.memberCount != null ? ` (${l.memberCount})` : ''}</option>)}
          </select>
          <button className="btn ghost" onClick={() => setShowLists(true)}><i className="ti ti-tags" /> Gestisci liste</button>
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
      {showLists && <ListsManager lists={allLists} onClose={() => setShowLists(false)} onChanged={load} />}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessun lead o cliente. Inseriscine uno con "Nuovo lead".</div>
        ) : (
          <table className="grid" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Stato</th>
                <th>Coach</th>
                <th>Nutrizionista</th>
                <th>Valore</th>
                <th>Creato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const st = stageOf(l.stage);
                return (
                  <tr key={l.id}>
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
                      {(() => { const k = classify(l); return <span className={`chip ${k.chip}`} style={{ marginLeft: 8, fontSize: 10 }} title={k.title}>{k.label}</span>; })()}
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
                    <td>{euro(l.valueCents)}</td>
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
        )}
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
