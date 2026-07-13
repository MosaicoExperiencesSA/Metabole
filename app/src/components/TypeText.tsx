import { CSSProperties, ReactNode, useEffect, useState } from 'react';

export interface Seg {
  t: string;
  b?: boolean; // grassetto
}

/**
 * Testo che si "compone" a macchina da scrivere mentre Gaia parla (identico al prototipo:
 * durata = max(1500ms, caratteri × 62ms), reveal lineare via requestAnimationFrame).
 * Preserva le parti in grassetto. Rispetta `prefers-reduced-motion` (mostra tutto subito).
 */
export function TypeText({
  segments,
  msPerChar = 62,
  minMs = 1500,
  start = true,
  className,
  style,
  onDone,
}: {
  segments: Seg[];
  msPerChar?: number;
  minMs?: number;
  start?: boolean;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
}) {
  const total = segments.reduce((a, s) => a + s.t.length, 0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(start && !reduce ? 0 : total);

  useEffect(() => {
    if (!start || reduce || total === 0) {
      setN(total);
      onDone?.();
      return;
    }
    const dur = Math.max(minMs, total * msPerChar);
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / dur);
      setN(Math.round(f * total));
      if (f < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, total, msPerChar, minMs]);

  let remaining = n;
  const out: ReactNode[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (remaining <= 0) break;
    const take = Math.min(s.t.length, remaining);
    const txt = s.t.slice(0, take);
    remaining -= take;
    out.push(s.b ? <b key={i}>{txt}</b> : <span key={i}>{txt}</span>);
  }
  const done = n >= total;

  return (
    <span className={className} style={style}>
      {out}
      {!done && <span className="type-caret" aria-hidden>▍</span>}
    </span>
  );
}
