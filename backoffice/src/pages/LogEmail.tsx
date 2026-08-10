import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

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

// Tetto del server (`logs(limit = 300)` in email-templates.service.ts): oltre queste righe non
// arriva niente, e chi filtra deve saperlo.
const TETTO = 300;

// Documento isolato per l'anteprima: sandbox senza script, sola lettura.
const previewDoc = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2b2b;padding:12px}img{max-width:100%}</style></head><body>${html}</body></html>`;

export function LogEmail() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const COLONNE: Colonna<LogRow>[] = [
    { chiave: 'quando', titolo: 'Data e ora', valore: (r) => r.createdAt },
    { chiave: 'a', titolo: 'Destinatario', valore: (r) => r.to, filtro: 'testo' },
    { chiave: 'modello', titolo: 'Modello', valore: (r) => r.templateKey, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'oggetto', titolo: 'Oggetto', valore: (r) => r.subject, filtro: 'testo' },
    // Lo stato si confronta sul valore grezzo (`sent`/`failed`/`skipped`) e si legge con le stesse
    // etichette del chip: è il filtro che prima stava nella tendina in cima alla pagina.
    { chiave: 'stato', titolo: 'Stato', valore: (r) => STATUS[r.status]?.label ?? r.status, filtro: 'scelta', etichettaTutti: 'Tutti gli stati', ordineScelte: ['Fallita', 'Non inviata', 'Inviata'] },
  ];

  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'quando', direzione: 'desc' } });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="email caricate" />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>Clicca una riga per l'anteprima.</p>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      {rows.length >= TETTO && (
        <Banner kind="info">
          Stai guardando le <b>{TETTO}</b> email più recenti: i filtri cercano solo fra queste, quindi
          un invio più vecchio non compare nemmeno filtrando.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessuna email registrata.' : 'Nessuna email con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
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
        <Pager {...t.pager} />
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
