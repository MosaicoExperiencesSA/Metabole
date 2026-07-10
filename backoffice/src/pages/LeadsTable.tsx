import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Stage {
  key: string;
  label: string;
  color: string | null;
  order: number;
}
interface Lead {
  id: string;
  email: string | null;
  name: string | null;
  stage: string;
  valueCents: number | null;
  createdAt: string;
  owner: { displayName: string } | null;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
}

function euro(cents: number | null): string {
  return cents == null ? '—' : '€ ' + (cents / 100).toFixed(2).replace('.', ',');
}
function displayName(l: Lead): string {
  return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
}

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [ls, st] = await Promise.all([api<Lead[]>('/crm/leads'), api<Stage[]>('/crm/stages')]);
      setLeads(ls);
      setStages(st);
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
                <th>Responsabile</th>
                <th>Valore</th>
                <th>Creato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const st = stageOf(l.stage);
                return (
                  <tr key={l.id}>
                    <td>
                      <b>{displayName(l)}</b>
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
                    <td className="muted">{l.owner?.displayName ?? '—'}</td>
                    <td>{euro(l.valueCents)}</td>
                    <td className="muted">{new Date(l.createdAt).toLocaleDateString('it-IT')}</td>
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
