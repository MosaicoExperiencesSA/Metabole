import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/ui';

type Coach = { id: string; displayName: string };

// Stessa lista della registrazione dell'app (app/src/pages/Register.tsx):
// il numero si salva già col prefisso, così coincide col futuro login col telefono.
const PHONE_PREFIXES = [
  { code: '+39', name: 'Italia' },
  { code: '+41', name: 'Svizzera' },
  { code: '+378', name: 'San Marino' },
  { code: '+377', name: 'Monaco' },
  { code: '+33', name: 'Francia' },
  { code: '+49', name: 'Germania' },
  { code: '+34', name: 'Spagna' },
  { code: '+44', name: 'Regno Unito' },
  { code: '+43', name: 'Austria' },
  { code: '+32', name: 'Belgio' },
  { code: '+31', name: 'Paesi Bassi' },
  { code: '+351', name: 'Portogallo' },
  { code: '+30', name: 'Grecia' },
  { code: '+353', name: 'Irlanda' },
  { code: '+352', name: 'Lussemburgo' },
  { code: '+1', name: 'USA / Canada' },
];

export function LeadForm() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canAssignCoach = can('assign_coach', 'manage');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+39');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [coachId, setCoachId] = useState('');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Il backend accettava già `assignedCoachId` in creazione, ma il form non lo chiedeva: ogni
  // lead inserito da qui nasceva nel pool e andava riassegnato a mano dalla tabella.
  useEffect(() => {
    if (!canAssignCoach) return;
    void (async () => {
      try { setCoaches(await api<Coach[]>('/crm/coaches')); } catch { /* elenco coach opzionale */ }
    })();
  }, [canAssignCoach]);

  async function submit(withCredentials = false) {
    setError(null);
    setOk(null);
    if (!email.includes('@')) {
      setError('Inserisci un\'email valida.');
      return;
    }
    setBusy(true);
    // Numero completo col prefisso internazionale (come la registrazione app).
    const phone = phoneNumber.trim() ? `${phonePrefix} ${phoneNumber.trim()}` : undefined;
    try {
      await api('/crm/leads', { method: 'POST', body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, phone, sendCredentials: withCredentials, assignedCoachId: coachId || undefined }) });
      const chi = coaches.find((c) => c.id === coachId)?.displayName;
      const coda = chi ? ` Assegnato a ${chi}: le è arrivata la notifica, deve accettarlo.` : '';
      setOk(withCredentials
        ? `Lead "${name.trim() || email.trim()}" inserito e credenziali inviate a ${email.trim()}.${coda}`
        : `Lead "${name.trim() || email.trim()}" inserito. Lo trovi in Gestione lead e nella Pipeline.${coda}`);
      setEmail('');
      setName('');
      setPhoneNumber('');
      setCoachId('');
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
        <div className="row" style={{ gap: 8 }}>
          <select
            className="select"
            style={{ flex: '0 0 44%' }}
            value={phonePrefix}
            onChange={(e) => setPhonePrefix(e.target.value)}
            aria-label="Prefisso internazionale"
          >
            {PHONE_PREFIXES.map((p) => (
              <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
            ))}
          </select>
          <input
            className="input"
            style={{ flex: 1 }}
            type="tel"
            inputMode="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ''))}
            placeholder="333 1234567"
            maxLength={20}
          />
        </div>
      </div>
      {canAssignCoach && coaches.length > 0 && (
        <div className="field">
          <label>Assegna a (facoltativo)</label>
          <select className="select" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">— nessuna: resta da assegnare —</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
          <p className="hint" style={{ marginBottom: 0 }}>
            La coach riceve la notifica e deve accettare il lead, come per l'assegnazione dalla
            tabella. Se non accetta entro la scadenza, il lead torna alla responsabile.
          </p>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={() => navigate('/crm/gestione')} disabled={busy}>
          Vai alla gestione
        </button>
        <button className="btn ghost" onClick={() => submit(true)} disabled={busy || !email} title="Crea il lead e gli invia subito email + password provvisoria">
          {busy ? 'Attendi…' : 'Inserisci e invia credenziali'}
        </button>
        <button className="btn" onClick={() => submit(false)} disabled={busy || !email}>
          {busy ? 'Inserisco…' : 'Inserisci lead'}
        </button>
      </div>
    </div>
  );
}
