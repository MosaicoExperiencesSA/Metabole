import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import { track } from './lib/track';
import { initPush } from './lib/push';
import { useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import StaffApp from './staff/StaffApp';
import TabBar from './components/TabBar';
import MeasuresGate from './components/MeasuresGate';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Diversi from './pages/Diversi';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Percorso from './pages/Percorso';
import Contatti from './pages/Contatti';
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
          <Route path="/percorso" element={<Percorso />} />
          <Route path="/contatti" element={<Contatti />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/obiettivo" element={<Obiettivo />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/negozio" element={<Negozio />} />
          <Route path="/shop" element={<Negozio />} />
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
  const { user } = useAuth();
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

  // Staff (coach, nutrizionista, ecc.): app mobile dedicata smistata per ruolo.
  if (!isClient) {
    return <StaffApp />;
  }

  return (
    <CartProvider>
      {status === 'loading' ? <Centered /> : status === 'todo' ? <Onboarding onDone={() => setStatus('done')} /> : <Shell />}
    </CartProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) initPush(); // registra le push dopo il login (no-op su web)
  }, [user]);

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
