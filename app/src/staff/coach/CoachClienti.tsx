import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fullName, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface CoachClient {
  clientId: string | null;
  leadId?: string;
  isLead?: boolean;
  stage?: string;
  name: string | null;
  planActive: boolean;
  planEndDate: string | null;
  lastMeasureDate: string | null;
  lastWeightKg: number | null;
  weightDeltaKg: number | null;
  progressPct: number | null;
  openAlerts: number;
}

/** "-1,8 kg" se ha perso peso, "+0,4 kg" se ripreso. */
function deltaLabel(kg: number | null): string | null {
  if (kg == null) return null;
  const sign = kg > 0 ? '-' : kg < 0 ? '+' : '';
  return `${sign}${Math.abs(kg).toFixed(1).replace('.', ',')} kg`;
}

function statusPill(c: CoachClient) {
  if (c.isLead) return ['#EEE9FA', '#6C4CD6', 'Lead'] as const;
  if (c.openAlerts > 0) return ['#FBE3E3', '#B4491F', 'A rischio'] as const;
  if (c.planActive) return ['#DCF0D8', '#3B6D11', 'In rotta'] as const;
  return ['#E7EEF6', '#3A6EA5', 'Nuova'] as const;
}

export default function CoachClienti() {
  const nav = useNavigate();
  const [showLeads, setShowLeads] = useState(false);
  const state = useApi<{ clients: CoachClient[] }>(`/coach/clients${showLeads ? '?leads=1' : ''}`, [showLeads]);
  const [q, setQ] = useState('');

  return (
    <StaffShell title="Le tue clienti" tabs={COACH_TABS}>
      <input
        className="sf-inp"
        placeholder="Cerca una cliente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={showLeads} onChange={(e) => setShowLeads(e.target.checked)} />
        <span>Mostra anche i lead</span>
      </label>
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
                const delta = deltaLabel(c.weightDeltaKg);
                return (
                  <div
                    key={c.clientId ?? c.leadId}
                    className="sf-row"
                    onClick={() => { if (c.clientId) nav(`/clienti/${c.clientId}`); }}
                    style={{ alignItems: 'stretch', cursor: c.clientId ? 'pointer' : 'default' }}
                  >
                    <Avatar name={c.name} />
                    <div className="sf-row-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <div className="sf-row-name">{fullName(c.name)}</div>
                        <span className="sf-pill" style={{ background: s[0], color: s[1], flex: 'none' }}>
                          {s[2]}
                        </span>
                      </div>
                      {c.progressPct != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 4, background: '#EDF1EF', overflow: 'hidden' }}>
                            <div style={{ width: `${c.progressPct}%`, height: '100%', background: 'var(--sf-brand)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sf-brand-dark)' }}>{c.progressPct}%</span>
                        </div>
                      )}
                      <div className="sf-row-sub" style={{ marginTop: 4 }}>
                        {c.isLead
                          ? 'Lead da contattare'
                          : delta
                            ? delta
                            : `ultima misura ${relDays(c.lastMeasureDate)}`}
                        {!c.isLead && c.openAlerts > 0 ? ` · ${c.openAlerts} alert` : ''}
                      </div>
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
