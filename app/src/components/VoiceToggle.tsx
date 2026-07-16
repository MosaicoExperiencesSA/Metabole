import { useState } from 'react';
import { isMuted, play, setMuted, stop } from '../audio/gaia';

/**
 * Piccolo autoparlante cliccabile: silenzia/riattiva la voce di Gaia.
 * Se è indicata una `clip`, alla riattivazione la ripete.
 */
export default function VoiceToggle({ clip, size = 17, style }: { clip?: string; size?: number; style?: React.CSSProperties }) {
  const [muted, setMutedState] = useState(isMuted());

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (next) stop();
    else if (clip) play(clip);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Riattiva la voce di Gaia' : 'Silenzia Gaia'}
      title={muted ? 'Riattiva la voce' : 'Silenzia'}
      style={{
        background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
        padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume'}`} style={{ fontSize: size }} />
    </button>
  );
}
