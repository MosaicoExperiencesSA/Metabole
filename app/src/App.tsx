import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { useAuth } from './auth/AuthContext';
import TabBar from './components/TabBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Placeholder from './pages/Placeholder';

function Centered() {
  return (
    <div className="app-frame">
      <div className="center">
        <div className="spin" />
      </div>
    </div>
  );
}

/** Guscio autenticato: schermata + tab bar in basso. */
function Shell() {
  return (
    <div className="app-frame">
      <div className="screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Placeholder title="Menu & Diario" icon="ti-salad" />} />
          <Route path="/calendario" element={<Placeholder title="Calendario" icon="ti-calendar-heart" />} />
          <Route path="/obiettivo" element={<Placeholder title="Obiettivo" icon="ti-target-arrow" />} />
          <Route path="/negozio" element={<Placeholder title="Negozio" icon="ti-shopping-bag" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </div>
  );
}

/** Area autenticata: controlla se l'onboarding è stato completato. */
function AuthedApp() {
  const [status, setStatus] = useState<'loading' | 'todo' | 'done'>('loading');

  useEffect(() => {
    let alive = true;
    api('/onboarding/result')
      .then(() => alive && setStatus('done'))
      .catch(() => {
        // 404 = onboarding non completato; qualsiasi altro errore → comunque mostriamo l'onboarding
        if (alive) setStatus('todo');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'loading') return <Centered />;
  if (status === 'todo') return <Onboarding onDone={() => setStatus('done')} />;
  return <Shell />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Centered />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthedApp />;
}
