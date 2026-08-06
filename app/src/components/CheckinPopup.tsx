import { useState } from 'react';

/**
 * Check-in giornaliero in due passi.
 *
 * Prima chiedeva solo l'umore. Dal 5/8 (richiesta Simone, voce #1) servono anche **energia,
 * fame e stress**: sono i tre segnali che il motore usa per capire come sta andando il percorso,
 * e finora restavano quasi sempre vuoti perché nessuno li chiedeva.
 *
 * Perché in DUE passi e non tutto in una schermata: il primo tap sull'umore resta identico a
 * prima — una faccina e via, l'abitudine non cambia — e solo dopo compaiono le tre scale. Chi ha
 * fretta usa «Salta per oggi», che è sempre lì.
 */
const MOODS: { key: string; emoji: string; label: string; bg: string; color: string }[] = [
  { key: 'great', emoji: '😍', label: 'Alla grande', bg: '#E4F3DC', color: '#3B6D11' },
  { key: 'good', emoji: '😄', label: 'Bene', bg: '#EAF3D9', color: '#4D7C0F' },
  { key: 'ok', emoji: '😐', label: 'Media', bg: '#FBF0D6', color: '#8A5A0B' },
  { key: 'hard', emoji: '😣', label: 'Dura', bg: '#FBE6DC', color: '#B4491F' },
  { key: 'stressed', emoji: '🤯', label: 'Stress', bg: '#F7DAD6', color: '#993C1D' },
];

/** Le tre scale 1-5. Gli estremi sono scritti a parole: "3" da solo non vuol dire niente. */
const SCALE: { key: 'energy' | 'hunger' | 'stress'; label: string; basso: string; alto: string }[] = [
  { key: 'energy', label: 'Energia', basso: 'a terra', alto: 'carica' },
  { key: 'hunger', label: 'Fame', basso: 'nessuna', alto: 'tanta' },
  { key: 'stress', label: 'Stress', basso: 'sereno', alto: 'molto' },
];

export interface CheckinValori {
  mood: string;
  energy?: number;
  hunger?: number;
  stress?: number;
}

export default function CheckinPopup({
  onSubmit,
  onSkip,
  busy,
}: {
  onSubmit: (valori: CheckinValori) => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const [mood, setMood] = useState<string | null>(null);
  const [voti, setVoti] = useState<{ energy?: number; hunger?: number; stress?: number }>({});

  const tutteRisposte = voti.energy != null && voti.hunger != null && voti.stress != null;

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}>
      <div className="sheet-card">
        <div className="sheet-grab" />

        {mood == null ? (
          <>
            <b style={{ fontSize: 16 }}>Come ti senti oggi?</b>
            <div className="muted" style={{ margin: '3px 0 14px' }}>Un check-in veloce prima di iniziare la giornata.</div>
            <div className="mood-row">
              {MOODS.map((m) => (
                <button className="mood-btn" key={m.key} disabled={busy} onClick={() => setMood(m.key)}>
                  <span className="mood-emoji" style={{ background: m.bg }}>{m.emoji}</span>
                  <span style={{ fontSize: 9, color: m.color }}>{m.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <b style={{ fontSize: 16 }}>Ancora tre tocchi</b>
            <div className="muted" style={{ margin: '3px 0 14px' }}>
              Servono a capire come sta andando davvero, oltre all'umore.
            </div>
            {SCALE.map((s) => (
              <div key={s.key} style={{ marginBottom: 12 }}>
                <div className="row-between" style={{ fontSize: 12, marginBottom: 5 }}>
                  <b>{s.label}</b>
                  <span className="muted" style={{ fontSize: 10 }}>{s.basso} → {s.alto}</span>
                </div>
                <div className="scale-row">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={voti[s.key] === n ? 'scale-btn on' : 'scale-btn'}
                      disabled={busy}
                      aria-label={`${s.label} ${n} su 5`}
                      onClick={() => setVoti((v) => ({ ...v, [s.key]: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              className="btn"
              style={{ width: '100%', marginTop: 4 }}
              disabled={busy || !tutteRisposte}
              onClick={() => onSubmit({ mood, ...voti })}
            >
              {busy ? 'Salvo…' : tutteRisposte ? 'Salva' : 'Tocca le tre scale'}
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 14, cursor: 'pointer' }} onClick={onSkip}>
          <span className="muted">Salta per oggi</span>
        </div>
      </div>
    </div>
  );
}
