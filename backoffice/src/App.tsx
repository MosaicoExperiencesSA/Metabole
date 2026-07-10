import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Placeholder } from './pages/Placeholder';
import { Permissions } from './pages/Permissions';
import { Users } from './pages/Users';
import type { ReactNode } from 'react';

/** Rotta protetta: richiede login; opzionalmente un permesso di sezione. */
function Protected({ title, pageKey, children }: { title: string; pageKey?: string; children: ReactNode }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (pageKey && !can(pageKey)) {
    return (
      <Layout title={title}>
        <Placeholder title="Accesso non consentito" icon="ti-lock" note="Il tuo ruolo non ha accesso a questa sezione. Chiedi all'amministratore di abilitarla dai Permessi." />
      </Layout>
    );
  }
  return <Layout title={title}>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? <Spinner /> : user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<Protected title="Dashboard"><Dashboard /></Protected>} />
      <Route path="/utenti" element={<Protected title="Utenti" pageKey="users"><Users /></Protected>} />
      <Route path="/permessi" element={<Protected title="Permessi" pageKey="permissions"><Permissions /></Protected>} />

      {/* Sezioni in arrivo (stesse API già pronte lato backend) */}
      <Route path="/clienti" element={<Protected title="Clienti" pageKey="clients"><Placeholder title="Clienti" icon="ti-users" /></Protected>} />
      <Route path="/crm" element={<Protected title="CRM / Lead" pageKey="crm_leads"><Placeholder title="CRM / Lead" icon="ti-user-plus" /></Protected>} />
      <Route path="/agenda" element={<Protected title="Agenda visite" pageKey="visits_agenda"><Placeholder title="Agenda visite" icon="ti-calendar" /></Protected>} />
      <Route path="/segnalazioni" element={<Protected title="Segnalazioni" pageKey="escalations"><Placeholder title="Segnalazioni" icon="ti-alert-triangle" /></Protected>} />
      <Route path="/pagamenti" element={<Protected title="Bonifici & contabilità" pageKey="accounting"><Placeholder title="Bonifici & contabilità" icon="ti-cash" /></Protected>} />
      <Route path="/compensi" element={<Protected title="Compensi staff" pageKey="compensation"><Placeholder title="Compensi staff" icon="ti-coin" /></Protected>} />
      <Route path="/diete" element={<Protected title="Catalogo diete" pageKey="diets_catalog"><Placeholder title="Catalogo diete" icon="ti-salad" /></Protected>} />
      <Route path="/protocolli" element={<Protected title="Protocolli motore" pageKey="engine_protocols"><Placeholder title="Protocolli motore" icon="ti-cpu" /></Protected>} />
      <Route path="/parametri" element={<Protected title="Parametri motore" pageKey="engine_config"><Placeholder title="Parametri motore" icon="ti-adjustments" note="Qui potrai modificare le soglie del motore e gli estremi del bonifico." /></Protected>} />
      <Route path="/log" element={<Protected title="Log attività" pageKey="audit_logs"><Placeholder title="Log attività" icon="ti-history" /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
