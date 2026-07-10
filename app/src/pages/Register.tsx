import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import Gaia from '../components/Gaia';

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    addressLine: '',
    postalCode: '',
    city: '',
    province: '',
    email: '',
    password: '',
    refCode: '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function up(k: keyof typeof f, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register(f);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Registrazione non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar">
        <h1>Crea il tuo account</h1>
        <p className="muted">Bastano pochi secondi.</p>

        <div className="qbubble">
          <Gaia clip="registrazione" size={58} controls={false} />
          <div className="bubble">
            Presentati, così saprò dove e come inviarti tutto il necessario. I percorsi sono personalizzati:
            potrebbero richiedere l'invio di <b>prodotti al tuo indirizzo</b> o di <b>schede via email</b>.
          </div>
        </div>

        {err && <div className="banner err">{err}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Nome</label>
            <input className="input" value={f.firstName} onChange={(e) => up('firstName', e.target.value)} autoComplete="given-name" required />
          </div>
          <div className="field">
            <label>Cognome</label>
            <input className="input" value={f.lastName} onChange={(e) => up('lastName', e.target.value)} autoComplete="family-name" required />
          </div>
          <div className="field">
            <label>Via e numero civico</label>
            <input className="input" value={f.addressLine} onChange={(e) => up('addressLine', e.target.value)} autoComplete="street-address" />
          </div>
          <div className="fields-grid">
            <div className="field">
              <label>CAP</label>
              <input className="input" value={f.postalCode} onChange={(e) => up('postalCode', e.target.value)} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <div className="field">
              <label>Città</label>
              <input className="input" value={f.city} onChange={(e) => up('city', e.target.value)} autoComplete="address-level2" />
            </div>
          </div>
          <div className="field">
            <label>Provincia</label>
            <input className="input" value={f.province} onChange={(e) => up('province', e.target.value.toUpperCase())} maxLength={2} placeholder="Es. MI" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={f.email} onChange={(e) => up('email', e.target.value)} inputMode="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={f.password} onChange={(e) => up('password', e.target.value)} autoComplete="new-password" minLength={8} required />
          </div>
          <div className="field">
            <label>Codice invito (facoltativo)</label>
            <input
              className="input"
              value={f.refCode}
              onChange={(e) => up('refCode', e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Es. AB12CD"
              style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Registrati'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Hai già un account? <Link className="link" to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
