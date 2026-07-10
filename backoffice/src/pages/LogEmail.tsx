import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface LogRow {
  id: string;
  to: string;
  templateKey: string | null;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<string, { label: string; chip: string }> = {
  sent: { label: 'Inviata', chip: '' },
  failed: { label: 'Fallita', chip: 'red' },
  skipped: { label: 'Non inviata', chip: 'amber' },
};

export function LogEmail() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<LogRow[]>('/admin/email/log'));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => (status ? rows.filter((r) => r.status === status) : rows), [rows, status]);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Ultimi 300 invii email (per verifica).</p>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="sent">Inviate</option>
          <option value="failed">Fallite</option>
          <option value="skipped">Non inviate</option>
        </select>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessuna email registrata.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Data e ora</th>
                <th>Destinatario</th>
                <th>Modello</th>
                <th>Oggetto</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{dateTime(r.createdAt)}</td>
                  <td>{r.to}</td>
                  <td className="muted">{r.templateKey ?? '—'}</td>
                  <td>{r.subject}</td>
                  <td>
                    <span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span>
                    {r.error && <div className="muted" style={{ fontSize: 11, marginTop: 2 }} title={r.error}>{r.error.length > 40 ? r.error.slice(0, 40) + '…' : r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
