import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import Sheet from '../components/Sheet';
import CheckinPopup from '../components/CheckinPopup';
import MenuReviewPopup from '../components/MenuReviewPopup';
import VoiceToggle from '../components/VoiceToggle';
import { getTodaySteps } from '../lib/steps';
import { DEFAULT_WATER_UNIT, isWaterUnit, waterIcon, waterStep, waterValue, type WaterUnit } from '../lib/water';
import StartDatePrompt from '../components/StartDatePrompt';
import AppHeader from '../components/AppHeader';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';
import { TypeText } from '../components/TypeText';

interface Today {
  checkinDone: boolean;
  measurementDone: boolean;
  water: { glasses: number; goal: number };
  steps: { steps: number; goal: number };
  objective?: string | null; // fase attuale: 'dimagrimento' | 'mantenimento'
}

// Badge della fase attuale (gestita dallo staff): dimagrimento o mantenimento.
const PHASE_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  dimagrimento: { label: 'Dimagrimento', icon: 'ti-trending-down', color: '#12A386' },
  mantenimento: { label: 'Mantenimento', icon: 'ti-equal', color: '#2F80ED' },
};
interface NextAppt { id: string; staffRole: string; staffName: string | null; type: string; datetime: string; note: string | null }

const APPT_TYPE_LABEL: Record<string, string> = { call: 'Chiamata', televisit: 'Televisita', in_person: 'In presenza' };
function apptWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/**
 * Home — allineata al prototipo navigabile (docs/):
 * header MetaboleAI · "Ciao, {nome}", card "IL MENU DI OGGI" (carosello pasti + Spesa),
 * "PROSSIMO APPUNTAMENTO", card Gaia "LA FRASE DI OGGI". Dati REALI dal backend.
 */

const FRASI = [
  'Non è una dieta, è il tuo nuovo stile.',
  'Un passo alla volta è comunque un passo avanti.',
  'I piccoli gesti di oggi sono i risultati di domani.',
  'Bevi, respira, muoviti: il resto viene.',
  'Sii gentile con te: stai già facendo tanto.',
  'La costanza batte la perfezione.',
];

interface EventItem { id: string; type: string; label: string | null; startDate: string; mode: string }
const EV: Record<string, [string, string, string, string]> = {
  // tipo → [etichetta, icona, bg, colore]
  wedding: ['Matrimonio', 'ti-heart', '#FBEEE7', '#E8825A'],
  baptism: ['Battesimo', 'ti-heart', '#FBEEE7', '#E8825A'],
  dinner: ['Cena', 'ti-glass-full', '#F3E8DC', '#B8863B'],
  monthly_cheat: ['Sgarro', 'ti-cake', '#F3E8DC', '#B8863B'],
  vacation: ['Vacanza', 'ti-umbrella', '#E7EEF6', '#3A6EA5'],
  other: ['Evento', 'ti-calendar-heart', '#E7EEF6', '#3A6EA5'],
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function whenLabel(iso: string): string {
  const days = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days > 1) return `tra ${days} giorni`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** Testi di aiuto rapido (come nel prototipo). */
const SHEETS: Record<string, { t: string; b: string; cta: string }> = {
  fame: { t: 'Ho fame adesso', b: "Bevi un bicchiere d'acqua e prendi un frutto o dei semi: spesso la fame passa in 15 minuti. Se ti capita spesso di pomeriggio, lo segnalo alla tua coach e anticipiamo lo spuntino.", cta: 'Chiedi alla coach' },
  fuori: { t: 'Mangio fuori', b: 'Scegli una proteina con verdure, evita bevande zuccherate e concediti un piccolo piacere senza sensi di colpa. Domani ti preparo un rientro morbido, tranquilla.', cta: 'Ok, grazie' },
  sost: { t: 'Sostituisci un ingrediente', b: 'Non hai un ingrediente o non ti piace? Alternativa equivalente: al posto del farro, quinoa o orzo. Vuoi che aggiorni la ricetta di oggi?', cta: 'Aggiorna ricetta' },
};
const HELP: [string, string, string, string][] = [
  ['ti-mood-sad', 'Ho fame', 'fame', '#E8825A'],
  ['ti-tools-kitchen-2', 'Mangio fuori', 'fuori', '#3A6EA5'],
  ['ti-arrows-exchange', 'Sostituisci', 'sost', '#6C5AB7'],
];

function KpiTile({ icon, value, label, color, onClick, hint }: { icon: string; value: string; label: string; color: string; onClick?: () => void; hint?: string }) {
  // Come nel prototipo: sfondo a gradiente colorato + icona a tinta piena con
  // ombra colorata (leggero effetto 3D).
  return (
    <div
      onClick={onClick}
      title={hint}
      style={{
        flex: 1,
        minWidth: 0,
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 6px',
        borderRadius: 18,
        background: `linear-gradient(160deg, ${color}22, ${color}0a)`,
        border: `1px solid ${color}26`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 9,
          boxShadow: `0 6px 14px ${color}55`,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 18, color: '#fff' }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#101826', lineHeight: 1 }}>{value}</div>
      <div className="muted" style={{ fontSize: 10, marginTop: 5 }}>{label}</div>
    </div>
  );
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

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'spesa'>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [meals, setMeals] = useState<ApiMeal[] | null>(null);
  const [nextAppt, setNextAppt] = useState<NextAppt | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [deviceSteps, setDeviceSteps] = useState<number | null>(null);
  const [waterUnit, setWaterUnit] = useState<WaterUnit>(DEFAULT_WATER_UNIT);
  const [dismissed, setDismissed] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const mealsRef = useRef<HTMLDivElement>(null);
  const [mealIdx, setMealIdx] = useState(0);

  useEffect(() => {
    api<Today>('/me/today').then(setToday).catch(() => {});
    api<{ days: ApiMenuDay[] }>('/me/menu').then((r) => {
      const iso = new Date().toISOString().slice(0, 10);
      const day = (r.days ?? []).find((d) => d.date.slice(0, 10) === iso) ?? (r.days ?? [])[0];
      setMeals(day?.meals ?? []);
    }).catch(() => setMeals([]));
    api<{ next: NextAppt | null }>('/me/agenda?next=1').then((r) => setNextAppt(r.next)).catch(() => setNextAppt(null));
    api<EventItem[]>('/me/events').then((evs) => {
      const t = startOfDay(new Date()).getTime();
      setEvents((evs ?? []).filter((e) => startOfDay(new Date(e.startDate)).getTime() >= t).sort((a, b) => a.startDate.localeCompare(b.startDate)));
    }).catch(() => setEvents([]));
    // Passi dal sensore del telefono (solo su nativo): li mostriamo e li salviamo.
    getTodaySteps().then((s) => {
      if (s == null) return;
      setDeviceSteps(s);
      api('/me/steps', { method: 'POST', body: JSON.stringify({ steps: s }) }).catch(() => {});
    });
    // Unità di visualizzazione dell'acqua scelta dal cliente (bicchieri / bottiglie).
    api<{ waterUnit?: string }>('/me/preferences').then((p) => {
      if (isWaterUnit(p.waterUnit)) setWaterUnit(p.waterUnit);
    }).catch(() => {});
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
    const prev = today.water.glasses;
    const next = prev + waterStep(waterUnit); // +1 bicchiere, o l'equivalente in bottiglie
    setToday((t) => (t ? { ...t, water: { ...t.water, glasses: next } } : t));
    try {
      await api('/me/water', { method: 'POST', body: JSON.stringify({ glasses: next }) });
    } catch {
      setToday((t) => (t ? { ...t, water: { ...t.water, glasses: prev } } : t));
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const now = new Date();
  const frase = FRASI[now.getDate() % FRASI.length];
  const totKcal = (meals ?? []).reduce((a, m) => a + (m.kcal || 0), 0);

  return (
    <div className="home">
      <AppHeader title={`Ciao, ${name}`} />

      {/* Fase attuale del percorso (dimagrimento / mantenimento), decisa dallo staff. */}
      {today?.objective && PHASE_BADGE[today.objective] && (
        <div style={{ display: 'flex', marginBottom: 10 }}>
          <span
            className="chip"
            style={{
              background: `${PHASE_BADGE[today.objective].color}18`,
              color: PHASE_BADGE[today.objective].color,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <i className={`ti ${PHASE_BADGE[today.objective].icon}`} style={{ fontSize: 13 }} /> {PHASE_BADGE[today.objective].label}
          </span>
        </div>
      )}

      <StartDatePrompt />

      {/* IL MENU DI OGGI */}
      {meals && meals.length > 0 && (
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #EEF1F0', boxShadow: '0 10px 24px rgba(16,48,42,.10)', marginBottom: 14 }}>
          <div style={{ background: 'var(--teal)', color: '#fff', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: '.5px' }}>IL MENU DI OGGI</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{meals.length} pasti{totKcal > 0 ? ` · ${totKcal.toLocaleString('it-IT')} kcal` : ''}</div>
            </div>
            <button className="chip" onClick={() => setSheet('spesa')} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '6px 10px', fontSize: 11 }}>
              <i className="ti ti-basket" style={{ fontSize: 13 }} /> Spesa
            </button>
          </div>
          <div style={{ padding: '11px 12px 12px' }}>
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
          </div>
        </div>
      )}

      {/* PROSSIMO APPUNTAMENTO */}
      {nextAppt && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 14 }} onClick={() => navigate('/calendario')}>
          <span className="event-ic" style={{ background: '#EAF6F1', color: '#0E7C66', flex: 'none' }}>
            <i className="ti ti-calendar-event" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.3px' }}>PROSSIMO APPUNTAMENTO</div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {apptWhen(nextAppt.datetime)}
              {nextAppt.staffName ? ` · ${nextAppt.staffName}` : ''}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{APPT_TYPE_LABEL[nextAppt.type] ?? 'Appuntamento'}</div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
        </div>
      )}

      {/* GAIA · LA FRASE DI OGGI */}
      <div style={{ background: 'var(--teal)', borderRadius: 20, padding: '14px 16px', color: '#fff', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 'none' }}>
            <Gaia size={60} controls={false} mouth="big" eyes="open" />
            <VoiceToggle size={17} style={{ opacity: 0.9 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, opacity: 0.9, fontWeight: 700, letterSpacing: '.4px' }}>
              <i className="ti ti-sparkles" style={{ fontSize: 10, verticalAlign: '-1px' }} /> GAIA · LA FRASE DI OGGI
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginTop: 5 }}>
              "<TypeText key={frase} segments={[{ t: frase }]} />"
            </div>
          </div>
        </div>
      </div>

      {/* KPI di oggi: kcal · acqua · passi */}
      <div style={{ display: 'flex', gap: 9, margin: '12px 0' }}>
        <KpiTile icon="ti-flame" value={totKcal > 0 ? totKcal.toLocaleString('it-IT') : '—'} label="kcal" color="#E8825A" />
        <KpiTile icon={waterIcon(waterUnit)} value={today ? `${waterValue(today.water.glasses, waterUnit)}/${waterValue(today.water.goal, waterUnit)}` : '—'} label="acqua" color="#2AA7C4" onClick={today ? addWater : undefined} hint={`Tocca per aggiungere ${waterUnit === 'glass' ? 'un bicchiere' : 'una bottiglia'}`} />
        <KpiTile icon="ti-walk" value={deviceSteps != null ? deviceSteps.toLocaleString('it-IT') : today ? today.steps.steps.toLocaleString('it-IT') : '—'} label="passi" color="#3B6D11" />
      </div>

      {/* Help rapido */}
      <div className="sec" style={{ margin: '4px 2px 8px' }}>Help</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {HELP.map(([icon, lbl, key, color]) => (
          <div key={key} className="card" style={{ flex: 1, margin: 0, textAlign: 'center', padding: '12px 4px', cursor: 'pointer' }} onClick={() => setHelp(key)}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: color + '1f', color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px' }}>
              <i className={`ti ${icon}`} style={{ fontSize: 21 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* In arrivo: eventi/periodi speciali */}
      {events.length > 0 && (
        <>
          <div className="sec" style={{ margin: '14px 2px 8px' }}>In arrivo</div>
          {events.slice(0, 3).map((ev) => {
            const [lbl, icon, bg, color] = EV[ev.type] ?? EV.other;
            return (
              <div key={ev.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', marginBottom: 10 }} onClick={() => navigate('/percorso')}>
                <span className="event-ic" style={{ background: bg, color, flex: 'none' }}><i className={`ti ${icon}`} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.label || lbl} {whenLabel(ev.startDate)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>Ti preparo per arrivarci al meglio</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
              </div>
            );
          })}
        </>
      )}

      {/* Popup check-in giornaliero */}
      {today && !today.checkinDone && !dismissed && (
        <CheckinPopup onMood={submitMood} onSkip={() => setDismissed(true)} busy={checkinBusy} />
      )}
      {/* Popup "Com'è andata ieri?" — solo quando il check-in non è a schermo */}
      {(!today || today.checkinDone || dismissed) && <MenuReviewPopup />}
      {sheet === 'spesa' && <Sheet onClose={() => setSheet(null)}><SpesaList /></Sheet>}
      {help && SHEETS[help] && (
        <Sheet onClose={() => setHelp(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: 'var(--teal)', color: '#fff', flex: 'none' }}><i className="ti ti-sparkles" /></span>
            <b style={{ fontSize: 15 }}>{SHEETS[help].t}</b>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#2E3E3B', marginBottom: 14 }}>{SHEETS[help].b}</div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 11 }} onClick={() => setHelp(null)}>{SHEETS[help].cta}</button>
        </Sheet>
      )}
    </div>
  );
}
