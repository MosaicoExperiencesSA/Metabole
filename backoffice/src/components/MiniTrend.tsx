/**
 * Grafico compatto a linea con area e LINEA DI TENDENZA (regressione lineare)
 * per l'andamento di una metrica negli ultimi mesi. Un solo colore (accento del
 * tema); testo in token di inchiostro, non nel colore della serie.
 */
export function MiniTrend({
  label, values, labels, format, color = 'var(--teal)', invertDelta = false,
}: {
  label: string;
  values: number[];
  labels: string[];
  format: (v: number) => string;
  color?: string;
  invertDelta?: boolean; // se true, un aumento è "negativo" (es. non usato qui)
}) {
  const W = 320, H = 76, pad = 8;
  const n = values.length;
  const safe = n > 0 ? values : [0];
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

  const current = safe[n - 1];
  const prev = safe[n - 2] ?? current;
  const delta = current - prev;
  const up = delta > 0.0001;
  const down = delta < -0.0001;
  const good = invertDelta ? down : up;
  const deltaColor = up || down ? (good ? 'var(--ok-ink)' : 'var(--danger)') : 'var(--muted)';

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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points={area} fill={color} opacity={0.12} />
        {trend && <polyline points={trend} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.8} />}
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {n >= 1 && <circle cx={x(n - 1)} cy={y(current)} r={3.5} fill={color} stroke="var(--card)" strokeWidth={1.5} />}
      </svg>
      <div className="spread" style={{ marginTop: 2 }}>
        <span className="muted" style={{ fontSize: 10 }}>{labels[0] ?? ''}</span>
        <span className="muted" style={{ fontSize: 10 }}>{labels[n - 1] ?? ''}</span>
      </div>
    </div>
  );
}
