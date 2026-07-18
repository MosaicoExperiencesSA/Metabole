import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiPublic, ApiError } from '../api/client';
import PasswordField from '../components/PasswordField';

/**
 * Reset password cliente — stesso flusso del backoffice.
 * - Con ?token=… (dal link della mail): form per la NUOVA password → POST /auth/password-reset/confirm.
 * - Senza token: form per richiedere il link via email → POST /auth/password-reset.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = (params.get('token') ?? '').trim();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | 'requested' | 'reset'>(null);

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiPublic('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setDone('requested');
    } catch {
      // Per privacy l'API risponde sempre 202: mostriamo comunque conferma.
      setDone('requested');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('La password deve avere almeno 8 caratteri.'); return; }
    if (pw !== pw2) { setErr('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      await apiPublic('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, newPassword: pw }) });
      setDone('reset');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Reset non riuscito. Il link potrebbe essere scaduto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <div className="card" style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className="ti ti-key" style={{ fontSize: 16 }} />
            </span>
            <b style={{ fontSize: 16 }}>Reimposta la password</b>
          </div>

          {err && <div className="banner err" style={{ marginBottom: 10 }}>{err}</div>}

          {/* Esito */}
          {done === 'reset' ? (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Password aggiornata. Ora puoi accedere con la nuova password.</p>
              <button className="btn" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate('/login')}>Vai all'accesso</button>
            </>
          ) : done === 'requested' ? (
            <>
              <p className="muted" style={{ fontSize: 13 }}>
                Se l'indirizzo è registrato, ti abbiamo inviato una email con il link per reimpostare la password. Controlla anche lo spam.
              </p>
              <button className="btn ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate('/login')}>Torna all'accesso</button>
            </>
          ) : token ? (
            /* Con token → nuova password */
            <form onSubmit={confirmReset}>
              <div className="field">
                <label>Nuova password</label>
                <PasswordField autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
              </div>
              <div className="field">
                <label>Conferma password</label>
                <PasswordField autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={8} required />
              </div>
              <button className="btn" type="submit" disabled={busy} style={{ marginTop: 6, width: '100%' }}>
                {busy ? 'Salvo…' : 'Imposta la nuova password'}
              </button>
            </form>
          ) : (
            /* Senza token → richiesta link via email */
            <form onSubmit={requestLink}>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Inserisci la tua email: ti mandiamo il link per reimpostare la password.</p>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button className="btn" type="submit" disabled={busy} style={{ marginTop: 6, width: '100%' }}>
                {busy ? 'Invio…' : 'Invia il link di reset'}
              </button>
            </form>
          )}

          {!done && (
            <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              <span className="link" style={{ cursor: 'pointer' }} onClick={() => navigate('/login')}>Torna all'accesso</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
