import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';

/**
 * Percorso — allineata al prototipo (docs/): "IL MENU DI OGGI" + "Diario del percorso"
 * con due schede (Menu passati · Eventi). Dati REALI: menu (/me/menu) ed eventi (/me/events).
 */

interface EventItem { id: string; type: string; label: string | null; startDate: string; mode: string }
interface ReportHead { id: string; read: boolean }

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

export default function Percorso() {
  const nav = useNavigate();
  const [days, setDays] = useState<ApiMenuDay[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tab, setTab] = useState<'past' | 'fut'>('past');
  const [reports, setReports] = useState<ReportHead[]>([]);

  useEffect(() => {
    api<{ days: ApiMenuDay[] }>('/me/menu').then((r) => setDays(r.days ?? [])).catch(() => setDays([]));
    api<EventItem[]>('/me/events').then((evs) => {
      const t = startOfDay(new Date()).getTime();
      setEvents((evs ?? []).filter((e) => startOfDay(new Date(e.startDate)).getTime() >= t).sort((a, b) => a.startDate.localeCompare(b.startDate)));
    }).catch(() => setEvents([]));
    // Report di fine piano: se ce n'è uno, lo segnaliamo in cima al percorso.
    api<ReportHead[]>('/me/reports').then((rs) => setReports(rs ?? [])).catch(() => setReports([]));
  }, []);

  const iso = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date.slice(0, 10) === iso) ?? days[0];
  const meals: ApiMeal[] = todayDay?.meals ?? [];
  const totKcal = meals.reduce((a, m) => a + (m.kcal || 0), 0);
  const past = days
    .filter((d) => d.date.slice(0, 10) < iso)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="home">
      <AppHeader title="Il tuo percorso" />

      {/* Report di fine piano pronto (handoff punto 4) */}
      {reports.length > 0 && (
        <div className="card" onClick={() => nav('/report')}
          style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', marginBottom: 12, border: reports.some((r) => !r.read) ? '2px solid var(--teal)' : undefined }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EAF6F1', color: '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <i className="ti ti-report" style={{ fontSize: 19 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{reports.some((r) => !r.read) ? 'Il tuo report è pronto 📊' : 'I tuoi report'}</div>
            <div className="muted" style={{ fontSize: 12 }}>Punto A → punto B: misure, aderenza e cosa ha imparato Gaia.</div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: '#9AA6A2' }} />
        </div>
      )}

      {/* IL MENU DI OGGI */}
      {meals.length > 0 && (
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #EEF1F0', boxShadow: '0 10px 24px rgba(16,48,42,.10)', marginBottom: 14 }}>
          <div style={{ background: 'var(--teal)', color: '#fff', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: '.5px' }}>IL MENU DI OGGI</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{meals.length} pasti{totKcal > 0 ? ` · ${totKcal.toLocaleString('it-IT')} kcal` : ''}</div>
            </div>
            <button className="chip" onClick={() => nav('/menu')} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '6px 10px', fontSize: 11 }}>
              <i className="ti ti-tools-kitchen-2" style={{ fontSize: 13 }} /> Apri
            </button>
          </div>
          <div style={{ padding: '11px 12px 12px' }}>
            <div className="meal-carousel">
              {meals.map((m, i) => {
                const s = slotInfo(m.slot);
                return (
                  <div className="meal-row" key={i}>
                    <div className="meal-thumb" style={{ background: s.bg }}><i className={`ti ${s.icon}`} style={{ color: s.color }} /></div>
                    <div className="meal-body">
                      <span className="meal-tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      <div className="meal-name">{m.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{m.kcal} kcal</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sec" style={{ margin: '0 2px 9px' }}>Diario del percorso</div>
      <div className="seg">
        <div className={`s${tab === 'past' ? ' on' : ''}`} onClick={() => setTab('past')}>Menu passati</div>
        <div className={`s${tab === 'fut' ? ' on' : ''}`} onClick={() => setTab('fut')}>Eventi</div>
      </div>

      {tab === 'past' ? (
        <div>
          {past.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
              <i className="ti ti-history" style={{ fontSize: 20, color: 'var(--teal)' }} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>I menu dei giorni passati compariranno qui.</div>
            </div>
          ) : (
            <>
              <div className="meal-carousel" style={{ scrollSnapType: 'none' }}>
                {past.map((d) => {
                  const label = new Date(d.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                  return (
                    <div key={d.id} className="dcard" onClick={() => nav('/menu')}
                      style={{ minWidth: 108, scrollSnapAlign: 'start', border: '2px solid #E7EBE9', borderRadius: 14, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', background: '#fff' }}>
                      <div className="muted" style={{ fontSize: 10, fontWeight: 600 }}>{label}</div>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EAF6F1', color: '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 6px' }}>
                        <i className="ti ti-tools-kitchen-2" style={{ fontSize: 17 }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0E7C66' }}>{d.meals.length} pasti</div>
                    </div>
                  );
                })}
              </div>
              <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none', marginTop: 8 }}>
                <i className="ti ti-hand-finger" style={{ fontSize: 20, color: 'var(--teal)' }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Tocca un menu per vedere <b>pasti e ricette</b>.</div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          {events.length === 0 && (
            <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
              <div className="muted" style={{ fontSize: 12 }}>Nessun evento in programma.</div>
            </div>
          )}
          {events.map((e) => {
            const info = EV[e.type] ?? EV.other;
            return (
              <div key={e.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11 }} onClick={() => nav('/calendario')}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: info[2], color: info[3], display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <i className={`ti ${info[1]}`} style={{ fontSize: 22 }} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.label || info[0]}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{whenLabel(e.startDate)}</div>
                </div>
                <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Gestito</span>
              </div>
            );
          })}
          <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => nav('/calendario')}>
            <i className="ti ti-plus" style={{ fontSize: 15, verticalAlign: '-2px' }} /> Aggiungi un evento
          </button>
        </div>
      )}
    </div>
  );
}
