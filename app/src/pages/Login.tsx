import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
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
    <div className="app-frame">
      <div className="screen no-tabbar">
        <div className="hero" style={{ marginBottom: 22 }}>
          <div className="chip" style={{ marginBottom: 10 }}>
            <i className="ti ti-sparkles" /> Metabole
          </div>
          <h1 style={{ color: '#fff' }}>Bentornata 👋</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>Accedi per continuare il tuo percorso.</p>
        </div>

        {err && <div className="banner err">{err}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Accedi'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: 22 }}>
          Non hai un account? <Link className="link" to="/register">Registrati</Link>
        </p>
      </div>
    </div>
  );
}
