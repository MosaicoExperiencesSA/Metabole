import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner, usePagination } from '../components/ui';

interface LogRow {
  id: string;
  to: string;
  templateKey: string | null;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
}

interface LogDetail extends LogRow {
  bodyHtml: string | null;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<string, { label: string; chip: string }> = {
  sent: { label: 'Inviata', chip: '' },
  failed: { label: 'Fallita', chip: 'red' },
  skipped: { label: 'Non inviata', chip: 'amber' },
};

// Documento isolato per l'anteprima: sandbox senza script, sola lettura.
const previewDoc = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2b2b;padding:12px}img{max-width:100%}</style></head><body>${html}</body></html>`;

export function LogEmail() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!openId) return;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    (async () => {
      try {
        setDetail(await api<LogDetail>(`/admin/email/log/${openId}`));
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [openId]);

  const filtered = useMemo(() => (status ? rows.filter((r) => r.status === status) : rows), [rows, status]);

  const pg = usePagination(filtered, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Ultimi 300 invii email (clicca una riga per l'anteprima).</p>
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
              {pg.pageItems.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} style={{ cursor: 'pointer' }} title="Apri anteprima">
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
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>

      {openId && (
        <Modal title="Anteprima email" wide onClose={() => setOpenId(null)}>
          {detailLoading ? (
            <Spinner />
          ) : detailError ? (
            <Banner kind="err">{detailError}</Banner>
          ) : detail ? (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, fontSize: 13 }}>
                <div><span className="muted">Destinatario:</span> {detail.to}</div>
                <div><span className="muted">Oggetto:</span> <b>{detail.subject}</b></div>
                <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                  <span><span className="muted">Data:</span> {dateTime(detail.createdAt)}</span>
                  <span><span className="muted">Modello:</span> {detail.templateKey ?? '—'}</span>
                  <span className={`chip ${STATUS[detail.status]?.chip ?? 'gray'}`}>{STATUS[detail.status]?.label ?? detail.status}</span>
                </div>
                {detail.error && <Banner kind="err">{detail.error}</Banner>}
              </div>
              {detail.bodyHtml ? (
                <iframe
                  title="Contenuto email"
                  srcDoc={previewDoc(detail.bodyHtml)}
                  sandbox=""
                  style={{ width: '100%', height: '58vh', border: '1px solid var(--line,#eee)', borderRadius: 8, background: '#fff' }}
                />
              ) : (
                <div className="empty">Corpo non disponibile per questa email (registrata prima dell'aggiornamento).</div>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn ghost" onClick={() => setOpenId(null)}>Chiudi</button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}
