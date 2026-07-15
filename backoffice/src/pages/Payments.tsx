import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, usePagination } from '../components/ui';

type Status = 'pending' | 'receipt_uploaded' | 'approved' | 'rejected' | 'cancelled';

interface Payment {
  id: string;
  clientId: string;
  amountCents: number;
  description: string;
  method: 'bank_transfer' | 'card';
  status: Status;
  receiptName: string | null;
  receiptMime: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  hasReceipt: boolean;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
}

interface Accounting {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
}

const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const clientName = (p: Payment) => p.client?.clientProfile?.name ?? p.client?.email ?? 'Cliente';
const methodLabel = (m: string) => (m === 'card' ? 'Carta' : 'Bonifico');

const STATUS: Record<Status, { label: string; chip: string }> = {
  receipt_uploaded: { label: 'Da approvare', chip: 'amber' },
  pending: { label: 'In attesa contabile', chip: 'gray' },
  approved: { label: 'Approvato', chip: '' },
  rejected: { label: 'Rifiutato', chip: 'red' },
  cancelled: { label: 'Annullato', chip: 'gray' },
};

const TABS: { key: Status; label: string }[] = [
  { key: 'receipt_uploaded', label: 'Da approvare' },
  { key: 'pending', label: 'In attesa contabile' },
  { key: 'approved', label: 'Approvati' },
  { key: 'rejected', label: 'Rifiutati' },
  { key: 'cancelled', label: 'Annullati' },
];

export function Payments() {
  const { can } = useAuth();
  const isAdmin = can('accounting', 'manage'); // il riepilogo contabile è solo admin
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounting, setAccounting] = useState<Accounting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Status>('receipt_uploaded');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ name: string; mime: string; url: string } | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const list = await api<Payment[]>('/admin/payments');
      setPayments(list);
      if (isAdmin) {
        try {
          setAccounting(await api<Accounting>('/dashboards/accounting'));
        } catch {
          /* il riepilogo è accessorio: se non disponibile, la coda resta usabile */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      if (receipt) URL.revokeObjectURL(receipt.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of payments) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [payments]);

  const rows = payments.filter((p) => p.status === tab);

  async function viewReceipt(p: Payment) {
    setError(null);
    setBusyId(p.id);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/payments/${p.id}/receipt`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (ch) => ch.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.mimeType });
      const url = URL.createObjectURL(blob);
      setReceipt({ name: r.fileName || 'contabile', mime: r.mimeType, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contabile non disponibile.');
    } finally {
      setBusyId(null);
    }
  }

  function closeReceipt() {
    if (receipt) URL.revokeObjectURL(receipt.url);
    setReceipt(null);
  }

  async function approve(p: Payment) {
    if (!confirm(`Approvare il pagamento di ${clientName(p)} da ${euro(p.amountCents)}?\nL'abbonamento verrà attivato.`)) return;
    setError(null);
    setNotice(null);
    setBusyId(p.id);
    try {
      const updated = await api<Payment>(`/admin/payments/${p.id}/approve`, { method: 'POST' });
      setPayments((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      setNotice(`Pagamento di ${clientName(p)} approvato.`);
      if (isAdmin) {
        try { setAccounting(await api<Accounting>('/dashboards/accounting')); } catch { /* accessorio */ }
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Approvazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(p: Payment) {
    if (!confirm(`Annullare il pagamento di ${clientName(p)} da ${euro(p.amountCents)}?\nResterà nello storico come "Annullato".`)) return;
    setError(null);
    setNotice(null);
    setBusyId(p.id);
    try {
      const updated = await api<Payment>(`/admin/payments/${p.id}/cancel`, { method: 'POST' });
      setPayments((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      setNotice(`Pagamento di ${clientName(p)} annullato.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  async function doReject(p: Payment, reason: string) {
    setError(null);
    setNotice(null);
    setBusyId(p.id);
    try {
      const updated = await api<Payment>(`/admin/payments/${p.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setPayments((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      setNotice(`Pagamento di ${clientName(p)} rifiutato. La cliente riceverà una notifica.`);
      setRejecting(null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  const pg = usePagination(rows, 100);

  if (loading) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {isAdmin && accounting && (
        <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <StatCard label="Incassato" value={euro(accounting.totalIncomeCents)} tone="teal" />
          <StatCard label="Uscite" value={euro(accounting.totalExpenseCents)} tone="coral" />
          <StatCard label="Netto" value={euro(accounting.netCents)} tone="deep" />
        </div>
      )}

      {/* Tab per stato */}
      <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const n = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              className={`btn ${active ? '' : 'ghost'}`}
              onClick={() => setTab(t.key)}
              style={{ padding: '7px 14px' }}
            >
              {t.label}
              {n > 0 && <span className={`chip ${active ? 'gray' : t.key === 'receipt_uploaded' ? 'amber' : 'gray'}`} style={{ marginLeft: 8, fontSize: 11 }}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">
            {tab === 'receipt_uploaded' ? 'Nessun bonifico da approvare. Tutto in ordine. 👍' : 'Nessun pagamento in questo stato.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descrizione</th>
                <th>Importo</th>
                <th>Metodo</th>
                <th>Data</th>
                <th>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{clientName(p)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{p.client?.email ?? '—'}</div>
                  </td>
                  <td>{p.description}</td>
                  <td><b>{euro(p.amountCents)}</b></td>
                  <td className="muted">{methodLabel(p.method)}</td>
                  <td className="muted">{date(p.createdAt)}</td>
                  <td>
                    <span className={`chip ${STATUS[p.status].chip}`}>{STATUS[p.status].label}</span>
                    {p.status === 'rejected' && p.rejectReason && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }} title={p.rejectReason}>
                        {p.rejectReason.length > 40 ? p.rejectReason.slice(0, 40) + '…' : p.rejectReason}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.hasReceipt && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => viewReceipt(p)}>
                        <i className="ti ti-file-text" /> Contabile
                      </button>
                    )}
                    {(p.status === 'receipt_uploaded' || p.status === 'pending') && (
                      <>
                        <button className="btn sm" disabled={busyId === p.id} onClick={() => approve(p)} style={{ marginLeft: 6 }}>
                          <i className="ti ti-check" /> Approva
                        </button>
                        <button className="btn danger sm" disabled={busyId === p.id} onClick={() => setRejecting(p)} style={{ marginLeft: 6 }}>
                          Rifiuta
                        </button>
                        <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => cancel(p)} style={{ marginLeft: 6 }} title="Annulla (resta nello storico)">
                          <i className="ti ti-trash" /> Elimina
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>

      {receipt && (
        <Modal title={`Contabile · ${receipt.name}`} onClose={closeReceipt}>
          <div style={{ marginBottom: 12 }}>
            {receipt.mime.startsWith('image/') ? (
              <img src={receipt.url} alt="Contabile" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
            ) : (
              <>
                <object data={receipt.url} type="application/pdf" style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 10 }}>
                  <div className="empty" style={{ padding: 24 }}>
                    Anteprima PDF non disponibile in questo browser.
                  </div>
                </object>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Se l'anteprima non compare, apri il file in una nuova scheda o scaricalo.
                </p>
              </>
            )}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn ghost" href={receipt.url} target="_blank" rel="noreferrer">
                <i className="ti ti-external-link" /> Apri in nuova scheda
              </a>
              <a className="btn ghost" href={receipt.url} download={receipt.name}>
                <i className="ti ti-download" /> Scarica
              </a>
            </div>
            <button className="btn ghost" onClick={closeReceipt}>Chiudi</button>
          </div>
        </Modal>
      )}

      {rejecting && (
        <RejectModal payment={rejecting} busy={busyId === rejecting.id} onCancel={() => setRejecting(null)} onConfirm={(reason) => doReject(rejecting, reason)} />
      )}
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'teal' | 'coral' | 'deep' }) {
  const bg = tone === 'teal' ? '#12a386' : tone === 'coral' ? '#e8825a' : '#10403a';
  return (
    <div className="card" style={{ flex: 1, minWidth: 150, background: bg, color: '#fff', border: 'none' }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function RejectModal({
  payment,
  busy,
  onCancel,
  onConfirm,
}: {
  payment: Payment;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 3;
  return (
    <Modal title="Rifiuta pagamento" onClose={onCancel}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Stai rifiutando il bonifico di <b>{clientName(payment)}</b> da {euro(payment.amountCents)}. La cliente
        riceverà una notifica con il motivo.
      </p>
      <textarea
        className="input"
        style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
        placeholder="Motivo del rifiuto (es. contabile illeggibile, importo diverso)…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Annulla</button>
        <button className="btn danger" onClick={() => onConfirm(reason.trim())} disabled={!valid || busy}>
          {busy ? 'Invio…' : 'Conferma rifiuto'}
        </button>
      </div>
    </Modal>
  );
}
