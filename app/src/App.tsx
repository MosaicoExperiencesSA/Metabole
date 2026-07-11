import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import TabBar from './components/TabBar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
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
