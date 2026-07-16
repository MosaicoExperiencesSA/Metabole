import { useNavigate } from 'react-router-dom';
import { euro } from '../format';
import { useApi } from '../hooks';
import { Async, Card, Kpi, Section, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';

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

interface ValidationQueue {
  engineDecisions: { id: string; patientName: string | null; flagReason: string | null; rule: { name: string } | null }[];
  protocolsPending: { id: string; name: string }[];
}

export default function NutriDashboard() {
  const nav = useNavigate();
  const dash = useApi<Dash>('/nutritionist/dashboard');
  const queue = useApi<ValidationQueue>('/nutritionist/validation-queue');

  return (
    <StaffShell
      title="Dashboard"
      subtitle="Nutrizionista"
      tabs={NUTRI_TABS}
      headerBadge={dash.data ? dash.data.pendingDocuments + dash.data.openEscalations : undefined}
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
                value={d.patientsCount}
                label="Pazienti"
                bg="#DCEBE3"
                fg="#0E7C66"
                onClick={() => nav('/pazienti')}
              />
              <Kpi
                icon="ti-clipboard-check"
                value={d.protocolsToValidate}
                label="Da validare"
                bg="#E7EEF6"
                fg="#3A6EA5"
                onClick={() => nav('/diete')}
              />
            </div>
            <div className="sf-kpi-row">
              <Kpi
                icon="ti-calendar-heart"
                value={d.upcomingVisits}
                label="Visite oggi"
                bg="#FBEEE7"
                fg="#E8825A"
                onClick={() => nav('/agenda')}
              />
              <Kpi
                icon="ti-file-alert"
                value={d.pendingDocuments}
                label="Documenti"
                bg="#FBE3E3"
                fg="#B4491F"
                onClick={() => nav('/pazienti')}
              />
            </div>

            <Section
              title="Priorità cliniche"
              action={
                <span className="sf-sub" style={{ cursor: 'pointer' }} onClick={() => nav('/diete')}>
                  Vedi tutte
                </span>
              }
            />
            <Async state={queue}>
              {(q) => {
                const rows = [
                  ...q.engineDecisions.map((e) => ({
                    id: `d-${e.id}`,
                    icon: 'ti-report-medical',
                    bg: '#FBE3E3',
                    fg: '#B4491F',
                    title: e.rule?.name ?? 'Decisione da rivedere',
                    sub: [e.patientName, e.flagReason].filter(Boolean).join(' · ') || 'Da validare',
                  })),
                  ...q.protocolsPending.map((p) => ({
                    id: `p-${p.id}`,
                    icon: 'ti-clipboard-check',
                    bg: '#E7EEF6',
                    fg: '#3A6EA5',
                    title: p.name || 'Protocollo da validare',
                    sub: 'Protocollo in attesa di validazione',
                  })),
                ].slice(0, 5);
                if (rows.length === 0) {
                  return (
                    <Card>
                      <div className="sf-sub" style={{ textAlign: 'center', padding: 8 }}>
                        Nessuna priorità clinica. Ottimo lavoro! 🎉
                      </div>
                    </Card>
                  );
                }
                return (
                  <Card className="pad0">
                    {rows.map((r) => (
                      <div key={r.id} className="sf-row" onClick={() => nav('/diete')} style={{ alignItems: 'flex-start' }}>
                        <span
                          style={{ width: 34, height: 34, borderRadius: 11, background: r.bg, color: r.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                        >
                          <i className={`ti ${r.icon}`} style={{ fontSize: 18 }} />
                        </span>
                        <div className="sf-row-main">
                          <div className="sf-row-name">{r.title}</div>
                          <div className="sf-row-sub">{r.sub}</div>
                        </div>
                        <i className="ti ti-chevron-right chev" />
                      </div>
                    ))}
                  </Card>
                );
              }}
            </Async>
          </>
        )}
      </Async>
    </StaffShell>
  );
}
