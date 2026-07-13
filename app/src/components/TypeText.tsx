import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';

export interface Seg {
  t: string;
  b?: boolean; // grassetto
}

/**
 * Testo che si "compone" a macchina da scrivere mentre Gaia parla (come nel prototipo).
 * Preserva le parti in grassetto. Con `start=false` mostra subito tutto (accessibilità/no-motion).
 */
export function TypeText({
  segments,
  cps = 32,
  start = true,
  className,
  style,
  onDone,
}: {
  segments: Seg[];
  cps?: number;
  start?: boolean;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
}) {
  const total = segments.reduce((a, s) => a + s.t.length, 0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(start && !reduce ? 0 : total);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!start || reduce) {
      setN(total);
      return;
    }
    doneRef.current = false;
    setN(0);
    let cur = 0;
    const step = Math.max(1, Math.round(cps / 30));
    const id = window.setInterval(() => {
      cur += step;
      if (cur >= total) {
        cur = total;
        window.clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
      setN(cur);
    }, 1000 / 30);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, total, cps]);

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
