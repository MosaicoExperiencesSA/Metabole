/** Obiettivo — misure di oggi, andamento (grafici) e progressi verso il target. */

type Obj = [string, string, number, number, number, string]; // label, unit, start, current, target, color
const OBJ: Obj[] = [
  ['Peso', 'kg', 72, 68.4, 66, '#12A386'],
  ['Vita', 'cm', 80, 76.5, 72, '#E8825A'],
  ['Fianchi', 'cm', 99, 97, 94, '#3A6EA5'],
];
const CHARTS: [string, string, number[], string][] = [
  ['Peso', 'kg', [72, 71.3, 70.6, 70, 69.4, 69, 68.7, 68.4], '#12A386'],
  ['Vita', 'cm', [80, 79.4, 78.6, 78, 77.5, 77.1, 76.8, 76.5], '#E8825A'],
  ['Fianchi', 'cm', [99, 98.6, 98.2, 97.8, 97.5, 97.2, 97, 97], '#3A6EA5'],
];

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
const pctOf = (o: Obj) => Math.round(((o[2] - o[3]) / (o[2] - o[4])) * 100);

function Spark({ vals, color }: { vals: number[]; color: string }) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100;
  const h = 40;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${(h - 2) - ((v - min) / range) * (h - 4) + 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="52" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function Obiettivo() {
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
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso (kg)</div><input className="input" defaultValue="68,4" /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Vita (cm)</div><input className="input" defaultValue="76,5" /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Fianchi (cm)</div><input className="input" defaultValue="97" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" style={{ padding: 11 }}><i className="ti ti-send" /> Invia</button>
          </div>
        </div>
      </div>

      {/* Andamento */}
      <div className="sec">Andamento</div>
      <div className="meals-col">
        {CHARTS.map((c) => {
          const delta = d1(c[2][0] - c[2][c[2].length - 1]);
          return (
            <div className="card" key={c[0]}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>Andamento {c[0].toLowerCase()}</b>
                <span style={{ fontSize: 11, color: c[3], fontWeight: 600 }}>-{delta} {c[1]}</span>
              </div>
              <Spark vals={c[2]} color={c[3]} />
              <div className="row-between" style={{ fontSize: 10, color: '#9aa', marginTop: 4 }}>
                <span>3 sett. fa</span><span>oggi</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progressi */}
      <div className="card" style={{ marginTop: 12 }}>
        <b style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Verso il tuo obiettivo</b>
        {OBJ.map((o) => {
          const pct = pctOf(o);
          return (
            <div key={o[0]} style={{ marginBottom: 13 }}>
              <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
                <b>{o[0]}</b>
                <span className="muted">-{d1(o[2] - o[3])} di -{d1(o[2] - o[4])} {o[1]} · <b style={{ color: o[5] }}>{pct}%</b></span>
              </div>
              <div className="bar"><span style={{ width: `${pct}%`, background: o[5] }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
