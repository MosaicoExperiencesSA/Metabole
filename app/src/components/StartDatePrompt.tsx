import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Rete di sicurezza: se l'abbonamento è ATTIVO ma manca la data di inizio piano
 * (planStartDate) — es. dopo un bonifico approvato — il menu non verrebbe mai
 * erogato. Qui la cliente sceglie la data; salva su PATCH /me/client-profile.
 * Non mostra nulla quando non serve.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function StartDatePrompt() {
  const today = startOfDay(new Date());
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(iso(addDays(today, 3)));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sub, profile] = await Promise.all([
          api<{ status: string } | null>('/me/subscription').catch(() => null),
          api<{ planStartDate: string | null }>('/me/client-profile').catch(() => null),
        ]);
        if (sub?.status === 'active' && profile && !profile.planStartDate) setShow(true);
      } catch {
        /* niente prompt in caso di errore */
      }
    })();
  }, []);

  async function confirm() {
    setBusy(true);
    try {
      await api('/me/client-profile', { method: 'PATCH', body: JSON.stringify({ planStartDate: date }) });
      setShow(false);
    } catch {
      /* riproverà al prossimo caricamento */
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;
  return (
    <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none', border: '1px solid #BFE0D2' }}>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span className="event-ic" style={{ background: '#12A386', color: '#fff' }}><i className="ti ti-calendar-check" /></span>
        <div><b style={{ fontSize: 14 }}>Quando vuoi iniziare?</b><div className="muted" style={{ fontSize: 11 }}>Il menu si sblocca 2 giorni prima.</div></div>
      </div>
      <input className="input" type="date" min={iso(today)} value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 8 }} />
      <button className="btn" style={{ width: '100%' }} onClick={confirm} disabled={busy}>{busy ? 'Salvo…' : 'Conferma data di inizio'}</button>
    </div>
  );
}
