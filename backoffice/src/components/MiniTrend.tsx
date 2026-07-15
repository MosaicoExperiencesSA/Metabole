import { useRef, useState } from 'react';

/**
 * Grafico compatto a linea con area e LINEA DI TENDENZA (regressione lineare).
 * Mostra TUTTI i mesi sull'asse in basso e, al passaggio del mouse, il valore
 * del punto più vicino in un tooltip. Un solo colore (accento del tema); testo
 * in token di inchiostro, non nel colore della serie.
 */
export function MiniTrend({
  label, values, labels, format, color = 'var(--teal)', invertDelta = false,
}: {
  label: string;
  values: number[];
  labels: string[];
  format: (v: number) => string;
  color?: string;
  invertDelta?: boolean;
}) {
  const W = 320, H = 76, pad = 8;
  // Robustezza: scarta valori non numerici (undefined/NaN) e gestisci la serie vuota (0 dati).
  const nums = Array.isArray(values) ? values.map((v) => (typeof v === 'number' && isFinite(v) ? v : 0)) : [];
  const n = nums.length;
  const safe = n > 0 ? nums : [0];
  const max = Math.max(...safe);
  const min = Math.min(...safe);
  const range = max - min || 1;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const line = safe.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${(H - pad).toFixed(1)} ${line} ${x(n - 1).toFixed(1)},${(H - pad).toFixed(1)}`;

  // Regressione lineare per la linea di tendenza.
  let trend: string | null = null;
  if (n >= 2) {
    const sx = safe.reduce((a, _v, i) => a + i, 0);
    const sy = safe.reduce((a, v) => a + v, 0);
    const sxx = safe.reduce((a, _v, i) => a + i * i, 0);
    const sxy = safe.reduce((a, v, i) => a + i * v, 0);
    const denom = n * sxx - sx * sx || 1;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    trend = `${x(0).toFixed(1)},${y(intercept).toFixed(1)} ${x(n - 1).toFixed(1)},${y(intercept + slope * (n - 1)).toFixed(1)}`;
  }

  const current = safe[safe.length - 1];
  const prev = safe[safe.length - 2] ?? current;
  const delta = current - prev;
  const up = delta > 0.0001;
  const down = delta < -0.0001;
  const good = invertDelta ? down : up;
  const deltaColor = up || down ? (good ? 'var(--ok-ink)' : 'var(--danger)') : 'var(--muted)';

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el || n <= 1) return;
    const rect = el.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width; // 0..1 sulla larghezza
    const frac = Math.min(1, Math.max(0, (rel * W - pad) / (W - 2 * pad)));
    setHover(Math.round(frac * (n - 1)));
  }

  const hx = hover != null ? (x(hover) / W) * 100 : 0; // % orizzontale del punto

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        {(up || down) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor }}>
            {up ? '▲' : '▼'} {format(Math.abs(delta))}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 6px' }}>{format(current)}</div>

      <div ref={wrapRef} style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <polygon points={area} fill={color} opacity={0.12} />
          {trend && <polyline points={trend} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.8} />}
          <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {n >= 1 && hover == null && <circle cx={x(n - 1)} cy={y(current)} r={3.5} fill={color} stroke="var(--card)" strokeWidth={1.5} />}
        </svg>

        {hover != null && (
          <>
            {/* linea guida verticale */}
            <div style={{ position: 'absolute', left: `${hx}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)', pointerEvents: 'none' }} />
            {/* punto evidenziato */}
            <div style={{ position: 'absolute', left: `${hx}%`, top: y(safe[hover]), width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: color, border: '2px solid var(--card)', pointerEvents: 'none' }} />
            {/* tooltip col valore */}
            <div style={{ position: 'absolute', left: `${Math.min(88, Math.max(12, hx))}%`, top: -4, transform: 'translate(-50%,-100%)', background: 'var(--ink)', color: 'var(--card)', fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.18)' }}>
              {labels[hover] ? `${labels[hover]} · ` : ''}{format(safe[hover])}
            </div>
          </>
        )}
      </div>

      {/* Mesi sull'asse in basso (tutti) */}
      <div style={{ position: 'relative', height: 14, marginTop: 3 }}>
        {labels.map((l, i) => (
          <span
            key={i}
            className="muted"
            style={{
              position: 'absolute',
              left: `${(x(i) / W) * 100}%`,
              transform: i === 0 ? 'none' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
