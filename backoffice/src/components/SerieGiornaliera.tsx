import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Spinner } from './ui';

/**
 * FATTURATO CUMULATO E NUOVE CLIENTI **PER GIORNATA** (richiesta di Simone dell'8/8).
 *
 * Le due cose che questa card fa e che la serie a sei mesi non poteva fare:
 *
 *  - l'asse è a **giorni**, e la curva si **azzera ogni mese**: si legge dove siamo arrivati questo
 *    mese, non una linea che sale da sempre e in cui un mese scarso non si distingue;
 *  - c'è la linea del **mese precedente**, sovrapposta giorno per giorno. Il confronto che informa a
 *    metà mese è quello **alla stessa giornata**: l'8 agosto contro l'8 luglio. I totali (un mese
 *    finito contro un mese a metà) sembrano sempre un crollo, e non dicono niente.
 *
 * Le frecce scorrono i mesi storici. La freccia «avanti» sparisce sul mese in corso: portare su un
 * mese futuro e vuoto fa sembrare rotta la pagina.
 */

interface PuntoGiorno {
  giorno: number;
  ricaviCents: number;
  ricaviCumulatiCents: number;
  nuoveClienti: number;
  nuoveClientiCumulate: number;
}

interface RispostaGiornaliera {
  mese: string;
  etichetta: string;
  precedente: string;
  etichettaPrecedente: string;
  successivo: string | null;
  giorniNelMese: number;
  oggi: number | null;
  serie: PuntoGiorno[];
  seriePrecedente: PuntoGiorno[];
  confronto: {
    giorno: number;
    ricaviCents: number;
    ricaviPrecedenteCents: number;
    nuoveClienti: number;
    nuoveClientiPrecedente: number;
    variazionePct: number | null;
  };
}

const eur = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

export function SerieGiornaliera() {
  const [mese, setMese] = useState<string | null>(null);
  const [dati, setDati] = useState<RispostaGiornaliera | null>(null);
  const [carico, setCarico] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarico(true);
    api<RispostaGiornaliera>(`/admin/charts/daily${mese ? `?mese=${mese}` : ''}`)
      .then((r) => { if (vivo) { setDati(r); setErr(null); } })
      .catch((e) => { if (vivo) setErr(e instanceof Error ? e.message : 'Non riesco a leggere la serie giornaliera.'); })
      .finally(() => { if (vivo) setCarico(false); });
    return () => { vivo = false; };
  }, [mese]);

  if (carico && !dati) return <div className="card"><Spinner /></div>;
  if (err && !dati) return <div className="card"><p className="muted" style={{ margin: 0 }}>{err}</p></div>;
  if (!dati) return null;

  const c = dati.confronto;
  const meglio = c.ricaviCents > c.ricaviPrecedenteCents;
  const pari = c.ricaviCents === c.ricaviPrecedenteCents;

  return (
    <div className="card">
      <div className="spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          <i className="ti ti-chart-line" style={{ verticalAlign: '-2px', color: 'var(--gold)' }} /> Fatturato del mese, giorno per giorno
        </h2>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button className="btn ghost sm" title="Mese precedente" onClick={() => setMese(dati.precedente)}>
            <i className="ti ti-chevron-left" />
          </button>
          <b style={{ fontSize: 13.5, minWidth: 108, textAlign: 'center', textTransform: 'capitalize' }}>{dati.etichetta}</b>
          {/* Niente freccia oltre il mese in corso: vedi il commento in testa al file. */}
          <button
            className="btn ghost sm"
            title="Mese successivo"
            disabled={!dati.successivo}
            style={{ visibility: dati.successivo ? 'visible' : 'hidden' }}
            onClick={() => dati.successivo && setMese(dati.successivo)}
          >
            <i className="ti ti-chevron-right" />
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 18, alignItems: 'baseline', flexWrap: 'wrap', margin: '8px 0 2px' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{eur(c.ricaviCents)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {dati.oggi ? `al ${c.giorno} del mese` : 'nel mese'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--muted)' }}>{eur(c.ricaviPrecedenteCents)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {/* Si dice SEMPRE «allo stesso giorno»: è la condizione che rende il numero confrontabile,
                e senza scriverlo sembra il totale del mese scorso. */}
            <span style={{ textTransform: 'capitalize' }}>{dati.etichettaPrecedente}</span>, allo stesso giorno
          </div>
        </div>
        {c.variazionePct !== null ? (
          <span
            style={{
              fontSize: 12.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              background: pari ? 'var(--chip)' : meglio ? 'rgba(18,163,134,.14)' : 'rgba(180,35,42,.10)',
              color: pari ? 'var(--muted)' : meglio ? 'var(--ok-ink)' : 'var(--danger)',
            }}
          >
            {c.variazionePct > 0 ? '▲ +' : c.variazionePct < 0 ? '▼ ' : ''}{c.variazionePct}%
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>nessun incasso nel mese precedente</span>
        )}
      </div>

      <DueLinee
        serie={dati.serie.map((p) => p.ricaviCumulatiCents)}
        precedente={dati.seriePrecedente.map((p) => p.ricaviCumulatiCents)}
        oggi={dati.oggi}
        formato={eur}
        etichetta={dati.etichetta}
        etichettaPrecedente={dati.etichettaPrecedente}
      />

      <div className="sec" style={{ margin: '16px 0 6px' }}>Nuove clienti al giorno</div>
      <Barre
        valori={dati.serie.map((p) => p.nuoveClienti)}
        oggi={dati.oggi}
        totale={c.nuoveClienti}
        totalePrecedente={c.nuoveClientiPrecedente}
        etichettaPrecedente={dati.etichettaPrecedente}
      />

      <p className="hint" style={{ marginBottom: 0 }}>
        Il cumulato riparte da zero ogni mese, così si legge dove siamo arrivati. La linea grigia è il
        mese precedente allo stesso giorno: è quello il confronto che dice qualcosa — un mese finito
        contro un mese a metà sembra sempre un crollo.
      </p>
    </div>
  );
}

/**
 * Due curve sullo stesso asse dei giorni, con la stessa scala: la scala condivisa è ciò che rende il
 * confronto leggibile a occhio. Normalizzarle separatamente le farebbe sembrare uguali.
 */
function DueLinee({
  serie, precedente, oggi, formato, etichetta, etichettaPrecedente,
}: {
  serie: number[];
  precedente: number[];
  oggi: number | null;
  formato: (v: number) => string;
  etichetta: string;
  etichettaPrecedente: string;
}) {
  const W = 640, H = 150, padX = 10, padY = 12;
  const giorni = Math.max(serie.length, precedente.length, 2);
  const max = Math.max(1, ...serie, ...precedente);
  const x = (i: number) => padX + (i / (giorni - 1)) * (W - 2 * padX);
  const y = (v: number) => H - padY - (v / max) * (H - 2 * padY);
  const punti = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Il mese in corso si disegna solo FINO A OGGI: continuare la linea piatta fino al 31 mostrerebbe
  // un mese fermo invece di un mese non ancora arrivato.
  const finoAOggi = oggi ? serie.slice(0, oggi) : serie;

  const wrap = useRef<HTMLDivElement>(null);
  const [su, setSu] = useState<number | null>(null);

  function muovi(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frazione = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * W - padX) / (W - 2 * padX)));
    setSu(Math.round(frazione * (giorni - 1)));
  }

  return (
    <>
      <div ref={wrap} style={{ position: 'relative', height: H }} onMouseMove={muovi} onMouseLeave={() => setSu(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <polyline
            points={punti(precedente)}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
          <polygon
            points={`${x(0).toFixed(1)},${(H - padY).toFixed(1)} ${punti(finoAOggi)} ${x(finoAOggi.length - 1).toFixed(1)},${(H - padY).toFixed(1)}`}
            fill="var(--gold)"
            opacity={0.13}
          />
          <polyline
            points={punti(finoAOggi)}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={2.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {su != null && (
          <>
            <div style={{ position: 'absolute', left: `${(x(su) / W) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)', pointerEvents: 'none' }} />
            <div
              style={{
                position: 'absolute', left: `${Math.min(84, Math.max(16, (x(su) / W) * 100))}%`, top: -2,
                transform: 'translate(-50%,-100%)', background: 'var(--ink)', color: 'var(--card)',
                fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.18)', lineHeight: 1.5,
              }}
            >
              giorno {su + 1}
              <br />
              {etichetta}: {oggi && su + 1 > oggi ? '—' : formato(serie[su] ?? 0)}
              <br />
              {etichettaPrecedente}: {formato(precedente[su] ?? precedente[precedente.length - 1] ?? 0)}
            </div>
          </>
        )}
      </div>

      {/* Asse: 1, 5, 10, … e l'ultimo giorno. Tutti i numeri non ci starebbero. */}
      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        {Array.from({ length: giorni }, (_, i) => i).filter((i) => i === 0 || i === giorni - 1 || (i + 1) % 5 === 0).map((i) => (
          <span
            key={i}
            className="muted"
            style={{
              position: 'absolute', left: `${(x(i) / W) * 100}%`,
              transform: i === 0 ? 'none' : i === giorni - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: 10,
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </>
  );
}

/** Nuove clienti al giorno: barre, non una linea. Sono conteggi, e fra un giorno e l'altro non c'è
 *  niente da interpolare — una linea suggerirebbe mezze clienti. */
function Barre({
  valori, oggi, totale, totalePrecedente, etichettaPrecedente,
}: {
  valori: number[];
  oggi: number | null;
  totale: number;
  totalePrecedente: number;
  etichettaPrecedente: string;
}) {
  const max = Math.max(1, ...valori);
  return (
    <>
      <div className="row" style={{ gap: 14, alignItems: 'baseline', marginBottom: 6 }}>
        <b style={{ fontSize: 18 }}>{totale}</b>
        <span className="muted" style={{ fontSize: 12 }}>
          contro {totalePrecedente} in <span style={{ textTransform: 'capitalize' }}>{etichettaPrecedente}</span> allo stesso giorno
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 54 }}>
        {valori.map((v, i) => {
          const futuro = oggi != null && i + 1 > oggi;
          return (
            <div
              key={i}
              title={`giorno ${i + 1}: ${futuro ? 'non ancora' : `${v} ${v === 1 ? 'cliente' : 'clienti'}`}`}
              style={{
                flex: 1,
                height: `${Math.max(v > 0 ? 8 : 2, (v / max) * 100)}%`,
                borderRadius: 3,
                background: futuro ? 'var(--line)' : v > 0 ? 'var(--violet)' : 'var(--chip)',
                opacity: futuro ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
