import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api/client';
import { track } from './lib/track';
import { alToccoDellaNotifica, initPush } from './lib/push';
import { rottaClienteDaNotifica, rottaDaNotifica } from './lib/rottaNotifica';
import { COACH_ROLES, NUTRI_ROLES } from './staff/tabs';
import { useAuth } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import StaffApp from './staff/StaffApp';
import TabBar from './components/TabBar';
import MeasuresGate from './components/MeasuresGate';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import { PrivacyCosaCancelliamo, PrivacySospendi } from './pages/PrivacyCancellazione';
import ResetPassword from './pages/ResetPassword';
import Diversi from './pages/Diversi';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Percorso from './pages/Percorso';
import Report from './pages/Report';
import Preferenze from './pages/Preferenze';
import Contatti from './pages/Contatti';
import Calendario from './pages/Calendario';
import Obiettivo from './pages/Obiettivo';
import Assistente from './pages/Assistente';
import Negozio from './pages/Negozio';
import Profilo from './pages/Profilo';
import Checkout from './pages/Checkout';
import Onboarding from './pages/Onboarding';
import SetPassword from './pages/SetPassword';
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

/**
 * La barra di «Entra come», in cima a tutto.
 *
 * Chi sta guardando l'account di un'altra persona deve vederlo in ogni momento, non solo quando è
 * entrato: una scheda del browser lasciata aperta assomiglia a qualsiasi altra, e da lì a credere
 * di stare guardando i propri dati è un attimo. Dice anche che è a termine, così la scadenza non
 * sembra un guasto.
 */
function BarraOspite({ email }: { email: string | null | undefined }) {
  return (
    <div
      style={{
        background: '#C96E45', color: '#fff', padding: '8px 14px', fontSize: 12.5, lineHeight: 1.45,
        textAlign: 'center', position: 'sticky', top: 0, zIndex: 60,
      }}
    >
      Stai guardando l'account di <b>{email ?? 'questa cliente'}</b> — <b>sola lettura</b>, e la
      sessione si chiude da sola dopo 30 minuti.
    </div>
  );
}

/** Guscio autenticato: schermata + tab bar in basso. */
function Shell() {
  const location = useLocation();
  const { user, ospite } = useAuth();
  useEffect(() => {
    track('screen_view', { path: location.pathname }, { phase: 'app', screen: location.pathname });
  }, [location.pathname]);
  return (
    <div className="app-frame">
      {ospite && <BarraOspite email={user?.email} />}
      <div className="screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/percorso" element={<Percorso />} />
          <Route path="/report" element={<Report />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/contatti" element={<Contatti />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/obiettivo" element={<Obiettivo />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/negozio" element={<Negozio />} />
          <Route path="/shop" element={<Negozio />} />
          <Route path="/profilo" element={<Profilo />} />
          <Route path="/conferma-email" element={<ConfermaEmail />} />
          <Route path="/verifica-email" element={<VerificaEmail />} />
          {/* La riga era doppia (e con l'indentazione sbagliata): la seconda non serviva a niente. */}
          <Route path="/preferenze" element={<Preferenze />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/success" element={<PaymentResult ok />} />
          <Route path="/payment/cancelled" element={<PaymentResult ok={false} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Le due pagine della cancellazione stanno in ENTRAMBI gli alberi di rotte, dentro e
              fuori dal login: chi clicca il pulsante della mail può essere già entrata (e allora
              deve funzionare senza buttarla fuori) oppure aver disinstallato l'app, che è il caso
              più probabile dato che sta andando via. Il token vale da solo, la sessione non serve. */}
          <Route path="/privacy/sospendi" element={<PrivacySospendi />} />
          <Route path="/privacy/cancellazione" element={<PrivacyCosaCancelliamo />} />
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
  // Account provvisori (lead da backoffice): dopo il questionario si impone di
  // impostare una password personale. Vale anche per un utente con onboarding già
  // fatto a cui l'admin ha resettato la password (mustChangePassword=true).
  const [pwDone, setPwDone] = useState(false);
  const needsPassword = !!user?.mustChangePassword && !pwDone;

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
      {status === 'loading'
        ? <Centered />
        : status === 'todo'
          ? <Onboarding onDone={() => setStatus('done')} />
          : needsPassword
            ? <SetPassword onDone={() => setPwDone(true)} />
            : <Shell />}
    </CartProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) initPush(); // registra le push dopo il login (no-op su web)
  }, [user]);

  /**
   * ⚠️ DOVE PORTA IL TOCCO SULLA PUSH — e perché si decide QUI e non nel server.
   *
   * La stessa notizia ha rotte diverse a seconda di chi la riceve: la scheda di una cliente è
   * `/clienti/:id` per la coach e `/pazienti/:id` per la nutrizionista, e la cliente non naviga
   * affatto per conversazione (ha una chat sola, con le linguette). Il ruolo lo sappiamo qui, le
   * rotte pure: il server manda i fatti (`dati-push.ts`) e l'indirizzo lo compone l'app.
   */
  useEffect(() => {
    if (!user) return;
    alToccoDellaNotifica((dati) => {
      const ruolo = user.role;
      const dove = COACH_ROLES.has(ruolo)
        ? rottaDaNotifica(dati, '/clienti')
        : NUTRI_ROLES.has(ruolo)
          ? rottaDaNotifica(dati, '/pazienti')
          : rottaClienteDaNotifica(dati);
      if (dove) nav(dove);
    });
  }, [user, nav]);

  if (loading) return <Centered />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/diversi" element={<Diversi />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/conferma-email" element={<ConfermaEmail />} />
        <Route path="/verifica-email" element={<VerificaEmail />} />
        <Route path="/privacy/sospendi" element={<PrivacySospendi />} />
        <Route path="/privacy/cancellazione" element={<PrivacyCosaCancelliamo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return <AuthedApp />;
}
