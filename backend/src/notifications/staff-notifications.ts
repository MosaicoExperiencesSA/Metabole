import { Role } from '../common/roles';
import { EscalationCategory } from '../escalations/escalation-routing';

/**
 * Catalogo delle notifiche per i ruoli tecnici (staff). È l'unica fonte di verità
 * per: (a) le etichette mostrate nella campanella/lista, (b) la tabella di
 * attivazione/disattivazione nel profilo, (c) il filtro opt-out in notify().
 *
 * L'opt-out per tipo dello staff vive in `User.prefs.notificationsDisabled`
 * (array di `key`). Le clienti hanno un sistema separato (clientProfile.notificationPrefs).
 */
export interface StaffNotifType {
  key: string;
  label: string;
  description: string;
  /** Ruoli che possono ricevere/gestire questo alert (per la tabella profilo). */
  roles: Role[];
}

const COACHES: Role[] = ['coach'];
const NUTRIS: Role[] = ['nutritionist', 'head_nutritionist'];
const CARE: Role[] = ['coach', 'nutritionist', 'head_nutritionist'];
const RESP: Role[] = ['sales', 'coach']; // responsabile coach (sales) + coach che assegnano

export const STAFF_NOTIFICATION_TYPES: StaffNotifType[] = [
  // --- Segnalazioni cliente (arrivano sia alla coach sia alla nutrizionista assegnate) ---
  { key: 'escalation_diet_blocked', label: 'Dieta bloccata', description: 'Il motore non riesce a comporre un piano sicuro per una cliente assegnata.', roles: CARE },
  { key: 'escalation_no_progress', label: 'Nessun progresso', description: 'Una cliente assegnata è in stallo da più cicli.', roles: CARE },
  { key: 'escalation_low_adherence', label: 'Bassa aderenza', description: 'Check-in o misure mancanti da parte di una cliente assegnata.', roles: CARE },
  { key: 'escalation_mood_risk', label: 'Umore a rischio', description: 'Umore basso o rischio di abbandono di una cliente assegnata.', roles: CARE },
  { key: 'escalation_clinical', label: 'Segnalazione clinica', description: 'Dato clinico o farmacologico da valutare su una cliente assegnata.', roles: CARE },
  // --- Nutrizionista ---
  { key: 'appointment_created', label: 'Appuntamento fissato', description: 'Nuovo appuntamento/visita in agenda.', roles: NUTRIS },
  { key: 'appointment_reminder', label: 'Promemoria appuntamento', description: 'Promemoria 30 minuti prima di ogni appuntamento.', roles: NUTRIS },
  { key: 'diet_approved', label: 'Dieta approvata', description: 'Il capo nutrizionista ha approvato una tua dieta.', roles: NUTRIS },
  { key: 'client_assigned_nutritionist', label: 'Nuova cliente assegnata', description: 'Ti è stata assegnata una nuova cliente.', roles: NUTRIS },
  // --- Coach ---
  { key: 'lead_assigned', label: 'Lead assegnato', description: 'Ti è stato assegnato un nuovo lead da accettare.', roles: COACHES },
  { key: 'payment_in_structure', label: 'Pagamento nella tua struttura', description: 'Una tua cliente ha effettuato un pagamento.', roles: COACHES },
  { key: 'new_signup_referral', label: 'Nuova registrazione col tuo codice', description: 'Una nuova cliente si è registrata usando il tuo codice.', roles: ['coach', 'nutritionist'] },
  // --- Responsabile coach (assegnazioni lead) ---
  { key: 'lead_accepted', label: 'Lead accettato', description: 'Una coach ha accettato un lead che le hai assegnato.', roles: RESP },
  { key: 'lead_rejected', label: 'Lead rifiutato', description: 'Una coach ha rifiutato un lead: va riassegnato.', roles: RESP },
  { key: 'lead_assignment_expired', label: 'Lead non accettato in tempo', description: 'Un lead assegnato non è stato accettato entro i termini: va riassegnato.', roles: RESP },
];

/** Tipi disponibili per un ruolo (per la tabella nel profilo). */
export function staffTypesForRole(role: Role): StaffNotifType[] {
  return STAFF_NOTIFICATION_TYPES.filter((t) => t.roles.includes(role));
}

/** Mappa categoria segnalazione → tipo notifica + testo. */
export const ESCALATION_NOTIF: Record<EscalationCategory, { type: string; title: string }> = {
  diet_blocked: { type: 'escalation_diet_blocked', title: 'Dieta bloccata' },
  no_progress: { type: 'escalation_no_progress', title: 'Nessun progresso' },
  low_adherence: { type: 'escalation_low_adherence', title: 'Bassa aderenza' },
  mood_risk: { type: 'escalation_mood_risk', title: 'Umore a rischio' },
  clinical: { type: 'escalation_clinical', title: 'Segnalazione clinica' },
  other: { type: 'escalation_other', title: 'Segnalazione' },
};
