import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import AppHeader from '../components/AppHeader';
import PrenotaVisita from '../components/PrenotaVisita';
import Sheet from '../components/Sheet';

/**
 * Agenda — allineata al prototipo (docs/): "Prossimi appuntamenti" + "Prenota un
 * appuntamento" + "Il tuo piano". Sotto, la gestione dei giorni no-diet (dati reali).
 * Appuntamenti: GET /me/agenda · Piano: GET /me/subscription.
 */

interface EventItem { id: string; type: string; label: string | null; startDate: string; endDate: string; mode: string }
interface Appt {
  id: string;
  /** §16.7 — da quale delle due tabelle viene: solo le `visita` si spostano e si disdicono da qui. */
  fonte?: 'visita' | 'appuntamento';
  staffRole: string;
  staffName: string | null;
  type: string;
  datetime: string;
  note: string | null;
}
/** Da GET /me/visite: le 24 ore le decide il server, non questa schermata. */
interface MiaVisita { id: string; modificabile: boolean; perche: string | null }
interface Sub { status: string; endDate: string | null; plan?: { name: string; period: string; repurchasable?: boolean } | null }
interface PauseReq { id: string; startDate: string; endDate: string; days: number; status: string }

const PAUSE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  auto_approved: { label: 'Piano congelato', bg: '#DCF0D8', color: '#3B6D11' },
  approved: { label: 'Approvata', bg: '#DCF0D8', color: '#3B6D11' },
  pending: { label: 'In attesa dello staff', bg: '#FDECC8', color: '#8A5A00' },
  rejected: { label: 'Non approvata', bg: '#FBE0DE', color: '#B3261E' },
};
const AUTO_MAX = 20;

const TYPES: [string, string][] = [
  ['wedding', 'Matrimonio'], ['baptism', 'Battesimo'], ['dinner', 'Cena'],
  ['monthly_cheat', 'Sgarro mensile'], ['vacation', 'Vacanza'], ['other', 'Altro'],
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const APPT_TYPE: Record<string, string> = { call: 'Chiamata', televisit: 'Televisita', in_person: 'In presenza' };
const date = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function apptTime(iso: string) { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function apptDay(iso: string) {
  const d = startOfDay(new Date(iso));
  const days = Math.round((d.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Domani';
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}
function isCoach(role: string) { return role === 'coach' || role === 'sales'; }

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
  const nav = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [book, setBook] = useState(false);
  const [sposta, setSposta] = useState<string | null>(null);
  const [visite, setVisite] = useState<MiaVisita[]>([]);
  const [disdetta, setDisdetta] = useState<{ id: string; quando: string } | null>(null);
  const [disdiciBusy, setDisdiciBusy] = useState(false);
  const [f, setF] = useState({ type: 'dinner', label: '', startDate: '', endDate: '', mode: 'single_event' });

  const [pauses, setPauses] = useState<PauseReq[]>([]);
  const [pauseForm, setPauseForm] = useState({ open: false, startDate: '', endDate: '' });
  const [pauseBusy, setPauseBusy] = useState(false);
  const [pauseErr, setPauseErr] = useState<string | null>(null);
  const [pauseMsg, setPauseMsg] = useState<string | null>(null);

  async function loadPauses() {
    try {
      setPauses(await api<PauseReq[]>('/me/pause-requests'));
    } catch {
      /* ignora */
    }
  }

  const pauseDays = (() => {
    if (!pauseForm.startDate || !pauseForm.endDate) return 0;
    const s = startOfDay(new Date(pauseForm.startDate)).getTime();
    const e = startOfDay(new Date(pauseForm.endDate)).getTime();
    if (e < s) return 0;
    return Math.floor((e - s) / 86_400_000) + 1;
  })();

  async function requestPause() {
    setPauseErr(null);
    setPauseMsg(null);
    if (!pauseForm.startDate || !pauseForm.endDate) { setPauseErr('Scegli inizio e fine della pausa.'); return; }
    if (pauseDays <= 0) { setPauseErr('La fine non può precedere l\'inizio.'); return; }
    setPauseBusy(true);
    try {
      const res = await api<{ status: string; days: number; newEndDate?: string | null }>('/me/pause-requests', {
        method: 'POST',
        body: JSON.stringify({ startDate: pauseForm.startDate, endDate: pauseForm.endDate }),
      });
      if (res.status === 'pending') {
        setPauseMsg('Richiesta inviata: il tuo staff la esaminerà a breve. Ti avviseremo con la decisione.');
      } else {
        setPauseMsg(
          res.newEndDate
            ? `Piano congelato per ${res.days} giorni: la scadenza è stata spostata al ${date(res.newEndDate)}.`
            : `Piano congelato per ${res.days} giorni.`,
        );
      }
      setPauseForm({ open: false, startDate: '', endDate: '' });
      await Promise.all([loadPauses(), api<Sub>('/me/subscription').then(setSub).catch(() => {})]);
    } catch (e) {
      setPauseErr(e instanceof ApiError ? e.message : 'Richiesta non riuscita.');
    } finally {
      setPauseBusy(false);
    }
  }

  async function load() {
    try {
      setEvents(await api<EventItem[]>('/me/events'));
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }
  async function loadAppts() {
    try {
      const r = await api<{ appointments: Appt[]; planEndDate: string | null }>('/me/agenda');
      setAppts(r.appointments ?? []);
    } catch {
      setAppts([]);
    }
    // Chi si può ancora spostare lo dice il server: la regola delle 24 ore sta in un posto solo, e
    // riscriverla qui vorrebbe dire due regole che col tempo diventano diverse.
    try {
      setVisite(await api<MiaVisita[]>('/me/visite'));
    } catch {
      setVisite([]);
    }
  }

  useEffect(() => {
    load();
    loadAppts();
    api<Sub>('/me/subscription').then(setSub).catch(() => setSub(null));
    loadPauses();
  }, []);

  async function add() {
    setErr(null);
    if (!f.startDate) { setErr('Scegli la data di inizio.'); return; }
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

  const planEnd = sub?.endDate ?? null;
  const daysLeft = planEnd ? Math.max(0, Math.ceil((startOfDay(new Date(planEnd)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)) : null;

  return (
    <div className="home">
      <AppHeader title="Agenda" />

      <p className="muted" style={{ margin: '0 2px 12px', fontSize: 13 }}>I tuoi appuntamenti e le scadenze del piano.</p>

      {/* Prossimi appuntamenti */}
      <div className="sec" style={{ margin: '0 2px 8px' }}>Prossimi appuntamenti</div>
      {appts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun appuntamento in programma.</p>
        </div>
      ) : (
        appts.map((a) => {
          const c = isCoach(a.staffRole);
          // §16.7: solo la visita col nutrizionista si sposta e si disdice da qui, e solo finché il
          // server dice di sì. Quando dice di no, dice anche perché: quella frase si mostra al posto
          // dei pulsanti, così il pulsante che manca smette di sembrare un guasto.
          const mia = a.fonte === 'visita' ? visite.find((v) => v.id === a.id) : undefined;
          return (
            <div className="card" key={a.id} style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 56, textAlign: 'center', flex: 'none' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c ? '#0E7C66' : '#3A6EA5' }}>{apptTime(a.datetime)}</div>
                  <div className="muted" style={{ fontSize: 10, textTransform: 'capitalize' }}>{apptDay(a.datetime)}</div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid #EEF1F0', paddingLeft: 11 }}>
                  <b style={{ fontSize: 13 }}>{a.staffName ?? (c ? 'La tua coach' : 'Nutrizionista')}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{a.note || APPT_TYPE[a.type] || 'Appuntamento'}</div>
                  <span className="meal-tag" style={{ background: c ? '#DCEBE3' : '#E7EEF6', color: c ? '#0E7C66' : '#3A6EA5', marginTop: 5, display: 'inline-block' }}>
                    {c ? 'Con la coach' : 'Col nutrizionista'}
                  </span>
                </div>
              </div>
              {mia?.modificabile && (
                <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                  <button className="btn ghost sm" onClick={() => setSposta(a.id)}>
                    <i className="ti ti-calendar-repeat" /> Sposta
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => setDisdetta({ id: a.id, quando: `${apptDay(a.datetime)} alle ${apptTime(a.datetime)}` })}
                  >
                    <i className="ti ti-x" /> Disdici
                  </button>
                </div>
              )}
              {mia && !mia.modificabile && mia.perche && (
                <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{mia.perche}</div>
              )}
            </div>
          );
        })
      )}
      <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => setBook(true)}>Prenota un appuntamento</button>

      {/* Il tuo piano */}
      {sub && (
        <>
          <div className="sec" style={{ margin: '14px 2px 8px' }}>Il tuo piano</div>
          <div className="card" style={{ border: '1px solid var(--teal)', background: 'linear-gradient(135deg,#F3FBF8,#fff)' }}>
            <div className="row-between">
              <div>
                {/*
                  ⚠️ MAI IL VALORE GREZZO (19/8): qui si stampava `sub.status` così com'era, e dal
                  19/8 il server può mandare `queued` — cioè la parola inglese «queued» dentro una
                  pastiglia verde da «tutto a posto», sopra un «scade tra N gg» calcolato su un piano
                  che non è ancora cominciato. Un codice interno sullo schermo di una cliente è
                  sempre un difetto, anche quando il colore è giusto.
                */}
                <span
                  className="meal-tag"
                  style={sub.status === 'queued' ? { background: '#F3E8DC', color: '#B8863B' } : { background: '#DCF0D8', color: '#3B6D11' }}
                >
                  {sub.status === 'active' ? 'Piano attivo' : sub.status === 'queued' ? 'Piano in arrivo' : 'Il tuo piano'}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{sub.plan?.name ?? 'Il tuo percorso'}</div>
                <div className="muted" style={{ fontSize: 11 }}>Coach + nutrizionista + Gaia</div>
              </div>
              {daysLeft != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#8A938F' }}>scade tra</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>{daysLeft} gg</div>
                </div>
              )}
            </div>
            {sub.plan?.repurchasable !== false && (
              <button className="btn" style={{ marginTop: 12 }} onClick={() => nav('/shop')}>Rinnova</button>
            )}
          </div>
        </>
      )}

      {/* Congelamento piano (vacanza) */}
      {sub && (
        <>
          <div className="sec" style={{ margin: '14px 2px 8px' }}>Congela il piano (vacanza)</div>
          <p className="muted" style={{ margin: '0 2px 8px', fontSize: 12 }}>
            Se parti per più giorni puoi mettere in pausa il piano: la scadenza slitta in avanti dei giorni di pausa, così non perdi nulla.
            Fino a {AUTO_MAX} giorni è automatico; oltre serve l'ok del tuo staff.
          </p>

          {pauseMsg && <div className="card" style={{ background: '#DCEBE3', boxShadow: 'none', fontSize: 12, color: '#0E7C66' }}>{pauseMsg}</div>}

          {pauses.map((p) => {
            const st = PAUSE_STATUS[p.status] ?? { label: p.status, bg: '#EEF1F0', color: '#5B6B66' };
            return (
              <div className="card" key={p.id} style={{ padding: 12 }}>
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: 13 }}>{date(p.startDate)} – {date(p.endDate)}</b>
                    <div className="muted" style={{ fontSize: 11 }}>{p.days} giorni</div>
                  </div>
                  <span className="meal-tag" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
              </div>
            );
          })}

          {pauseForm.open ? (
            <div className="card">
              <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Nuova pausa</b>
              {pauseErr && <div className="banner err">{pauseErr}</div>}
              <div className="field">
                <label>Dal</label>
                <input className="input" type="date" value={pauseForm.startDate} onChange={(e) => setPauseForm({ ...pauseForm, startDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Al</label>
                <input className="input" type="date" value={pauseForm.endDate} onChange={(e) => setPauseForm({ ...pauseForm, endDate: e.target.value })} />
              </div>
              {pauseDays > 0 && (
                <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
                  {pauseDays} giorni · {pauseDays <= AUTO_MAX ? 'congelamento automatico' : 'serve l\'approvazione dello staff'}
                </p>
              )}
              <div className="onb-nav">
                <button className="btn ghost" onClick={() => { setPauseForm({ open: false, startDate: '', endDate: '' }); setPauseErr(null); }}>Annulla</button>
                <button className="btn" onClick={requestPause} disabled={pauseBusy}>{pauseBusy ? 'Invio…' : pauseDays > AUTO_MAX ? 'Richiedi' : 'Congela'}</button>
              </div>
            </div>
          ) : (
            <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => { setPauseForm({ open: true, startDate: '', endDate: '' }); setPauseMsg(null); }}>
              <i className="ti ti-snowflake" /> Metti in pausa il piano
            </button>
          )}
        </>
      )}

      {/* Giorni no-diet */}
      <div className="sec" style={{ margin: '14px 2px 8px' }}>I tuoi giorni no-diet</div>
      {events.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Aggiungi le occasioni in cui non seguirai la dieta: ti preparo un piano prima, durante e dopo.</p>
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

      {/* §16.7 — prima qui c'era il cartello «la prenotazione diretta sta arrivando», e per fissare
          una visita bisognava scrivere a qualcuno. Ora sceglie lei fra gli orari che la sua
          nutrizionista ha aperto. */}
      {book && <PrenotaVisita onClose={() => setBook(false)} onFatto={loadAppts} />}

      {sposta && (
        <PrenotaVisita spostaVisitId={sposta} onClose={() => setSposta(null)} onFatto={loadAppts} />
      )}

      {disdetta && (
        <Sheet onClose={() => setDisdetta(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#FBE0DE', color: '#B3261E' }}><i className="ti ti-calendar-x" /></span>
            <b style={{ fontSize: 15 }}>Disdici l'appuntamento</b>
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
            {disdetta.quando}. Quell'orario torna libero per un'altra persona, e <b>la visita resta tua</b>:
            puoi riprenotarla quando vuoi.
          </p>
          {err && <div className="card" style={{ background: '#FBE0DE', boxShadow: 'none', padding: 11 }}><span style={{ fontSize: 12, color: '#B3261E' }}>{err}</span></div>}
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setDisdetta(null)}>Lascia com'è</button>
            <button
              className="btn"
              style={{ flex: 1 }}
              disabled={disdiciBusy}
              onClick={async () => {
                setDisdiciBusy(true);
                setErr(null);
                try {
                  await api(`/me/visite/${disdetta.id}/disdici`, { method: 'POST' });
                  setDisdetta(null);
                  await loadAppts();
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : 'Non è riuscita.');
                } finally {
                  setDisdiciBusy(false);
                }
              }}
            >
              {disdiciBusy ? 'Un attimo…' : 'Disdici'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
