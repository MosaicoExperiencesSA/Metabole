/** Popup di check-in giornaliero: come ti senti oggi? (umore, salvato sul backend). */
const MOODS: { key: string; emoji: string; label: string; bg: string; color: string }[] = [
  { key: 'great', emoji: '😍', label: 'Alla grande', bg: '#E4F3DC', color: '#3B6D11' },
  { key: 'good', emoji: '😄', label: 'Bene', bg: '#EAF3D9', color: '#4D7C0F' },
  { key: 'ok', emoji: '😐', label: 'Media', bg: '#FBF0D6', color: '#8A5A0B' },
  { key: 'hard', emoji: '😣', label: 'Dura', bg: '#FBE6DC', color: '#B4491F' },
  { key: 'stressed', emoji: '🤯', label: 'Stress', bg: '#F7DAD6', color: '#993C1D' },
];

export default function CheckinPopup({ onMood, onSkip, busy }: { onMood: (mood: string) => void; onSkip: () => void; busy?: boolean }) {
  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}>
      <div className="sheet-card">
        <div className="sheet-grab" />
        <b style={{ fontSize: 16 }}>Come ti senti oggi?</b>
        <div className="muted" style={{ margin: '3px 0 14px' }}>Un check-in veloce prima di iniziare la giornata.</div>
        <div className="mood-row">
          {MOODS.map((m) => (
            <button className="mood-btn" key={m.key} disabled={busy} onClick={() => onMood(m.key)}>
              <span className="mood-emoji" style={{ background: m.bg }}>{m.emoji}</span>
              <span style={{ fontSize: 9, color: m.color }}>{m.label}</span>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, cursor: 'pointer' }} onClick={onSkip}>
          <span className="muted">Salta per oggi</span>
        </div>
      </div>
    </div>
  );
}
