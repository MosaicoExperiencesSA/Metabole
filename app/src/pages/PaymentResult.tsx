import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import WidgetInstall from '../components/WidgetInstall';

/**
 * Ritorno da Stripe Checkout: /payment/success e /payment/cancelled.
 * Sul successo l'utente sceglie la DATA DI INIZIO del piano (planStartDate):
 * il menu si sblocca 2 giorni prima. Senza questa data il backend non eroga il menu.
 */

const VISIBLE_DAYS_BEFORE = 2;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmt = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function PaymentResult({ ok }: { ok: boolean }) {
  const nav = useNavigate();
  const today = startOfDay(new Date());
  const [date, setDate] = useState(iso(addDays(today, 3)));
  const [phase, setPhase] = useState<'date' | 'done'>('date');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setErr(null);
    setBusy(true);
    try {
      await api('/me/client-profile', { method: 'PATCH', body: JSON.stringify({ planStartDate: date }) });
      setPhase('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Non è stato possibile salvare la data.');
    } finally {
      setBusy(false);
    }
  }

  if (!ok) {
    return (
      <div className="onb-body" style={{ textAlign: 'center', paddingTop: 24 }}>
        <span className="big-badge" style={{ background: '#F7DAD6', color: '#993C1D', margin: '0 auto 14px' }}><i className="ti ti-x" /></span>
        <h1>Pagamento annullato</h1>
        <p className="muted">Nessun addebito effettuato. Puoi completare il pagamento quando vuoi.</p>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => nav('/')}>Vai alla home</button>
      </div>
    );
  }

  if (phase === 'date') {
    const start = startOfDay(new Date(date));
    const visible = addDays(start, -VISIBLE_DAYS_BEFORE);
    return (
      <div className="onb-body" style={{ paddingTop: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11', margin: '0 auto 12px' }}><i className="ti ti-circle-check" /></span>
          <h1 style={{ marginBottom: 4 }}>Pagamento ricevuto!</h1>
          <p className="muted" style={{ marginTop: 0 }}>Scegli quando far partire il tuo piano.</p>
        </div>
        {err && <div className="banner err">{err}</div>}
        <div className="card">
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Data di inizio</div>
          <input className="input" type="date" min={iso(today)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none', display: 'flex', gap: 9 }}>
          <i className="ti ti-eye" style={{ color: '#0E7C66', fontSize: 18 }} />
          <div>
            <div style={{ fontSize: 12.5, color: '#0E7C66', fontWeight: 600 }}>Menu visibile dal {fmt(visible)}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Si sblocca 2 giorni prima dell'inizio, così arrivi preparata.</div>
          </div>
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 6 }} onClick={confirm} disabled={busy || !date}>{busy ? 'Salvo…' : 'Conferma data'}</button>
      </div>
    );
  }

  // phase 'done'
  const start = startOfDay(new Date(date));
  const visible = addDays(start, -VISIBLE_DAYS_BEFORE);
  const daysToVisible = Math.round((visible.getTime() - today.getTime()) / 86_400_000);
  const alreadyVisible = daysToVisible <= 0;
  return (
    <div className="onb-body" style={{ paddingTop: 12 }}>
      <div style={{ textAlign: 'center' }}>
        <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11', margin: '0 auto 12px' }}><i className="ti ti-circle-check" /></span>
        <h1 style={{ marginBottom: 4 }}>Tutto pronto!</h1>
        <p className="muted" style={{ marginTop: 0, textTransform: 'capitalize' }}>Il tuo piano inizia {fmt(start)}.</p>
      </div>
      {alreadyVisible ? (
        <div className="card" style={{ background: '#DCF0D8', boxShadow: 'none', textAlign: 'center' }}>
          <i className="ti ti-lock-open" style={{ fontSize: 22, color: '#3B6D11' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11', marginTop: 5 }}>Il menu è già visibile!</div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 11 }}>Il menu si sblocca tra</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#12A386', lineHeight: 1.1, margin: '4px 0' }}>{daysToVisible} <span style={{ fontSize: 14, color: '#7C8C88' }}>giorni</span></div>
          <div className="muted" style={{ fontSize: 11, textTransform: 'capitalize' }}><i className="ti ti-lock" style={{ fontSize: 12 }} /> visibile dal {fmt(visible)}</div>
        </div>
      )}
      <div className="card">
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Nel frattempo</div>
        {[['ti-ruler-2', 'Registra le tue misure iniziali'], ['ti-basket', 'Prepara la spesa consigliata']].map((r) => (
          <div key={r[1]} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, fontSize: 12.5 }}>
            <i className={`ti ${r[0]}`} style={{ fontSize: 16, color: '#0E7C66' }} />{r[1]}
          </div>
        ))}
      </div>
      {/* Suggerimento widget: aggiungilo alla home del telefono (guida nel foglio). */}
      <div style={{ marginBottom: 10 }}><WidgetInstall /></div>
      <button className="btn ghost" style={{ width: '100%' }} onClick={() => nav('/')}>Vai alla home</button>
    </div>
  );
}
