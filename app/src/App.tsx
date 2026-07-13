import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import { track } from './lib/track';
import { useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import TabBar from './components/TabBar';
import MeasuresGate from './components/MeasuresGate';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Diversi from './pages/Diversi';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Calendario from './pages/Calendario';
import Obiettivo from './pages/Obiettivo';
import Assistente from './pages/Assistente';
import Negozio from './pages/Negozio';
import Profilo from './pages/Profilo';
import Checkout from './pages/Checkout';
import Onboarding from './pages/Onboarding';
import PaymentResult from './pages/PaymentResult';
import ConfermaEmail from './pages/ConfermaEmail';
import VerificaEmail from './pages/VerificaEmail';

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
  const location = useLocation();
  useEffect(() => {
    track('screen_view', { path: location.pathname }, { phase: 'app', screen: location.pathname });
  }, [location.pathname]);
  return (
    <div className="app-frame">
      <div className="screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/obiettivo" element={<Obiettivo />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/negozio" element={<Negozio />} />
          <Route path="/profilo" element={<Profilo />} />
          <Route path="/conferma-email" element={<ConfermaEmail />} />
          <Route path="/verifica-email" element={<VerificaEmail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/success" element={<PaymentResult ok />} />
          <Route path="/payment/cancelled" element={<PaymentResult ok={false} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
      <MeasuresGate />
    </div>
  );
}

/** Area autenticata: controlla se l'onboarding è stato completato. */
function AuthedApp() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<'loading' | 'todo' | 'done'>('loading');

  // L'app cliente è riservata alle clienti: le rotte /onboarding sono @Roles('client').
  const isClient = !user?.role || user.role === 'client';

  useEffect(() => {
    if (!isClient) return; // niente chiamate client con un account staff
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
  }, [isClient]);

  if (!isClient) {
    return (
      <div className="app-frame">
        <div className="onb-body" style={{ textAlign: 'center', paddingTop: 40 }}>
          <span className="big-badge" style={{ background: '#F3E8DC', color: '#B8863B', margin: '0 auto 14px' }}><i className="ti ti-briefcase" /></span>
          <h1>Account staff</h1>
          <p className="muted">
            Questo è un account dello staff ({user?.role}). L'app è riservata alle clienti;
            per la gestione usa il backoffice su backoffice.metabole.eu.
          </p>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => logout()}>Esci</button>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      {status === 'loading' ? <Centered /> : status === 'todo' ? <Onboarding onDone={() => setStatus('done')} /> : <Shell />}
    </CartProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Centered />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/diversi" element={<Diversi />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/conferma-email" element={<ConfermaEmail />} />
        <Route path="/verifica-email" element={<VerificaEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return <AuthedApp />;
}
