import { useNavigate } from 'react-router-dom';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';

/** Passo 1 di 34 — Benvenuto: brand MetaboleAI, assistente Gaia, prova sociale, testimonianze. */
export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ overflowY: 'auto' }}>
        {/* Progress */}
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Passo 1 di 34</div>
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 999, marginBottom: 16 }}>
          <div style={{ width: '3%', height: '100%', background: 'var(--teal)', borderRadius: 999 }} />
        </div>

        {/* Brand */}
        <h1 style={{ textAlign: 'center', fontSize: 34, fontWeight: 800, margin: '2px 0' }}>
          <span style={{ color: 'var(--teal)' }}>Metabole</span><span style={{ color: '#6C5AB7' }}>AI</span>
        </h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 6, lineHeight: 1.45 }}>
          Non una dieta: un<span style={{ color: '#6C5AB7', fontWeight: 700 }}>'AI</span> che cuce il tuo percorso su misura, insieme a coach e nutrizionista.
        </p>

        {/* Card assistente */}
        <div style={{ background: 'var(--teal)', color: '#fff', borderRadius: 18, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 15 }}>La tua assistente <span style={{ color: '#CDBBF2' }}>AI</span></b>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-volume" />
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
            <div style={{ flex: 'none' }}><Gaia clip="benvenuto" size={92} controls={false} /></div>
            <TypeText
              style={{ margin: 0, fontSize: 14, lineHeight: 1.45, flex: 1 }}
              segments={[
                { t: 'Ciao, sono ' }, { t: 'Gaia', b: true }, { t: ", l'assistente " }, { t: 'AI', b: true },
                { t: ' di MetaboleAI: il tuo percorso personalizzato per raggiungere e mantenere la tua ' }, { t: 'forma', b: true },
                { t: ' migliore. Accedi se sei già registrata, o registrati se sei nuova.' },
              ]}
            />
          </div>
        </div>

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => nav('/login')}><i className="ti ti-login" /> Accedi</button>
          <button className="btn" style={{ flex: 1 }} onClick={() => nav('/diversi')}>Registrati</button>
        </div>

        {/* Prova sociale */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <span style={{ color: '#E8B84B', letterSpacing: 1, fontSize: 15 }}>★★★★★</span>
          <b>24.000</b><span className="muted">persone già seguite</span>
        </div>

        {/* Testimonianze */}
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>"Ho perso 7 kg senza sentirmi a dieta. La coach c'era sempre."</p>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>— Martina, 41 anni</div>
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <p style={{ margin: 0 }}>"Finalmente un percorso cucito su di me, non la solita dieta."</p>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>— Elena, 35 anni</div>
        </div>
      </div>
    </div>
  );
}
