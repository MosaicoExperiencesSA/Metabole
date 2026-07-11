import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface ProtocolRow {
  id: string;
  name: string;
  type: string;
  appliesTo: string | null;
  status: string;
  author: { displayName: string } | null;
  validatedBy: { displayName: string } | null;
  updatedAt: string;
}

const TYPE: Record<string, string> = {
  menu_correction: 'Correzione menu',
  threshold: 'Soglia',
  library: 'Libreria',
};
const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: 'Da validare', chip: 'amber' },
  approved: { label: 'Approvato', chip: '' },
  rejected: { label: 'Rifiutato', chip: 'red' },
};

export function Protocolli() {
  const [rows, setRows] = useState<ProtocolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<ProtocolRow[]>(`/protocols${status ? `?status=${status}` : ''}`));
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
        <p className="muted" style={{ margin: 0 }}>Regole del motore (menu, soglie): create dai nutrizionisti, validate dal capo.</p>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="pending">Da validare</option>
          <option value="approved">Approvati</option>
          <option value="rejected">Rifiutati</option>
        </select>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun protocollo.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Si applica a</th>
                <th>Autore</th>
                <th>Validato da</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{TYPE[r.type] ?? r.type}</td>
                  <td className="muted">{r.appliesTo ?? '—'}</td>
                  <td className="muted">{r.author?.displayName ?? '—'}</td>
                  <td className="muted">{r.validatedBy?.displayName ?? '—'}</td>
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
