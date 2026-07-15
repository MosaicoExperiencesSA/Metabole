import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AppHeader from '../components/AppHeader';
import NotificationPrefs from '../components/NotificationPrefs';
import { parseCodiceFiscale } from '../lib/codiceFiscale';

const PHONE_PREFIXES = ['+39', '+41', '+33', '+49', '+43', '+44', '+34', '+32', '+31', '+351', '+386', '+1'];
const COUNTRIES = ['Italia', 'Svizzera', 'Francia', 'Germania', 'Austria', 'Regno Unito', 'Spagna', 'Belgio', 'Paesi Bassi', 'Portogallo', 'Slovenia', 'Altro'];

interface AddrSuggestion { label: string; addressLine: string; postalCode: string; city: string; province: string; country: string; }

function splitPhone(p: string | null): { prefix: string; number: string } {
  if (!p) return { prefix: '+39', number: '' };
  const m = p.trim().match(/^(\+\d{1,3})\s*(.*)$/);
  if (m) return { prefix: m[1], number: m[2] };
  return { prefix: '+39', number: p.trim() };
}

/**
 * Profilo cliente: piano attivo (giorno X di N) + storico acquisti con
 * possibilità di scaricare la ricevuta PDF dei pagamenti confermati.
 */

interface MyProfile {
  email: string; secondaryEmail: string | null; firstName: string | null; lastName: string | null; nickname: string | null;
  addressLine: string | null; postalCode: string | null; city: string | null; province: string | null; country: string | null; phone: string | null;
  birthDate: string | null; codiceFiscale: string | null;
}
interface Plan { name: string; period: string; priceCents: number; }
interface Subscription { id: string; status: string; startDate: string | null; endDate: string | null; plan: Plan | null; }
interface Payment { id: string; description: string; amountCents: number; method: string; status: string; createdAt: string; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const DAY = 86_400_000;

const STATUS: Record<string, { label: string; bg: string; col: string }> = {
  pending: { label: 'In attesa', bg: '#FBF0D9', col: '#8A6D1B' },
  receipt_uploaded: { label: 'Contabile inviata', bg: '#E4EEF9', col: '#2B5A93' },
  approved: { label: 'Pagato', bg: '#DCF0D8', col: '#3B6D11' },
  rejected: { label: 'Rifiutato', bg: '#F9E1DE', col: '#B3261E' },
  cancelled: { label: 'Annullato', bg: '#EEE', col: '#666' },
};
const METHOD: Record<string, string> = { card: 'Carta', bank_transfer: 'Bonifico', manual: 'Manuale' };

function planProgress(sub: Subscription): { day: number; total: number; pct: number } | null {
  if (!sub.startDate || !sub.endDate) return null;
  const start = new Date(sub.startDate).getTime();
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  const total = Math.max(1, Math.round((end - start) / DAY));
  const day = Math.min(total, Math.max(1, Math.floor((now - start) / DAY) + 1));
  return { day, total, pct: Math.round((day / total) * 100) };
}

export default function Profilo() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sezione "I miei dati"
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [phonePrefix, setPhonePrefix] = useState('+39');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editing, setEditing] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [dataMsg, setDataMsg] = useState<string | null>(null);

  // Gestione email (cambio con verifica + secondaria)
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // Autocompletamento indirizzo (OpenStreetMap / Nominatim, senza chiave)
  const [addrSug, setAddrSug] = useState<AddrSuggestion[]>([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api<Subscription | null>('/me/subscription').catch(() => null),
      api<Payment[]>('/me/payments').catch(() => [] as Payment[]),
      api<MyProfile>('/me/profile').catch(() => null),
    ]).then(([s, p, pr]) => {
      setSub(s);
      setPayments(Array.isArray(p) ? p : []);
      if (pr) { setProfile(pr); setForm(pr); const sp = splitPhone(pr.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number); }
    }).finally(() => setLoading(false));
  }, []);

  function searchAddress(q: string) {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (q.trim().length < 3) { setAddrSug([]); setAddrOpen(false); setAddrLoading(false); return; }
    setAddrOpen(true);
    setAddrLoading(true);
    addrTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=6&accept-language=it`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        type A = { road?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string; municipality?: string; county?: string; state?: string; country?: string };
        type R = { display_name: string; name?: string; address?: A };
        const data: R[] = await res.json();
        const sug: AddrSuggestion[] = (data ?? []).map((r) => {
          const a = r.address ?? {};
          const street = [a.road ?? r.name, a.house_number].filter(Boolean).join(' ') || (r.display_name.split(',')[0] ?? '');
          const city = a.city ?? a.town ?? a.village ?? a.municipality ?? '';
          return { label: r.display_name, addressLine: street, postalCode: a.postcode ?? '', city, province: a.county ?? a.state ?? '', country: a.country ?? '' };
        }).filter((s) => s.addressLine);
        setAddrSug(sug);
      } catch {
        setAddrSug([]);
      } finally {
        setAddrLoading(false);
      }
    }, 450);
  }

  function pickAddress(s: AddrSuggestion) {
    setForm((f) => ({ ...f, addressLine: s.addressLine, postalCode: s.postalCode, city: s.city, province: s.province, country: s.country || f.country }));
    setAddrOpen(false);
    setAddrSug([]);
  }

  async function saveData() {
    setSavingData(true);
    setDataMsg(null);
    setErr(null);
    try {
      const phone = phoneNumber.trim() ? `${phonePrefix} ${phoneNumber.trim()}` : '';
      const body = {
        firstName: form.firstName ?? '', lastName: form.lastName ?? '', nickname: form.nickname ?? '',
        addressLine: form.addressLine ?? '', postalCode: form.postalCode ?? '', city: form.city ?? '',
        province: form.province ?? '', country: form.country ?? '', phone,
        birthDate: form.birthDate ?? '', codiceFiscale: form.codiceFiscale ?? '',
      };
      const updated = await api<MyProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setProfile(updated);
      setForm(updated);
      const sp = splitPhone(updated.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number);
      setEditing(false);
      setDataMsg('Dati aggiornati.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingData(false);
    }
  }

  async function requestEmailChange() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      await api('/auth/email-change/request', { method: 'POST', body: JSON.stringify({ newEmail: newEmail.trim() }) });
      setEmailMsg('Ti abbiamo inviato un link di conferma alla nuova email: aprilo per confermarla.');
      setNewEmail(''); setEmailOpen(false);
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Richiesta non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function makePrimary() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      const r = await api<{ email: string; secondaryEmail: string | null }>('/auth/email/primary', { method: 'POST' });
      setProfile((p) => (p ? { ...p, email: r.email, secondaryEmail: r.secondaryEmail } : p));
      setEmailMsg('Email principale aggiornata. Notifiche e ricevute andranno alla nuova principale.');
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function removeSecondary() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      const r = await api<{ email: string; secondaryEmail: string | null }>('/auth/email/secondary', { method: 'DELETE' });
      setProfile((p) => (p ? { ...p, secondaryEmail: r.secondaryEmail } : p));
      setEmailMsg('Email secondaria rimossa.');
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function reloadPayments() {
    const p = await api<Payment[]>('/me/payments').catch(() => [] as Payment[]);
    setPayments(Array.isArray(p) ? p : []);
  }

  /** Carica la contabile del bonifico (PDF o immagine) come base64. */
  async function uploadReceipt(id: string, file: File) {
    setBusyId(id);
    setErr(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File troppo grande (max 5 MB).');
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('File non leggibile.'));
        r.readAsDataURL(file);
      });
      await api(`/me/payments/${id}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, contentBase64 }) });
      await reloadPayments();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setBusyId(null);
    }
  }

  /** Annulla un proprio ordine ancora in attesa. */
  async function cancelOrder(id: string) {
    if (!confirm('Vuoi annullare questo ordine? Resterà nello storico come annullato.')) return;
    setBusyId(id);
    setErr(null);
    try {
      await api(`/me/payments/${id}/cancel`, { method: 'POST' });
      await reloadPayments();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadReceipt(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/me/payments/${id}/receipt-pdf`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non è stato possibile scaricare la ricevuta.');
    } finally {
      setBusyId(null);
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || '').replace(/^\w/, (c) => c.toUpperCase());
  const prog = sub && sub.status === 'active' ? planProgress(sub) : null;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="home">
      <AppHeader title="Profilo" />

      <div className="menu-head" style={{ marginTop: 4 }}>
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-user" /></span>
        <div>
          <h1 style={{ margin: 0 }}>{name || 'Profilo'}</h1>
          <div className="muted">{user?.email}</div>
        </div>
      </div>

      {/* I miei dati */}
      <div className="row-between" style={{ margin: '4px 2px 8px' }}>
        <span className="sec" style={{ margin: 0 }}>I miei dati</span>
        {profile && !editing && <button className="btn-recipe" style={{ padding: '4px 12px' }} onClick={() => { setEditing(true); setDataMsg(null); }}><i className="ti ti-pencil" /> Modifica</button>}
      </div>
      {dataMsg && <div className="banner ok" style={{ marginBottom: 10 }}>{dataMsg}</div>}
      {profile && (
        <div className="card">
          {!editing ? (
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div><span className="muted">Nome:</span> <b>{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}</b></div>
              <div><span className="muted">Nickname:</span> <b>{profile.nickname || '—'}</b></div>
              <div><span className="muted">Indirizzo:</span> <b>{[profile.addressLine, profile.postalCode, profile.city, profile.province, profile.country].filter(Boolean).join(', ') || '—'}</b></div>
              <div><span className="muted">Telefono:</span> <b>{profile.phone || '—'}</b></div>
              <div><span className="muted">Data di nascita:</span> <b>{profile.birthDate ? new Date(profile.birthDate + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</b></div>
              <div><span className="muted">Codice fiscale:</span> <b>{profile.codiceFiscale || '—'}</b></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Nome" value={form.firstName ?? ''} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Cognome" value={form.lastName ?? ''} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
              <input className="input" placeholder="Nickname" value={form.nickname ?? ''} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} />

              <select className="input" value={form.country ?? ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}>
                <option value="">Paese…</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.country && !COUNTRIES.includes(form.country) && <option value={form.country}>{form.country}</option>}
              </select>

              <div style={{ position: 'relative' }}>
                <input
                  className="input" placeholder="Via e numero (digita per cercare)" autoComplete="off"
                  value={form.addressLine ?? ''}
                  onChange={(e) => { setForm((f) => ({ ...f, addressLine: e.target.value })); searchAddress(e.target.value); }}
                  onFocus={() => { if (addrSug.length) setAddrOpen(true); }}
                />
                {addrOpen && (
                  <div className="addr-pop">
                    {addrLoading && <div className="addr-opt" style={{ cursor: 'default', color: 'var(--muted)' }}><i className="ti ti-loader" /> <span>Cerco indirizzi…</span></div>}
                    {!addrLoading && addrSug.length === 0 && <div className="addr-opt" style={{ cursor: 'default', color: 'var(--muted)' }}><i className="ti ti-map-off" /> <span>Nessun indirizzo trovato — scrivilo a mano</span></div>}
                    {addrSug.map((s, i) => (
                      <button type="button" key={i} className="addr-opt" onClick={() => pickAddress(s)}>
                        <i className="ti ti-map-pin" style={{ color: 'var(--teal)' }} /> <span>{s.label}</span>
                      </button>
                    ))}
                    <button type="button" className="addr-opt" style={{ justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }} onClick={() => setAddrOpen(false)}>Chiudi</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" style={{ width: 96, flex: '0 0 auto' }} placeholder="CAP" value={form.postalCode ?? ''} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Città" value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                <input className="input" style={{ width: 74, flex: '0 0 auto' }} placeholder="Prov." value={form.province ?? ''} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <select className="input" style={{ width: 96, flex: '0 0 auto' }} value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)}>
                  {PHONE_PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
                  {!PHONE_PREFIXES.includes(phonePrefix) && <option value={phonePrefix}>{phonePrefix}</option>}
                </select>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Numero di telefono" inputMode="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>

              <input
                className="input"
                placeholder="Codice fiscale (facoltativo)"
                autoCapitalize="characters"
                maxLength={16}
                value={form.codiceFiscale ?? ''}
                onChange={(e) => {
                  const cf = e.target.value.toUpperCase();
                  const parsed = parseCodiceFiscale(cf);
                  setForm((f) => ({ ...f, codiceFiscale: cf, ...(parsed.birthDate ? { birthDate: parsed.birthDate } : {}) }));
                }}
              />
              {form.codiceFiscale && parseCodiceFiscale(form.codiceFiscale).birthDate && (
                <div className="muted" style={{ fontSize: 11, marginTop: -4 }}>Data di nascita ricavata dal codice fiscale.</div>
              )}
              <label className="muted" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                Data di nascita
                <input
                  className="input"
                  type="date"
                  style={{ marginTop: 4 }}
                  value={form.birthDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                />
              </label>

              <div className="muted" style={{ fontSize: 11 }}>L'email ({profile.email}) non si cambia da qui: servirà una verifica via link.</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <button className="btn" style={{ flex: 1 }} onClick={saveData} disabled={savingData}>{savingData ? 'Salvo…' : 'Salva'}</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setEditing(false); setForm(profile); const sp = splitPhone(profile.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number); setErr(null); setAddrOpen(false); }}>Annulla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Le mie email */}
      {profile && (
        <>
          <div className="sec">Le mie email</div>
          {emailMsg && <div className="banner ok" style={{ marginBottom: 10 }}>{emailMsg}</div>}
          {emailErr && <div className="banner err" style={{ marginBottom: 10 }}>{emailErr}</div>}
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <b style={{ wordBreak: 'break-all' }}>{profile.email}</b>
                <div className="muted" style={{ fontSize: 11 }}>Principale · notifiche e ricevute</div>
              </div>
              <span className="chip" style={{ background: '#DCF0D8', color: '#3B6D11', flex: '0 0 auto' }}>Principale</span>
            </div>

            {profile.secondaryEmail && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <b style={{ wordBreak: 'break-all' }}>{profile.secondaryEmail}</b>
                <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Secondaria · login alternativo</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-recipe" onClick={makePrimary} disabled={emailBusy}>Rendi principale</button>
                  <button className="btn-recipe" style={{ background: '#f3e3e1', color: '#b3261e' }} onClick={removeSecondary} disabled={emailBusy}>Rimuovi</button>
                </div>
              </div>
            )}

            {!emailOpen ? (
              <button className="btn ghost" onClick={() => { setEmailOpen(true); setEmailErr(null); setEmailMsg(null); }}>
                <i className="ti ti-mail-plus" /> {profile.secondaryEmail ? 'Cambia email' : 'Aggiungi / cambia email'}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="muted" style={{ fontSize: 12 }}>Inserisci la nuova email: ti mandiamo un link di conferma. Dopo la verifica potrai sceglierla come principale o tenerle entrambe.</div>
                <input className="input" type="email" inputMode="email" placeholder="nuova@email.it" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={requestEmailChange} disabled={emailBusy || !newEmail.trim()}>{emailBusy ? 'Invio…' : 'Invia link'}</button>
                  <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setEmailOpen(false); setNewEmail(''); }}>Annulla</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Piano attivo */}
      <div className="sec" style={{ marginTop: 4 }}>Il mio piano</div>
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : sub && sub.status === 'active' && sub.plan ? (
        <div className="card" style={{ border: '2px solid #12A386' }}>
          <div className="row-between">
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{sub.plan.name}</div>
              <span className="chip" style={{ background: '#DCF0D8', color: '#3B6D11', marginTop: 4 }}><i className="ti ti-circle-check" /> Attivo</span>
            </div>
            <i className="ti ti-seeding" style={{ fontSize: 30, color: '#12A386' }} />
          </div>
          {prog && (
            <>
              <div className="row-between" style={{ marginTop: 14, alignItems: 'baseline' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0E7C66' }}>Giorno {prog.day}</span>
                <span className="muted" style={{ fontSize: 13 }}>di {prog.total}</span>
              </div>
              <div className="prog-track" style={{ marginTop: 8 }}>
                <div className="prog-fill" style={{ width: `${prog.pct}%` }} />
              </div>
              <div className="row-between" style={{ marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>Inizio {sub.startDate ? fmtDate(sub.startDate) : '—'}</span>
                <span className="muted" style={{ fontSize: 11 }}>Fine {sub.endDate ? fmtDate(sub.endDate) : '—'}</span>
              </div>
            </>
          )}
        </div>
      ) : sub && sub.status === 'pending' ? (
        <div className="card">
          <b style={{ fontSize: 14 }}>{sub.plan?.name ?? 'Piano'}</b>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>In attesa di conferma del pagamento.</p>
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Non hai ancora un piano attivo.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => navigate('/negozio')}>Scopri i piani</button>
        </div>
      )}

      {/* Storico acquisti */}
      <div className="sec">Storico acquisti</div>
      {err && <div className="banner err" style={{ marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : payments.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun acquisto per ora.</p></div>
      ) : (
        <div className="meals-col">
          {payments.map((p) => {
            const st = STATUS[p.status] ?? { label: p.status, bg: '#eee', col: '#555' };
            return (
              <div className="card storico-row" key={p.id} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.description}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {fmtDate(p.createdAt)} · {METHOD[p.method] ?? p.method}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <span className="chip" style={{ background: st.bg, color: st.col, fontSize: 11 }}>{st.label}</span>
                    {p.status === 'approved' && (
                      <button className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busyId === p.id} onClick={() => downloadReceipt(p.id)}>
                        <i className="ti ti-download" style={{ fontSize: 12 }} /> {busyId === p.id ? 'Attendi…' : 'Ricevuta'}
                      </button>
                    )}
                    {(p.status === 'pending' || p.status === 'receipt_uploaded') && (
                      <>
                        <label className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11, cursor: busyId === p.id ? 'default' : 'pointer' }}>
                          <i className="ti ti-upload" style={{ fontSize: 12 }} /> {busyId === p.id ? 'Attendi…' : p.status === 'receipt_uploaded' ? 'Sostituisci contabile' : 'Carica contabile'}
                          <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={busyId === p.id}
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadReceipt(p.id, f); }} />
                        </label>
                        <button className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busyId === p.id} onClick={() => cancelOrder(p.id)}>
                          <i className="ti ti-x" style={{ fontSize: 12 }} /> Annulla ordine
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{euro(p.amountCents)}</div>
              </div>
            );
          })}
        </div>
      )}

      <NotificationPrefs />

      <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => { logout(); navigate('/'); }}>
        <i className="ti ti-logout" /> Esci
      </button>

      <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 20, opacity: 0.7 }}>
        Metabole · v{__APP_VERSION__}
      </div>
    </div>
  );
}
