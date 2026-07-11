import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

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
  createdAt: string;
  owner: { displayName: string } | null;
  assignedCoachId: string | null;
  assignedCoach: { id: string; displayName: string } | null;
  assignmentStatus: string | null; // pending | accepted
  client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionistId: string | null; assignedNutritionist: { id: string; displayName: string } | null } | null } | null;
}
interface Coach { id: string; displayName: string }

function euro(cents: number | null): string {
  return cents == null ? '—' : '€ ' + (cents / 100).toFixed(2).replace('.', ',');
}
function displayName(l: Lead): string {
  return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
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
      const [ls, st] = await Promise.all([api<Lead[]>('/crm/leads'), api<Stage[]>('/crm/stages')]);
      setLeads(ls);
      setStages(st);
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
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return displayName(l).toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q) || (l.client?.email ?? '').toLowerCase().includes(q);
  });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Cerca per nome o email…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Link className="btn" to="/crm/inserimento">
          <i className="ti ti-user-plus" /> Nuovo lead
        </Link>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessun lead o cliente. Inseriscine uno con "Nuovo lead".</div>
        ) : (
          <table className="grid">
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
                        <b>{displayName(l)}</b>
                      )}
                      {!l.client && <span className="chip amber" style={{ marginLeft: 8, fontSize: 10 }}>lead</span>}
                    </td>
                    <td className="muted">{l.client?.email ?? l.email ?? '—'}</td>
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
