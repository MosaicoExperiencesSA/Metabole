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
  const role = permissions?.role ?? user?.role;
  if (role === 'coach') return <CoachHome />;
  if (role === 'nutritionist' || role === 'head_nutritionist') return <NutritionistHome />;
  return <Dashboard />;
}
