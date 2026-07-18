import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../cart/CartContext';
import AppHeader from '../components/AppHeader';

/**
 * Diario del percorso (modello del socio, `marketing/report_cliente/
 * MetaboleAI_Diario_Percorso.pdf`, lug 2026): il mese con Gaia + il piano d'azione.
 * Stesso impianto per il report MENSILE e per quello di FINE PIANO (prova inclusa).
 * Consegna IN APP: dati sanitari, mai via email/WhatsApp.
 * Sezioni: diario del percorso (timeline) · numeri del mese · Gaia consiglia
 * (aderenza/acqua/passi) · tappe verso l'obiettivo · tre mosse · coach reale ·
 * le tre strade (Rinnovo / Mantenimento €29 / Monitoraggio gratis).
 */

interface ReportHead { id: string; kind: string; planName: string; periodStart: string; periodEnd: string; read: boolean; createdAt: string }
interface MeasurePoint { date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }
interface JourneyStep { label: string; from: string; to: string; deltaKg: number | null; endWeightKg: number | null; events: string[]; prefsLearned: number }
interface ReportFull {
  id: string; kind: string; planName: string; periodStart: string; periodEnd: string; days: number; clientName: string;
  measures: { start: MeasurePoint | null; end: MeasurePoint | null; deltaWeightKg: number | null; deltaWaistCm: number | null; deltaHipsCm: number | null };
  adherence: { days: number; checkins: number; pct: number | null; ratings: number };
  objective: { targetWeightKg: number | null; toGoKg: number | null };
  gaia: string[];
  coach: { name: string; phone: string | null } | null;
  offer: { planId: string; planName: string; priceCents: number; listPriceCents: number | null; promoActive: boolean; promoEndsAt: string | null; period: string; code: string | null; codeExpiresAt?: string | null; codePriceCents?: number | null } | null;
  // Diario del percorso (i report vecchi non hanno questi campi)
  journey?: JourneyStep[];
  habits?: { waterAvgL: number | null; waterGoalL: number | null; stepsAvg: number | null; stepsGoal: number };
  milestones?: { label: string; date: string; weightKg: number }[];
  etaLabel?: string | null;
  maintenance?: { planId: string; planName: string; priceCents: number } | null;
  monitoring?: { rientroPriceCents: number } | null;
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

/**
 * "I tuoi passi verso l'obiettivo" (pagina 2 del modello): tutte le tappe del
 * percorso (inizio → 8 giorni → mesi → oggi) più la proiezione all'obiettivo.
 */
function Milestones({ points, target }: { points: { label: string; weightKg: number }[]; target: number | null }) {
  const last = points[points.length - 1];
  const showProj = target != null && last && target < last.weightKg;
  const weights = [...points.map((p) => p.weightKg), ...(showProj && target != null ? [target] : [])];
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  const span = Math.max(0.5, max - min);
  const y = (w: number) => 22 + ((max - w) / span) * 78; // 22..100
  const x0 = 22; const x1 = showProj ? 250 : 298; const xT = 298;
  const x = (i: number) => (points.length > 1 ? x0 + (i * (x1 - x0)) / (points.length - 1) : x0);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.weightKg)}`).join(' ');
  return (
    <svg viewBox="0 0 320 138" style={{ width: '100%', display: 'block' }}>
      {[22, 61, 100].map((gy) => <line key={gy} x1={12} x2={308} y1={gy} y2={gy} stroke="#EEF1F0" strokeWidth={1} />)}
      {showProj && target != null && (
        <line x1={12} x2={308} y1={y(target)} y2={y(target)} stroke="#E8825A" strokeWidth={1.5} strokeDasharray="2 4" opacity={0.6} />
      )}
      <path d={path} fill="none" stroke="#0E7C66" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {showProj && target != null && (
        <path d={`M${x(points.length - 1)},${y(last.weightKg)} C ${x(points.length - 1) + 20},${y(last.weightKg) + 12} ${xT - 20},${y(target) - 8} ${xT},${y(target)}`}
          fill="none" stroke="#25A67F" strokeWidth={2} strokeDasharray="6 5" opacity={0.75} />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.weightKg)} r={i === points.length - 1 ? 5 : 3.8} fill="#0E7C66" stroke={i === points.length - 1 ? '#fff' : 'none'} strokeWidth={1.5} />
          {(i === 0 || i === points.length - 1 || points.length <= 5) && (
            <text x={x(i)} y={y(p.weightKg) - 8} fontSize={10} fontWeight={700} fill={i === points.length - 1 ? '#0E7C66' : '#3D4C48'} textAnchor="middle">
              {kg1(p.weightKg)}{i === points.length - 1 ? ' · oggi' : ''}
            </text>
          )}
          <text x={x(i)} y={126} fontSize={8.5} fill="#93A29A" textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {showProj && target != null && (
        <g>
          <circle cx={xT} cy={y(target)} r={5} fill="#E8825A" stroke="#fff" strokeWidth={1.5} />
          <text x={xT} y={y(target) - 8} fontSize={10} fontWeight={700} fill="#E8825A" textAnchor="middle">{kg1(target)}</text>
          <text x={xT} y={126} fontSize={8.5} fill="#93A29A" textAnchor="middle">obiettivo</text>
        </g>
      )}
    </svg>
  );
}

export default function Report() {
  const nav = useNavigate();
  const cart = useCart();
  const { id } = useParams();
  const [list, setList] = useState<ReportHead[] | null>(null);
  const [report, setReport] = useState<ReportFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [monMsg, setMonMsg] = useState<string | null>(null);

  /** Terza strada del modello: attiva il Monitoraggio gratuito. */
  async function startMonitoring() {
    setMonMsg(null);
    try {
      await api('/me/monitoring/start', { method: 'POST' });
      nav('/percorso');
    } catch (e) {
      setMonMsg(e instanceof Error ? e.message : 'Attivazione non riuscita.');
    }
  }

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
  const kindTag = r?.kind === 'trial' ? 'Settimana gratuita' : r?.kind === 'monthly' ? 'Diario del mese' : 'Fine percorso';
  const firstName = (r?.clientName ?? '').split(' ')[0] || null;
  const headline = r?.kind === 'monthly'
    ? `${firstName ? firstName + ', ' : ''}un altro mese, un altro passo verso l'obiettivo.`
    : `${firstName ? firstName + ', ' : ''}in ${r?.days ?? 0} giorni hai già messo in moto il cambiamento.`;
  // Delta totale dall'inizio del percorso (prima tappa → oggi), per la card "Dall'inizio".
  const mi = r?.milestones ?? [];
  const totalDelta = mi.length >= 2 ? Math.round((mi[mi.length - 1].weightKg - mi[0].weightKg) * 10) / 10 : null;
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
          {/* Intestazione: il tuo mese con Gaia (modello Diario del Percorso) */}
          <div style={{ margin: '2px 2px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', color: 'var(--teal)' }}>
              {r.kind === 'monthly' ? 'IL TUO MESE CON GAIA' : 'IL TUO DIARIO DEL PERCORSO'}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.22, marginTop: 4 }}>{headline}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {kindTag} · {r.planName} · {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)} · {r.days} giorni
            </div>
          </div>

          {/* Il tuo percorso con Gaia — timeline (8 giorni + mesi, con eventi gestiti) */}
          {(r.journey?.length ?? 0) > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, background: '#0E7C66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>G</span>
                <b style={{ fontSize: 14 }}>Il tuo percorso con Gaia</b>
              </div>
              {r.journey!.map((j, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, position: 'relative', paddingBottom: i < r.journey!.length - 1 ? 12 : 0 }}>
                  {i < r.journey!.length - 1 && (
                    <span style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: '#EEF1F0' }} />
                  )}
                  <span style={{ width: 28, height: 28, borderRadius: 14, background: j.label === '8 giorni' ? '#B8863B' : '#0E7C66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 9.5, flex: 'none', zIndex: 1 }}>
                    {j.label === '8 giorni' ? '8g' : `M${j.label.replace('Mese ', '')}`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {j.label === '8 giorni' ? '8 giorni gratuiti — ti ha conosciuta' : `${j.label} — ha affinato`}
                      {j.deltaKg != null && j.deltaKg < 0 && (
                        <span className="chip" style={{ background: '#EAF6F1', color: '#0E7C66', fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}>{kg1(j.deltaKg)} kg</span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 1, lineHeight: 1.4 }}>
                      {j.prefsLearned > 0 ? `${j.prefsLearned} piatti valutati: gusti sempre più tuoi` : 'Menu adattati sui tuoi risultati'}
                      {j.endWeightKg != null && ` · a fine tratto ${kg1(j.endWeightKg)} kg`}
                    </div>
                    {j.events.length > 0 && (
                      <div style={{ fontSize: 11, color: '#0E7C66', background: '#EAF6F1', borderRadius: 8, padding: '3px 8px', marginTop: 4, display: 'inline-block' }}>
                        Gestito: {j.events.join(' · ')} → il piano si è riadattato da solo
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* I numeri del mese: peso, vita e totale dall'inizio (come le stat del modello) */}
          <div style={{ display: 'grid', gridTemplateColumns: totalDelta != null ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <StatCard delta={m?.deltaWeightKg ?? null} unit=" kg" label="Peso" from={m?.start?.weightKg} to={m?.end?.weightKg} />
            <StatCard delta={m?.deltaWaistCm ?? null} unit=" cm" label="Vita" from={m?.start?.waistCm} to={m?.end?.waistCm} />
            {totalDelta != null && (
              <StatCard delta={totalDelta} unit=" kg" label="Dall'inizio" from={mi[0]?.weightKg} to={mi[mi.length - 1]?.weightKg} />
            )}
          </div>

          {/* Gaia consiglia: aderenza, acqua, passi (sezione del modello aggiornato) */}
          {(r.adherence.pct != null || r.habits) && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, background: '#0E7C66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>G</span>
                <b style={{ fontSize: 14 }}>Gaia consiglia</b>
              </div>
              {r.adherence.pct != null && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '5px 0' }}>
                  <span style={{ fontSize: 15, flex: 'none' }}>🍽️</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                    <b>Aderenza ai menu: {r.adherence.pct}%{r.adherence.pct >= 85 ? ' — bravissima.' : '.'}</b>{' '}
                    {r.adherence.pct >= 85 ? 'È proprio la costanza che porta al risultato: continua così.' : 'Più giorni segui il menu, più Gaia impara e più i risultati si vedono.'}
                  </span>
                </div>
              )}
              {r.habits?.waterAvgL != null && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '5px 0' }}>
                  <span style={{ fontSize: 15, flex: 'none' }}>💧</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                    <b>Acqua — la tua media è {r.habits.waterAvgL.toLocaleString('it-IT')} litri al giorno.</b>{' '}
                    {r.habits.waterGoalL != null && r.habits.waterAvgL < r.habits.waterGoalL
                      ? <>Sul tuo peso l'obiettivo è circa <b>{r.habits.waterGoalL.toLocaleString('it-IT')} litri</b>: tieni una bottiglia a portata di mano e bevi anche lontano dai pasti.</>
                      : 'Sei in linea con il tuo obiettivo: continua così.'}
                  </span>
                </div>
              )}
              {r.habits?.stepsAvg != null && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '5px 0' }}>
                  <span style={{ fontSize: 15, flex: 'none' }}>👟</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                    <b>Passi — la tua media è {r.habits.stepsAvg.toLocaleString('it-IT')} al giorno.</b>{' '}
                    {r.habits.stepsAvg < r.habits.stepsGoal
                      ? <>Punta ad almeno <b>{r.habits.stepsGoal.toLocaleString('it-IT')} passi</b>: bastano ~20 minuti di camminata in più per accelerare il risultato.</>
                      : 'Obiettivo raggiunto: il movimento sta lavorando per te.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* I tuoi passi verso l'obiettivo: tutte le tappe (pagina 2 del modello) */}
          {mi.length >= 2 ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>I tuoi passi verso l'obiettivo</div>
              <div className="muted" style={{ fontSize: 11.5, margin: '3px 0 6px', lineHeight: 1.45 }}>
                Il peso a ogni tappa, dai primi 8 giorni a oggi. La tratteggiata è la stima al ritmo attuale.
              </div>
              <Milestones points={mi} target={r.objective.targetWeightKg} />
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 14, height: 3, background: '#0E7C66', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />Peso a ogni tappa</span>
                {r.objective.targetWeightKg != null && (
                  <>
                    <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed #25A67F', verticalAlign: 'middle', marginRight: 4 }} />Stima al ritmo attuale</span>
                    <span className="muted" style={{ fontSize: 10.5 }}><span style={{ display: 'inline-block', width: 8, height: 8, background: '#E8825A', borderRadius: 4, verticalAlign: 'middle', marginRight: 4 }} />Il tuo obiettivo</span>
                  </>
                )}
              </div>
            </div>
          ) : m?.start && m?.end && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>La tua traiettoria verso l'obiettivo</div>
              <div className="muted" style={{ fontSize: 11.5, margin: '3px 0 6px', lineHeight: 1.45 }}>
                La parte piena è il periodo appena fatto. Quella tratteggiata è la stima di dove puoi arrivare mantenendo questo ritmo.
              </div>
              <Trajectory a={m.start} b={m.end} target={r.objective.targetWeightKg} />
            </div>
          )}

          {/* Obiettivo + stima al ritmo attuale (goalbox del modello) */}
          {r.objective.targetWeightKg != null && (
            <div className="card" style={{ background: 'var(--teal)', color: '#fff', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', opacity: 0.85 }}>IL TUO OBIETTIVO</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>
                  {r.objective.targetWeightKg} kg
                  {r.objective.toGoKg != null && r.objective.toGoKg > 0 ? ` · −${r.objective.toGoKg} kg da oggi` : r.objective.toGoKg != null ? ' · raggiunto 🎉' : ''}
                </div>
              </div>
              {r.etaLabel && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', opacity: 0.85 }}>STIMA AL RITMO ATTUALE</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>{r.etaLabel}</div>
                </div>
              )}
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

          {/* Le tre strade (fine percorso): Rinnova · Mantenimento €29 · Monitoraggio gratis */}
          {r.kind !== 'monthly' && <div className="sec" style={{ margin: '0 2px 8px' }}>Come vuoi proseguire?</div>}
          {r.offer && r.kind !== 'monthly' && (
            <div className="card" style={{ border: '2px solid #0E7C66', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: '#0E7C66' }}>
                CONSIGLIATO{r.objective.toGoKg != null && r.objective.toGoKg > 0 ? ` · TI MANCANO ${r.objective.toGoKg} KG` : ''}
              </div>
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

          {/* Mantenimento: una pausa che tiene il peso */}
          {r.kind !== 'monthly' && r.maintenance && (
            <div className="card" style={{ border: '1.5px solid #E8825A', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: '#E8825A' }}>UNA PAUSA</div>
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>
                Mantenimento · {euro(r.maintenance.priceCents)}<span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>/mese</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
                Riposati dalla dieta: tieni il peso e rientri quando vuoi.
              </div>
              <button className="btn ghost" style={{ width: '100%', marginTop: 10, border: '1.5px solid #E8825A', color: '#B4491F' }}
                onClick={() => { cart.setPlan({ id: r.maintenance!.planId, name: r.maintenance!.planName, priceCents: r.maintenance!.priceCents, period: 'maintenance' }); nav('/checkout'); }}>
                Attiva il mantenimento
              </button>
            </div>
          )}

          {/* Monitoraggio: gratis, max 1 mese (spec Antonio) */}
          {r.kind !== 'monthly' && (
            <div className="card" style={{ border: '1.5px solid #B8863B', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: '#8A5A00' }}>GRATIS · 1 MESE</div>
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>Monitoraggio</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
                Per un mese Gaia resta in allerta e ti chiede le misure. Se riprendi peso, i tuoi <b>8 menu di
                rientro sono {euro(r.monitoring?.rientroPriceCents ?? 2900)}</b>. Il tuo storico resta salvato per quando torni.
              </div>
              {monMsg && <div style={{ fontSize: 11.5, color: '#B4491F', marginTop: 6 }}>{monMsg}</div>}
              <button className="btn ghost" style={{ width: '100%', marginTop: 10, border: '1.5px solid #B8863B', color: '#8A5A00' }} onClick={() => void startMonitoring()}>
                Attiva il monitoraggio gratuito
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
