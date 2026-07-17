import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';
import type { OnboardingResult } from '../onboarding/types';

/**
 * Coda onboarding: percorso pronto → scegli il piano → il piano va nel CARRELLO
 * e si prosegue al checkout unico (dove si sceglie metodo, sconto e si paga).
 */

interface Plan { id: string; name: string; priceCents: number; period: string; features: string[]; }
const euro = (c: number) => `€ ${Math.round(c / 100)}`;
const PERIOD: Record<string, string> = { '3m': '3 mesi', '6m': '6 mesi', '12m': '12 mesi' };

export default function PlanFlow({ result, onDone }: { result: OnboardingResult; onDone: () => void }) {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const name = user?.firstName || 'ciao';
  const coachName = result.team.coach?.displayName ?? null;
  // Nutrizionista non mostrato per ora (richiesta): il percorso parla solo della coach.
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/me/plans').then((ps) => { setPlans(ps); if (ps[0]) setPlanId(ps[0].id); }).catch(() => {});
  }, []);

  function goCheckout() {
    const chosen = plans.find((p) => p.id === planId);
    if (chosen) cart.setPlan({ id: chosen.id, name: chosen.name, priceCents: chosen.priceCents, period: chosen.period });
    onDone(); // completa l'onboarding → entra nell'app
    navigate('/checkout');
  }

  if (step === 0) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar onb">
          <div className="onb-body">
            <h1>Il tuo percorso è pronto</h1>
            <p className="muted" style={{ marginTop: 2 }}>Costruito sulle tue risposte.</p>
            <div className="qbubble">
              {/* Audio 'percorso' disattivato: il file contiene ancora nomi di esempio
                  (Giulia/Sara/Marini). Riattivare clip="percorso" quando il socio fornisce
                  la registrazione corretta (senza nomi). Il testo a schermo è già dinamico. */}
              <Gaia size={62} controls={false} />
              <div className="bubble">
                <TypeText segments={
                  coachName
                    ? [
                        { t: `${name}, il tuo percorso personalizzato è pronto, costruito sulle informazioni che hai fornito. La tua coach è ` },
                        { t: coachName, b: true },
                        { t: ' e ti contatterà a breve. Sei pronta a partire?' },
                      ]
                    : [
                        { t: `${name}, il tuo percorso personalizzato è pronto, costruito sulle informazioni che hai fornito. La tua coach ti contatterà a breve. Sei pronta a partire?` },
                      ]
                } />
              </div>
            </div>
            <div className="card result-card">
              <div className="result-name">{result.path.name}</div>
              {result.path.tags.length > 0 && <div className="result-tags">{result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>}
            </div>
            <div className="card">
              <h2>La tua coach</h2>
              <p className="muted" style={{ margin: 0 }}>
                {coachName ? (
                  <>La tua coach è <b>{coachName}</b>. Ti contatterà a breve per iniziare.</>
                ) : (
                  <>La tua coach ti verrà presentata a breve e ti contatterà per iniziare.</>
                )}
              </p>
            </div>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => setStep(1)}>Scegli il piano</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStep(2)}>Lo faccio dopo</button>
          </div>
        </div>
      </div>
    );
  }

  // Step finale onboarding: "Tutto pronto!" con date d'esempio (il piano vero
  // parte dopo il pagamento; qui è la schermata celebrativa di fine setup).
  if (step === 2) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() + 3);
    const visible = new Date(start); visible.setDate(visible.getDate() - 2);
    const daysToVisible = Math.max(0, Math.round((visible.getTime() - today.getTime()) / 86_400_000));
    const fmt = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const capName = name.charAt(0).toUpperCase() + name.slice(1);
    return (
      <div className="app-frame">
        <div className="screen no-tabbar onb">
          <div className="onb-body" style={{ paddingTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11', margin: '0 auto 12px' }}><i className="ti ti-circle-check" /></span>
              <h1 style={{ marginBottom: 4 }}>Tutto pronto, {capName}!</h1>
              <p className="muted" style={{ marginTop: 0, textTransform: 'capitalize' }}>Il tuo piano inizia {fmt(start)}.</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: 11 }}>Il menu si sblocca tra</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--teal)', lineHeight: 1.1, margin: '4px 0' }}>{daysToVisible} <span style={{ fontSize: 14, color: '#7C8C88' }}>giorni</span></div>
              <div className="muted" style={{ fontSize: 11, textTransform: 'capitalize' }}><i className="ti ti-lock" style={{ fontSize: 12 }} /> visibile dal {fmt(visible)}</div>
            </div>
            <div className="card">
              <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Nel frattempo</div>
              {([['ti-ruler-2', 'Registra le tue misure iniziali'], ['ti-basket', 'Prepara la spesa consigliata']] as [string, string][]).map((r) => (
                <div key={r[1]} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, fontSize: 12.5 }}>
                  <i className={`ti ${r[0]}`} style={{ fontSize: 16, color: '#0E7C66' }} />{r[1]}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={onDone}>Vai alla home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        <div className="onb-body">
          <h1>Scegli il tuo piano</h1>
          <p className="muted">Lo aggiungiamo al carrello: al passo dopo scegli come pagare e applichi eventuali buoni.</p>

          {plans.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Carico i piani…</p></div>}

          {plans.map((p, i) => {
            const sel = planId === p.id;
            return (
              <div key={p.id} className={`card plan-card${sel ? ' sel' : ''}`} onClick={() => setPlanId(p.id)} style={{ display: 'block' }}>
                <div className="row-between">
                  <div>
                    {i === 0 && <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Più scelto</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: i === 0 ? 5 : 0 }}>{p.name}</div>
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

          <button className="btn" style={{ marginTop: 16 }} onClick={goCheckout} disabled={!planId}>Vai al pagamento</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStep(2)}>Lo faccio dopo</button>
        </div>
      </div>
    </div>
  );
}
