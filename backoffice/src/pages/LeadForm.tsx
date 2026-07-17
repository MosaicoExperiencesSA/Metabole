import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner } from '../components/ui';

export function LeadForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setOk(null);
    if (!email.includes('@')) {
      setError('Inserisci un\'email valida.');
      return;
    }
    setBusy(true);
    try {
      await api('/crm/leads', { method: 'POST', body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, phone: phone.trim() || undefined }) });
      setOk(`Lead "${name.trim() || email.trim()}" inserito. Lo trovi in Gestione lead e nella Pipeline.`);
      setEmail('');
      setName('');
      setPhone('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Inserimento non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>Nuovo lead</h2>
      <p className="hint">Un nuovo contatto entra nella pipeline nello stato iniziale. Potrai spostarlo tra gli stati e assegnarlo.</p>

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <div className="field">
        <label>Nome (facoltativo)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Anna Bianchi" autoFocus />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.com" />
      </div>
      <div className="field">
        <label>Telefono (facoltativo)</label>
        <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Es. 333 1234567" maxLength={30} />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button className="btn ghost" onClick={() => navigate('/crm/gestione')} disabled={busy}>
          Vai alla gestione
        </button>
        <button className="btn" onClick={submit} disabled={busy || !email}>
          {busy ? 'Inserisco…' : 'Inserisci lead'}
        </button>
      </div>
    </div>
  );
}
