import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import Sheet from '../components/Sheet';
import CheckinPopup from '../components/CheckinPopup';
import StartDatePrompt from '../components/StartDatePrompt';
import AppHeader from '../components/AppHeader';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';
import { TypeText } from '../components/TypeText';

interface Today {
  checkinDone: boolean;
  measurementDone: boolean;
  water: { glasses: number; goal: number };
  steps: { steps: number; goal: number };
}
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
  const [today, setToday] = useState<Today | null>(null);
  const [meals, setMeals] = useState<ApiMeal[] | null>(null);
  const [nextAppt, setNextAppt] = useState<NextAppt | null>(null);
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

  const name = (user?.firstName || user?.email?.split('@')[0] || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const now = new Date();
  const frase = FRASI[now.getDate() % FRASI.length];
  const totKcal = (meals ?? []).reduce((a, m) => a + (m.kcal || 0), 0);

  return (
    <div className="home">
      <AppHeader title={`Ciao, ${name}`} />

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
            <Gaia size={60} controls={false} mouth="big" />
            <i className="ti ti-volume" style={{ fontSize: 17, opacity: 0.9 }} />
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

      {/* Popup check-in giornaliero */}
      {today && !today.checkinDone && !dismissed && (
        <CheckinPopup onMood={submitMood} onSkip={() => setDismissed(true)} busy={checkinBusy} />
      )}
      {sheet === 'spesa' && <Sheet onClose={() => setSheet(null)}><SpesaList /></Sheet>}
    </div>
  );
}
