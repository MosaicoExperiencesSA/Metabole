import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { euro, fullName, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Card, Kpi, Section, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Dash {
  isCoach: boolean;
  clientsCount: number;
  openAlerts: number;
  earningsMonthCents: number;
  earningsTotalCents: number;
  expiringPlans: { clientId: string; name: string | null; endDate: string | null }[];
}
interface Alert {
  id: string;
  type: string;
  priority: 'high' | 'med' | 'low';
  title: string;
  detail: string | null;
  clientId: string;
  clientName: string | null;
}

export default function CoachDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const dash = useApi<Dash>('/coach/dashboard');
  const alerts = useApi<{ alerts: Alert[] }>('/coach/alerts?priority=high');

  return (
    <StaffShell
      title="Dashboard"
      tabs={COACH_TABS}
      headerBadge={dash.data?.openAlerts}
      right={
        <span className="sf-header-brand" style={{ maxWidth: 90, textAlign: 'right' }}>
          Ciao {user?.firstName || 'Coach'}
        </span>
      }
    >
      <Async state={dash}>
        {(d) => (
          <>
            <div className="sf-earn-row">
              <div className="sf-earn g1">
                <div className="lab">Guadagno totale</div>
                <div className="val">{euro(d.earningsTotalCents)}</div>
              </div>
              <div className="sf-earn g2">
                <div className="lab">Questo mese</div>
                <div className="val">{euro(d.earningsMonthCents)}</div>
              </div>
            </div>

            <div className="sf-kpi-row">
              <Kpi
                icon="ti-users"
                value={d.clientsCount}
                label="Clienti seguite"
                bg="#DCEBE3"
                fg="#0E7C66"
                onClick={() => nav('/clienti')}
              />
              <Kpi
                icon="ti-alert-triangle"
                value={d.openAlerts}
                label="Alert aperti"
                bg="#FBE3E3"
                fg="#B4491F"
                onClick={() => nav('/alert')}
              />
            </div>

            {d.expiringPlans.length > 0 && (
              <>
                <Section title="Piani in scadenza" />
                <Card className="pad0">
                  {d.expiringPlans.map((p) => (
                    <div
                      key={p.clientId}
                      className="sf-row"
                      onClick={() => nav(`/clienti/${p.clientId}`)}
                    >
                      <div className="sf-row-main">
                        <div className="sf-row-name">{fullName(p.name)}</div>
                        <div className="sf-row-sub">Percorso in scadenza {relDays(p.endDate)}</div>
                      </div>
                      <i className="ti ti-chevron-right chev" />
                    </div>
                  ))}
                </Card>
              </>
            )}

            <Section
              title="Priorità del giorno"
              action={
                <span className="sf-sub" style={{ cursor: 'pointer' }} onClick={() => nav('/alert')}>
                  Vedi tutte
                </span>
              }
            />
            <Async state={alerts}>
              {(a) =>
                a.alerts.length === 0 ? (
                  <Card>
                    <div className="sf-sub" style={{ textAlign: 'center', padding: 8 }}>
                      Nessuna priorità urgente. Ottimo lavoro! 🎉
                    </div>
                  </Card>
                ) : (
                  <Card className="pad0">
                    {a.alerts.slice(0, 4).map((al) => (
                      <div
                        key={al.id}
                        className="sf-row"
                        onClick={() => nav('/alert')}
                        style={{ alignItems: 'flex-start' }}
                      >
                        <div className="sf-row-main">
                          <div className="sf-row-name">{al.title}</div>
                          <div className="sf-row-sub">
                            {fullName(al.clientName)}
                            {al.detail ? ` · ${al.detail}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Card>
                )
              }
            </Async>
          </>
        )}
      </Async>
    </StaffShell>
  );
}
