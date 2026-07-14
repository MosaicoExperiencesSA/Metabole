import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Schermata bloccante per gli account creati dall'admin con obbligo di cambio
 * password al primo accesso (user.mustChangePassword). Finché il cambio non
 * riesce, nessuna pagina del backoffice è raggiungibile.
 */
export function CambioPasswordObbligatorio() {
  const { user, logout, refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) { setError('La nuova password deve avere almeno 8 caratteri.'); return; }
    if (next === current) { setError('La nuova password deve essere diversa da quella attuale.'); return; }
    if (next !== confirm) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      await api('/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      await refreshUser(); // mustChangePassword ora è false → il gate si apre da solo
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cambio password non riuscito. Riprova.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">
          <i className="ti ti-lock" />
        </div>
        <h1>Benvenuta in Metabole</h1>
        <div className="sub">
          {user?.email} · per proteggere il tuo account devi scegliere una password personale prima di continuare.
        </div>

        {error && <div className="banner err">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="pw-current">Password attuale (quella che ti è stata consegnata)</label>
            <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw-next">Nuova password (almeno 8 caratteri)</label>
            <input id="pw-next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw-confirm">Conferma nuova password</label>
            <input id="pw-confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={busy || !current || !next || !confirm} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Imposta la nuova password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" className="btn ghost sm" style={{ border: 'none', background: 'none', color: 'var(--muted)' }} onClick={() => void logout()}>
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
