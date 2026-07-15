import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { euro } from '../format';
import { useApi } from '../hooks';
import { Async, Kpi, Section, StaffShell } from '../ui';
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

export default function NutriDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const dash = useApi<Dash>('/nutritionist/dashboard');

  return (
    <StaffShell
      title="Dashboard"
      tabs={NUTRI_TABS}
      headerBadge={dash.data ? dash.data.pendingDocuments + dash.data.openEscalations : undefined}
      right={
        <span className="sf-header-brand" style={{ maxWidth: 90, textAlign: 'right' }}>
          Dr. {user?.lastName || user?.firstName || ''}
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
                label="Visite in arrivo"
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

            <Section title="Priorità cliniche" />
            <div className="sf-kpi-row">
              <Kpi
                icon="ti-alert-triangle"
                value={d.openEscalations}
                label="Escalation aperte"
                bg="#EFEAF9"
                fg="#6C4CD6"
                onClick={() => nav('/pazienti')}
              />
              <Kpi
                icon="ti-clipboard-list"
                value={d.protocolsToValidate}
                label="Protocolli/decisioni"
                bg="#FDF3DD"
                fg="#B8863B"
                onClick={() => nav('/diete')}
              />
            </div>
          </>
        )}
      </Async>
    </StaffShell>
  );
}
