import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

interface Dash {
  isNutritionist: boolean;
  patientsCount: number;
  pendingDocuments: number;
  openEscalations: number;
  protocolsToValidate: number;
  upcomingVisits: number;
  earningsMonthCents: number;
  earningsTotalCents: number;
}
interface Patient {
  clientId: string;
  name: string | null;
  lastMeasureDate: string | null;
  openEscalations: number;
  pendingDocuments: number;
  nextVisit: { datetime: string; type: string } | null;
}
interface Decision {
  id: string;
  clientId: string;
  patientName: string | null;
  date: string;
  flagReason: string | null;
  rule: { id: string; name: string } | null;
  action: unknown;
}
interface Queue {
  engineDecisions: Decision[];
  dietsInReview: { id: string; name: string; regime: string; style: string }[];
  protocolsPending: { id: string; name: string; type: string }[];
  counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
}

export function NutritionistHome() {
  const { user, can } = useAuth();
  const [dash, setDash] = useState<Dash | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, p, q] = await Promise.all([
        api<Dash>('/nutritionist/dashboard'),
        api<{ patients: Patient[] }>('/nutritionist/patients'),
        api<Queue>('/nutritionist/validation-queue'),
      ]);
      setDash(d);
      setPatients(p.patients ?? []);
      setQueue(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reviewDecision(id: string, outcome: 'confirm' | 'correct') {
    setQueue((q) => (q ? { ...q, engineDecisions: q.engineDecisions.filter((x) => x.id !== id) } : q));
    try {
      await api(`/nutritionist/decisions/${id}/${outcome}`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(outcome === 'confirm' ? 'Decisione confermata.' : 'Decisione segnata da correggere.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      void load();
    }
  }

  if (loading) return <Spinner />;

  const hello = (user?.firstName && user.firstName.trim()) || 'Dottoressa';

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Ciao {hello} 👋</h1>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* KPI clinici */}
      <div className="card-row">
        <Kpi label="Pazienti" value={String(dash?.patientsCount ?? 0)} icon="ti-users" />
        <Kpi label="Documenti da rivedere" value={String(dash?.pendingDocuments ?? 0)} icon="ti-file-description" color={dash && dash.pendingDocuments > 0 ? 'var(--coral-dark)' : undefined} />
        <Kpi label="Escalation aperte" value={String(dash?.openEscalations ?? 0)} icon="ti-alert-triangle" color={dash && dash.openEscalations > 0 ? 'var(--coral-dark)' : undefined} />
        <Kpi label="Visite in arrivo" value={String(dash?.upcomingVisits ?? 0)} icon="ti-calendar" />
      </div>

      <div className="card-row" style={{ marginTop: 16, alignItems: 'flex-start' }}>
        {/* Coda di validazione */}
        <div className="card" style={{ margin: 0, flex: 1.3 }}>
          <h2 style={{ marginTop: 0 }}>Da validare</h2>

          <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0' }}>Decisioni del motore ({queue?.counts.engineDecisions ?? 0})</h3>
          {(!queue || queue.engineDecisions.length === 0) ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Nessuna decisione da rivedere.</div>
          ) : (
            queue.engineDecisions.slice(0, 8).map((d) => (
              <div key={d.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b style={{ fontSize: 14 }}>
                    {d.patientName ? <Link to={`/clienti/${d.clientId}`} className="link">{d.patientName}</Link> : 'Paziente'}
                  </b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.date}{d.rule?.name && ` · ${d.rule.name}`}{d.flagReason && ` · ${d.flagReason}`}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => reviewDecision(d.id, 'confirm')}>Conferma</button>
                  <button className="btn ghost sm" onClick={() => reviewDecision(d.id, 'correct')}>Correggi</button>
                </div>
              </div>
            ))
          )}

          {queue && queue.dietsInReview.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>Diete in revisione ({queue.dietsInReview.length})</h3>
              {queue.dietsInReview.map((d) => (
                <div key={d.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span><b>{d.name}</b> <span className="muted" style={{ fontSize: 12 }}>({d.regime} · {d.style})</span></span>
                  <Link className="btn ghost sm" to="/diete">Apri</Link>
                </div>
              ))}
            </>
          )}

          {queue && queue.protocolsPending.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>Protocolli in attesa ({queue.protocolsPending.length})</h3>
              {queue.protocolsPending.map((p) => (
                <div key={p.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span><b>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>({p.type})</span></span>
                  <Link className="btn ghost sm" to="/protocolli">Apri</Link>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Pazienti che richiedono attenzione */}
        <div className="card" style={{ margin: 0, flex: 1 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Pazienti</h2>
            <Link className="muted" style={{ fontSize: 13 }} to="/clienti">Tutti →</Link>
          </div>
          {patients.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Nessun paziente assegnato.</div>
          ) : (
            patients.slice(0, 10).map((p) => (
              <div key={p.clientId} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="spread">
                  <Link to={`/clienti/${p.clientId}`} className="link"><b>{p.name ?? 'Paziente'}</b></Link>
                  <div className="row" style={{ gap: 5 }}>
                    {p.openEscalations > 0 && <span className="chip red" style={{ fontSize: 10 }} title="Escalation aperte">{p.openEscalations} esc.</span>}
                    {p.pendingDocuments > 0 && <span className="chip amber" style={{ fontSize: 10 }} title="Documenti da rivedere">{p.pendingDocuments} doc.</span>}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {p.lastMeasureDate ? `ultima misura ${p.lastMeasureDate}` : 'nessuna misura'}
                  {p.nextVisit && ` · visita ${new Date(p.nextVisit.datetime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modulo Regole del motore — solo il capo nutrizionista */}
      {can('engine_rules', 'manage') && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <i className="ti ti-adjustments-cog" style={{ fontSize: 20, color: 'var(--deep)' }} />
                <h2 style={{ margin: 0 }}>Regole del motore</h2>
              </div>
              <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
                Gestisci le regole globali del motore, le regole base suggerite per tipo di nutrizione e le proposte di nuove regole.
              </p>
            </div>
            <Link className="btn" to="/regole-motore"><i className="ti ti-arrow-right" /> Apri</Link>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--chip)', color: 'var(--chip-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
        </span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
          <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        </div>
      </div>
    </div>
  );
}
