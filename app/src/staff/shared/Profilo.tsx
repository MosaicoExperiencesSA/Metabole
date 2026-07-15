import { useAuth } from '../../auth/AuthContext';
import { fullName } from '../format';
import { Avatar, Card, Section, StaffShell, type TabItem } from '../ui';

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  sales: 'Responsabile Coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
};

export default function Profilo({ tabs }: { tabs: TabItem[] }) {
  const { user, logout } = useAuth();
  const name = fullName(user?.firstName, user?.lastName, user?.email);
  const roleLabel = (user?.role && ROLE_LABEL[user.role]) || user?.role || '';

  return (
    <StaffShell title="Profilo" tabs={tabs}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={name} />
          <div style={{ minWidth: 0 }}>
            <div className="sf-row-name" style={{ fontSize: 16 }}>
              {name}
            </div>
            <div className="sf-sub">{user?.email}</div>
            <span className="sf-pill" style={{ marginTop: 6, display: 'inline-block' }}>
              {roleLabel}
            </span>
          </div>
        </div>
      </Card>

      <Section title="App" />
      <Card>
        <div className="sf-kv">
          <span className="k">Versione</span>
          <span className="v">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—'}</span>
        </div>
        <div className="sf-kv">
          <span className="k">Lingua</span>
          <span className="v">{user?.locale === 'en' ? 'English' : 'Italiano'}</span>
        </div>
      </Card>

      <button className="sf-btn g" style={{ marginTop: 12 }} onClick={() => logout()}>
        <i className="ti ti-logout" /> Esci
      </button>
    </StaffShell>
  );
}
