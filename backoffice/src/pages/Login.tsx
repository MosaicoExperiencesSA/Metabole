import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Troppi tentativi. Attendi un minuto e riprova.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Email o password non corretti.');
      } else {
        setError(err instanceof Error ? err.message : 'Accesso non riuscito.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="logo">
          <i className="ti ti-leaf" />
        </div>
        <h1>Metabole</h1>
        <div className="sub">Backoffice · accesso staff</div>

        {error && <div className="banner err">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
