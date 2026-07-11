import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

interface DietRow {
  id: string;
  name: string;
  regime: string;
  style: string;
  mealsPerDay: number;
  status: string;
  author: { displayName: string } | null;
  approvedBy: { displayName: string } | null;
  _count: { dayTemplates: number };
  updatedAt: string;
}

const REGIME: Record<string, string> = { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' };
const STYLE: Record<string, string> = { mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile' };
const STATUS: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Bozza', chip: 'gray' },
  in_review: { label: 'In revisione', chip: 'amber' },
  approved: { label: 'Approvata', chip: '' },
  rejected: { label: 'Rifiutata', chip: 'red' },
};

export function Diete() {
  const { permissions } = useAuth();
  const role = permissions?.role;
  const isHead = role === 'head_nutritionist';
  const isNutri = role === 'nutritionist' || role === 'head_nutritionist';
  const [rows, setRows] = useState<DietRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await api<DietRow[]>(`/diets${status ? `?status=${status}` : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function act(id: string, action: 'submit' | 'approve' | 'reject') {
    let body: string | undefined;
    if (action === 'reject') {
      const reason = prompt('Motivazione del rifiuto (facoltativa):') ?? '';
      body = JSON.stringify({ reason });
    }
    setBusy(id + action); setError(null);
    try {
      await api(`/diets/${id}/${action}`, { method: 'POST', ...(body ? { body } : {}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  const showActions = isNutri; // nutrizionisti/capo vedono la colonna azioni

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Diete del catalogo (create dai nutrizionisti, approvate dal capo).</p>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="draft">Bozze</option>
          <option value="in_review">In revisione</option>
          <option value="approved">Approvate</option>
          <option value="rejected">Rifiutate</option>
        </select>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessuna dieta.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Regime</th>
                <th>Stile</th>
                <th>Pasti</th>
                <th>Giorni</th>
                <th>Autore</th>
                <th>Stato</th>
                {showActions && <th>Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{REGIME[r.regime] ?? r.regime}</td>
                  <td className="muted">{STYLE[r.style] ?? r.style}</td>
                  <td className="muted">{r.mealsPerDay}</td>
                  <td className="muted">{r._count?.dayTemplates ?? 0}</td>
                  <td className="muted">{r.author?.displayName ?? '—'}</td>
                  <td><span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                  {showActions && (
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {r.status === 'draft' && isNutri && (
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => act(r.id, 'submit')}><i className="ti ti-send" /> Invia in revisione</button>
                        )}
                        {r.status === 'in_review' && isHead && (
                          <>
                            <button className="btn sm" disabled={!!busy} onClick={() => act(r.id, 'approve')}><i className="ti ti-check" /> Approva</button>
                            <button className="btn ghost sm" disabled={!!busy} style={{ color: 'var(--danger)' }} onClick={() => act(r.id, 'reject')}><i className="ti ti-x" /> Rifiuta</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
