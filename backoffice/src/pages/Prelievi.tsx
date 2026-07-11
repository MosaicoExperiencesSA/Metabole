import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Withdrawal {
  id: string; staffName: string; staffEmail: string | null;
  amountCents: number; iban: string; status: string;
  requestedAt: string; paidAt: string | null; note: string | null;
  hasReceipt: boolean; withdrawableCents: number; congruent: boolean;
}

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const TABS: { key: string; label: string }[] = [
  { key: 'requested', label: 'In attesa' },
  { key: 'paid', label: 'Pagate' },
  { key: 'rejected', label: 'Rifiutate' },
  { key: '', label: 'Tutte' },
];

export function Prelievi() {
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      setRows(await api<Withdrawal[]>(`/admin/withdrawals${tab ? `?status=${tab}` : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può gestire i prelievi.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [tab]);

  async function confirmPay(w: Withdrawal) {
    if (!confirm(`Confermi di aver pagato ${euro(w.amountCents)} a ${w.staffName} (IBAN ${w.iban})?\n\nVerrà registrato nel prelevato e inviata l'email di conferma.`)) return;
    setBusyId(w.id); setError(null); setNotice(null);
    try {
      await api(`/admin/withdrawals/${w.id}/confirm`, { method: 'POST' });
      setNotice('Pagamento confermato ed email inviata.');
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  async function reject(w: Withdrawal) {
    const reason = prompt('Motivo del rifiuto:');
    if (!reason) return;
    setBusyId(w.id); setError(null); setNotice(null);
    try {
      await api(`/admin/withdrawals/${w.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setNotice('Richiesta rifiutata.');
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  async function downloadReceipt(w: Withdrawal) {
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/withdrawals/${w.id}/receipt`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement('a'); a.href = url; a.download = r.fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Download non riuscito.'); }
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>Verifica gli importi (non oltre il saldo prelevabile), scarica la ricevuta e conferma dopo aver fatto il bonifico.</p>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`chip ${t.key === tab ? '' : 'ghost'}`} style={{ cursor: 'pointer', border: t.key === tab ? '2px solid var(--teal)' : undefined }} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card"><div className="empty">Nessuna richiesta.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((w) => (
            <div className="card" key={w.id} style={{ margin: 0 }}>
              <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ minWidth: 220 }}>
                  <b style={{ fontSize: 15 }}>{w.staffName}</b>
                  {w.staffEmail && <div className="muted" style={{ fontSize: 12 }}>{w.staffEmail}</div>}
                  <div style={{ fontSize: 13, marginTop: 6 }}>IBAN: <b>{w.iban}</b></div>
                  <div className="muted" style={{ fontSize: 12 }}>Richiesto il {new Date(w.requestedAt).toLocaleDateString('it-IT')}{w.paidAt ? ` · pagato il ${new Date(w.paidAt).toLocaleDateString('it-IT')}` : ''}</div>
                  {w.note && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nota: {w.note}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{euro(w.amountCents)}</div>
                  {w.status === 'requested' && (
                    <div className={`chip ${w.congruent ? '' : 'red'}`} style={{ marginTop: 4 }}>
                      {w.congruent ? `OK · prelevabile ${euro(w.withdrawableCents)}` : `⚠ supera il prelevabile (${euro(w.withdrawableCents)})`}
                    </div>
                  )}
                  {w.status === 'paid' && <span className="chip" style={{ marginTop: 4 }}>Pagato</span>}
                  {w.status === 'rejected' && <span className="chip red" style={{ marginTop: 4 }}>Rifiutato</span>}
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {w.hasReceipt && <button className="btn ghost sm" onClick={() => downloadReceipt(w)}><i className="ti ti-download" /> Ricevuta</button>}
                {w.status === 'requested' && (
                  <>
                    <button className="btn sm" disabled={busyId === w.id} onClick={() => confirmPay(w)}><i className="ti ti-check" /> Conferma pagamento</button>
                    <button className="btn ghost sm" disabled={busyId === w.id} onClick={() => reject(w)} style={{ color: 'var(--danger)' }}><i className="ti ti-x" /> Rifiuta</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
