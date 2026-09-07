import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Spinner } from './ui';

/**
 * FATTURATO COACH e PROVVIGIONI MATURATE — **una barra verticale per coach**, mese per mese.
 *
 * Richiesta di Simone del 7/9: «due grafici nuovi visibili ad admin, Responsabile Coach e
 * Coordinatrice Coach, sempre con la regola della visibilità che si può vedere chi è collegato
 * sotto di me» · «scegli dal menu a tendina il mese e mi fai vedere una barra verticale per ogni
 * coach».
 *
 * ## Perché due tendine e non una
 *
 * Le classifiche per perdita, qui sopra, hanno **una** tendina per due elenchi, e per una buona
 * ragione scritta lì: sono la stessa domanda letta dai due capi, e con due tendine si finisce a
 * confrontare agosto con luglio senza accorgersene. Qui no: fatturato e provvigioni sono due
 * grandezze diverse, e la domanda «il mese scorso ho fatturato come questo?» si fa su un grafico
 * solo. Ogni card porta il mese scritto nel proprio titolo, quindi nessuno dei due può essere letto
 * per sbaglio come se fosse dell'altro mese.
 *
 * ## Le scelte di disegno, e perché
 *
 * - **Una tinta per grafico, non una per coach.** C'è una serie sola in ogni card: colorare le
 *   barre una per una vorrebbe dire dare un significato a un colore che significato non ha, e al
 *   nono nome finirebbero i colori. Il nome sta sotto la barra, che è dove si legge.
 * - **Le barre a zero ci sono.** Una coach che non ha fatturato in quel mese ha una barra piatta
 *   con il suo nome sotto: «zero» e «non lo so» sono due risposte diverse, e chi guarda una
 *   squadra ha bisogno della prima.
 * - **Sotto lo zero si scende davvero.** Uno storno rende la provvigione del mese negativa: la
 *   barra va sotto la linea dello zero e cambia colore. Appiattirla a zero nasconderebbe l'unico
 *   mese in cui c'è qualcosa da capire.
 * - **Il numero sopra la barra solo quando ci sta** (fino a otto coach); oltre, il valore si legge
 *   passandoci sopra. Un numero su ogni barra, con venti barre, è una riga di cifre sovrapposte.
 */

export interface BarraCoach {
  staffId: string;
  nome: string;
  fatturatoCents: number;
  provvigioniCents: number;
}

interface RispostaBarre {
  /** Il mese da mostrare all'apertura: quello in corso, nel fuso dell'azienda. */
  mesePredefinito: string;
  /** Dal più recente. */
  periodi: { chiave: string; etichetta: string }[];
  perPeriodo: Record<string, BarraCoach[]>;
}

const euro = (c: number) => (c < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(c / 100)).toLocaleString('it-IT');

/** Altezza dell'area di disegno, zero compreso. */
const H = 180;

function Colonne({
  barre, colore, formato,
}: {
  barre: { nome: string; valoreCents: number }[];
  colore: string;
  formato: (c: number) => string;
}) {
  const [sopra, setSopra] = useState<number | null>(null);
  const valori = barre.map((b) => b.valoreCents);
  const massimo = Math.max(0, ...valori);
  const minimo = Math.min(0, ...valori);
  const scala = massimo - minimo || 1;
  // Dove cade lo zero, contato dall'alto: senza valori negativi è il fondo.
  const zeroDaSopra = (massimo / scala) * H;
  const etichetteDirette = barre.length <= 8;

  if (barre.length === 0) {
    return <div className="empty">Nessuna coach nella tua rete.</div>;
  }

  return (
    <div style={{ overflowX: 'auto', paddingTop: 18 }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', minWidth: Math.max(0, barre.length * 46) }}>
        {barre.map((b, i) => {
          const v = b.valoreCents;
          const altezza = Math.max(v === 0 ? 2 : 3, (Math.abs(v) / scala) * H);
          const negativo = v < 0;
          return (
            <div
              key={b.nome + i}
              style={{ flex: '1 0 44px', minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              onMouseEnter={() => setSopra(i)}
              onMouseLeave={() => setSopra((s) => (s === i ? null : s))}
            >
              <div style={{ position: 'relative', width: '100%', height: H }}>
                {/* La linea dello zero: recessiva, ma c'è — senza, una barra negativa sembra corta. */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: zeroDaSopra, height: 1, background: 'var(--line)' }} />
                <div
                  style={{
                    position: 'absolute',
                    left: '18%', right: '18%',
                    top: negativo ? zeroDaSopra : zeroDaSopra - altezza,
                    height: altezza,
                    background: v === 0 ? 'var(--line)' : negativo ? 'var(--danger)' : colore,
                    borderRadius: negativo ? '0 0 4px 4px' : '4px 4px 0 0',
                    opacity: sopra == null || sopra === i ? 1 : 0.45,
                    transition: 'opacity .12s',
                  }}
                />
                {etichetteDirette && (
                  <div
                    style={{
                      position: 'absolute', left: 0, right: 0,
                      top: negativo ? zeroDaSopra + altezza + 2 : zeroDaSopra - altezza - 16,
                      textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formato(v)}
                  </div>
                )}
                {!etichetteDirette && sopra === i && (
                  <div
                    style={{
                      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                      top: negativo ? zeroDaSopra + altezza + 2 : Math.max(-16, zeroDaSopra - altezza - 18),
                      background: 'var(--ink)', color: 'var(--card)', borderRadius: 6,
                      padding: '2px 6px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 2,
                    }}
                  >
                    {b.nome}: {formato(v)}
                  </div>
                )}
              </div>
              <div
                className="muted"
                title={b.nome}
                style={{
                  fontSize: 11, marginTop: 6, width: '100%', textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: sopra === i ? 'var(--ink)' : undefined,
                }}
              >
                {b.nome}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  titolo, spiegazione, periodi, mese, cambiaMese, barre, colore,
}: {
  titolo: string;
  spiegazione: string;
  periodi: { chiave: string; etichetta: string }[];
  mese: string;
  cambiaMese: (m: string) => void;
  barre: { nome: string; valoreCents: number }[];
  colore: string;
}) {
  const totale = barre.reduce((a, b) => a + b.valoreCents, 0);
  const ordinate = [...barre].sort((a, b) => b.valoreCents - a.valoreCents);
  const etichetta = periodi.find((p) => p.chiave === mese)?.etichetta ?? mese;

  return (
    <div className="card">
      <div className="spread" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{titolo} · {etichetta}</h2>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>Totale: <b>{euro(totale)}</b></span>
          <select className="select" style={{ width: 'auto' }} value={mese} onChange={(e) => cambiaMese(e.target.value)}>
            {periodi.map((p) => <option key={p.chiave} value={p.chiave}>{p.etichetta}</option>)}
          </select>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{spiegazione}</p>
      <Colonne barre={ordinate} colore={colore} formato={euro} />
    </div>
  );
}

export function GraficiCoach() {
  const [dati, setDati] = useState<RispostaBarre | null>(null);
  const [carico, setCarico] = useState(true);
  /**
   * ⚠️ Un 403 qui **non è un errore da mostrare**: questa sezione è di tre ruoli, e la pagina
   * Grafici ne serve sei. A chi non le compete la sezione semplicemente non c'è — un riquadro rosso
   * su una pagina che funziona insegna a ignorare i riquadri rossi.
   */
  const [fuori, setFuori] = useState(false);
  const [meseFatturato, setMeseFatturato] = useState<string | null>(null);
  const [meseProvvigioni, setMeseProvvigioni] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<RispostaBarre>('/admin/charts/coach')
      .then((r) => {
        if (!vivo) return;
        setDati(r);
        setMeseFatturato(r.mesePredefinito);
        setMeseProvvigioni(r.mesePredefinito);
      })
      .catch((e) => { if (vivo && e instanceof ApiError && e.status === 403) setFuori(true); })
      .finally(() => { if (vivo) setCarico(false); });
    return () => { vivo = false; };
  }, []);

  if (fuori) return null;
  if (carico) return <Spinner />;
  if (!dati || dati.periodi.length === 0) return null;

  const scegli = (mese: string | null) => dati.perPeriodo[mese ?? dati.mesePredefinito] ?? [];
  const fatturato = scegli(meseFatturato).map((b) => ({ nome: b.nome, valoreCents: b.fatturatoCents }));
  const provvigioni = scegli(meseProvvigioni).map((b) => ({ nome: b.nome, valoreCents: b.provvigioniCents }));

  return (
    <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
      <Card
        titolo="Fatturato coach"
        spiegazione="Gli incassi approvati delle clienti assegnate a ciascuna coach, nel mese scelto. Il fatturato di una coach non compare anche nella barra della sua coordinatrice: la somma delle barre è il fatturato della rete, contato una volta sola."
        periodi={dati.periodi}
        mese={meseFatturato ?? dati.mesePredefinito}
        cambiaMese={setMeseFatturato}
        barre={fatturato}
        colore="var(--gold)"
      />
      <Card
        titolo="Provvigioni maturate"
        spiegazione="Quanto ciascuna ha maturato nel mese, letto dal registro contabile: è lo stesso numero che lei vede nel proprio portafoglio alla voce «in maturazione». Uno storno la fa scendere sotto lo zero."
        periodi={dati.periodi}
        mese={meseProvvigioni ?? dati.mesePredefinito}
        cambiaMese={setMeseProvvigioni}
        barre={provvigioni}
        colore="var(--teal)"
      />
    </div>
  );
}
