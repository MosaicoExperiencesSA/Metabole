import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dateTime, fullName, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';
import ContactActions from '../shared/ContactActions';

interface Patient {
  clientId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lastMeasureDate: string | null;
  openEscalations: number;
  pendingDocuments: number;
  nextVisit: { datetime: string; type: string } | null;
}

export default function NutriPazienti() {
  const nav = useNavigate();
  const state = useApi<{ patients: Patient[] }>('/nutritionist/patients');
  const [q, setQ] = useState('');

  return (
    <StaffShell title="Pazienti" tabs={NUTRI_TABS}>
      <input
        className="sf-inp"
        placeholder="Cerca un paziente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <Async state={state} empty={<Empty icon="ti-users" text="Nessun paziente assegnato." />}>
        {(d) => {
          const list = d.patients.filter((p) =>
            fullName(p.name).toLowerCase().includes(q.trim().toLowerCase()),
          );
          if (list.length === 0)
            return <Empty icon="ti-search" text="Nessun paziente con questo nome." />;
          return (
            <Card className="pad0">
              {list.map((p) => (
                <div
                  key={p.clientId}
                  className="sf-row"
                  onClick={() => nav(`/pazienti/${p.clientId}`)}
                  style={{ alignItems: 'flex-start' }}
                >
                  <Avatar name={p.name} />
                  <div className="sf-row-main">
                    <div className="sf-row-name">{fullName(p.name)}</div>
                    <div className="sf-row-sub">
                      {p.nextVisit
                        ? `Prossima visita ${dateTime(p.nextVisit.datetime)}`
                        : `Ultima misura ${relDays(p.lastMeasureDate)}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {p.pendingDocuments > 0 && (
                        <span className="sf-pill" style={{ background: '#FBE3E3', color: '#B4491F' }}>
                          {p.pendingDocuments} doc.
                        </span>
                      )}
                      {p.openEscalations > 0 && (
                        <span className="sf-pill" style={{ background: '#FBEEE7', color: '#B4491F' }}>
                          {p.openEscalations} escalation
                        </span>
                      )}
                    </div>
                    <ContactActions name={fullName(p.name)} phone={p.phone} email={p.email} />
                  </div>
                  <i className="ti ti-chevron-right chev" />
                </div>
              ))}
            </Card>
          );
        }}
      </Async>
    </StaffShell>
  );
}
