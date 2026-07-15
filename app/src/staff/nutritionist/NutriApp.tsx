import { Navigate, Route, Routes } from 'react-router-dom';
import Guadagni from '../shared/Guadagni';
import Notifiche from '../shared/Notifiche';
import Profilo from '../shared/Profilo';
import { NUTRI_TABS } from '../tabs';
import NutriDashboard from './NutriDashboard';
import NutriPazienti from './NutriPazienti';
import NutriPazienteDetail from './NutriPazienteDetail';
import NutriDiete from './NutriDiete';
import NutriAgenda from './NutriAgenda';
import { CoachChatList, CoachChatThread } from '../coach/CoachChat';

export default function NutriApp() {
  return (
    <Routes>
      <Route path="/" element={<NutriDashboard />} />
      <Route path="/pazienti" element={<NutriPazienti />} />
      <Route path="/pazienti/:id" element={<NutriPazienteDetail />} />
      <Route path="/diete" element={<NutriDiete />} />
      <Route path="/agenda" element={<NutriAgenda />} />
      <Route path="/chat" element={<CoachChatList tabs={NUTRI_TABS} />} />
      <Route path="/chat/:threadId" element={<CoachChatThread tabs={NUTRI_TABS} />} />
      <Route path="/guadagni" element={<Guadagni tabs={NUTRI_TABS} />} />
      <Route path="/notifiche" element={<Notifiche tabs={NUTRI_TABS} />} />
      <Route path="/profilo" element={<Profilo tabs={NUTRI_TABS} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
