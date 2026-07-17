import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiPublic } from '../api/client';

/**
 * Preferenze marketing (handoff punto 6, GDPR): pagina PUBBLICA raggiunta dal
 * link personale nel footer di ogni email (token firmato, niente login).
 * Disiscrizione facile + scelta dei canali; serve anche per il ri-opt-in
 * dello storico ("torniamo a scriverti? scegli tu come").
 */

interface Prefs { name: string | null; email: string | null; marketingConsent: boolean | null; consentChannels: string[] }

const CHANNELS: { key: string; label: string; icon: string }[] = [
  { key: 'email', label: 'Email', icon: 'ti-mail' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'ti-brand-whatsapp' },
  { key: 'sms', label: 'SMS', icon: 'ti-message' },
];

export default function Preferenze() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'saved' | 'error'>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setState('error'); return; }
    apiPublic<Prefs>(`/public/marketing/prefs?t=${encodeURIComponent(token)}`)
      .then((p) => { setPrefs(p); setConsent(p.marketingConsent); setChannels(p.consentChannels ?? []); setState('ready'); })
      .catch(() => setState('error'));
  }, [token]);

  async function save(nextConsent: boolean) {
    setSaving(true);
    try {
      await apiPublic(`/public/marketing/prefs?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ marketingConsent: nextConsent, channels: nextConsent ? (channels.length ? channels : ['email']) : [] }),
      });
      setConsent(nextConsent);
      setState('saved');
    } catch {
      setState('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="home" style={{ maxWidth: 480, margin: '0 auto', padding: '28px 18px' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>Metabole</div>
        <div className="muted" style={{ fontSize: 13 }}>Le tue preferenze di comunicazione</div>
      </div>

      {state === 'loading' && <div className="card" style={{ textAlign: 'center' }}><span className="muted">Un attimo…</span></div>}

      {state === 'error' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <i className="ti ti-link-off" style={{ fontSize: 22, color: '#B3261E' }} />
          <div style={{ fontSize: 14, marginTop: 6 }}>Questo link non è valido.</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Usa il link "Gestisci le tue preferenze" in fondo a una delle nostre email.</div>
        </div>
      )}

      {(state === 'ready' || state === 'saved') && prefs && (
        <>
          {state === 'saved' && (
            <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none', textAlign: 'center', marginBottom: 12 }}>
              <b style={{ color: '#0E7C66', fontSize: 14 }}><i className="ti ti-check" /> Preferenze salvate</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{consent ? 'Ti scriveremo solo sui canali che hai scelto.' : 'Non riceverai più comunicazioni promozionali.'}</div>
            </div>
          )}
          <div className="card">
            {prefs.email && <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Contatto: <b>{prefs.email}</b></div>}
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Vuoi ricevere consigli, novità e offerte da Metabole?</div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Decidi tu: puoi cambiare idea quando vuoi da questo stesso link. Le comunicazioni di servizio
              (ricevute, verifiche, il tuo percorso) arrivano comunque.
            </p>

            <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
              {CHANNELS.map((c) => (
                <label key={c.key} className="card" style={{ margin: 0, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', boxShadow: 'none', border: channels.includes(c.key) ? '2px solid var(--teal)' : '1px solid #E7EBE9' }}>
                  <input type="checkbox" checked={channels.includes(c.key)}
                    onChange={(e) => setChannels((cs) => e.target.checked ? [...cs, c.key] : cs.filter((x) => x !== c.key))} />
                  <i className={`ti ${c.icon}`} style={{ color: 'var(--teal)', fontSize: 17 }} />
                  <span style={{ fontSize: 14 }}>{c.label}</span>
                </label>
              ))}
            </div>

            <button className="btn" style={{ width: '100%' }} disabled={saving || channels.length === 0} onClick={() => save(true)}>
              {saving ? 'Salvo…' : consent ? 'Aggiorna le mie preferenze' : 'Sì, voglio riceverle'}
            </button>
            <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} disabled={saving} onClick={() => save(false)}>
              Non voglio ricevere comunicazioni promozionali
            </button>
          </div>
          <p className="muted" style={{ fontSize: 10.5, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            Trattiamo i tuoi dati secondo la nostra informativa privacy. La disiscrizione ha effetto immediato.
          </p>
        </>
      )}
    </div>
  );
}
