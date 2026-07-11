import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

/** Agenda / calendario — giorni speciali ed eventi no-diet (dati reali). */

interface EventItem {
  id: string;
  type: string;
  label: string | null;
  startDate: string;
  endDate: string;
  mode: string;
}

const TYPES: [string, string][] = [
  ['wedding', 'Matrimonio'],
  ['baptism', 'Battesimo'],
  ['dinner', 'Cena'],
  ['monthly_cheat', 'Sgarro mensile'],
  ['vacation', 'Vacanza'],
  ['other', 'Altro'],
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const date = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

/** Consigli reali per l'evento (prima/durante/dopo) da GET /me/events/:id/plan. */
function EventPlan({ eventId, mode }: { eventId: string; mode: string }) {
  const [phases, setPhases] = useState<{ before: string; during: string; after: string } | null>(null);
  const [tab, setTab] = useState<'before' | 'during' | 'after'>('before');

  useEffect(() => {
    api<{ currentPhase: string; phases: { before: string; during: string; after: string } }>(`/me/events/${eventId}/plan`)
      .then((p) => {
        setPhases(p.phases);
        const cp = p.currentPhase === 'mini_plan_active' ? 'during' : p.currentPhase;
        if (cp === 'before' || cp === 'during' || cp === 'after') setTab(cp);
      })
      .catch(() => {});
  }, [eventId]);

  if (!phases) return null;
  const tabs: [typeof tab, string][] = [
    ['before', 'Prima'],
    ['during', mode === 'pause_period' ? 'Durante' : 'Il giorno'],
    ['after', 'Dopo'],
  ];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pill-row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} className={`pill${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{phases[tab]}</div>
    </div>
  );
}

export default function Calendario() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ type: 'dinner', label: '', startDate: '', endDate: '', mode: 'single_event' });

  async function load() {
    try {
      setEvents(await api<EventItem[]>('/me/events'));
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setErr(null);
    if (!f.startDate) {
      setErr('Scegli la data di inizio.');
      return;
    }
    setBusy(true);
    const body: Record<string, string> = { type: f.type, startDate: f.startDate, mode: f.mode };
    if (f.label.trim()) body.label = f.label.trim();
    if (f.endDate) body.endDate = f.endDate;
    else if (f.mode === 'pause_period') body.endDate = f.startDate;
    try {
      await api('/me/events', { method: 'POST', body: JSON.stringify(body) });
      setF({ type: 'dinner', label: '', startDate: '', endDate: '', mode: 'single_event' });
      setAdding(false);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Aggiunta non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Rimuovere questo evento?')) return;
    setEvents((es) => es.filter((e) => e.id !== id));
    try {
      await api(`/me/events/${id}`, { method: 'DELETE' });
    } catch {
      load();
    }
  }

  if (loading) return <div className="center"><div className="spin" /></div>;

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#FBEEE7', color: '#E8825A' }}><i className="ti ti-calendar-heart" /></span>
        <div><h1 style={{ margin: 0 }}>Agenda</h1><div className="muted">I tuoi giorni speciali</div></div>
      </div>

      {events.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>Nessun evento in programma. Aggiungi le occasioni in cui non seguirai la dieta.</p>
        </div>
      )}

      {events.map((e) => (
        <div className="card" key={e.id}>
          <div className="row-between">
            <div className="row" style={{ alignItems: 'center', gap: 10 }}>
              <span className="event-ic" style={{ background: '#E8825A', color: '#fff' }}><i className="ti ti-heart" /></span>
              <div>
                <b style={{ fontSize: 14 }}>{e.label || TYPE_LABEL[e.type] || 'Evento'}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {e.mode === 'pause_period' && e.endDate !== e.startDate ? `${date(e.startDate)} – ${date(e.endDate)}` : date(e.startDate)}
                </div>
              </div>
            </div>
            <button className="home-icon" style={{ color: '#b3261e', width: 32, height: 32 }} onClick={() => remove(e.id)} aria-label="Rimuovi">
              <i className="ti ti-trash" style={{ fontSize: 16 }} />
            </button>
          </div>
          <EventPlan eventId={e.id} mode={e.mode} />
        </div>
      ))}

      {adding ? (
        <div className="card">
          <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Nuovo evento</b>
          {err && <div className="banner err">{err}</div>}
          <div className="field">
            <label>Tipo</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Nome (facoltativo)</label>
            <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Es. Matrimonio di Anna" />
          </div>
          <div className="field">
            <label>Modalità</label>
            <select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              <option value="single_event">Evento singolo</option>
              <option value="pause_period">Periodo (più giorni)</option>
            </select>
          </div>
          <div className="field">
            <label>Data {f.mode === 'pause_period' ? 'inizio' : ''}</label>
            <input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </div>
          {f.mode === 'pause_period' && (
            <div className="field">
              <label>Data fine</label>
              <input className="input" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </div>
          )}
          <div className="onb-nav">
            <button className="btn ghost" onClick={() => setAdding(false)}>Annulla</button>
            <button className="btn" onClick={add} disabled={busy}>{busy ? 'Aggiungo…' : 'Aggiungi'}</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => setAdding(true)}><i className="ti ti-plus" /> Aggiungi evento</button>
      )}

      <div className="card" style={{ background: '#DCEBE3', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
        <i className="ti ti-shield-check" style={{ color: '#0E7C66' }} />
        <span style={{ fontSize: 12, color: '#0E7C66' }}>Nei giorni no-diet non ti do la dieta; se il peso sale, arriva un mini-piano.</span>
      </div>
    </div>
  );
}
