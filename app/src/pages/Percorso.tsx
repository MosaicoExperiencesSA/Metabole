import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../cart/CartContext';
import AppHeader from '../components/AppHeader';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';

/**
 * Percorso — allineata al prototipo (docs/): "IL MENU DI OGGI" + "Diario del percorso"
 * con due schede (Menu passati · Eventi). Dati REALI: menu (/me/menu) ed eventi (/me/events).
 */

interface EventItem { id: string; type: string; label: string | null; startDate: string; mode: string }
interface ReportHead { id: string; read: boolean }

/** Stato del Monitoraggio post-percorso (spec Antonio: gratis, max 1 mese). */
interface MonitoringStatus {
  eligible: boolean;
  period: { id: string; status: string; endsAt: string; daysLeft: number; referenceWeightKg: number; regainOffered: boolean } | null;
  lastWeightKg: number | null;
  deltaKg: number | null;
  regainThresholdKg: number;
  rientro: { planId: string; planName: string; priceCents: number } | null;
}

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
  const cart = useCart();
  const [days, setDays] = useState<ApiMenuDay[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tab, setTab] = useState<'past' | 'fut'>('past');
  const [reports, setReports] = useState<ReportHead[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringStatus | null>(null);
  const [monBusy, setMonBusy] = useState(false);

  function loadMonitoring() {
    api<MonitoringStatus>('/me/monitoring').then(setMonitoring).catch(() => setMonitoring(null));
  }
  useEffect(() => {
    api<{ days: ApiMenuDay[] }>('/me/menu').then((r) => setDays(r.days ?? [])).catch(() => setDays([]));
    api<EventItem[]>('/me/events').then((evs) => {
      const t = startOfDay(new Date()).getTime();
      setEvents((evs ?? []).filter((e) => startOfDay(new Date(e.startDate)).getTime() >= t).sort((a, b) => a.startDate.localeCompare(b.startDate)));
    }).catch(() => setEvents([]));
    // Report di fine piano: se ce n'è uno, lo segnaliamo in cima al percorso.
    api<ReportHead[]>('/me/reports').then((rs) => setReports(rs ?? [])).catch(() => setReports([]));
    loadMonitoring();
  }, []);

  /** Attiva il mese gratuito di monitoraggio. */
  async function startMonitoring() {
    setMonBusy(true);
    try { await api('/me/monitoring/start', { method: 'POST' }); loadMonitoring(); }
    catch { /* messaggio già in notifica/errore api */ }
    finally { setMonBusy(false); }
  }

  /** Kit di rientro: mette il piano €29 nel carrello e va al checkout. */
  function buyRientro() {
    if (!monitoring?.rientro) return;
    cart.setPlan({ id: monitoring.rientro.planId, name: monitoring.rientro.planName, priceCents: monitoring.rientro.priceCents, period: '8d' });
    nav('/checkout');
  }

  const iso = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date.slice(0, 10) === iso) ?? days[0];
  const meals: ApiMeal[] = todayDay?.meals ?? [];
  const totKcal = meals.reduce((a, m) => a + (m.kcal || 0), 0);
  const past = days
    .filter((d) => d.date.slice(0, 10) < iso)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  // Menu futuri: i giorni già erogati con data SUCCESSIVA a oggi (di norma i
  // prossimi 1-2 giorni sbloccati dall'ultima misura). Ordinati dal più vicino.
  const future = days
    .filter((d) => d.date.slice(0, 10) > iso)
    .sort((a, b) => a.date.localeCompare(b.date));

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

      {/* MONITORAGGIO attivo: Gaia veglia, con eventuale kit di rientro */}
      {monitoring?.period?.status === 'active' && (
        <div className="card" style={{ marginBottom: 12, border: monitoring.period.regainOffered ? '2px solid #B8863B' : '1px solid #E7EBE9' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FBF6EA', color: '#B8863B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className="ti ti-shield-heart" style={{ fontSize: 19 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Monitoraggio attivo 🛡️</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Ancora {monitoring.period.daysLeft} giorni · peso di riferimento {monitoring.period.referenceWeightKg} kg
                {monitoring.deltaKg != null && ` · oggi ${monitoring.deltaKg > 0 ? '+' : ''}${monitoring.deltaKg} kg`}
              </div>
            </div>
          </div>
          {monitoring.period.regainOffered && monitoring.rientro && (
            <div style={{ marginTop: 10, background: '#FBF6EA', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A5A00' }}>Il tuo kit di rientro è pronto 🧰</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                Gli 8 menu che hanno funzionato meglio su di te: di solito bastano 4-6 giorni per recuperare. Sbloccandoli riparte anche un altro mese di monitoraggio gratis.
              </div>
              <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={buyRientro}>
                Sblocca i menu di rientro · € {(monitoring.rientro.priceCents / 100).toFixed(0)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MONITORAGGIO da attivare (fine percorso, nessun piano attivo) */}
      {monitoring?.eligible && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FBF6EA', color: '#B8863B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className="ti ti-shield-heart" style={{ fontSize: 19 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {monitoring.period ? 'Riattiva il monitoraggio · gratis' : 'Monitoraggio · gratis per 1 mese'}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Gaia resta in allerta e ti chiede il peso ogni tanto. Il tuo storico è al sicuro: se serve, il kit di rientro è pronto.
              </div>
            </div>
            <button className="chip" disabled={monBusy} onClick={() => void startMonitoring()} style={{ background: '#B8863B', border: 'none', color: '#fff', padding: '7px 11px', fontSize: 11.5, fontWeight: 700 }}>
              {monBusy ? 'Attivo…' : 'Attiva'}
            </button>
          </div>
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

      {/* MENU FUTURI — i prossimi giorni già erogati (sbloccati dall'invio misure) */}
      {future.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="sec" style={{ margin: '0 2px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-calendar" style={{ fontSize: 15, color: 'var(--teal)' }} /> Menu futuri
          </div>
          <div className="meals-col">
            {future.map((d) => {
              const dm = d.meals ?? [];
              const kcal = dm.reduce((a, m) => a + (m.kcal || 0), 0);
              const label = whenLabel(d.date);
              const names = dm.map((m) => m.name).filter(Boolean).join(' · ');
              return (
                <div key={d.id} className="card" onClick={() => nav(`/menu?giorno=${d.date.slice(0, 10)}`)}
                  style={{ display: 'flex', gap: 11, alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, background: '#EAF6F1', color: '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <i className="ti ti-tools-kitchen-2" style={{ fontSize: 22 }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                      {label} · {dm.length} pasti{kcal > 0 ? ` · ${kcal.toLocaleString('it-IT')} kcal` : ''}
                    </div>
                    {names && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names}</div>
                    )}
                  </div>
                  <i className="ti ti-chevron-right" style={{ color: '#9AA6A2', flex: 'none' }} />
                </div>
              );
            })}
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
                    <div key={d.id} className="dcard" onClick={() => nav(`/menu?giorno=${d.date.slice(0, 10)}`)}
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
