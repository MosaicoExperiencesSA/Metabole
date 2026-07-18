import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppHeader from '../components/AppHeader';

/** Obiettivo — misure reali, andamento (grafici) e progressi verso il target. */

interface Measurement {
  id: string;
  date: string;
  weightKg: number;
  waistCm: number | null;
  hipsCm: number | null;
  replacedSnapshot?: unknown | null; // valorizzato ⇒ misura del giorno già corretta una volta
}
interface Objective {
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetHipsCm: number | null;
  targetDate: string | null;
}

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

function Spark({ vals, dates, format, color }: { vals: number[]; dates?: string[]; format: (v: number) => string; color: string }) {
  const H = 66;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 250;
  const h = 64;
  const n = vals.length;
  const x = (i: number) => (i / Math.max(n - 1, 1)) * w;
  const y = (v: number) => h - ((v - min) / range) * h * 0.85 - 5;
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || n <= 1) return;
    const rect = el.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(rel * (n - 1)));
  }
  const hx = hover != null ? (x(hover) / w) * 100 : 0;

  return (
    <div ref={ref} style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) => <circle key={i} cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r="3" fill={hover === i ? color : color} opacity={hover == null || hover === i ? 1 : 0.5} />)}
      </svg>
      {hover != null && (
        <>
          <div style={{ position: 'absolute', left: `${hx}%`, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${hx}%`, top: (y(vals[hover]) / h) * H, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: color, border: '2px solid #fff', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${Math.min(85, Math.max(15, hx))}%`, top: -4, transform: 'translate(-50%,-100%)', background: '#16302C', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
            {dates?.[hover] ? `${dates[hover]} · ` : ''}{format(vals[hover])}
          </div>
        </>
      )}
    </div>
  );
}

const METRICS = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', color: '#12A386', targetKey: 'targetWeightKg' },
  { key: 'waistCm', label: 'Vita', unit: 'cm', color: '#E8825A', targetKey: 'targetWaistCm' },
  { key: 'hipsCm', label: 'Fianchi', unit: 'cm', color: '#3A6EA5', targetKey: 'targetHipsCm' },
] as const;

export default function Obiettivo() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false); // modalità "cambia misure" attiva
  const [confirmCorrect, setConfirmCorrect] = useState(false); // sto mostrando "Sei sicuro?"
  const [msg, setMsg] = useState<string | null>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [chartIdx, setChartIdx] = useState(0);
  // Modifica obiettivo
  const [editObj, setEditObj] = useState(false);
  const [objKg, setObjKg] = useState('');
  const [objWeeks, setObjWeeks] = useState('');
  const [objBusy, setObjBusy] = useState(false);
  const [objErr, setObjErr] = useState<string | null>(null);

  function onChartsScroll() {
    const el = chartsRef.current;
    if (el) setChartIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  async function saveObjective() {
    setObjBusy(true);
    setObjErr(null);
    try {
      const body: Record<string, number> = {};
      const kg = parseNum(objKg);
      const wk = Number(objWeeks);
      if (kg != null) body.weightToLoseKg = kg;
      if (Number.isFinite(wk) && wk > 0) body.weeks = wk;
      await api('/me/objective', { method: 'PATCH', body: JSON.stringify(body) });
      setEditObj(false);
      await load();
    } catch (e) {
      setObjErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setObjBusy(false);
    }
  }

  async function load() {
    const [msRaw, obj] = await Promise.all([
      api<Measurement[]>('/me/measurements').catch(() => [] as Measurement[]),
      api<Objective>('/me/objective').catch((e) => (e instanceof ApiError && e.status === 404 ? null : null)),
    ]);
    // L'API le manda DECRESCENTI: le riordiniamo CRESCENTI (dalla più vecchia alla più
    // recente) così i grafici vanno nel verso giusto (un calo scende) e il form
    // pre-compila con l'ULTIMA misura (quella di oggi), non con la più vecchia.
    const ms = [...msRaw].sort((a, b) => a.date.localeCompare(b.date));
    setMeasurements(ms);
    setObjective(obj);
    const last = ms[ms.length - 1];
    if (last) {
      setWeight(d1(last.weightKg));
      setWaist(last.waistCm != null ? d1(last.waistCm) : '');
      setHips(last.hipsCm != null ? d1(last.hipsCm) : '');
    }
    setCorrecting(false);
    setConfirmCorrect(false);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setMsg(null);
    const w = parseNum(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return;
    }
    setBusy(true);
    const body: Record<string, number> = { weightKg: w };
    const wa = parseNum(waist);
    const hi = parseNum(hips);
    if (wa !== undefined) body.waistCm = wa;
    if (hi !== undefined) body.hipsCm = hi;
    try {
      await api('/me/measurements', { method: 'POST', body: JSON.stringify(body) });
      await load();
      setMsg('Misure salvate!');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  /** Correzione della misura di OGGI (una sola volta): la precedente resta "sostituita". */
  async function correct() {
    setMsg(null);
    const w = parseNum(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return;
    }
    setBusy(true);
    const body: Record<string, number> = { weightKg: w };
    const wa = parseNum(waist);
    const hi = parseNum(hips);
    if (wa !== undefined) body.waistCm = wa;
    if (hi !== undefined) body.hipsCm = hi;
    try {
      await api('/me/measurements/correct', { method: 'POST', body: JSON.stringify(body) });
      await load();
      setMsg('Misure corrette. La misura precedente è stata sostituita.');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Correzione non riuscita.');
    } finally {
      setBusy(false);
      setConfirmCorrect(false);
    }
  }

  if (loading) return <div className="center"><div className="spin" /></div>;

  // Misura di oggi già inviata? (le misure sono ordinate crescenti → l'ultima è la più
  // recente). Se sì, il tasto resta disattivato finché non modifichi un valore.
  const todayIso = new Date().toISOString().slice(0, 10);
  const lastMeas = measurements[measurements.length - 1];
  const sentToday = !!lastMeas && String(lastMeas.date).slice(0, 10) === todayIso;
  // Misura di oggi già corretta una volta? Allora niente altre modifiche dalla cliente.
  const correctedToday = sentToday && !!lastMeas?.replacedSnapshot;
  // Gli input si modificano: quando NON hai ancora inviato oggi, oppure quando hai premuto
  // "Cambia misure" (correcting) e non l'hai già corretta.
  const inputsEnabled = !busy && (!sentToday || (correcting && !correctedToday));

  return (
    <div className="home">
      <AppHeader title="I tuoi obiettivi" />

      {/* Obiettivo attuale (dai dati di registrazione) */}
      {objective && (() => {
        const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
        const start = sorted[0];
        const dW = objective.targetWeightKg != null && start ? start.weightKg - objective.targetWeightKg : null;
        const dWa = objective.targetWaistCm != null && start?.waistCm != null ? start.waistCm - objective.targetWaistCm : null;
        const dH = objective.targetHipsCm != null && start?.hipsCm != null ? start.hipsCm - objective.targetHipsCm : null;
        const cm = dWa ?? dH;
        const weeks = objective.targetDate ? Math.max(1, Math.round((new Date(objective.targetDate).getTime() - Date.now()) / (7 * 86_400_000))) : null;
        const rate = dW != null && weeks ? dW / weeks : null;
        const sust = rate == null ? null : rate <= 0.7 ? { t: 'sostenibile', c: '#3B6D11' } : rate <= 1 ? { t: 'ambizioso', c: '#8A5A0B' } : { t: 'molto ambizioso', c: '#993C1D' };
        if (dW == null && cm == null) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row-between">
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Obiettivo attuale</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
                  {dW != null ? `-${d1(dW)} kg` : ''}{dW != null && cm != null ? ' · ' : ''}{cm != null ? `-${d1(cm)} cm` : ''}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {weeks ? `entro ${weeks} settimane` : ''}{weeks && sust ? ' · ' : ''}{sust && <span style={{ color: sust.c, fontWeight: 600 }}>{sust.t}</span>}
                </div>
              </div>
              <span className="event-ic" style={{ background: '#EAF6F1', color: '#0E7C66', flex: 'none' }}><i className="ti ti-target" /></span>
            </div>
            <button
              className="btn-recipe"
              style={{ marginTop: 10 }}
              onClick={() => { setObjKg(dW != null ? d1(dW) : ''); setObjWeeks(weeks ? String(weeks) : ''); setObjErr(null); setEditObj(true); }}
            >
              <i className="ti ti-pencil" /> Modifica o fissa un nuovo obiettivo
            </button>
          </div>
        );
      })()}

      {editObj && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Modifica obiettivo</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso da perdere (kg)</div>
              <input className="input" inputMode="decimal" value={objKg} onChange={(e) => setObjKg(e.target.value)} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Entro (settimane)</div>
              <input className="input" inputMode="numeric" value={objWeeks} onChange={(e) => setObjWeeks(e.target.value)} />
            </div>
          </div>
          {objErr && <div className="muted" style={{ color: '#B3261E', fontSize: 12, marginTop: 8 }}>{objErr}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={saveObjective} disabled={objBusy}>{objBusy ? 'Salvo…' : 'Salva obiettivo'}</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEditObj(false)}>Annulla</button>
          </div>
        </div>
      )}

      {/* Misure di oggi */}
      <div className="card">
        <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Misure di oggi</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso (kg)</div><input className="input" inputMode="decimal" value={weight} disabled={!inputsEnabled} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Vita (cm)</div><input className="input" inputMode="decimal" value={waist} disabled={!inputsEnabled} onChange={(e) => setWaist(e.target.value)} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Fianchi (cm)</div><input className="input" inputMode="decimal" value={hips} disabled={!inputsEnabled} onChange={(e) => setHips(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {!sentToday ? (
              <button className="btn" style={{ padding: 11 }} onClick={submit} disabled={busy}>
                <i className="ti ti-send" /> {busy ? 'Salvo…' : 'Invia'}
              </button>
            ) : correctedToday ? (
              <button className="btn" style={{ padding: 11 }} disabled>
                <i className="ti ti-check" /> Corretta oggi
              </button>
            ) : !correcting ? (
              <button className="btn ghost" style={{ padding: 11 }} onClick={() => { setMsg(null); setCorrecting(true); }} disabled={busy}>
                <i className="ti ti-pencil" /> Cambia misure
              </button>
            ) : (
              <button className="btn" style={{ padding: 11 }} onClick={() => setConfirmCorrect(true)} disabled={busy}>
                <i className="ti ti-send" /> {busy ? 'Salvo…' : 'Salva correzione'}
              </button>
            )}
          </div>
        </div>

        {/* Conferma sostituzione ("Sei sicuro?") */}
        {confirmCorrect && (
          <div className="card" style={{ marginTop: 10, background: '#FBF0D6', border: '1px solid #EAD8A6', boxShadow: 'none' }}>
            <div style={{ fontSize: 13, color: '#7A5B12', marginBottom: 8 }}>
              Sei sicuro? Le misure di oggi verranno sostituite con quelle nuove. <b>Puoi correggerle una sola volta</b>; dopo, solo lo staff può modificarle.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ flex: 1, padding: 10 }} onClick={correct} disabled={busy}>{busy ? 'Salvo…' : 'Sì, sostituisci'}</button>
              <button className="btn ghost" style={{ flex: 1, padding: 10 }} onClick={() => setConfirmCorrect(false)} disabled={busy}>Annulla</button>
            </div>
          </div>
        )}

        {sentToday && !correctedToday && !correcting && (
          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Hai inviato le misure di oggi. Se hai sbagliato puoi correggerle una volta.</div>
        )}
        {msg && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
      </div>

      {measurements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>Ancora nessuna misura: inserisci la prima per vedere i progressi.</p>
        </div>
      ) : (
        <>
          {/* Andamento — carosello di grafici (come il prototipo) */}
          {(() => {
            const charts = METRICS
              .map((m) => {
                const pts = measurements
                  .map((x) => ({ v: x[m.key] as number | null, d: x.date }))
                  .filter((p): p is { v: number; d: string } => p.v != null);
                return {
                  m,
                  series: pts.map((p) => p.v),
                  dates: pts.map((p) => new Date(p.d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })),
                };
              })
              .filter((c) => c.series.length >= 2);
            if (charts.length === 0) return null;
            return (
              <>
                <div className="sec">Andamento <span className="muted" style={{ fontWeight: 400 }}>· scorri i grafici</span></div>
                <div className="meal-carousel" ref={chartsRef} onScroll={onChartsScroll}>
                  {charts.map(({ m, series, dates }) => {
                    const delta = series[0] - series[series.length - 1];
                    return (
                      <div className="card" key={m.key}>
                        <div className="row-between" style={{ marginBottom: 8 }}>
                          <b style={{ fontSize: 13 }}>Andamento {m.label.toLowerCase()}</b>
                          <span style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{delta >= 0 ? '-' : '+'}{d1(Math.abs(delta))} {m.unit}</span>
                        </div>
                        <Spark vals={series} dates={dates} format={(v) => `${d1(v)} ${m.unit}`} color={m.color} />
                        <div className="row-between" style={{ fontSize: 10, color: '#9aa', marginTop: 4 }}>
                          <span>{dates[0]}</span><span>{dates[dates.length - 1]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {charts.length > 1 && (
                  <div className="home-dots">
                    {charts.map((_, i) => <span key={i} className={i === chartIdx ? 'on' : ''} />)}
                  </div>
                )}
              </>
            );
          })()}

          {/* Progressi */}
          <div className="card" style={{ marginTop: 12 }}>
            <b style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Verso il tuo obiettivo</b>
            {METRICS.map((m) => {
              const series = measurements.map((x) => x[m.key] as number | null).filter((v): v is number => v != null);
              const target = objective ? (objective[m.targetKey] as number | null) : null;
              if (series.length === 0 || target == null) return null;
              const start = series[0];
              const current = series[series.length - 1];
              const denom = start - target;
              const pct = denom === 0 ? 100 : Math.max(0, Math.min(100, Math.round(((start - current) / denom) * 100)));
              return (
                <div key={m.key} style={{ marginBottom: 13 }}>
                  <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
                    <b>{m.label}</b>
                    <span className="muted">-{d1(start - current)} di -{d1(start - target)} {m.unit} · <b style={{ color: m.color }}>{pct}%</b></span>
                  </div>
                  <div className="bar"><span style={{ width: `${pct}%`, background: m.color }} /></div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
