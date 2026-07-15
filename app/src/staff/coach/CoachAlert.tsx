import { useState } from 'react';
import { api } from '../../api/client';
import { fullName } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Card, Empty, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Alert {
  id: string;
  clientId: string;
  clientName: string | null;
  group: string;
  type: string;
  priority: 'high' | 'med' | 'low';
  title: string;
  detail: string | null;
  status: 'open' | 'handled' | 'escalated' | 'resolved';
}

const GROUPS: [string, string][] = [
  ['all', 'Tutti'],
  ['corpo_misure', 'Corpo'],
  ['aderenza_vita', 'Vita'],
  ['gusto_mente', 'Gusto & Mente'],
  ['agenda_op', 'Agenda'],
];
const PR: Record<Alert['priority'], [string, string, string]> = {
  high: ['#FBE3E3', '#B4491F', 'Urgente'],
  med: ['#FDF3DD', '#B8863B', 'Da gestire'],
  low: ['#E7EEF6', '#3A6EA5', 'Info'],
};
const GROUP_IC: Record<string, [string, string, string]> = {
  corpo_misure: ['ti-scale', '#E7EEF6', '#3A6EA5'],
  aderenza_vita: ['ti-zzz', '#F3E8DC', '#B8863B'],
  gusto_mente: ['ti-mood-smile', '#EFEAF9', '#6C4CD6'],
  agenda_op: ['ti-calendar-heart', '#DCEBE3', '#0E7C66'],
};

export default function CoachAlert() {
  const [group, setGroup] = useState('all');
  const path = group === 'all' ? '/coach/alerts' : `/coach/alerts?group=${group}`;
  const state = useApi<{ alerts: Alert[] }>(path, [group]);
  const [setStatus, actState] = useAction(async (id: string, status: string) => {
    await api(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
  });

  async function act(id: string, status: string) {
    const ok = await setStatus(id, status);
    if (ok) state.reload();
  }

  return (
    <StaffShell title="Alert" tabs={COACH_TABS}>
      <div className="sf-chips">
        {GROUPS.map(([k, label]) => (
          <button
            key={k}
            className={'sf-chip' + (group === k ? ' on' : '')}
            onClick={() => setGroup(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <Async
        state={state}
        empty={<Empty icon="ti-checks" text="Nessun alert aperto in questo gruppo." />}
      >
        {(d) => {
          const open = d.alerts.filter((a) => a.status === 'open' || a.status === 'escalated');
          if (open.length === 0)
            return <Empty icon="ti-checks" text="Tutto gestito. Ottimo lavoro!" />;
          return (
            <Card className="pad0">
              {open.map((a) => {
                const p = PR[a.priority];
                const g = GROUP_IC[a.group] ?? ['ti-alert-triangle', '#FBE3E3', '#B4491F'];
                return (
                  <div key={a.id} className="sf-alert" style={{ flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 11 }}>
                      <span className="sf-alert-ic" style={{ background: g[1], color: g[2] }}>
                        <i className={`ti ${g[0]}`} />
                      </span>
                      <div className="sf-row-main">
                        <div className="sf-alert-t">{a.title}</div>
                        <div className="sf-alert-d">{a.detail}</div>
                        <div className="sf-sub" style={{ marginTop: 4 }}>
                          {fullName(a.clientName)} ·{' '}
                          <span style={{ color: p[1], fontWeight: 700 }}>{p[2]}</span>
                          {a.status === 'escalated' ? ' · inoltrato' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="sf-acts">
                      <a className="sf-mini b" href="/chat">
                        <i className="ti ti-message-2" /> Messaggia
                      </a>
                      {a.status !== 'escalated' && (
                        <button
                          className="sf-mini"
                          disabled={actState.loading}
                          onClick={() => act(a.id, 'escalated')}
                        >
                          <i className="ti ti-arrow-up-right" /> Escala
                        </button>
                      )}
                      <button
                        className="sf-mini"
                        disabled={actState.loading}
                        onClick={() => act(a.id, 'handled')}
                      >
                        <i className="ti ti-check" /> Gestito
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        }}
      </Async>
    </StaffShell>
  );
}
