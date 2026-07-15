import { api } from '../../api/client';
import { dateTime, fullName } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';

interface Visit {
  id: string;
  type: 'in_person' | 'televisit';
  datetime: string;
  status: string;
  videoRoomId?: string | null;
  client: { id: string; email: string; clientProfile: { name: string | null } | null } | null;
}

const TYPE: Record<Visit['type'], [string, string]> = {
  in_person: ['ti-map-pin', 'In presenza'],
  televisit: ['ti-video', 'Televisita'],
};

export default function NutriAgenda() {
  const state = useApi<Visit[]>('/agenda');
  const [start, startState] = useAction(async (id: string) => {
    const res = await api<{ joinUrl?: string }>(`/visits/${id}/start`, { method: 'POST' });
    if (res?.joinUrl) window.open(res.joinUrl, '_blank');
  });
  const [complete, compState] = useAction(async (id: string) => {
    await api(`/visits/${id}/complete`, { method: 'POST', body: JSON.stringify({}) });
  });

  return (
    <StaffShell title="Agenda visite" tabs={NUTRI_TABS}>
      <Async state={state} empty={<Empty icon="ti-calendar-off" text="Nessuna visita in programma." />}>
        {(visits) => {
          const upcoming = visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled');
          if (upcoming.length === 0)
            return <Empty icon="ti-calendar-off" text="Nessuna visita in programma." />;
          return (
            <Card className="pad0">
              {upcoming.map((v) => {
                const t = TYPE[v.type] ?? ['ti-calendar', 'Visita'];
                const name = v.client?.clientProfile?.name || fullName(null, null, v.client?.email);
                return (
                  <div key={v.id} className="sf-alert" style={{ flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 11 }}>
                      <Avatar name={name} />
                      <div className="sf-row-main">
                        <div className="sf-row-name">{name}</div>
                        <div className="sf-row-sub">
                          <i className={`ti ${t[0]}`} /> {t[1]} · {dateTime(v.datetime)}
                        </div>
                      </div>
                    </div>
                    <div className="sf-acts">
                      {v.type === 'televisit' && (
                        <button
                          className="sf-mini b"
                          disabled={startState.loading}
                          onClick={() => start(v.id)}
                        >
                          <i className="ti ti-video" /> Avvia televisita
                        </button>
                      )}
                      <button
                        className="sf-mini"
                        disabled={compState.loading}
                        onClick={async () => {
                          const ok = await complete(v.id);
                          if (ok) state.reload();
                        }}
                      >
                        <i className="ti ti-check" /> Completa
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
