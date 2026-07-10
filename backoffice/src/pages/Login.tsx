import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../api/client';

type Mode = 'login' | 'reset_request' | 'reset_confirm';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError('Troppi tentativi. Attendi un minuto e riprova.');
      else if (err instanceof ApiError && err.status === 401) setError('Email o password non corretti.');
      else setError(err instanceof Error ? err.message : 'Accesso non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      await api('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, false);
      setNotice('Se l\'email è registrata, riceverai un codice. Controlla la posta (anche lo spam) e incollalo qui sotto.');
      setMode('reset_confirm');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError('Troppe richieste. Attendi qualche minuto e riprova.');
      else setError(err instanceof Error ? err.message : 'Richiesta non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    if (newPassword.length < 8) {
      setError('La nuova password deve avere almeno 8 caratteri.');
      return;
    }
    setBusy(true);
    try {
      await api(
        '/auth/password-reset/confirm',
        { method: 'POST', body: JSON.stringify({ token: code.trim(), newPassword }) },
        false,
      );
      setNotice('Password impostata! Ora accedi con la nuova password.');
      setPassword('');
      setCode('');
      setNewPassword('');
      setMode('login');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError('Codice non valido o scaduto. Richiedine uno nuovo.');
      else setError(err instanceof Error ? err.message : 'Reimpostazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">
          <i className="ti ti-leaf" />
        </div>
        <h1>Metabole</h1>
        <div className="sub">Backoffice · accesso staff</div>

        {error && <div className="banner err">{error}</div>}
        {notice && <div className="banner ok">{notice}</div>}

        {mode === 'login' && (
          <form onSubmit={doLogin}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Accedi'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="btn ghost sm" style={{ border: 'none', background: 'none', color: 'var(--teal-dark)' }} onClick={() => { resetMessages(); setMode('reset_request'); }}>
                Password dimenticata?
              </button>
            </div>
          </form>
        )}

        {mode === 'reset_request' && (
          <form onSubmit={requestReset}>
            <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
              Inserisci la tua email: ti invieremo un codice per impostare una nuova password.
            </p>
            <div className="field">
              <label htmlFor="remail">Email</label>
              <input id="remail" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Invia il codice'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="btn ghost sm" style={{ border: 'none', background: 'none', color: 'var(--muted)' }} onClick={() => { resetMessages(); setMode('login'); }}>
                ← Torna all'accesso
              </button>
            </div>
          </form>
        )}

        {mode === 'reset_confirm' && (
          <form onSubmit={confirmReset}>
            <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
              Incolla il codice ricevuto via email e scegli la nuova password.
            </p>
            <div className="field">
              <label htmlFor="code">Codice dall'email</label>
              <input id="code" className="input" type="text" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus placeholder="Incolla qui il codice" />
            </div>
            <div className="field">
              <label htmlFor="newpwd">Nuova password (min. 8 caratteri)</label>
              <input id="newpwd" className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Imposta password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="btn ghost sm" style={{ border: 'none', background: 'none', color: 'var(--muted)' }} onClick={() => { resetMessages(); setMode('reset_request'); }}>
                Non hai ricevuto il codice? Richiedilo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
