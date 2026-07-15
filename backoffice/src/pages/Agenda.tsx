import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner, usePagination } from '../components/ui';

interface VisitRow {
  id: string;
  type: string;
  datetime: string;
  status: string;
  client: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  nutritionist: { displayName: string } | null;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const TYPE: Record<string, string> = { in_person: 'In presenza', televisit: 'Televisita' };
const STATUS: Record<string, { label: string; chip: string }> = {
  scheduled: { label: 'In programma', chip: 'amber' },
  done: { label: 'Effettuata', chip: '' },
  cancelled: { label: 'Annullata', chip: 'red' },
};

export function Agenda() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('scheduled');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<VisitRow[]>(`/admin/visits${status ? `?status=${status}` : ''}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const name = (c: VisitRow['client']) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email : '—');

  const pg = usePagination(rows, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Visite col nutrizionista (le note cliniche restano nella scheda).</p>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="scheduled">In programma</option>
          <option value="done">Effettuate</option>
          <option value="cancelled">Annullate</option>
          <option value="">Tutte</option>
        </select>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessuna visita.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Cliente</th>
                <th>Nutrizionista</th>
                <th>Tipo</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.datetime)}</td>
                  <td>
                    {r.client ? (
                      <span className="link" style={{ cursor: 'pointer' }} onClick={() => navigate(`/clienti/${r.client!.id}`)}>{name(r.client)}</span>
                    ) : '—'}
                  </td>
                  <td className="muted">{r.nutritionist?.displayName ?? '—'}</td>
                  <td className="muted">{TYPE[r.type] ?? r.type}</td>
                  <td><span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>
    </>
  );
}
