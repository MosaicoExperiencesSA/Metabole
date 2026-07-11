import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import type { OnboardingResult } from '../onboarding/types';

/**
 * Coda commerciale dopo l'onboarding (DEMO VISIVA, come nel prototipo):
 * percorso pronto → scegli il piano → riepilogo e pagamento → quando iniziare →
 * tutto pronto → il tuo menu è pronto. Il pagamento è finto: verrà collegato a Stripe in fase 3.
 */

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(d: Date) {
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const PLANS = {
  mensile: { name: 'Percorso mensile · 5 pasti', sub: 'Coach + nutrizionista', price: '€ 99', per: '/mese', cents: '€ 99' },
  trimestrale: { name: 'Percorso 3 mesi', sub: 'Risultati più solidi', price: '€ 267', per: '', cents: '€ 267' },
};

export default function PlanFlow({ result, onDone }: { result: OnboardingResult; onDone: () => void }) {
  const { user } = useAuth();
  const name = (user?.firstName || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<'mensile' | 'trimestrale'>('trimestrale');
  const [startDate, setStartDate] = useState(iso(addDays(new Date(), 5)));

  const startD = new Date(startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visible = addDays(startD, -2);
  const daysToVisible = Math.round((visible.getTime() - today.getTime()) / 86400000);
  const alreadyVisible = daysToVisible <= 0;

  function Frame({ title, sub, gaia, children, btn, onNext }: { title: string; sub?: string; gaia?: string; children: React.ReactNode; btn: string; onNext: () => void }) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar onb">
          {gaia && <div className="onb-gaia"><Gaia clip={gaia} size={110} controls={false} /></div>}
          <div className="onb-body">
            <h1>{title}</h1>
            {sub && <p className="muted">{sub}</p>}
            {children}
            <button className="btn" style={{ marginTop: 18 }} onClick={onNext}>{btn}</button>
          </div>
        </div>
      </div>
    );
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

  // 1 — Scegli il piano
  if (step === 1) {
    return (
      <Frame title="Scegli il tuo piano" sub="Puoi cambiarlo quando vuoi." btn="Continua" onNext={() => setStep(2)}>
        <div className={`card plan-card${plan === 'mensile' ? ' sel' : ''}`} onClick={() => setPlan('mensile')}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{PLANS.mensile.name}</div>
            <div className="muted" style={{ fontSize: 11 }}>{PLANS.mensile.sub}</div>
          </div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 700 }}>{PLANS.mensile.price}</div><div className="muted" style={{ fontSize: 10 }}>{PLANS.mensile.per}</div></div>
        </div>
        <div className={`card plan-card${plan === 'trimestrale' ? ' sel' : ''}`} onClick={() => setPlan('trimestrale')}>
          <div style={{ flex: 1 }}>
            <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Più scelto · -10%</span>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 5 }}>{PLANS.trimestrale.name}</div>
            <div className="muted" style={{ fontSize: 11 }}>{PLANS.trimestrale.sub}</div>
          </div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 700 }}>{PLANS.trimestrale.price}</div>{plan === 'trimestrale' && <i className="ti ti-circle-check" style={{ color: '#12A386', fontSize: 20 }} />}</div>
        </div>
      </Frame>
    );
  }

  // 2 — Riepilogo e pagamento (finto)
  if (step === 2) {
    return (
      <Frame title="Riepilogo" sub="Ancora un passo." btn="Paga e attiva" onNext={() => setStep(3)}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13 }}>{PLANS[plan].name}</span><b style={{ fontSize: 14 }}>{PLANS[plan].price}</b>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Metodo di pagamento</div>
          <div className="row" style={{ alignItems: 'center', gap: 9 }}>
            <i className="ti ti-credit-card" style={{ fontSize: 20, color: '#3A6EA5' }} />
            <span style={{ fontSize: 13 }}>•••• •••• •••• 4242</span>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-lock" style={{ fontSize: 14 }} /> Pagamento sicuro e crittografato. <b>&nbsp;(demo)</b>
        </div>
      </Frame>
    );
  }

  // 3 — Quando vuoi iniziare
  if (step === 3) {
    return (
      <Frame title="Quando vuoi iniziare?" sub="Scegli il giorno in cui parte il tuo piano." btn="Conferma data" onNext={() => setStep(4)}>
        <div className="card">
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Data di inizio</div>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none' }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
            <i className="ti ti-eye" style={{ color: '#0E7C66', fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 13, color: '#0E7C66', fontWeight: 600 }}>Menu visibile dal {fmt(visible)}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Si sblocca 2 giorni prima dell'inizio.</div>
            </div>
          </div>
        </div>
      </Frame>
    );
  }

  // 4 — Tutto pronto
  if (step === 4) {
    return (
      <Frame title={`Tutto pronto, ${name}!`} sub={`Il tuo piano inizia ${fmt(startD)}.`} btn="Vai alla home" onNext={() => setStep(5)}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11' }}><i className="ti ti-circle-check" /></span>
        </div>
        {alreadyVisible ? (
          <div className="card" style={{ background: '#DCF0D8', boxShadow: 'none', textAlign: 'center' }}>
            <i className="ti ti-lock-open" style={{ fontSize: 22, color: '#3B6D11' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11', marginTop: 5 }}>Il menu è già visibile!</div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11 }}>Il menu si sblocca tra</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--teal)', lineHeight: 1.1, margin: '4px 0' }}>{daysToVisible} <span style={{ fontSize: 14, color: '#7C8C88' }}>giorni</span></div>
            <div className="muted" style={{ fontSize: 11 }}><i className="ti ti-lock" style={{ fontSize: 12 }} /> visibile dal {fmt(visible)} (2 giorni prima)</div>
          </div>
        )}
      </Frame>
    );
  }

  // 5 — Il tuo menu è pronto
  const preview = [
    ['Oggi', 'Colazione · yogurt', 'Pranzo · farro e pollo', 'Cena · orata'],
    ['Domani', 'Colazione · pancake', 'Pranzo · vellutata', 'Cena · pizza integrale'],
  ];
  return (
    <Frame title="Il tuo menu è pronto!" sub="Ecco i primi due giorni. Il resto dopo i check-in." btn="Apri l'app" onNext={onDone}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <span className="big-badge" style={{ background: 'var(--teal)', color: '#fff' }}><i className="ti ti-lock-open" /></span>
      </div>
      {preview.map((d) => (
        <div className="card" key={d[0]}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{d[0]}</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>{d[1]}<br />{d[2]}<br />{d[3]}</div>
        </div>
      ))}
      <div className="card" style={{ background: '#F1EFEA', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 9, opacity: 0.85 }}>
        <i className="ti ti-lock" style={{ color: '#9aa' }} />
        <span className="muted" style={{ fontSize: 12 }}>Giorni 3-4 · dopo il check-in</span>
      </div>
    </Frame>
  );
}
