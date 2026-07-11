/** Negozio — piani e integratori. */

type Integ = [string, string, string, string, string, string];
const INTEG: Integ[] = [
  ['Omega 3', 'Benessere e sazietà', '€ 24', 'ti-pill', '#DCEBE3', '#0E7C66'],
  ['Proteine veg', 'Post-allenamento', '€ 32', 'ti-bottle', '#EFEAF9', '#6C5AB7'],
];

export default function Negozio() {
  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-shopping-bag" /></span>
        <div><h1 style={{ margin: 0 }}>Negozio</h1><div className="muted">Piani e integratori</div></div>
      </div>

      <div className="sec" style={{ marginTop: 4 }}>Piani</div>
      <div className="card" style={{ border: '2px solid #12A386', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Più scelto</span>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 5 }}>Percorso 3 mesi</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>€ 267</div>
          <button className="btn-recipe" style={{ marginTop: 5 }}>Acquista</button>
        </div>
      </div>

      <div className="sec">Integratori</div>
      <div className="meals-col">
        {INTEG.map((p) => (
          <div className="card storico-row" key={p[0]}>
            <span className="event-ic" style={{ width: 40, height: 40, borderRadius: 12, background: p[4], color: p[5] }}><i className={`ti ${p[3]}`} style={{ fontSize: 20 }} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p[0]}</div>
              <div className="muted" style={{ fontSize: 11 }}>{p[1]}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p[2]}</div>
              <button className="btn-recipe" style={{ marginTop: 4, padding: '4px 10px', fontSize: 11 }}><i className="ti ti-plus" style={{ fontSize: 12 }} /> Aggiungi</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
