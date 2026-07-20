import { useAuth } from '../auth/AuthContext';
import { CoachHome } from './CoachHome';
import { Dashboard } from './Dashboard';
import { NutritionistHome } from './NutritionistHome';

/**
 * Home role-adattiva del backoffice/app staff: a seconda del ruolo effettivo mostra
 * la vista dedicata (Coach o Nutrizionista) oppure la dashboard generale (admin/altri).
 * Il backend è lo stesso; cambia solo l'esperienza in base a chi entra.
 */
export function Home() {
  const { user, permissions } = useAuth();
  // Vista home per ESPERIENZA: si basa sul ruolo di SISTEMA (user.role). Per un ruolo
  // personalizzato (es. "Responsabile Coach") user.role è il ruolo BASE su cui è costruito
  // (coach_coordinator), mentre permissions.role sarebbe la chiave custom → prima cadeva
  // sulla Dashboard generica e la coordinatrice non vedeva la home coach (ref link ecc).
  const role = user?.role ?? permissions?.role;
  if (role === 'coach' || role === 'coach_coordinator') return <CoachHome />;
  if (role === 'nutritionist' || role === 'head_nutritionist') return <NutritionistHome />;
  return <Dashboard />;
}
