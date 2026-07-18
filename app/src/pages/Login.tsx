import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import PasswordField from '../components/PasswordField';
import Landing from './Landing';

/**
 * Accedi — come nel prototipo: un foglio che sale dal basso ("bottom sheet")
 * sopra la Landing (MetaboleAI). "Bentornata" · Email o username · Password ·
 * Entra · Password dimenticata?.
 */
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Accesso non riuscito');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Landing sullo sfondo (non interattiva) */}
      <div aria-hidden style={{ pointerEvents: 'none' }}>
        <Landing />
      </div>

      {/* Foglio di accesso */}
      <div className="sheet-overlay" onClick={() => nav('/')}>
        <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-grab" />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className="ti ti-login-2" style={{ fontSize: 16 }} />
            </span>
            <b style={{ fontSize: 16 }}>Bentornata</b>
          </div>

          {err && <div className="banner err">{err}</div>}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label>Email o telefono</label>
              <input
                className="input"
                type="text"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordField
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ marginTop: 6 }}>
              {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Entra'}
            </button>
          </form>

          <div
            className="muted"
            style={{ textAlign: 'center', fontSize: 12, marginTop: 12 }}
          >
            <span className="link" style={{ cursor: 'pointer' }} onClick={() => nav('/reset-password')}>
              Password dimenticata?
            </span>
          </div>

          <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            Non hai un account? <Link className="link" to="/register">Registrati</Link>
          </p>
        </div>
      </div>
    </>
  );
}
