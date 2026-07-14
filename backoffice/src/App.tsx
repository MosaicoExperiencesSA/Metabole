import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Home } from './pages/Home';
import { Posta } from './pages/Posta';
import { Login } from './pages/Login';
import { CambioPasswordObbligatorio } from './pages/CambioPasswordObbligatorio';
import { Placeholder } from './pages/Placeholder';
import { Acquisti } from './pages/Acquisti';
import { BuoniSconto } from './pages/BuoniSconto';
import { Calendar } from './pages/Calendar';
import { ClientDetail } from './pages/ClientDetail';
import { Clienti } from './pages/Clienti';
import { Compensi } from './pages/Compensi';
import { Diete } from './pages/Diete';
import { Testimonianze } from './pages/Testimonianze';
import { GruppiEquivalenza } from './pages/GruppiEquivalenza';
import { Publisher } from './pages/Publisher';
import { Ricette } from './pages/Ricette';
import { TagAllergeni } from './pages/TagAllergeni';
import { GestioneNegozio } from './pages/GestioneNegozio';
import { Protocolli } from './pages/Protocolli';
import { Agenda } from './pages/Agenda';
import { Segnalazioni } from './pages/Segnalazioni';
import { Chat } from './pages/Chat';
import { LeadDaAccettare } from './pages/LeadDaAccettare';
import { LeadDetail } from './pages/LeadDetail';
import { ImportaLead } from './pages/ImportaLead';
import { LeadForm } from './pages/LeadForm';
import { LeadsTable } from './pages/LeadsTable';
import { LogAttivita } from './pages/LogAttivita';
import { LogEmail } from './pages/LogEmail';
import { ModelliEmail } from './pages/ModelliEmail';
import { GraficaPdf } from './pages/GraficaPdf';
import { Grafici } from './pages/Grafici';
import { Impostazioni } from './pages/Impostazioni';
import { Prelievi } from './pages/Prelievi';
import { Parametri } from './pages/Parametri';
import { Payments } from './pages/Payments';
import { Contabilita } from './pages/Contabilita';
import { Permissions } from './pages/Permissions';
import { Pipeline } from './pages/Pipeline';
import { Provvigioni } from './pages/Provvigioni';
import { Roles } from './pages/Roles';
import { Users } from './pages/Users';
import type { ReactNode } from 'react';

/** Rotta protetta: richiede login; opzionalmente un permesso di sezione. */
function Protected({ title, pageKey, children }: { title: string; pageKey?: string; children: ReactNode }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // Account creato dall'admin con password provvisoria: blocca tutto finché non la cambia.
  if (user.mustChangePassword) return <CambioPasswordObbligatorio />;
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

      <Route path="/" element={<Protected title="Home" pageKey="dashboard"><Home /></Protected>} />
      <Route path="/posta" element={<Protected title="Posta" pageKey="posta"><Posta /></Protected>} />
      <Route path="/utenti" element={<Protected title="Utenti" pageKey="users"><Users /></Protected>} />
      <Route path="/ruoli" element={<Protected title="Ruoli" pageKey="permissions"><Roles /></Protected>} />
      <Route path="/permessi" element={<Protected title="Permessi" pageKey="permissions"><Permissions /></Protected>} />

      {/* Percorso cliente e CRM */}
      <Route path="/clienti" element={<Protected title="Clienti" pageKey="clients"><Clienti /></Protected>} />
      <Route path="/clienti/:id" element={<Protected title="Scheda cliente" pageKey="clients"><ClientDetail /></Protected>} />
      <Route path="/crm" element={<Navigate to="/crm/gestione" replace />} />
      <Route path="/crm/gestione" element={<Protected title="Gestione lead" pageKey="crm_leads"><LeadsTable /></Protected>} />
      <Route path="/crm/lead/:id" element={<Protected title="Scheda lead" pageKey="crm_leads"><LeadDetail /></Protected>} />
      <Route path="/crm/inserimento" element={<Protected title="Inserimento lead" pageKey="crm_leads"><LeadForm /></Protected>} />
      <Route path="/crm/import" element={<Protected title="Import liste" pageKey="crm_leads"><ImportaLead /></Protected>} />
      <Route path="/crm/pipeline" element={<Protected title="Pipeline" pageKey="crm_leads"><Pipeline /></Protected>} />
      <Route path="/crm/calendario" element={<Protected title="Calendario CRM" pageKey="crm_leads"><Calendar /></Protected>} />
      <Route path="/crm/da-accettare" element={<Protected title="Lead da accettare" pageKey="lead_acceptance"><LeadDaAccettare /></Protected>} />
      <Route path="/agenda" element={<Protected title="Agenda visite" pageKey="visits_agenda"><Agenda /></Protected>} />
      <Route path="/segnalazioni" element={<Protected title="Segnalazioni" pageKey="escalations"><Segnalazioni /></Protected>} />
      <Route path="/chat" element={<Protected title="Chat" pageKey="chat"><Chat /></Protected>} />
      <Route path="/negozio" element={<Protected title="Negozio" pageKey="shop"><GestioneNegozio /></Protected>} />
      <Route path="/acquisti" element={<Protected title="Acquisti" pageKey="purchases"><Acquisti /></Protected>} />
      <Route path="/buoni-sconto" element={<Protected title="Buoni sconto" pageKey="discounts"><BuoniSconto /></Protected>} />
      <Route path="/pagamenti" element={<Protected title="Bonifici & contabilità" pageKey="accounting"><Payments /></Protected>} />
      <Route path="/contabilita" element={<Protected title="Contabilità" pageKey="accounting_costs"><Contabilita /></Protected>} />
      <Route path="/marketing" element={<Protected title="Marketing" pageKey="marketing"><Placeholder title="Reparto Marketing" icon="ti-speakerphone" note="Campagne, segmenti, KPI e gestione consensi. Il modulo marketing è in arrivo; il ruolo e i permessi sono già attivi." /></Protected>} />
      <Route path="/testimonianze" element={<Protected title="Testimonianze" pageKey="marketing"><Testimonianze /></Protected>} />
      <Route path="/publisher" element={<Protected title="Publisher social" pageKey="marketing"><Publisher /></Protected>} />
      <Route path="/provvigioni" element={<Protected title="Provvigioni" pageKey="commissions"><Provvigioni /></Protected>} />
      <Route path="/compensi" element={<Protected title="Compensi staff" pageKey="compensation"><Compensi /></Protected>} />
      <Route path="/diete" element={<Protected title="Catalogo diete" pageKey="diets_catalog"><Diete /></Protected>} />
      <Route path="/ricette" element={<Protected title="Catalogo ricette" pageKey="recipes"><Ricette /></Protected>} />
      <Route path="/tag-allergeni" element={<Protected title="Allergeni ricette" pageKey="recipes"><TagAllergeni /></Protected>} />
      <Route path="/gruppi-equivalenza" element={<Protected title="Gruppi di equivalenza" pageKey="diets_catalog"><GruppiEquivalenza /></Protected>} />
      <Route path="/protocolli" element={<Protected title="Protocolli motore" pageKey="engine_protocols"><Protocolli /></Protected>} />
      <Route path="/parametri" element={<Protected title="Parametri" pageKey="engine_config"><Parametri /></Protected>} />
      <Route path="/log" element={<Protected title="Log attività" pageKey="audit_logs"><LogAttivita /></Protected>} />
      <Route path="/email-modelli" element={<Protected title="Modelli email" pageKey="email_templates"><ModelliEmail /></Protected>} />
      <Route path="/email-log" element={<Protected title="Log email" pageKey="email_log"><LogEmail /></Protected>} />
      <Route path="/grafica-pdf" element={<Protected title="Grafica PDF" pageKey="pdf_templates"><GraficaPdf /></Protected>} />
      <Route path="/grafici" element={<Protected title="Grafici" pageKey="charts"><Grafici /></Protected>} />
      <Route path="/impostazioni" element={<Protected title="Impostazioni"><Impostazioni /></Protected>} />
      <Route path="/prelievi" element={<Protected title="Richieste di prelievo" pageKey="withdrawals"><Prelievi /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
