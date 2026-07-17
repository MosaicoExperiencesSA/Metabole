import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
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
interface CoachTask {
  id: string;
  clientId: string;
  kind: string;
  title: string;
  description: string | null;
  dueDate: string;
  overdue: boolean;
  status: string;
  clientName: string;
}
interface TasksSummary {
  openTasks: number;
  overdueTasks: number;
  trialsActive: number;
  expiringToday: number;
  expiringTomorrow: number;
  notConverted: number;
}

export default function CoachDashboard() {
  const nav = useNavigate();
  const dash = useApi<Dash>('/coach/dashboard');
  const alerts = useApi<{ alerts: Alert[] }>('/coach/alerts?priority=high');
  const tasks = useApi<CoachTask[]>('/staff/coach-tasks?status=todo&limit=20');
  const tasksSummary = useApi<TasksSummary>('/staff/coach-tasks/summary');
  const [taskBusy, setTaskBusy] = useState<string | null>(null);

  async function markTask(id: string, status: 'done' | 'skipped') {
    setTaskBusy(id);
    try {
      await api(`/staff/coach-tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      tasks.reload();
      tasksSummary.reload();
    } catch {
      // errore silenzioso: la lista resta invariata
    } finally {
      setTaskBusy(null);
    }
  }

  const fmtDue = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  return (
    <StaffShell
      title="Dashboard"
      subtitle="Coach"
      tabs={COACH_TABS}
      headerBadge={dash.data?.openAlerts}
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
                <div className="lab">Guadagno del mese</div>
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

            {tasksSummary.data && tasksSummary.data.trialsActive > 0 && (
              <Card>
                <div className="sf-sub" style={{ lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--ink, #1F2933)' }}>
                    Prove attive: {tasksSummary.data.trialsActive}
                  </b>
                  {' · '}in scadenza oggi:{' '}
                  <b style={{ color: tasksSummary.data.expiringToday > 0 ? '#B3261E' : undefined }}>
                    {tasksSummary.data.expiringToday}
                  </b>
                  {' · '}domani: <b>{tasksSummary.data.expiringTomorrow}</b>
                  {' · '}non convertite: <b>{tasksSummary.data.notConverted}</b>
                </div>
              </Card>
            )}

            {tasks.data && tasks.data.length > 0 && (
              <>
                <Section
                  title={`Da fare (${tasks.data.length})`}
                />
                <Card className="pad0">
                  {tasks.data.slice(0, 6).map((t) => (
                    <div key={t.id} className="sf-row" style={{ alignItems: 'flex-start' }}>
                      <div
                        className="sf-row-main"
                        onClick={() => nav(`/clienti/${t.clientId}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="sf-row-name">
                          {t.title}
                          {t.overdue && (
                            <span style={{ color: '#B3261E', fontWeight: 600 }}> · in ritardo</span>
                          )}
                        </div>
                        <div className="sf-row-sub">
                          {fullName(t.clientName)} · entro il {fmtDue(t.dueDate)}
                        </div>
                      </div>
                      <button
                        className="sf-btn g"
                        style={{ flex: 'none', padding: '6px 10px', fontSize: 13 }}
                        disabled={taskBusy === t.id}
                        onClick={() => markTask(t.id, 'done')}
                      >
                        <i className="ti ti-check" /> Fatto
                      </button>
                    </div>
                  ))}
                </Card>
              </>
            )}

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
