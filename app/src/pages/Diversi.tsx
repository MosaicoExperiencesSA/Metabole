import { useNavigate } from 'react-router-dom';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';

/** Passo 2 di 34 — "In cosa siamo diversi": i 5 punti di forza, poi si va alla registrazione. */
const ITEMS: { n: number; title: string; icon: string; bg: string; color: string }[] = [
  { n: 1, title: 'Coach sempre presente', icon: 'ti-heart-handshake', bg: '#DCEBE3', color: '#0E7C66' },
  { n: 2, title: 'Nutrizionista specializzato', icon: 'ti-stethoscope', bg: '#E7EEF6', color: '#3A6EA5' },
  { n: 3, title: 'App intelligente', icon: 'ti-sparkles', bg: '#DCEBE3', color: '#0E7C66' },
  { n: 4, title: 'Dieta personalizzata', icon: 'ti-salad', bg: '#FBEEE7', color: '#B8863B' },
  { n: 5, title: 'Gaia · supervisore AI', icon: 'ti-robot', bg: '#ECE7F7', color: '#6C5AB7' },
];

export default function Diversi() {
  const nav = useNavigate();
  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ overflowY: 'auto', paddingBottom: 90 }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          <button className="link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => nav(-1)}>‹ Indietro</button>
          <span>Passo 2 di 34</span>
        </div>
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 999, marginBottom: 14 }}>
          <div style={{ width: '6%', height: '100%', background: 'var(--teal)', borderRadius: 999 }} />
        </div>

        <h1 style={{ margin: '2px 0', fontSize: 24 }}>In cosa siamo diversi</h1>
        <p className="muted" style={{ marginTop: 2 }}>Cinque cose che, insieme, non trovi altrove.</p>

        {/* Bolla Gaia */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '10px 0 14px' }}>
          <div style={{ flex: 'none' }}><Gaia size={48} controls={false} /></div>
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px 14px 14px 4px', padding: '10px 12px', fontSize: 14, boxShadow: 'var(--shadow)' }}>
            <TypeText segments={[{ t: 'Prima di iniziare, lascia che ti spieghi in cosa siamo diversi.' }]} />
          </div>
        </div>

        {ITEMS.map((it) => (
          <div key={it.n} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: it.bg, color: it.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className={`ti ${it.icon}`} style={{ fontSize: 22 }} />
            </span>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{it.n}</div>
              <b style={{ fontSize: 16 }}>{it.title}</b>
            </div>
          </div>
        ))}

        <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          Uniamo tutto questo <b style={{ color: 'var(--teal-dark)' }}>attorno a te</b>. Pronta?
        </p>
      </div>

      {/* CTA fissa in basso */}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <button className="btn" style={{ width: '100%' }} onClick={() => nav('/register')}>Sono pronta/o</button>
      </div>
    </div>
  );
}
