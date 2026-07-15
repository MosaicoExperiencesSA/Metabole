import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import { DashboardShortcuts, DashboardModules } from '../components/DashboardBlocks';

const euro0 = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

interface Dash {
  isCoach: boolean;
  clientsCount: number;
  openAlerts: number;
  earningsMonthCents: number;
  earningsTotalCents: number;
  expiringPlans: { clientId: string; name: string | null; endDate: string | null }[];
}
interface CoachClient {
  clientId: string;
  name: string | null;
  planActive: boolean;
  planEndDate: string | null;
  lastMeasureDate: string | null;
  lastWeightKg: number | null;
  openAlerts: number;
}
interface Alert {
  id: string;
  type: string;
  priority: string;
  title: string;
  detail: string | null;
  status: string;
  clientId: string;
  clientName: string | null;
}
interface Assignment {
  id: string;
  name: string | null;
  email: string | null;
  assignedBy: string | null;
  hoursLeft: number | null;
}

const PRIO: Record<string, { label: string; cls: string }> = {
  high: { label: 'Alta', cls: 'red' },
  med: { label: 'Media', cls: 'amber' },
  low: { label: 'Bassa', cls: 'gray' },
};

export function CoachHome() {
  const { user } = useAuth();
  const [dash, setDash] = useState<Dash | null>(null);
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [invite, setInvite] = useState<{ refCode: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, c, a, asg, inv] = await Promise.all([
        api<Dash>('/coach/dashboard'),
        api<{ clients: CoachClient[] }>('/coach/clients'),
        api<{ alerts: Alert[] }>('/coach/alerts'),
        api<Assignment[]>('/crm/my-assignments').catch(() => []),
        api<{ refCode: string; url: string }>('/crm/my-invite').catch(() => null),
      ]);
      setDash(d);
      setClients(c.clients ?? []);
      setAlerts(a.alerts ?? []);
      setAssignments(Array.isArray(asg) ? asg : []);
      setInvite(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setAlertStatus(id: string, status: 'handled' | 'escalated') {
    setAlerts((as) => as.filter((x) => x.id !== id));
    try {
      await api(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setNotice(status === 'handled' ? 'Avviso segnato come gestito.' : 'Avviso inoltrato al nutrizionista.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      void load();
    }
  }

  async function respondAssignment(id: string, action: 'accept' | 'reject') {
    setAssignments((xs) => xs.filter((x) => x.id !== id));
    try {
      await api(`/crm/leads/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(action === 'accept' ? 'Lead accettato.' : 'Lead rifiutato.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      void load();
    }
  }

  function copyInvite() {
    if (!invite) return;
    navigator.clipboard?.writeText(invite.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <Spinner />;

  const hello = (user?.firstName && user.firstName.trim()) || 'coach';

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Ciao {hello} 👋</h1>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <DashboardShortcuts />

      {/* KPI */}
      <div className="card-row">
        <Kpi label="Le mie clienti" value={String(dash?.clientsCount ?? 0)} icon="ti-users" />
        <Kpi label="Avvisi aperti" value={String(dash?.openAlerts ?? 0)} icon="ti-alert-triangle" color={dash && dash.openAlerts > 0 ? 'var(--coral-dark)' : undefined} />
        <Kpi label="Piani in scadenza" value={String(dash?.expiringPlans.length ?? 0)} icon="ti-clock" />
        <Kpi label="Guadagni mese" value={euro0(dash?.earningsMonthCents ?? 0)} icon="ti-coin" />
        <Kpi label="Guadagni totale" value={euro0(dash?.earningsTotalCents ?? 0)} icon="ti-wallet" />
      </div>

      {/* Lead da accettare */}
      {assignments.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--teal)' }}>
          <h2 style={{ marginTop: 0 }}>Lead da accettare ({assignments.length})</h2>
          {assignments.map((a) => (
            <div key={a.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <b>{a.name ?? a.email ?? 'Senza nome'}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.assignedBy ? `da ${a.assignedBy}` : ''}
                  {a.hoursLeft != null && ` · ${a.hoursLeft}h per accettare`}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm" onClick={() => respondAssignment(a.id, 'accept')}>Accetta</button>
                <button className="btn ghost sm" onClick={() => respondAssignment(a.id, 'reject')}>Rifiuta</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-row" style={{ marginTop: 16, alignItems: 'flex-start' }}>
        {/* Avvisi */}
        <div className="card" style={{ margin: 0, flex: 1.3 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Avvisi</h2>
            <Link className="muted" style={{ fontSize: 13 }} to="/segnalazioni">Tutte →</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="empty" style={{ padding: '20px' }}>Nessun avviso aperto. Ottimo. 🎉</div>
          ) : (
            alerts.slice(0, 8).map((a) => {
              const p = PRIO[a.priority] ?? PRIO.low;
              return (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="spread" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`chip ${p.cls}`} style={{ fontSize: 10 }}>{p.label}</span>
                        <b style={{ fontSize: 14 }}>{a.title}</b>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {a.clientName && (
                          <Link to={`/clienti/${a.clientId}`} className="link">{a.clientName}</Link>
                        )}
                        {a.detail && <> · {a.detail}</>}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn ghost sm" onClick={() => setAlertStatus(a.id, 'handled')} title="Segna come gestito">
                        <i className="ti ti-check" />
                      </button>
                      <button className="btn ghost sm" onClick={() => setAlertStatus(a.id, 'escalated')} title="Inoltra al nutrizionista">
                        <i className="ti ti-arrow-up-right" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Colonna destra: invito + piani in scadenza */}
        <div style={{ flex: 1, display: 'grid', gap: 16 }}>
          {invite && (
            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>Il mio link d'invito</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Condividilo con una nuova cliente: registrandosi da qui verrà assegnata a te.</p>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all', background: 'var(--bg)', padding: '8px 10px', borderRadius: 8 }}>{invite.url}</code>
                <button className="btn sm" onClick={copyInvite}>{copied ? 'Copiato!' : 'Copia'}</button>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Codice: <b>{invite.refCode}</b></div>
            </div>
          )}

          {dash && dash.expiringPlans.length > 0 && (
            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>Piani in scadenza</h2>
              {dash.expiringPlans.map((p) => (
                <div key={p.clientId} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <Link to={`/clienti/${p.clientId}`} className="link">{p.name ?? 'Cliente'}</Link>
                  <span className="muted" style={{ fontSize: 12 }}>{p.endDate ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Le mie clienti */}
      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div className="spread" style={{ padding: '16px 20px 4px' }}>
          <h2 style={{ margin: 0 }}>Le mie clienti</h2>
          <Link className="muted" style={{ fontSize: 13 }} to="/clienti">Tutte →</Link>
        </div>
        {clients.length === 0 ? (
          <div className="empty">Nessuna cliente assegnata.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="grid">
              <thead>
                <tr><th>Cliente</th><th>Piano</th><th>Ultima misura</th><th style={{ textAlign: 'center' }}>Avvisi</th></tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.clientId}>
                    <td><Link to={`/clienti/${c.clientId}`} className="link"><b>{c.name ?? 'Cliente'}</b></Link></td>
                    <td>
                      {c.planActive
                        ? <span className="chip" style={{ fontSize: 11 }}>attivo{c.planEndDate ? ` → ${c.planEndDate}` : ''}</span>
                        : <span className="chip gray" style={{ fontSize: 11 }}>nessun piano</span>}
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {c.lastMeasureDate ?? '—'}{c.lastWeightKg != null && ` · ${c.lastWeightKg} kg`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.openAlerts > 0 ? <span className="chip red" style={{ fontSize: 11 }}>{c.openAlerts}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <DashboardModules />
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
