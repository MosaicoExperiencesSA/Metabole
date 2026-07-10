import { useEffect, useState } from 'react';
import { isMuted, onSpeaking, play, setMuted, stop } from '../audio/gaia';

/**
 * Mascotte Gaia: faccia animata (galleggia, sbatte gli occhi, muove la bocca quando parla)
 * con pulsanti "riascolta" e "muto". Quando cambia `clip`, riproduce la nuova frase.
 */
export default function Gaia({ clip, size = 116 }: { clip?: string; size?: number }) {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => onSpeaking(setSpeaking), []);

  useEffect(() => {
    if (clip) play(clip);
    return () => stop();
  }, [clip]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <div className="gaia-wrap">
      <div
        className={`gaia${speaking ? ' talking' : ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 120 120" width={size} height={size}>
          <defs>
            <radialGradient id="gaiaBody" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#b9efe0" />
              <stop offset="55%" stopColor="#2bbd9d" />
              <stop offset="100%" stopColor="#0f7f6b" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="46" fill="url(#gaiaBody)" />
          {/* guance */}
          <circle cx="40" cy="72" r="6" fill="#ff9d7a" opacity="0.45" />
          <circle cx="80" cy="72" r="6" fill="#ff9d7a" opacity="0.45" />
          {/* occhi */}
          <g className="gaia-eyes">
            <circle cx="47" cy="55" r="8.5" fill="#fff" />
            <circle cx="73" cy="55" r="8.5" fill="#fff" />
            <circle cx="48.5" cy="56" r="4" fill="#13322c" />
            <circle cx="74.5" cy="56" r="4" fill="#13322c" />
            <circle cx="50" cy="54.5" r="1.3" fill="#fff" />
            <circle cx="76" cy="54.5" r="1.3" fill="#fff" />
          </g>
          {/* bocca */}
          <path className="gaia-mouth" d="M50 76 Q60 84 70 76" fill="none" stroke="#0c2b25" strokeWidth="3.2" strokeLinecap="round" />
          {/* fogliolina */}
          <path d="M60 12 Q68 4 78 8 Q72 18 60 16 Z" fill="#7bd6b0" />
        </svg>
      </div>

      <div className="gaia-ctrls">
        <button className="gaia-btn" onClick={() => clip && play(clip)} aria-label="Riascolta Gaia" title="Riascolta">
          <i className="ti ti-volume" />
        </button>
        <button className="gaia-btn" onClick={toggleMute} aria-label={muted ? 'Riattiva la voce' : 'Silenzia Gaia'} title={muted ? 'Riattiva' : 'Silenzia'}>
          <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume-2'}`} />
        </button>
      </div>
    </div>
  );
}
