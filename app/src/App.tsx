import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import TabBar from './components/TabBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';

/** Guscio autenticato: schermata + tab bar in basso. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame">
      <div className="screen">{children}</div>
      <TabBar />
    </div>
  );
}

/** Protegge le rotte private: se non loggato, torna al login. */
function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-frame">
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

/** Se già loggato, le rotte pubbliche rimandano alla home. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-frame">
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      <Route path="/" element={<Private><Home /></Private>} />
      <Route path="/menu" element={<Private><Placeholder title="Menu & Diario" icon="ti-salad" /></Private>} />
      <Route path="/calendario" element={<Private><Placeholder title="Calendario" icon="ti-calendar-heart" /></Private>} />
      <Route path="/obiettivo" element={<Private><Placeholder title="Obiettivo" icon="ti-target-arrow" /></Private>} />
      <Route path="/negozio" element={<Private><Placeholder title="Negozio" icon="ti-shopping-bag" /></Private>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
