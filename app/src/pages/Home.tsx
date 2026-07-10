import { useAuth } from '../auth/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();
  const firstName = user?.email?.split('@')[0] ?? '';

  return (
    <>
      <div className="hero">
        <div className="chip" style={{ marginBottom: 12 }}>
          <i className="ti ti-sun" /> Buongiorno
        </div>
        <h1 style={{ color: '#fff', textTransform: 'capitalize' }}>{firstName}</h1>
        <p style={{ margin: 0, opacity: 0.92 }}>
          Oggi è un buon giorno per prenderti cura di te. Un passo alla volta.
        </p>
      </div>

      {/* Segnaposto mascotte + frase del giorno (animazione e voce ElevenLabs in arrivo) */}
      <div className="card" style={{ marginTop: 14, textAlign: 'center' }}>
        <div
          style={{
            width: 120,
            height: 120,
            margin: '4px auto 12px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #a7e8d8, #12a386)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 54,
          }}
          aria-hidden
        >
          🌿
        </div>
        <h2 style={{ marginBottom: 4 }}>La tua coach</h2>
        <p className="muted" style={{ margin: 0 }}>
          Presto qui troverai la mascotte animata con la voce che ti accompagna ogni giorno.
        </p>
      </div>

      <div className="card">
        <h2>Il tuo percorso</h2>
        <p className="muted" style={{ margin: 0 }}>
          Le pesate, il diario, il menu e gli obiettivi arriveranno nelle prossime schermate.
        </p>
      </div>

      <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => logout()}>
        <i className="ti ti-logout" /> Esci
      </button>
    </>
  );
}
