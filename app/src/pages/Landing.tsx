import { useNavigate } from 'react-router-dom';
import Gaia from '../components/Gaia';

/** Passo 1 del prototipo: Gaia accoglie, poi si va alla registrazione (o al login). */
export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        <div className="onb-gaia" style={{ marginTop: 24 }}>
          <Gaia clip="benvenuto" size={148} controls={false} />
        </div>
        <div className="onb-body" style={{ textAlign: 'center' }}>
          <h1>Ciao, sono Gaia 🌿</h1>
          <p className="muted">
            Sono la tua assistente. Ti guiderò passo passo per costruire il tuo percorso, cucito su di te.
            Tocca me per riascoltarmi. Quando sei pronta, entra.
          </p>
          <button className="btn" onClick={() => nav('/register')}>Entra in Metabole</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => nav('/login')}>Ho già un account</button>
        </div>
      </div>
    </div>
  );
}
