import { dateTime, fullName } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Appointment {
  id: string;
  clientId: string;
  clientName: string | null;
  type: 'call' | 'televisit' | 'in_person';
  datetime: string;
  note: string | null;
}

const TYPE: Record<Appointment['type'], [string, string]> = {
  call: ['ti-phone', 'Chiamata'],
  televisit: ['ti-video', 'Televisita'],
  in_person: ['ti-map-pin', 'In presenza'],
};

export default function CoachAgenda() {
  const state = useApi<{ appointments: Appointment[] }>('/coach/agenda');
  return (
    <StaffShell title="Agenda" tabs={COACH_TABS}>
      <Async
        state={state}
        empty={<Empty icon="ti-calendar-off" text="Nessun appuntamento in programma." />}
      >
        {(d) => {
          if (d.appointments.length === 0)
            return <Empty icon="ti-calendar-off" text="Nessun appuntamento in programma." />;
          return (
            <Card className="pad0">
              {d.appointments.map((a) => {
                const t = TYPE[a.type] ?? ['ti-calendar', 'Appuntamento'];
                return (
                  <div key={a.id} className="sf-row" style={{ cursor: 'default' }}>
                    <Avatar name={a.clientName} />
                    <div className="sf-row-main">
                      <div className="sf-row-name">{fullName(a.clientName)}</div>
                      <div className="sf-row-sub">
                        <i className={`ti ${t[0]}`} /> {t[1]} · {dateTime(a.datetime)}
                      </div>
                      {a.note && <div className="sf-row-sub">{a.note}</div>}
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
