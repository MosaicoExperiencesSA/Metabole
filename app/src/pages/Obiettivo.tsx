import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

/** Obiettivo — misure reali, andamento (grafici) e progressi verso il target. */

interface Measurement {
  id: string;
  date: string;
  weightKg: number;
  waistCm: number | null;
  hipsCm: number | null;
}
interface Objective {
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetHipsCm: number | null;
}

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

function Spark({ vals, color }: { vals: number[]; color: string }) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 250;
  const h = 64;
  const x = (i: number) => (i / Math.max(vals.length - 1, 1)) * w;
  const y = (v: number) => h - ((v - min) / range) * h * 0.85 - 5;
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="66" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => <circle key={i} cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r="3" fill={color} />)}
    </svg>
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
  const [msg, setMsg] = useState<string | null>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [chartIdx, setChartIdx] = useState(0);

  function onChartsScroll() {
    const el = chartsRef.current;
    if (el) setChartIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  async function load() {
    const [ms, obj] = await Promise.all([
      api<Measurement[]>('/me/measurements').catch(() => [] as Measurement[]),
      api<Objective>('/me/objective').catch((e) => (e instanceof ApiError && e.status === 404 ? null : null)),
    ]);
    setMeasurements(ms);
    setObjective(obj);
    const last = ms[ms.length - 1];
    if (last) {
      setWeight(d1(last.weightKg));
      setWaist(last.waistCm != null ? d1(last.waistCm) : '');
      setHips(last.hipsCm != null ? d1(last.hipsCm) : '');
    }
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

  if (loading) return <div className="center"><div className="spin" /></div>;

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#E7EEF6', color: '#3A6EA5' }}><i className="ti ti-target" /></span>
        <div><h1 style={{ margin: 0 }}>Il mio obiettivo</h1><div className="muted">Inserisci le misure e segui i progressi</div></div>
      </div>

      {/* Misure di oggi */}
      <div className="card">
        <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Misure di oggi</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso (kg)</div><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Vita (cm)</div><input className="input" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Fianchi (cm)</div><input className="input" inputMode="decimal" value={hips} onChange={(e) => setHips(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" style={{ padding: 11 }} onClick={submit} disabled={busy}><i className="ti ti-send" /> {busy ? 'Salvo…' : 'Invia'}</button>
          </div>
        </div>
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
              .map((m) => ({ m, series: measurements.map((x) => x[m.key] as number | null).filter((v): v is number => v != null) }))
              .filter((c) => c.series.length >= 2);
            if (charts.length === 0) return null;
            return (
              <>
                <div className="sec">Andamento <span className="muted" style={{ fontWeight: 400 }}>· scorri i grafici</span></div>
                <div className="meal-carousel" ref={chartsRef} onScroll={onChartsScroll}>
                  {charts.map(({ m, series }) => {
                    const delta = series[0] - series[series.length - 1];
                    return (
                      <div className="card" key={m.key}>
                        <div className="row-between" style={{ marginBottom: 8 }}>
                          <b style={{ fontSize: 13 }}>Andamento {m.label.toLowerCase()}</b>
                          <span style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{delta >= 0 ? '-' : '+'}{d1(Math.abs(delta))} {m.unit}</span>
                        </div>
                        <Spark vals={series} color={m.color} />
                        <div className="row-between" style={{ fontSize: 10, color: '#9aa', marginTop: 4 }}>
                          <span>inizio</span><span>oggi</span>
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
