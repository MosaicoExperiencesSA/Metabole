/** Popup di check-in giornaliero: come ti senti oggi? (umore). */
const MOODS: [string, string, string, string][] = [
  ['😍', 'Alla grande', '#E4F3DC', '#3B6D11'],
  ['😄', 'Bene', '#EAF3D9', '#4D7C0F'],
  ['😐', 'Media', '#FBF0D6', '#8A5A0B'],
  ['😣', 'Dura', '#FBE6DC', '#B4491F'],
  ['🤯', 'Stress', '#F7DAD6', '#993C1D'],
];

export default function CheckinPopup({ onDone }: { onDone: () => void }) {
  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <div className="sheet-card">
        <div className="sheet-grab" />
        <b style={{ fontSize: 16 }}>Come ti senti oggi?</b>
        <div className="muted" style={{ margin: '3px 0 14px' }}>Un check-in veloce prima di iniziare la giornata.</div>
        <div className="mood-row">
          {MOODS.map((m) => (
            <button className="mood-btn" key={m[1]} onClick={onDone}>
              <span className="mood-emoji" style={{ background: m[2] }}>{m[0]}</span>
              <span style={{ fontSize: 9, color: m[3] }}>{m[1]}</span>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, cursor: 'pointer' }} onClick={onDone}>
          <span className="muted">Salta per oggi</span>
        </div>
      </div>
    </div>
  );
}
