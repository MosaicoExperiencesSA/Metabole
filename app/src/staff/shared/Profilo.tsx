import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import BrandPicker from '../../components/BrandPicker';
import { fullName } from '../format';
import { Async, Card, Section, StaffShell, type TabItem } from '../ui';
import { useApi } from '../hooks';

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  sales: 'Responsabile Coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
};

const PHONE_PREFIXES = ['+39', '+41', '+33', '+49', '+43', '+44', '+34', '+32', '+31', '+351', '+386', '+1'];

interface MyProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  phone: string | null;
}

function splitPhone(p: string | null): { prefix: string; number: string } {
  if (!p) return { prefix: '+39', number: '' };
  const m = p.trim().match(/^(\+\d{1,3})\s*(.*)$/);
  if (m) return { prefix: m[1], number: m[2] };
  return { prefix: '+39', number: p.trim() };
}

/** Profilo staff (coach + nutrizionista): stesso design del profilo cliente,
 *  adattato (dati modificabili, colore dell'app, versione), senza le sezioni
 *  piano/acquisti che riguardano solo il cliente. */
export default function Profilo({ tabs }: { tabs: TabItem[] }) {
  const { user, logout, switchAccount } = useAuth();
  const [switching, setSwitching] = useState(false);

  async function goToLinked() {
    setSwitching(true);
    try {
      await switchAccount();
      window.location.href = '/'; // ricarica l'app nel profilo cliente
    } catch {
      setSwitching(false);
    }
  }
  const name = fullName(user?.firstName, user?.lastName, user?.email);
  const roleLabel = (user?.role && ROLE_LABEL[user.role]) || user?.role || '';
  const prof = useApi<MyProfile>('/me/profile');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [prefix, setPrefix] = useState('+39');
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Preferenze notifiche staff (attiva/disattiva ogni alert)
  const [notifTypes, setNotifTypes] = useState<{ key: string; label: string; description: string }[] | null>(null);
  const [notifDisabled, setNotifDisabled] = useState<string[]>([]);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    if (prof.data) {
      setForm(prof.data);
      const sp = splitPhone(prof.data.phone);
      setPrefix(sp.prefix);
      setNumber(sp.number);
    }
  }, [prof.data]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const phone = number.trim() ? `${prefix} ${number.trim()}` : '';
      const body = {
        firstName: form.firstName ?? '',
        lastName: form.lastName ?? '',
        nickname: form.nickname ?? '',
        phone,
      };
      await api<MyProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setEditing(false);
      setMsg('Dati aggiornati.');
      prof.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    api<{ types: { key: string; label: string; description: string }[]; disabled: string[] }>('/me/notifications/staff-prefs')
      .then((r) => { setNotifTypes(r.types ?? []); setNotifDisabled(Array.isArray(r.disabled) ? r.disabled : []); })
      .catch(() => setNotifTypes([]));
  }, []);

  async function toggleAlert(key: string, on: boolean) {
    const next = on ? notifDisabled.filter((k) => k !== key) : Array.from(new Set([...notifDisabled, key]));
    setNotifDisabled(next);
    setNotifBusy(true);
    try {
      await api('/me/notifications/staff-prefs', { method: 'PATCH', body: JSON.stringify({ disabled: next }) });
    } catch {
      setNotifDisabled((prev) => (on ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)));
    } finally {
      setNotifBusy(false);
    }
  }

  return (
    <StaffShell title="Profilo" tabs={tabs}>
      {/* Intestazione: avatar + nome + ruolo */}
      <div style={{ textAlign: 'center', margin: '6px 0 16px' }}>
        <span
          style={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            background: 'var(--sf-brand, #12a386)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {(name || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{name}</div>
        {roleLabel && <div className="sf-sub">{roleLabel}</div>}
      </div>

      {/* I tuoi dati */}
      <Section title="I tuoi dati" />
      {msg && <div className="banner ok" style={{ marginBottom: 10 }}>{msg}</div>}
      {err && <div className="banner err" style={{ marginBottom: 10 }}>{err}</div>}
      <Async state={prof}>
        {(p) => (
          <Card>
            {!editing ? (
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div><span className="sf-sub">Nome:</span> <b>{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</b></div>
                <div><span className="sf-sub">Email:</span> <b style={{ wordBreak: 'break-all' }}>{p.email}</b></div>
                <div><span className="sf-sub">Telefono:</span> <b>{p.phone || '—'}</b></div>
                <button className="sf-btn" style={{ marginTop: 6 }} onClick={() => { setEditing(true); setMsg(null); }}>
                  <i className="ti ti-pencil" /> Modifica
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Nome" value={form.firstName ?? ''} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Cognome" value={form.lastName ?? ''} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div className="sf-sub" style={{ fontSize: 11 }}>Email ({p.email}): non si cambia da qui.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <select className="input" style={{ width: 96, flex: '0 0 auto' }} value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                    {PHONE_PREFIXES.map((pp) => <option key={pp} value={pp}>{pp}</option>)}
                    {!PHONE_PREFIXES.includes(prefix) && <option value={prefix}>{prefix}</option>}
                  </select>
                  <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Numero di telefono" inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</button>
                  <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setEditing(false); setErr(null); if (prof.data) { setForm(prof.data); const sp = splitPhone(prof.data.phone); setPrefix(sp.prefix); setNumber(sp.number); } }}>Annulla</button>
                </div>
              </div>
            )}
          </Card>
        )}
      </Async>

      {/* Colore dell'app */}
      <Section title="Colore dell'app" />
      <Card>
        <p className="sf-sub" style={{ margin: '0 0 12px', fontSize: 12.5 }}>Scegli il colore che preferisci: trasforma tutta l'app.</p>
        <BrandPicker />
        <p className="sf-sub" style={{ margin: '12px 0 0', fontSize: 11 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, verticalAlign: '-1px' }} /> L'ultimo è <b>Auto</b>: un colore nuovo ogni due giorni.
        </p>
      </Card>

      {/* Notifiche */}
      <Section title="Notifiche" />
      <Card>
        <p className="sf-sub" style={{ margin: '0 0 10px', fontSize: 12.5 }}>
          Attiva o disattiva i singoli avvisi. Quelli attivi arrivano in app e come notifica sul telefono.
        </p>
        {notifTypes === null ? (
          <p className="sf-sub" style={{ fontSize: 12 }}>Carico…</p>
        ) : notifTypes.length === 0 ? (
          <p className="sf-sub" style={{ fontSize: 12 }}>Nessun avviso configurabile per il tuo ruolo.</p>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {notifTypes.map((t) => {
              const on = !notifDisabled.includes(t.key);
              return (
                <label key={t.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--sf-line, #eef1f0)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} disabled={notifBusy} onChange={(e) => toggleAlert(t.key, e.target.checked)} style={{ marginTop: 2, flex: 'none' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{t.label}</span>
                    <span className="sf-sub" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{t.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {/* App */}
      <Section title="App" />
      <Card>
        <div className="sf-kv">
          <span className="k">Versione</span>
          <span className="v">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—'}</span>
        </div>
        <div className="sf-kv">
          <span className="k">Lingua</span>
          <span className="v">{user?.locale === 'en' ? 'English' : 'Italiano'}</span>
        </div>
      </Card>

      {user?.linkedUserId && (
        <button className="sf-btn p" style={{ marginTop: 12 }} onClick={goToLinked} disabled={switching}>
          <i className="ti ti-switch-horizontal" /> {switching ? 'Passo…' : 'Passa al profilo cliente'}
        </button>
      )}

      <button className="sf-btn g" style={{ marginTop: 12 }} onClick={() => logout()}>
        <i className="ti ti-logout" /> Esci
      </button>
    </StaffShell>
  );
}
