import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import PasswordField from '../components/PasswordField';

/**
 * Impostazione della password personale al primo accesso, per gli account provvisori
 * (lead creati da backoffice con una password di default). Mostrata SUBITO DOPO il
 * questionario di onboarding (scelta: "reset a fine questionario"). Non chiede la
 * password provvisoria: l'utente è già autenticato e il flag mustChangePassword prova
 * che è un primo cambio forzato. Al successo azzera il flag lato server e prosegue.
 */
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const { refreshMe } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('La password deve avere almeno 8 caratteri.'); return; }
    if (pw !== pw2) { setErr('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      await api('/me/password/initial', { method: 'PATCH', body: JSON.stringify({ newPassword: pw }) });
      await refreshMe(); // aggiorna user.mustChangePassword → false
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non è stato possibile impostare la password.');
      setBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ overflowY: 'auto' }}>
        <h1 style={{ margin: '2px 0' }}>Imposta la tua password</h1>
        <p className="muted" style={{ marginTop: 2 }}>Ultimo passo: scegli una password personale.</p>

        <div className="qbubble">
          <Gaia size={58} controls={false} />
          <div className="bubble">
            Hai completato il questionario! Ora crea una password tutta tua: quella che hai
            ricevuto via email era provvisoria.
          </div>
        </div>

        {err && <div className="banner err">{err}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Nuova password</label>
            <PasswordField
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label>Conferma password</label>
            <PasswordField
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Salva e continua'}
          </button>
        </form>
      </div>
    </div>
  );
}
