import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr('Le password non coincidono');
      return;
    }
    setBusy(true);
    try {
      await register(email.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Registrazione non riuscita');
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
          <h1 style={{ color: '#fff' }}>Crea il tuo account</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>Inizia oggi il tuo percorso di benessere.</p>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label>Conferma password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Registrati'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: 22 }}>
          Hai già un account? <Link className="link" to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
