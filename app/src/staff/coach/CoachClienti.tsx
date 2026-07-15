import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fullName, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface CoachClient {
  clientId: string;
  name: string | null;
  planActive: boolean;
  planEndDate: string | null;
  lastMeasureDate: string | null;
  lastWeightKg: number | null;
  openAlerts: number;
}

function statusPill(c: CoachClient) {
  if (c.openAlerts > 0) return ['#FBE3E3', '#B4491F', 'A rischio'] as const;
  if (c.planActive) return ['#DCF0D8', '#3B6D11', 'In rotta'] as const;
  return ['#E7EEF6', '#3A6EA5', 'Nuova'] as const;
}

export default function CoachClienti() {
  const nav = useNavigate();
  const state = useApi<{ clients: CoachClient[] }>('/coach/clients');
  const [q, setQ] = useState('');

  return (
    <StaffShell title="Le tue clienti" tabs={COACH_TABS}>
      <input
        className="sf-inp"
        placeholder="Cerca una cliente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <Async state={state} empty={<Empty icon="ti-users" text="Nessuna cliente assegnata." />}>
        {(d) => {
          const list = d.clients.filter((c) =>
            fullName(c.name).toLowerCase().includes(q.trim().toLowerCase()),
          );
          if (list.length === 0)
            return <Empty icon="ti-search" text="Nessuna cliente con questo nome." />;
          return (
            <Card className="pad0">
              {list.map((c) => {
                const s = statusPill(c);
                return (
                  <div
                    key={c.clientId}
                    className="sf-row"
                    onClick={() => nav(`/clienti/${c.clientId}`)}
                  >
                    <Avatar name={c.name} />
                    <div className="sf-row-main">
                      <div className="sf-row-name">{fullName(c.name)}</div>
                      <div className="sf-row-sub">
                        {c.lastWeightKg != null ? `${c.lastWeightKg} kg · ` : ''}
                        ultima misura {relDays(c.lastMeasureDate)}
                      </div>
                    </div>
                    <span className="sf-pill" style={{ background: s[0], color: s[1] }}>
                      {s[2]}
                    </span>
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
