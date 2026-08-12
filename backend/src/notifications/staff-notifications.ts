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
const RESP: Role[] = ['sales']; // solo la responsabile coach (sales) riceve gli esiti assegnazione

export const STAFF_NOTIFICATION_TYPES: StaffNotifType[] = [
  // --- Segnalazioni cliente (arrivano sia alla coach sia alla nutrizionista assegnate) ---
  { key: 'escalation_diet_blocked', label: 'Dieta bloccata', description: 'Il motore non riesce a comporre un piano sicuro per una cliente assegnata.', roles: CARE },
  { key: 'escalation_no_progress', label: 'Nessun progresso', description: 'Una cliente assegnata è in stallo da più cicli.', roles: CARE },
  { key: 'escalation_low_adherence', label: 'Bassa aderenza', description: 'Check-in o misure mancanti da parte di una cliente assegnata.', roles: CARE },
  { key: 'escalation_mood_risk', label: 'Umore a rischio', description: 'Umore basso o rischio di abbandono di una cliente assegnata.', roles: CARE },
  { key: 'escalation_clinical', label: 'Segnalazione clinica', description: 'Dato clinico o farmacologico da valutare su una cliente assegnata.', roles: CARE },
  // --- Nutrizionista ---
  { key: 'appointment_created', label: 'Appuntamento fissato', description: 'Nuovo appuntamento/visita in agenda.', roles: NUTRIS },
  { key: 'appointment_reminder', label: 'Promemoria appuntamento', description: 'Promemoria 20 minuti prima di ogni appuntamento.', roles: NUTRIS },
  // §16.7: la cliente prenota e disdice da sola, quindi l'agenda può cambiare senza che il
  // nutrizionista tocchi niente. `appointment_created` esisteva già ed è quello che si usa per la
  // prenotazione; l'annullamento mancava — ed è la notizia più urgente delle due, perché è un'ora
  // che si è liberata.
  { key: 'appointment_cancelled', label: 'Appuntamento annullato', description: 'Una cliente ha annullato la visita: quell\'ora è tornata libera.', roles: NUTRIS },
  { key: 'diet_approved', label: 'Dieta approvata', description: 'Il capo nutrizionista ha approvato una tua dieta.', roles: NUTRIS },
  { key: 'diet_review_requested', label: 'Dieta da approvare', description: 'Un nutrizionista ha inviato una dieta in revisione: va approvata.', roles: ['head_nutritionist'] },
  { key: 'client_assigned_nutritionist', label: 'Nuova cliente assegnata', description: 'Ti è stata assegnata una nuova cliente.', roles: NUTRIS },
  { key: 'pause_request', label: 'Richiesta di pausa (vacanza)', description: 'Una cliente assegnata chiede una pausa più lunga di 20 giorni: va approvata o rifiutata.', roles: CARE },
  // --- Coach ---
  { key: 'lead_assigned', label: 'Lead assegnato', description: 'Ti è stato assegnato un nuovo lead da accettare.', roles: COACHES },
  { key: 'payment_in_structure', label: 'Pagamento nella tua struttura', description: 'Una tua cliente ha effettuato un pagamento.', roles: COACHES },
  { key: 'new_signup_referral', label: 'Nuova registrazione col tuo codice', description: 'Una nuova cliente si è registrata usando il tuo codice.', roles: ['coach', 'nutritionist'] },
  // Richiesta delle coach (8/8): i tre momenti in cui una cliente fa un passo avanti e la coach
  // deve saperlo SUBITO, non scoprirlo aprendo la board. Tutte e tre portano il `clientId` nel
  // payload, quindi dalla notifica si apre la scheda con un tocco.
  { key: 'client_questionnaire_done', label: 'Questionario completato', description: 'Una tua cliente ha completato il questionario: è pronta per la chiamata.', roles: COACHES },
  { key: 'client_trial_started', label: 'Prova attivata', description: 'Una tua cliente ha attivato la settimana di prova.', roles: COACHES },
  { key: 'client_renewed', label: 'Rinnovo', description: 'Una tua cliente ha rinnovato il piano.', roles: COACHES },
  // Richiesta di Simone (12/8). Parte insieme all'invito che Gaia fa alla cliente («parlane con la
  // tua coach»): le due cose sono la stessa cosa vista dai due lati, e se la coach non lo sapesse
  // quell'invito la manderebbe a bussare a una porta chiusa. `CARE` e non solo `COACHES` perché
  // senza coach assegnata l'avviso ripiega sulla nutrizionista, che deve poterlo ricevere.
  { key: 'cambi_frequenti', label: 'Cambia il menu quasi ogni giorno', description: 'Una tua cliente ha cambiato qualcosa nel menu in almeno 3 giorni su 7: forse il tipo di alimentazione non le sta bene.', roles: CARE },
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
