import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import Sheet from '../components/Sheet';
import CheckinPopup from '../components/CheckinPopup';
import ChatSheet from '../components/ChatSheet';
import StartDatePrompt from '../components/StartDatePrompt';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';

interface Today {
  checkinDone: boolean;
  measurementDone: boolean;
  water: { glasses: number; goal: number };
  steps: { steps: number; goal: number };
}
interface EventItem { id: string; type: string; label: string | null; startDate: string; endDate: string; mode: string }

/**
 * Home / dashboard — dati REALI:
 * - GET /me/today (acqua, passi, check-in)
 * - GET /me/menu (pasti di oggi)
 * - GET /me/events (prossimo evento gestito)
 * - GET /me/shopping-list (lista della spesa)
 */

const FRASI = [
  'Non è una dieta, è il tuo nuovo stile.',
  'Un passo alla volta è comunque un passo avanti.',
  'I piccoli gesti di oggi sono i risultati di domani.',
  'Bevi, respira, muoviti: il resto viene.',
  'Sii gentile con te: stai già facendo tanto.',
  'La costanza batte la perfezione.',
];

type HelpAction = 'coach' | 'menu' | 'close';
function helpFor(coach: string): Record<string, { t: string; b: string; cta: string; action: HelpAction }> {
  return {
    fame: { t: 'Ho fame adesso', b: `Bevi un bicchiere d'acqua e prendi un frutto o dei semi: spesso la fame passa in 15 minuti. Se ti capita spesso di pomeriggio, scrivilo a ${coach} e anticipiamo lo spuntino.`, cta: `Scrivi a ${coach}`, action: 'coach' },
    fuori: { t: 'Mangio fuori', b: 'Scegli una proteina con verdure, evita bevande zuccherate e concediti un piccolo piacere senza sensi di colpa. Domani ti preparo un rientro morbido, tranquilla.', cta: 'Ok, grazie', action: 'close' },
    sost: { t: 'Sostituisci un ingrediente', b: 'Non hai un ingrediente o non ti piace? Alternativa equivalente: al posto del farro, quinoa o orzo. Vuoi vedere il menu di oggi?', cta: 'Apri il menu', action: 'menu' },
  };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const EV: Record<string, [string, string]> = {
  wedding: ['Matrimonio', 'ti-heart'],
  baptism: ['Battesimo', 'ti-heart'],
  dinner: ['Cena', 'ti-glass'],
  monthly_cheat: ['Sgarro', 'ti-cake'],
  vacation: ['Vacanza', 'ti-plane'],
  other: ['Evento', 'ti-calendar-heart'],
};

function coachOfDay(name: string): { bg: string; head: string } {
  const h = new Date().getHours();
  if (h < 11) return { bg: '#2AA7C4', head: `Buongiorno, ${name}!` };
  if (h < 14) return { bg: '#12A386', head: `Sei in rotta, ${name}!` };
  if (h < 17) return { bg: '#2AA7C4', head: `Bevi un po', ${name}` };
  if (h < 21) return { bg: '#D8663C', head: 'Muoviti un po\'!' };
  return { bg: '#2E2A5A', head: `Buonanotte, ${name}` };
}

interface SpesaItem { name: string; qty?: number | null; unit?: string | null; checked: boolean }
function SpesaList() {
  const [list, setList] = useState<{ id?: string; items: SpesaItem[] } | null>(null);
  useEffect(() => {
    api<{ id?: string; items: SpesaItem[] }>('/me/shopping-list').then(setList).catch(() => setList(null));
  }, []);

  async function toggle(item: SpesaItem) {
    if (!list?.id) return;
    setList((l) => (l ? { ...l, items: l.items.map((x) => (x.name === item.name ? { ...x, checked: !x.checked } : x)) } : l));
    try {
      await api(`/me/shopping-list/${list.id}/items`, { method: 'PATCH', body: JSON.stringify({ itemName: item.name, checked: !item.checked }) });
    } catch {
      /* la spunta è già applicata localmente */
    }
  }

  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-basket" /></span>
        <div><b style={{ fontSize: 15 }}>Lista della spesa</b><div className="muted" style={{ fontSize: 11 }}>Per i prossimi giorni</div></div>
      </div>
      {!list || list.items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nessun ingrediente: la lista si popola quando il menu è disponibile.</p>
      ) : (
        list.items.map((it) => (
          <div key={it.name} className="spesa-item" style={{ opacity: it.checked ? 0.55 : 1 }} onClick={() => toggle(it)}>
            <span className={`spesa-ck${it.checked ? ' on' : ''}`}>{it.checked && <i className="ti ti-check" />}</span>
            <span style={{ fontSize: 13 }}>{it.name}{it.qty ? ` · ${it.qty}${it.unit ? ' ' + it.unit : ''}` : ''}</span>
          </div>
        ))
      )}
    </>
  );
}

function StepsSheet({ current, goal, onSave }: { current: number; goal: number; onSave: (n: number) => void }) {
  const [val, setVal] = useState(String(current || ''));
  const n = Math.max(0, Math.min(100000, Math.round(Number(val) || 0)));
  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="event-ic" style={{ background: '#FBEEE7', color: '#E8825A' }}><i className="ti ti-walk" /></span>
        <div><b style={{ fontSize: 15 }}>Passi di oggi</b><div className="muted" style={{ fontSize: 11 }}>Obiettivo: {goal.toLocaleString('it-IT')}</div></div>
      </div>
      <input className="input" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Es. 6500" autoFocus style={{ marginBottom: 12 }} />
      <button className="btn" style={{ width: '100%' }} onClick={() => onSave(n)}><i className="ti ti-check" /> Salva passi</button>
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'coach' | 'fame' | 'fuori' | 'sost' | 'spesa' | 'passi'>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [meals, setMeals] = useState<ApiMeal[] | null>(null);
  const [nextEvent, setNextEvent] = useState<EventItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [coachName, setCoachName] = useState('la tua coach');
  const mealsRef = useRef<HTMLDivElement>(null);
  const [mealIdx, setMealIdx] = useState(0);
  const HELP = helpFor(coachName);

  useEffect(() => {
    api<Today>('/me/today').then(setToday).catch(() => {});
    api<{ assignedCoach?: { displayName?: string } | null }>('/me/client-profile')
      .then((p) => { if (p?.assignedCoach?.displayName) setCoachName(p.assignedCoach.displayName); })
      .catch(() => {});
    api<{ days: ApiMenuDay[] }>('/me/menu').then((r) => {
      const iso = new Date().toISOString().slice(0, 10);
      const day = (r.days ?? []).find((d) => d.date.slice(0, 10) === iso) ?? (r.days ?? [])[0];
      setMeals(day?.meals ?? []);
    }).catch(() => setMeals([]));
    api<EventItem[]>('/me/events').then((evs) => {
      const t = startOfDay(new Date()).getTime();
      const up = evs.filter((e) => startOfDay(new Date(e.startDate)).getTime() >= t).sort((a, b) => a.startDate.localeCompare(b.startDate));
      setNextEvent(up[0] ?? null);
    }).catch(() => setNextEvent(null));
  }, []);

  function onMealsScroll() {
    const el = mealsRef.current;
    if (el) setMealIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  async function submitMood(mood: string) {
    setCheckinBusy(true);
    try {
      await api('/me/checkins', { method: 'POST', body: JSON.stringify({ mood }) });
      setToday((t) => (t ? { ...t, checkinDone: true } : t));
    } catch {
      /* in caso di errore chiudiamo comunque */
    } finally {
      setCheckinBusy(false);
      setDismissed(true);
    }
  }

  async function addWater() {
    if (!today) return;
    const glasses = today.water.glasses + 1;
    setToday({ ...today, water: { ...today.water, glasses } });
    try {
      await api('/me/water', { method: 'POST', body: JSON.stringify({ glasses }) });
    } catch {
      /* ignora */
    }
  }

  async function saveSteps(steps: number) {
    if (!today) return;
    setToday({ ...today, steps: { ...today.steps, steps } });
    setSheet(null);
    try {
      await api('/me/steps', { method: 'POST', body: JSON.stringify({ steps }) });
    } catch {
      /* ignora */
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const coach = coachOfDay(name);
  const frase = FRASI[now.getDate() % FRASI.length];

  const evInfo = nextEvent ? (EV[nextEvent.type] ?? EV.other) : null;
  const evDays = nextEvent ? Math.round((startOfDay(new Date(nextEvent.startDate)).getTime() - startOfDay(now).getTime()) / 86_400_000) : 0;
  const evWhen = evDays === 0 ? 'oggi' : evDays === 1 ? 'domani' : `tra ${evDays} giorni`;

  return (
    <div className="home">
      <div className="home-head">
        <div>
          <h1 style={{ textTransform: 'capitalize' }}>Ciao, {name}</h1>
          <div className="muted" style={{ textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <div className="home-icons">
          <button className="home-icon" style={{ color: '#12A386' }} onClick={() => setSheet('coach')}><i className="ti ti-message-2" /></button>
          <button className="home-icon" style={{ color: '#6C5AB7' }} onClick={() => navigate('/negozio')}><i className="ti ti-shopping-bag" /></button>
          <button className="home-icon" style={{ color: '#10403A' }} onClick={() => navigate('/profilo')}><i className="ti ti-user" /></button>
        </div>
      </div>

      <StartDatePrompt />

      <div className="coach-hero" style={{ background: coach.bg, cursor: 'pointer' }} onClick={() => setSheet('coach')}>
        <div className="row-between">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Il tuo coach</span>
        </div>
        <div className="coach-body">
          <Gaia size={70} controls={false} mouth="big" />
          <div className="coach-head">{coach.head}</div>
        </div>
        <div className="coach-phrase">"{frase}"</div>
      </div>

      <div className="sec">Oggi a colpo d'occhio</div>
      <div className="stat-row">
        <div className="stat" onClick={addWater} style={{ cursor: 'pointer' }}>
          <i className="ti ti-droplet" style={{ color: '#2AA7C4' }} />
          <div className="stat-v">{today ? `${today.water.glasses}/${today.water.goal}` : '—'}</div>
          <div className="muted stat-l">acqua</div>
        </div>
        <div className="stat" onClick={() => today && setSheet('passi')} style={{ cursor: 'pointer' }}>
          <i className="ti ti-walk" style={{ color: '#E8825A' }} />
          <div className="stat-v">{today ? today.steps.steps.toLocaleString('it-IT') : '—'}</div>
          <div className="muted stat-l">passi</div>
        </div>
        <div className="stat" onClick={() => navigate('/obiettivo')} style={{ cursor: 'pointer' }}>
          <i className="ti ti-ruler-2" style={{ color: '#3A6EA5' }} />
          <div className="stat-v">{today ? (today.measurementDone ? 'oggi' : '—') : '—'}</div>
          <div className="muted stat-l">misure</div>
        </div>
      </div>

      {meals && meals.length > 0 && (
        <>
          <div className="row-between" style={{ margin: '6px 2px 8px' }}>
            <span className="sec" style={{ margin: 0 }}>I pasti di oggi <span className="muted" style={{ fontWeight: 400 }}>· {meals.length} pasti</span></span>
            <span className="chip" style={{ cursor: 'pointer' }} onClick={() => setSheet('spesa')}><i className="ti ti-basket" style={{ fontSize: 13 }} /> Lista spesa</span>
          </div>
          <div className="meal-carousel" ref={mealsRef} onScroll={onMealsScroll}>
            {meals.map((m, i) => {
              const s = slotInfo(m.slot);
              return (
                <div className="meal-row" key={i}>
                  <div className="meal-thumb" style={{ background: s.bg }}><i className={`ti ${s.icon}`} style={{ color: s.color }} /></div>
                  <div className="meal-body">
                    <span className="meal-tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <div className="meal-name">{m.name}</div>
                    <div className="row-between">
                      <span className="muted" style={{ fontSize: 12 }}>{m.kcal} kcal</span>
                      <button className="btn-recipe" onClick={() => navigate('/menu')}>Ricetta</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="home-dots">
            {meals.map((_, i) => <span key={i} className={i === mealIdx ? 'on' : ''} />)}
          </div>
        </>
      )}

      <div className="sec">Ti serve una mano adesso?</div>
      <div className="card">
        <div className="qa-row">
          <span className="qa-chip" onClick={() => setSheet('fame')}>Ho fame</span>
          <span className="qa-chip" onClick={() => setSheet('fuori')}>Mangio fuori</span>
          <span className="qa-chip" onClick={() => setSheet('sost')}>Sostituisci</span>
        </div>
      </div>

      {nextEvent && evInfo && (
        <>
          <div className="sec">Eventi gestiti</div>
          <div className="event-card" onClick={() => navigate('/calendario')}>
            <span className="event-ic"><i className={`ti ${evInfo[1]}`} /></span>
            <div style={{ flex: 1 }}>
              <div className="event-title">{nextEvent.label || evInfo[0]} {evWhen}</div>
              <div className="event-sub">Ti preparo per arrivare serena</div>
            </div>
            <i className="ti ti-chevron-right" style={{ color: '#C08363' }} />
          </div>
        </>
      )}

      {/* Popup e schede */}
      {today && !today.checkinDone && !dismissed && (
        <CheckinPopup onMood={submitMood} onSkip={() => setDismissed(true)} busy={checkinBusy} />
      )}
      {sheet === 'coach' && <Sheet onClose={() => setSheet(null)}><ChatSheet /></Sheet>}
      {sheet === 'spesa' && <Sheet onClose={() => setSheet(null)}><SpesaList /></Sheet>}
      {sheet === 'passi' && today && <Sheet onClose={() => setSheet(null)}><StepsSheet current={today.steps.steps} goal={today.steps.goal} onSave={saveSteps} /></Sheet>}
      {sheet && HELP[sheet] && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#12A386', color: '#fff' }}><i className="ti ti-sparkles" /></span>
            <b style={{ fontSize: 15 }}>{HELP[sheet].t}</b>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#2E3E3B', marginBottom: 14 }}>{HELP[sheet].b}</div>
          <button
            className="btn"
            onClick={() => {
              const act = HELP[sheet].action;
              if (act === 'coach') setSheet('coach');
              else if (act === 'menu') { setSheet(null); navigate('/menu'); }
              else setSheet(null);
            }}
          >
            {HELP[sheet].cta}
          </button>
        </Sheet>
      )}
    </div>
  );
}
