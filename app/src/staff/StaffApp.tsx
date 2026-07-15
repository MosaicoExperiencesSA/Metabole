import { useAuth } from '../auth/AuthContext';
import CoachApp from './coach/CoachApp';
import NutriApp from './nutritionist/NutriApp';
import { COACH_ROLES, NUTRI_ROLES } from './tabs';
import './theme-staff.css';

/** Schermata per i ruoli staff senza app mobile dedicata (admin, marketing…). */
function StaffFallback({ role, onLogout }: { role: string; onLogout: () => void }) {
  return (
    <div className="sf-frame">
      <div className="sf-fallback">
        <div className="big">
          <i className="ti ti-briefcase" />
        </div>
        <h1 className="sf-h1">Account staff</h1>
        <p className="sf-sub" style={{ margin: '8px 0 18px' }}>
          Il ruolo «{role}» si gestisce dal backoffice web su backoffice.metabole.eu.
          L'app mobile è dedicata a coach e nutrizionisti.
        </p>
        <button className="sf-btn g" onClick={onLogout}>
          <i className="ti ti-logout" /> Esci
        </button>
      </div>
    </div>
  );
}

/** Router di primo livello per lo staff: smista in base al ruolo. */
export default function StaffApp() {
  const { user, logout } = useAuth();
  const role = user?.role ?? '';

  if (COACH_ROLES.has(role)) return <CoachApp />;
  if (NUTRI_ROLES.has(role)) return <NutriApp />;
  return <StaffFallback role={role} onLogout={() => logout()} />;
}
