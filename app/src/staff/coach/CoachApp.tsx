import { Navigate, Route, Routes } from 'react-router-dom';
import Guadagni from '../shared/Guadagni';
import Notifiche from '../shared/Notifiche';
import Profilo from '../shared/Profilo';
import { COACH_TABS } from '../tabs';
import CoachDashboard from './CoachDashboard';
import CoachClienti from './CoachClienti';
import CoachClienteDetail from './CoachClienteDetail';
import CoachAlert from './CoachAlert';
import { CoachChatList, CoachChatThread } from './CoachChat';
import CoachAgenda from './CoachAgenda';

export default function CoachApp() {
  return (
    <Routes>
      <Route path="/" element={<CoachDashboard />} />
      <Route path="/clienti" element={<CoachClienti />} />
      <Route path="/clienti/:id" element={<CoachClienteDetail />} />
      <Route path="/alert" element={<CoachAlert />} />
      <Route path="/chat" element={<CoachChatList />} />
      <Route path="/chat/:threadId" element={<CoachChatThread />} />
      <Route path="/agenda" element={<CoachAgenda />} />
      <Route path="/guadagni" element={<Guadagni tabs={COACH_TABS} />} />
      <Route path="/notifiche" element={<Notifiche tabs={COACH_TABS} />} />
      <Route path="/profilo" element={<Profilo tabs={COACH_TABS} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
