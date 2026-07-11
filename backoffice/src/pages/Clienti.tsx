import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface ClientRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
}

const date = (s: string) => new Date(s).toLocaleDateString('it-IT');

export function Clienti() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: ClientRow[] }>('/admin/users?role=client&limit=200');
        setRows(res.items);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const name = (r: ClientRow) => [r.firstName, r.lastName].filter(Boolean).join(' ');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => name(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, filter]);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{rows.length} clienti registrati.</p>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Cerca per nome o email…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessun cliente.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Stato</th>
                <th>Iscritto il</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clienti/${r.id}`)}>
                  <td>{name(r) || <span className="muted">—</span>}</td>
                  <td>{r.email}</td>
                  <td><span className={`chip ${r.status === 'active' ? '' : 'amber'}`}>{r.status === 'active' ? 'Attivo' : 'Sospeso'}</span></td>
                  <td className="muted">{date(r.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}><i className="ti ti-chevron-right muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
