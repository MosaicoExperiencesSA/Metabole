import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
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
  const [rows, setRows] = useState<DietRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<DietRow[]>(`/diets${status ? `?status=${status}` : ''}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
