import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';

/**
 * Report di fine piano (handoff punto 4): il tuo punto A → punto B.
 * Consegna IN APP: misure, aderenza, "cosa ha imparato Gaia su di te",
 * coach reale e offerta per continuare. Dati congelati alla generazione.
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
  const kindLabel = r?.kind === 'trial' ? 'La tua settimana di prova' : 'Il tuo piano';

  return (
    <div className="home">
      <AppHeader title="Il tuo report" />

      {loading ? (
        <div className="card" style={{ textAlign: 'center' }}><span className="muted">Carico il report…</span></div>
      ) : !r ? (
        <div className="card" style={{ textAlign: 'center', background: '#F7FAF9', boxShadow: 'none' }}>
          <i className="ti ti-report" style={{ fontSize: 22, color: 'var(--teal)' }} />
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Il tuo report di fine piano comparirà qui: lo prepariamo in automatico quando un piano si conclude.
          </div>
        </div>
      ) : (
        <>
          {/* Intestazione: punto A → punto B */}
          <div style={{ margin: '2px 2px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', color: 'var(--teal)' }}>IL TUO PUNTO A → PUNTO B</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginTop: 3 }}>
              {kindLabel}: {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{r.planName} · {r.days} giorni</div>
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

          {/* Obiettivo */}
          {r.objective.targetWeightKg != null && (
            <div className="card" style={{ background: 'var(--teal)', color: '#fff', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', opacity: 0.85 }}>IL TUO OBIETTIVO</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>
                {r.objective.targetWeightKg} kg
                {r.objective.toGoKg != null && r.objective.toGoKg > 0 ? ` · mancano ${r.objective.toGoKg} kg` : r.objective.toGoKg != null ? ' · raggiunto 🎉' : ''}
              </div>
            </div>
          )}

          {/* Cosa ha imparato Gaia */}
          <div className="sec" style={{ margin: '0 2px 8px' }}>Cosa ha imparato Gaia su di te</div>
          <div className="card" style={{ marginBottom: 12 }}>
            {r.gaia.map((g, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0' }}>
                <i className="ti ti-check" style={{ color: '#0E7C66', fontSize: 15, marginTop: 2, flex: 'none' }} />
                <span style={{ fontSize: 13, lineHeight: 1.45 }}>{g}</span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Questo profilo è ciò che rende i tuoi menu davvero tuoi: continuando, Gaia lo affina a ogni ciclo.
            </div>
          </div>

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

          {/* Offerta per continuare */}
          {r.offer && (
            <div className="card" style={{ border: '2px solid #E8825A', marginBottom: 12 }}>
              {r.offer.promoActive && (
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: '#E8825A' }}>PREZZO LANCIO · IN SCADENZA</div>
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
                    <span style={{ fontSize: 13 }}>{h.planName || (h.kind === 'trial' ? 'Prova gratuita' : 'Piano')}</span>
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
