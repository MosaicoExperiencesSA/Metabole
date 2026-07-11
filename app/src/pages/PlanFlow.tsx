import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import Gaia from '../components/Gaia';
import type { OnboardingResult } from '../onboarding/types';

/**
 * Coda commerciale dopo l'onboarding, con PAGAMENTO REALE:
 * percorso pronto → scegli piano + metodo → carta (Stripe Checkout) o bonifico.
 * La carta si inserisce sulla pagina sicura di Stripe (mai in-app).
 */

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  period: string;
  features: string[];
}

const euro = (c: number) => `€ ${Math.round(c / 100)}`;
const PERIOD: Record<string, string> = { '3m': '3 mesi', '6m': '6 mesi', '12m': '12 mesi' };

function Frame({ title, sub, gaia, children, btn, onNext, busy }: { title: string; sub?: string; gaia?: string; children: React.ReactNode; btn: string; onNext: () => void; busy?: boolean }) {
  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        {gaia && <div className="onb-gaia"><Gaia clip={gaia} size={110} controls={false} /></div>}
        <div className="onb-body">
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
          {children}
          <button className="btn" style={{ marginTop: 18 }} onClick={onNext} disabled={busy}>{busy ? 'Attendi…' : btn}</button>
        </div>
      </div>
    </div>
  );
}

export default function PlanFlow({ result, onDone }: { result: OnboardingResult; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<'card' | 'bank_transfer'>('card');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/plans').then((ps) => { setPlans(ps); if (ps[0]) setPlanId(ps[0].id); }).catch(() => {});
  }, []);

  async function pay() {
    if (!planId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ checkoutUrl?: string }>('/me/subscribe', { method: 'POST', body: JSON.stringify({ planId, method }) });
      if (method === 'card') {
        if (res.checkoutUrl) window.location.href = res.checkoutUrl;
        else setErr('Pagamento con carta non ancora disponibile: usa il bonifico.');
      } else {
        setStep(2);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  // 0 — Il tuo percorso è pronto
  if (step === 0) {
    return (
      <Frame title="Il tuo percorso è pronto! 🎉" gaia="percorso" btn="Continua" onNext={() => setStep(1)}>
        <div className="card result-card">
          <div className="result-name">{result.path.name}</div>
          {result.path.tags.length > 0 && <div className="result-tags">{result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>}
        </div>
        <div className="card">
          <h2>Il tuo team</h2>
          <p className="muted" style={{ margin: 0 }}>
            Coach: <b>{result.team.coach?.displayName ?? 'in assegnazione'}</b><br />
            Nutrizionista: <b>{result.team.nutritionist?.displayName ?? 'in assegnazione'}</b>
          </p>
        </div>
        <div className="card"><h2>Prima visita</h2><p className="muted" style={{ margin: 0 }}>{result.firstVisit.note}</p></div>
      </Frame>
    );
  }

  // 2 — Conferma bonifico
  if (step === 2) {
    return (
      <Frame title="Ci siamo quasi!" btn="Entra nell'app" onNext={onDone}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11' }}><i className="ti ti-mail-check" /></span>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0 }}>Ti abbiamo inviato via email <b>gli estremi del bonifico</b>. Il piano si attiva appena riceviamo il pagamento e lo verifichiamo.</p>
        </div>
      </Frame>
    );
  }

  // 1 — Scegli il piano + metodo
  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        <div className="onb-body">
          <h1>Scegli il tuo piano</h1>
          <p className="muted">Puoi cambiarlo quando vuoi.</p>

          {plans.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Carico i piani…</p></div>}

          {plans.map((p) => {
            const sel = planId === p.id;
            return (
              <div key={p.id} className={`card plan-card${sel ? ' sel' : ''}`} onClick={() => setPlanId(p.id)} style={{ display: 'block' }}>
                <div className="row-between">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{PERIOD[p.period] ?? p.period}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{euro(p.priceCents)}</div>
                    {sel && <i className="ti ti-circle-check" style={{ color: 'var(--teal)', fontSize: 20 }} />}
                  </div>
                </div>
                {p.features?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.features.map((f) => <span className="chip" key={f} style={{ fontSize: 11 }}>{f}</span>)}
                  </div>
                )}
              </div>
            );
          })}

          <div className="sec-note" style={{ color: 'var(--muted)', textAlign: 'left', margin: '10px 2px 8px', fontSize: 13, fontWeight: 700 }}>Come vuoi pagare?</div>
          <div className="opt-list">
            <button type="button" className={`opt${method === 'card' ? ' on' : ''}`} onClick={() => setMethod('card')}>
              <span className="opt-ind">{method === 'card' && <i className="ti ti-check" />}</span>
              <span><b>Carta</b> · pagamento sicuro con Stripe</span>
            </button>
            <button type="button" className={`opt${method === 'bank_transfer' ? ' on' : ''}`} onClick={() => setMethod('bank_transfer')}>
              <span className="opt-ind">{method === 'bank_transfer' && <i className="ti ti-check" />}</span>
              <span><b>Bonifico</b> · ti inviamo gli estremi via email</span>
            </button>
          </div>

          {err && <div className="banner err" style={{ marginTop: 12 }}>{err}</div>}

          <button className="btn" style={{ marginTop: 16 }} onClick={pay} disabled={busy || !planId}>
            {busy ? 'Attendi…' : method === 'card' ? 'Paga e attiva' : 'Ricevi gli estremi'}
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={onDone}>Lo faccio dopo</button>
        </div>
      </div>
    </div>
  );
}
