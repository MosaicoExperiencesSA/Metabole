import { useEffect, useState } from 'react';
import { isMuted, onSpeaking, play, setMuted, stop } from '../audio/gaia';

type Eyes = 'happy' | 'open' | 'sleep';
type Mouth = 'big' | 'smile' | 'flat';

/**
 * Mascotte Gaia — SVG identico al prototipo del socio (mascSVG).
 * Galleggia, "respira", le foglie ondeggiano; muove la bocca quando parla.
 */
function Mascot({ size, eyes, mouth, cheek, talking }: { size: number; eyes: Eyes; mouth: Mouth; cheek: boolean; talking: boolean }) {
  const mouthD = mouth === 'big' ? 'M102 152 Q120 174 138 152' : mouth === 'flat' ? 'M106 158 L134 158' : 'M104 156 Q120 166 136 156';
  return (
    <svg viewBox="0 0 240 250" width={size} height={size} aria-hidden className={talking ? 'gaia talking' : 'gaia'}>
      <defs>
        <linearGradient id="cmB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93E7C8" />
          <stop offset="1" stopColor="#33B190" />
        </linearGradient>
        <linearGradient id="cmBe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ECFCF4" />
          <stop offset="1" stopColor="#CBF2E3" />
        </linearGradient>
        <linearGradient id="cmL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9EF7C" />
          <stop offset="1" stopColor="#54BD66" />
        </linearGradient>
      </defs>
      <g className="cmFloat">
        <g className="cmBreathe">
          <g className="cmSprout">
            <path d="M117 66 C112 44 96 40 92 46 C100 60 112 64 117 66Z" fill="url(#cmL)" />
            <path d="M123 66 C128 44 144 40 148 46 C140 60 128 64 123 66Z" fill="url(#cmL)" />
            <rect x="116" y="58" width="8" height="20" rx="4" fill="#3FA98C" />
          </g>
          <ellipse cx="50" cy="168" rx="14" ry="22" fill="#57C0A2" />
          <ellipse cx="190" cy="168" rx="14" ry="22" fill="#57C0A2" />
          <path d="M120 70 C172 70 200 112 200 156 C200 208 162 226 120 226 C78 226 40 208 40 156 C40 112 68 70 120 70Z" fill="url(#cmB)" />
          <ellipse cx="105" cy="104" rx="40" ry="24" fill="#fff" opacity=".22" />
          <ellipse cx="120" cy="162" rx="50" ry="54" fill="url(#cmBe)" />
          <ellipse cx="98" cy="224" rx="16" ry="10" fill="#4FB495" />
          <ellipse cx="142" cy="224" rx="16" ry="10" fill="#4FB495" />
          {cheek && (
            <>
              <ellipse cx="86" cy="150" rx="12" ry="7.5" fill="#FF9DB0" opacity=".7" />
              <ellipse cx="154" cy="150" rx="12" ry="7.5" fill="#FF9DB0" opacity=".7" />
            </>
          )}
          {eyes === 'sleep' ? (
            <>
              <path d="M84 126 Q100 136 116 126" stroke="#25384A" strokeWidth="5" strokeLinecap="round" fill="none" />
              <path d="M124 126 Q140 136 156 126" stroke="#25384A" strokeWidth="5" strokeLinecap="round" fill="none" />
            </>
          ) : eyes === 'open' ? (
            <>
              <g className="cmEye" style={{ transformOrigin: '100px 128px' }}>
                <ellipse cx="100" cy="128" rx="16" ry="19" fill="#25384A" />
                <circle cx="94" cy="121" r="6" fill="#fff" />
              </g>
              <g className="cmEye" style={{ transformOrigin: '140px 128px' }}>
                <ellipse cx="140" cy="128" rx="16" ry="19" fill="#25384A" />
                <circle cx="134" cy="121" r="6" fill="#fff" />
              </g>
            </>
          ) : (
            <>
              <path d="M84 132 Q100 112 116 132" stroke="#25384A" strokeWidth="6" strokeLinecap="round" fill="none" />
              <path d="M124 132 Q140 112 156 132" stroke="#25384A" strokeWidth="6" strokeLinecap="round" fill="none" />
            </>
          )}
          <path className="cmMouth" d={mouthD} stroke="#25384A" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}

export default function Gaia({
  clip,
  size = 116,
  eyes = 'happy',
  mouth = 'big',
  cheek = true,
  controls = true,
}: {
  clip?: string;
  size?: number;
  eyes?: Eyes;
  mouth?: Mouth;
  cheek?: boolean;
  controls?: boolean;
}) {
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

  // Tap sulla mascotte: se sta parlando la silenzia; se è muta la riattiva e ripete la frase.
  function handleTap() {
    if (muted) {
      setMuted(false);
      setMutedState(false);
      if (clip) play(clip);
    } else {
      setMuted(true);
      setMutedState(true);
    }
  }

  return (
    <div className="gaia-wrap">
      <div className="gaia-tap" onClick={handleTap} role="button" aria-label={muted ? 'Riattiva la voce di Gaia' : 'Silenzia Gaia'}>
        <Mascot size={size} eyes={eyes} mouth={mouth} cheek={cheek} talking={speaking} />
        {muted && (
          <span className="gaia-muted" aria-hidden><i className="ti ti-volume-off" /></span>
        )}
      </div>
      {controls && (
        <div className="gaia-ctrls">
          <button className="gaia-btn" onClick={() => clip && play(clip)} aria-label="Riascolta Gaia" title="Riascolta">
            <i className="ti ti-volume" />
          </button>
          <button className="gaia-btn" onClick={toggleMute} aria-label={muted ? 'Riattiva la voce' : 'Silenzia Gaia'} title={muted ? 'Riattiva' : 'Silenzia'}>
            <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume-2'}`} />
          </button>
        </div>
      )}
    </div>
  );
}
