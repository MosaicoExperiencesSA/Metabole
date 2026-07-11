import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Profilo cliente: piano attivo (giorno X di N) + storico acquisti con
 * possibilità di scaricare la ricevuta PDF dei pagamenti confermati.
 */

interface Plan { name: string; period: string; priceCents: number; }
interface Subscription { id: string; status: string; startDate: string | null; endDate: string | null; plan: Plan | null; }
interface Payment { id: string; description: string; amountCents: number; method: string; status: string; createdAt: string; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const DAY = 86_400_000;

const STATUS: Record<string, { label: string; bg: string; col: string }> = {
  pending: { label: 'In attesa', bg: '#FBF0D9', col: '#8A6D1B' },
  receipt_uploaded: { label: 'Contabile inviata', bg: '#E4EEF9', col: '#2B5A93' },
  approved: { label: 'Pagato', bg: '#DCF0D8', col: '#3B6D11' },
  rejected: { label: 'Rifiutato', bg: '#F9E1DE', col: '#B3261E' },
};
const METHOD: Record<string, string> = { card: 'Carta', bank_transfer: 'Bonifico', manual: 'Manuale' };

function planProgress(sub: Subscription): { day: number; total: number; pct: number } | null {
  if (!sub.startDate || !sub.endDate) return null;
  const start = new Date(sub.startDate).getTime();
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  const total = Math.max(1, Math.round((end - start) / DAY));
  const day = Math.min(total, Math.max(1, Math.floor((now - start) / DAY) + 1));
  return { day, total, pct: Math.round((day / total) * 100) };
}

export default function Profilo() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Subscription | null>('/me/subscription').catch(() => null),
      api<Payment[]>('/me/payments').catch(() => [] as Payment[]),
    ]).then(([s, p]) => {
      setSub(s);
      setPayments(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, []);

  async function downloadReceipt(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/me/payments/${id}/receipt-pdf`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non è stato possibile scaricare la ricevuta.');
    } finally {
      setBusyId(null);
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || '').replace(/^\w/, (c) => c.toUpperCase());
  const prog = sub && sub.status === 'active' ? planProgress(sub) : null;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-user" /></span>
        <div>
          <h1 style={{ margin: 0 }}>{name || 'Profilo'}</h1>
          <div className="muted">{user?.email}</div>
        </div>
      </div>

      {/* Piano attivo */}
      <div className="sec" style={{ marginTop: 4 }}>Il mio piano</div>
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : sub && sub.status === 'active' && sub.plan ? (
        <div className="card" style={{ border: '2px solid #12A386' }}>
          <div className="row-between">
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{sub.plan.name}</div>
              <span className="chip" style={{ background: '#DCF0D8', color: '#3B6D11', marginTop: 4 }}><i className="ti ti-circle-check" /> Attivo</span>
            </div>
            <i className="ti ti-seeding" style={{ fontSize: 30, color: '#12A386' }} />
          </div>
          {prog && (
            <>
              <div className="row-between" style={{ marginTop: 14, alignItems: 'baseline' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0E7C66' }}>Giorno {prog.day}</span>
                <span className="muted" style={{ fontSize: 13 }}>di {prog.total}</span>
              </div>
              <div className="prog-track" style={{ marginTop: 8 }}>
                <div className="prog-fill" style={{ width: `${prog.pct}%` }} />
              </div>
              <div className="row-between" style={{ marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>Inizio {sub.startDate ? fmtDate(sub.startDate) : '—'}</span>
                <span className="muted" style={{ fontSize: 11 }}>Fine {sub.endDate ? fmtDate(sub.endDate) : '—'}</span>
              </div>
            </>
          )}
        </div>
      ) : sub && sub.status === 'pending' ? (
        <div className="card">
          <b style={{ fontSize: 14 }}>{sub.plan?.name ?? 'Piano'}</b>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>In attesa di conferma del pagamento.</p>
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Non hai ancora un piano attivo.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => navigate('/negozio')}>Scopri i piani</button>
        </div>
      )}

      {/* Storico acquisti */}
      <div className="sec">Storico acquisti</div>
      {err && <div className="banner err" style={{ marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : payments.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun acquisto per ora.</p></div>
      ) : (
        <div className="meals-col">
          {payments.map((p) => {
            const st = STATUS[p.status] ?? { label: p.status, bg: '#eee', col: '#555' };
            return (
              <div className="card storico-row" key={p.id} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.description}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {fmtDate(p.createdAt)} · {METHOD[p.method] ?? p.method}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <span className="chip" style={{ background: st.bg, color: st.col, fontSize: 11 }}>{st.label}</span>
                    {p.status === 'approved' && (
                      <button className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busyId === p.id} onClick={() => downloadReceipt(p.id)}>
                        <i className="ti ti-download" style={{ fontSize: 12 }} /> {busyId === p.id ? 'Attendi…' : 'Ricevuta'}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{euro(p.amountCents)}</div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => { logout(); navigate('/'); }}>
        <i className="ti ti-logout" /> Esci
      </button>
    </div>
  );
}
