import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';

/**
 * Report di percorso (handoff punto 4 + modello grafico del socio,
 * `marketing/report_cliente/MetaboleAI_Report_Cliente.pdf`): il tuo punto A → punto B.
 * Stesso impianto per il report MENSILE (piani lunghi) e per quello di FINE PIANO
 * (prova inclusa). Consegna IN APP: dati sanitari, mai via email/WhatsApp.
 * Sezioni: numeri A→B · traiettoria verso l'obiettivo · cosa ha imparato Gaia ·
 * dove hai perso i centimetri · tre mosse · coach reale · offerta col codice.
 */

interface ReportHead { id: string; kind: string; planName: string; periodStart: string; periodEnd: string; read: boolean; createdAt: string }
interface MeasurePoint { date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }
interface ReportFull {
  id: string; kind: string; planName: string; periodStart: string; periodEnd: string; days: number; clientName: string;
  measures: { start: MeasurePoint | null; end: MeasurePoint | null; deltaWeightKg: number | null; deltaWaistCm: number | null; deltaHipsCm: number | null };
  adherence: { days: number; checkins: number; pct: number | null; ratings: number };
  objective: { targetWeightKg: number | null; toGoKg: number | null };
  gaia: string[];
  coach: { name: string; phone: string | null } | null;
  offer: { planId: string; planName: string; priceCents: number; listPriceCents: number | null; promoActive: boolean; promoEndsAt: string | null; period: string; code: string | null; codeExpiresAt?: string | null; codePriceCents?: number | null } | null;
}

const euro = (c: number) => `€ ${Math.round(c / 100)}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const kg1 = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function StatCard({ delta, unit, label, from, to }: { delta: number | null; unit: string; label: string; from?: number | null; to?: number | null }) {
  const good = delta != null && delta < 0;
  return (
    <div className="card" style={{ margin: 0, padding: '12px 10px', textAlign: 'center', background: good ? '#EAF6F1' : '#F7FAF9', boxShadow: 'none' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: good ? '#0E7C66' : '#3D4C48' }}>
        {delta == null ? '—' : `${sign(delta)}${unit}`}
      </div>
      <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{label}</div>
      {from != null && to != null && (
        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{from} → {to}</div>
      )}
    </div>
  );
}

/**
 * La traiettoria verso l'obiettivo (come nel modello): tratto pieno = periodo
 * appena fatto (A→B), tratteggio = stima verso l'obiettivo mantenendo il ritmo.
 */
function Trajectory({ a, b, target }: { a: MeasurePoint; b: MeasurePoint; target: number | null }) {
  const showProj = target != null && target < b.weightKg && b.weightKg <= a.weightKg;
  const weights = [a.weightKg, b.weightKg, ...(showProj && target != null ? [target] : [])];
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  const span = Math.max(0.5, max - min);
  const y = (w: number) => 18 + ((max - w) / span) * 84; // 18..102
  const xA = 26; const xB = showProj ? 96 : 240; const xT = 286;
  return (
    <svg viewBox="0 0 320 132" style={{ width: '100%', display: 'block' }}>
      {/* griglia leggera */}
      {[18, 60, 102].map((gy) => <line key={gy} x1={14} x2={306} y1={gy} y2={gy} stroke="#EEF1F0" strokeWidth={1} />)}
      {/* linea obiettivo */}
      {showProj && target != null && (
        <line x1={14} x2={306} y1={y(target)} y2={y(target)} stroke="#E8825A" strokeWidth={1.5} strokeDasharray="2 4" opacity={0.6} />
      )}
      {/* tratto fatto */}
      <line x1={xA} y1={y(a.weightKg)} x2={xB} y2={y(b.weightKg)} stroke="#0E7C66" strokeWidth={3} strokeLinecap="round" />
      {/* stima */}
      {showProj && target != null && (
        <line x1={xB} y1={y(b.weightKg)} x2={xT} y2={y(target)} stroke="#0E7C66" strokeWidth={2} strokeDasharray="6 5" opacity={0.65} />
      )}
      <circle cx={xA} cy={y(a.weightKg)} r={4.5} fill="#0E7C66" />
      <circle cx={xB} cy={y(b.weightKg)} r={4.5} fill="#0E7C66" />
      {showProj && target != null && <circle cx={xT} cy={y(target)} r={4.5} fill="#E8825A" />}
      <text x={xA} y={y(a.weightKg) - 9} fontSize={11} fontWeight={700} fill="#3D4C48" textAnchor="start">{kg1(a.weightKg)}</text>
      <text x={xB + 6} y={y(b.weightKg) + 4} fontSize={11} fontWeight={700} fill="#0E7C66" textAnchor="start">{kg1(b.weightKg)} kg · oggi</text>
      {showProj && target != null && (
        <text x={xT} y={y(target) - 9} fontSize={11} fontWeight={700} fill="#E8825A" textAnchor="end">{kg1(target)} kg</text>
      )}
    </svg>
  );
}

export default function Report() {
  const nav = useNavigate();
  const { id } = useParams();
  const [list, setList] = useState<ReportHead[] | null>(null);
  const [report, setReport] = useState<ReportFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ReportHead[]>('/me/reports').then((rs) => {
      setList(rs ?? []);
      const target = id ?? rs?.[0]?.id;
      if (target) {
        api<ReportFull>(`/me/reports/${target}`).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
      } else setLoading(false);
    }).catch(() => { setList([]); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const r = report;
  const m = r?.measures;
  const kindTag = r?.kind === 'trial' ? 'Settimana gratuita' : r?.kind === 'monthly' ? 'Report del mese' : 'Fine piano';
  const firstName = (r?.clientName ?? '').split(' ')[0] || null;
  const headline = r?.kind === 'monthly'
    ? `${firstName ? firstName + ', ' : ''}un altro mese di strada fatta.`
    : `${firstName ? firstName + ', ' : ''}in ${r?.days ?? 0} giorni hai già messo in moto il cambiamento.`;
  const cmRows = [
    { label: 'Fianchi', delta: m?.deltaHipsCm ?? null, from: m?.start?.hipsCm, to: m?.end?.hipsCm },
    { label: 'Vita', delta: m?.deltaWaistCm ?? null, from: m?.start?.waistCm, to: m?.end?.waistCm },
  ].filter((x) => x.delta != null && x.delta < 0) as { label: string; delta: number; from: number; to: number }[];
  const cmTotal = cmRows.reduce((a, x) => a + Math.abs(x.delta), 0);
  const cmMax = Math.max(1, ...cmRows.map((x) => Math.abs(x.delta)));

  return (
    <div className="home">
      <AppHeader title="Il tuo report" />

      {loading ? (
        <div className="card" style={{ textAlign: 'center' }}><span className="muted">Carico il report…</span></div>
      ) : !r ? (
        <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
          <i className="ti ti-report" style={{ fontSize: 22, color: 'var(--teal)' }} />
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Il tuo report comparirà qui: lo prepariamo in automatico a ogni mese di percorso e a ogni fine piano.
          </div>
        </div>
      ) : (
        <>
          {/* Intestazione: punto A → punto B (come il modello) */}
          <div style={{ margin: '2px 2px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', color: 'var(--teal)' }}>IL TUO PUNTO A → PUNTO B</div>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.22, marginTop: 4 }}>{headline}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {kindTag} · {r.planName} · {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)} · {r.days} giorni
            </div>
          </div>

          {/* Numeri A→B */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <StatCard delta={m?.deltaWeightKg ?? null} unit=" kg" label="Peso" from={m?.start?.weightKg} to={m?.end?.weightKg} />
            <StatCard delta={m?.deltaWaistCm ?? null} unit=" cm" label="Vita" from={m?.start?.waistCm} to={m?.end?.waistCm} />
            <StatCard delta={m?.deltaHipsCm ?? null} unit=" cm" label="Fianchi" from={m?.start?.hipsCm} to={m?.end?.hipsCm} />
            <div className="card" style={{ margin: 0, padding: '12px 10px', textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>{r.adherence.pct != null ? `${r.adherence.pct}%` : '—'}</div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>Aderenza</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{r.adherence.checkins}/{r.adherence.days} check-in</div>
            </div>
          </div>

          {/* La traiettoria verso l'obiettivo */}
          {m?.start && m?.end && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>La tua traiettoria verso l'obiettivo</div>
              <div className="muted" style={{ fontSize: 11.5, margin: '3px 0 6px', lineHeight: 1.45 }}>
                La parte piena è il periodo appena fatto. Quella tratteggiata è la stima di dove puoi arrivare mantenendo questo ritmo.
              </div>
              <Trajectory a={m.start} b={m.end} target={r.objective.targetWeightKg} />
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 14, height: 3, background: '#0E7C66', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />Fatto</span>
                {r.objective.targetWeightKg != null && (
                  <>
                    <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed #0E7C66', verticalAlign: 'middle', marginRight: 4 }} />Stima col percorso completo</span>
                    <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 8, height: 8, background: '#E8825A', borderRadius: 4, verticalAlign: 'middle', marginRight: 4 }} />Il tuo obiettivo</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Obiettivo */}
          {r.objective.targetWeightKg != null && (
            <div className="card" style={{ background: 'var(--teal)', color: '#fff', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', opacity: 0.85 }}>IL TUO OBIETTIVO</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>
                {r.objective.targetWeightKg} kg
                {r.objective.toGoKg != null && r.objective.toGoKg > 0 ? ` · mancano ${r.objective.toGoKg} kg da oggi` : r.objective.toGoKg != null ? ' · raggiunto 🎉' : ''}
              </div>
            </div>
          )}

          {/* Cosa ha imparato Gaia (il cuore del modello) */}
          <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none', marginBottom: 12 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: '#0E7C66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>G</span>
              <b style={{ fontSize: 14 }}>Cosa ha imparato Gaia su di te</b>
            </div>
            {r.gaia.map((g, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
                <i className="ti ti-check" style={{ color: '#0E7C66', fontSize: 15, marginTop: 2, flex: 'none' }} />
                <span style={{ fontSize: 13, lineHeight: 1.45 }}>{g}</span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Questo profilo è ciò che rende i tuoi menu davvero tuoi: continuando, Gaia lo affina a ogni ciclo.
            </div>
          </div>

          {/* Dove hai perso i centimetri */}
          {cmRows.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Dove hai perso i centimetri</div>
              <div className="muted" style={{ fontSize: 11.5, margin: '3px 0 10px', lineHeight: 1.45 }}>
                Anche quando la bilancia si muove poco, il corpo cambia forma.
              </div>
              {cmRows.map((row) => (
                <div key={row.label} className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, width: 54, flex: 'none' }}>{row.label}</span>
                  <div style={{ flex: 1, height: 10, background: '#F0F4F2', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((Math.abs(row.delta) / cmMax) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#0E7C66,#25A67F)', borderRadius: 5 }} />
                  </div>
                  <span className="muted" style={{ fontSize: 11, flex: 'none' }}>{row.from} → {row.to}</span>
                  <span className="chip" style={{ background: '#EAF6F1', color: '#0E7C66', fontSize: 11, fontWeight: 700, flex: 'none' }}>−{kg1(Math.abs(row.delta))} cm</span>
                </div>
              ))}
              {cmRows.length > 1 && (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  Totale tra vita e fianchi: <b style={{ color: '#0E7C66' }}>−{kg1(cmTotal)} cm</b> in {r.days} giorni.
                </div>
              )}
            </div>
          )}

          {/* Cosa fare adesso — tre mosse (come il modello) */}
          <div className="sec" style={{ margin: '0 2px 8px' }}>Cosa fare adesso</div>
          <div className="card" style={{ marginBottom: 12 }}>
            {[
              r.kind === 'monthly'
                ? { t: 'Continua così: la costanza sta lavorando per te.', d: r.adherence.pct != null ? `Hai chiuso il mese al ${r.adherence.pct}% di aderenza: il corpo si adatta proprio grazie a questo ritmo.` : 'Ogni check-in aiuta Gaia ad adattare il percorso a te.' }
                : { t: 'Non fermarti ora: la parte più difficile è alle spalle.', d: r.adherence.pct != null ? `Hai chiuso al ${r.adherence.pct}% di aderenza. Interrompere adesso significa ripartire da zero.` : 'Il corpo ha appena iniziato ad adattarsi: interrompere adesso significa ripartire da zero.' },
              r.offer
                ? { t: r.kind === 'monthly' ? `Tieni d'occhio il traguardo del tuo ${r.planName}.` : `Attiva il ${r.offer.planName}: è lì che si vedono i risultati veri.`, d: r.kind === 'monthly' ? 'A fine piano troverai qui il report completo con la proposta per il passo successivo.' : 'Gaia affina la dieta sui tuoi risultati reali e il cambiamento si consolida.' }
                : { t: 'Prosegui il percorso.', d: 'Gaia affina la dieta sui tuoi risultati reali e il cambiamento si consolida.' },
              { t: `Appòggiati a ${r.coach?.name ?? 'la tua coach'} nei momenti critici.`, d: 'Weekend, cene, viaggi: un messaggio prima di una cena fuori vale più di dieci buoni propositi.' },
            ].map((mv, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: i < 2 ? '1px solid #F0F2F1' : undefined }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, background: '#0E7C66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none', marginTop: 1 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{mv.t}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{mv.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pannello onesto (solo prova): il profilo si cancella davvero a +7 giorni. */}
          {r.kind === 'trial' && (
            <div className="card" style={{ background: '#FFF7F0', border: '1px solid #F3D9C4', boxShadow: 'none', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <i className="ti ti-clock-exclamation" style={{ color: '#B4491F', fontSize: 18, marginTop: 1, flex: 'none' }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <b>Una cosa detta con onestà:</b> se non continui, ciò che Gaia ha imparato su di te
                  viene <b>cancellato davvero 7 giorni dopo la fine della prova</b> (è una promessa di privacy,
                  non una minaccia). Le tue misure e i tuoi documenti restano al sicuro.
                </div>
              </div>
            </div>
          )}

          {/* Coach */}
          {r.coach && (
            <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 21, background: '#EAF6F1', color: '#0E7C66', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flex: 'none' }}>
                {r.coach.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.coach.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>La tua coach dedicata</div>
              </div>
              {r.coach.phone && (
                <a className="chip" href={`https://wa.me/${r.coach.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                  style={{ background: '#EAF6F1', color: '#0E7C66', border: 'none', padding: '8px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  <i className="ti ti-brand-whatsapp" style={{ fontSize: 14 }} /> Scrivile
                </a>
              )}
            </div>
          )}

          {/* Offerta per continuare (non nei report mensili: il piano è già in corso) */}
          {r.offer && r.kind !== 'monthly' && (
            <div className="card" style={{ border: '2px solid #E8825A', marginBottom: 12 }}>
              {(r.offer.promoActive || r.offer.codePriceCents != null) && (
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: '#E8825A' }}>OFFERTA RISERVATA · IN SCADENZA</div>
              )}
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{r.offer.planName}</div>
              <div style={{ marginTop: 4 }}>
                {/* Col codice personale (Opzione B): prezzo target grande, pieno barrato. */}
                <span style={{ fontSize: 24, fontWeight: 800, color: '#0E7C66' }}>{euro(r.offer.codePriceCents ?? r.offer.priceCents)}</span>
                {r.offer.codePriceCents != null ? (
                  <span className="muted" style={{ fontSize: 15, textDecoration: 'line-through', marginLeft: 8 }}>{euro(r.offer.priceCents)}</span>
                ) : r.offer.listPriceCents != null && (
                  <span className="muted" style={{ fontSize: 15, textDecoration: 'line-through', marginLeft: 8 }}>{euro(r.offer.listPriceCents)}</span>
                )}
                {r.offer.codePriceCents != null && (
                  <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>col tuo codice</span>
                )}
              </div>
              {r.offer.code && (
                <div style={{ border: '1.5px dashed #E8825A', borderRadius: 10, textAlign: 'center', padding: '8px 10px', marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px' }}>CODICE RISERVATO A TE</div>
                  <div style={{ fontWeight: 800, letterSpacing: '2px', color: '#E8825A', fontSize: 16 }}>{r.offer.code}</div>
                  {r.offer.codeExpiresAt && (
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                      valido fino al {new Date(r.offer.codeExpiresAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
              <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => nav('/negozio')}>
                Continua il percorso →
              </button>
            </div>
          )}

          {/* Altri report */}
          {list && list.length > 1 && (
            <>
              <div className="sec" style={{ margin: '0 2px 8px' }}>I tuoi report</div>
              <div className="card" style={{ padding: '4px 14px' }}>
                {list.map((h) => (
                  <div key={h.id} onClick={() => nav(`/report/${h.id}`)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', cursor: 'pointer', borderBottom: '1px solid #F0F2F1', fontWeight: h.id === r.id ? 700 : 400 }}>
                    <span style={{ fontSize: 13 }}>
                      {h.kind === 'monthly' ? 'Report del mese' : h.kind === 'trial' ? 'Prova gratuita' : h.planName || 'Fine piano'}
                      <span className="muted" style={{ fontWeight: 400 }}> · {h.planName}</span>
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDate(h.periodEnd)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="muted" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '8px 2px 0' }}>
            Il calo della prima settimana può includere una quota di liquidi ed è fisiologicamente normale. I risultati variano da persona a persona.
            Questo report non sostituisce un parere medico: per patologie è disponibile la visita con il nutrizionista in app.
          </p>
        </>
      )}
    </div>
  );
}
