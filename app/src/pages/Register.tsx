import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, apiPublic } from '../api/client';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';

/** Passo 3 di 34 — Crea il tuo account (minimale: l'indirizzo si prende al checkout). */
export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  // Codice invito da link (es. app.metabole.eu/register?ref=ABC123) — precompilato.
  const invitedCode = (searchParams.get('ref') ?? searchParams.get('refCode') ?? '').trim().toUpperCase();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    addressLine: '',
    postalCode: '',
    city: '',
    province: '',
    email: '',
    password: '',
    refCode: invitedCode,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Se l'email è già registrata, proponiamo il reset password invece del solo errore.
  const [emailExists, setEmailExists] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function up(k: keyof typeof f, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  // Se l'utente cambia email, azzeriamo l'eventuale proposta di reset.
  useEffect(() => { setEmailExists(false); setResetSent(false); }, [f.email]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setEmailExists(false);
    setResetSent(false);
    setBusy(true);
    try {
      await register(f);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Email già registrata: niente errore secco, proponiamo il reset.
        setEmailExists(true);
      } else {
        setErr(e instanceof ApiError ? e.message : 'Registrazione non riuscita');
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestReset() {
    setResetBusy(true);
    setErr(null);
    try {
      await apiPublic('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email: f.email.trim() }) });
      setResetSent(true);
    } catch {
      // Per privacy l'API risponde comunque 202; un errore qui è di rete.
      setResetSent(true);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ overflowY: 'auto' }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          <button className="link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => nav(-1)}>‹ Indietro</button>
          <span>Passo 3 di 34</span>
        </div>
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 999, marginBottom: 12 }}>
          <div style={{ width: '9%', height: '100%', background: 'var(--teal)', borderRadius: 999 }} />
        </div>

        <h1 style={{ margin: '2px 0' }}>Crea il tuo account</h1>
        <p className="muted" style={{ marginTop: 2 }}>Bastano pochi secondi.</p>

        <div className="qbubble">
          <Gaia clip="registrazione" size={58} controls={false} />
          <div className="bubble">
            <TypeText segments={[{ t: 'Crea la tua registrazione in pochi passi, in modo da darti l\'accesso completo a ' }, { t: 'MetaboleAI', b: true }, { t: '.' }]} />
          </div>
        </div>

        {err && <div className="banner err">{err}</div>}

        {emailExists && (
          <div className="banner" style={{ background: 'var(--card, #fff)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            {!resetSent ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Questa email è già registrata</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Se sei già iscritta puoi accedere, oppure reimpostare la password se non la ricordi.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn" disabled={resetBusy} onClick={requestReset}>{resetBusy ? 'Invio…' : 'Reimposta la password'}</button>
                  <button type="button" className="btn ghost" onClick={() => nav('/login')}>Accedi</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Controlla la tua email</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Se l'indirizzo è registrato, ti abbiamo inviato le istruzioni per reimpostare la password.</div>
                <button type="button" className="btn ghost" onClick={() => nav('/login')}>Vai all'accesso</button>
              </>
            )}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="fields-grid">
            <div className="field">
              <label>Nome</label>
              <input className="input" value={f.firstName} onChange={(e) => up('firstName', e.target.value)} autoComplete="given-name" required />
            </div>
            <div className="field">
              <label>Cognome</label>
              <input className="input" value={f.lastName} onChange={(e) => up('lastName', e.target.value)} autoComplete="family-name" required />
            </div>
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
              maxLength={8}
              placeholder="Es. AB12CD"
              style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {invitedCode && f.refCode === invitedCode
                ? <span><i className="ti ti-ticket" /> Codice invito applicato dal link.</span>
                : 'Se ti ha seguito un consulente, inserisci il suo codice.'}
            </div>
          </div>

          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Registrati'}
          </button>
        </form>

        {/* Social login (in arrivo) */}
        <p className="muted" style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 13 }}>oppure registrati con</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setErr('Accesso con Apple in arrivo: per ora usa email e password.')}>
            <i className="ti ti-brand-apple" /> Apple
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setErr('Accesso con Google in arrivo: per ora usa email e password.')}>
            <i className="ti ti-brand-google" /> Google
          </button>
        </div>

        <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
          Hai già un account? <Link className="link" to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
