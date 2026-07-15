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
  const nutriName = result.team.nutritionist?.displayName ?? null;
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/plans').then((ps) => { setPlans(ps); if (ps[0]) setPlanId(ps[0].id); }).catch(() => {});
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
                  coachName || nutriName
                    ? [
                        { t: `${name}, il tuo percorso personalizzato è pronto. Settato secondo le indicazioni del nutrizionista e personalizzato sulle informazioni che hai fornito. La tua coach è ` },
                        { t: coachName ?? 'in arrivo', b: true },
                        { t: ' e il tuo nutrizionista è ' },
                        { t: nutriName ?? 'in arrivo', b: true },
                        { t: '. Sei pronta a partire?' },
                      ]
                    : [
                        { t: `${name}, il tuo percorso personalizzato è pronto, costruito sulle informazioni che hai fornito. A breve il responsabile ti presenterà la tua coach e il tuo nutrizionista: sarà la nutrizionista a contattarti per organizzare la prima visita. Sei pronta a partire?` },
                      ]
                } />
              </div>
            </div>
            <div className="card result-card">
              <div className="result-name">{result.path.name}</div>
              {result.path.tags.length > 0 && <div className="result-tags">{result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>}
            </div>
            <div className="card">
              <h2>Il tuo team</h2>
              <p className="muted" style={{ margin: 0 }}>
                {coachName || nutriName ? (
                  <>
                    Coach: <b>{coachName ?? 'in arrivo'}</b><br />
                    Nutrizionista: <b>{nutriName ?? 'in arrivo'}</b>
                  </>
                ) : (
                  <>Coach e nutrizionista ti verranno presentati a breve; la nutrizionista ti contatterà per organizzare la prima visita.</>
                )}
              </p>
            </div>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => setStep(1)}>Scegli il piano</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={onDone}>Lo faccio dopo</button>
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
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={onDone}>Lo faccio dopo</button>
        </div>
      </div>
    </div>
  );
}
