/**
 * Catalogo messaggi (spec sez. 12: multilingua — contenuti e notifiche localizzabili).
 * Ogni voce ha un titolo e una o più VARIANTI di corpo: il composer ne sceglie una
 * in modo deterministico (utente+giorno) per non essere ripetitivo (spec sez. 9).
 * Interpolazione con {parametro}.
 */

export type Locale = 'it' | 'en';

export interface MessageEntry {
  title: string;
  variants: string[];
}

type Catalog = Record<string, MessageEntry>;

const it: Catalog = {
  // ---------- Notifiche cliente ----------
  checkin_reminder: {
    title: 'Come va oggi?',
    variants: [
      'Trenta secondi per il check-in: umore ed energia guidano il tuo piano.',
      'Il check-in di oggi ti aspetta: due tocchi e il piano si adatta a te.',
      'Raccontaci come stai: il tuo piano funziona meglio quando ti ascolta.',
    ],
  },
  measurement_reminder: {
    title: 'Giorno di misure',
    variants: [
      'Peso e centimetri di oggi: bastano due minuti, contano le tendenze.',
      'Oggi tocca alle misure: un piccolo gesto che tiene il percorso sui binari.',
      'Due minuti per le misure: non il singolo numero, è la tendenza che guida.',
    ],
  },
  pre_event_today: {
    title: 'Oggi ti godi l\'evento!',
    variants: [
      'Nessun menu oggi: libertà senza sensi di colpa. Domani si riparte insieme.',
      'Goditi la giornata: oggi nessun vincolo. Da domani si riprende il ritmo.',
    ],
  },
  pre_event_upcoming: {
    title: 'Evento tra {days} giorni',
    variants: [
      'Nei giorni prima alleggeriamo il piano, così arrivi serena.',
      '{days} giorni a "{eventLabel}": il piano si alleggerisce per farti arrivare al meglio.',
    ],
  },
  mini_plan: {
    title: 'Un piccolo aiuto per restare in equilibrio',
    variants: [
      'Il peso è salito di {deviationKg} kg da inizio pausa: ecco un mini-piano leggero per i prossimi giorni, poi si riprende normalmente.',
    ],
  },
  rating_request: {
    title: 'Com\'erano i piatti?',
    variants: [
      'Hai {count} piatti da valutare: i tuoi voti insegnano al menu cosa ti piace.',
      '{count} ricette aspettano il tuo voto: più ci dici cosa ami, meglio mangi.',
    ],
  },
  visit_reminder: {
    title: 'Visita in arrivo',
    variants: [
      'Domani hai la visita con la tua nutrizionista: {when}. Ti aspettiamo!',
      'Promemoria: visita domani, {when}. Porta le tue domande!',
    ],
  },
  progress_cheer: {
    title: 'Le misure parlano chiaro 🎉',
    variants: [
      'Le tue misure sono migliorate: il percorso sta funzionando, continua così!',
      'Progressi registrati! Ogni misura in meno è una promessa mantenuta con te stessa.',
    ],
  },
  /*
   * Peso in aumento. Nato da una segnalazione: chi inseriva un dato in salita non riceveva
   * NIENTE, e il silenzio dopo un gesto faticoso pesa (vedi REGISTRO_Feedback_Clienti.md §3).
   * Regole del testo, decise con la committente e da rispettare in ogni futura variante:
   *  - motivazionale, MAI complimenti ("brava", "ottimo risultato"): non c'è un risultato da
   *    celebrare, e fingerlo è la stessa presa in giro di prima al contrario;
   *  - fattuale sul numero, senza giudizio, senza allarme e senza promesse;
   *  - niente consigli alimentari: qui non si fa clinica, si rimanda alla nutrizionista.
   * Questi testi NON passano dal riformulatore AI (`verbatim`): sono testi approvati.
   */
  progress_support: {
    title: 'Misura registrata',
    variants: [
      'Il peso è salito di {gainKg} kg dall\'ultima misura. Un dato singolo dice poco — sonno, liquidi e sale lo muovono più di quanto faccia il cibo: conta la tendenza delle prossime settimane, e per vederla serve continuare a misurare.',
      'Oggi la bilancia segna {gainKg} kg in più dell\'ultima volta. Averlo registrato lo stesso è la parte utile: il percorso si legge sulle settimane, e se vuoi capirci di più la tua nutrizionista è a un messaggio di distanza.',
    ],
  },
  /* Peso in aumento ma vita in calo: due segnali opposti. Si dicono entrambi, senza
     trasformarli in un complimento — è la cliente, con la nutrizionista, a leggerli. */
  progress_support_waist: {
    title: 'Due numeri che dicono cose diverse',
    variants: [
      'Il peso è salito di {gainKg} kg, ma la vita è scesa di {waistCm} cm. Vanno in direzioni opposte, e sulla forma del corpo la circonferenza racconta spesso più della bilancia: continua a registrare entrambi.',
      'Bilancia in su di {gainKg} kg, vita in giù di {waistCm} cm. Il peso da solo non distingue cosa è cambiato sotto: è tenendo insieme le due misure che si capisce la direzione.',
    ],
  },
  // Messaggio quotidiano del motore: il TONO è deciso dalle regole (mai dall\'AI).
  engine_daily_supportive: {
    title: 'Un passo alla volta',
    variants: [
      'Settimana intensa? Il piano di oggi è pensato per starti accanto, non per chiederti di più.',
      'Oggi contano la costanza e la gentilezza con te stessa: il menu ti viene incontro.',
    ],
  },
  engine_daily_neutral: {
    title: 'Il tuo piano di oggi',
    variants: [
      'Il piano di oggi è pronto: si prosegue con il ritmo attuale.',
      'Tutto confermato per oggi: il percorso continua come previsto.',
    ],
  },
  engine_daily_encouraging: {
    title: 'Si vede il movimento!',
    variants: [
      'I segnali vanno nella direzione giusta: il piano di oggi asseconda la spinta.',
      'Stai costruendo qualcosa: il menu di oggi accompagna i tuoi progressi.',
    ],
  },
  engine_daily_celebratory: {
    title: 'Traguardo in vista! 🎉',
    variants: [
      'Obiettivo sempre più vicino: oggi si festeggia con un piano su misura per il passo successivo.',
      'Che percorso! Il piano di oggi celebra i risultati e prepara il prossimo step.',
    ],
  },
  engine_daily_gentle: {
    title: 'Con calma, insieme',
    variants: [
      'Il piano di oggi rallenta un po\' il ritmo: ascoltare il corpo fa parte del percorso.',
      'Oggi andiamo più piano, ed è la scelta giusta: il tuo team ti segue da vicino.',
    ],
  },
  payment_approved_subscription: {
    title: 'Pagamento confermato! 🎉',
    variants: [
      'Il tuo pagamento è confermato: il percorso è attivo e il menu è in arrivo.',
    ],
  },
  payment_approved_order: {
    title: 'Pagamento confermato! 🎉',
    variants: ['Il tuo pagamento è confermato: l\'ordine è in preparazione.'],
  },
  payment_rejected: {
    title: 'Contabile da ricontrollare',
    variants: [
      'La contabile caricata non è verificabile: {reason}. Puoi caricarne una nuova dall\'app.',
    ],
  },
  chat_reply: {
    title: 'Nuovo messaggio in chat',
    variants: ['Hai una risposta nel tuo thread: apri la chat per leggerla. 💬'],
  },
  // ---------- Notifiche staff ----------
  chat_message_staff: {
    title: 'Nuovo messaggio in chat',
    variants: ['Una tua cliente ti ha scritto: apri la chat per rispondere. 💬'],
  },
  chat_sensitive_alert: {
    title: 'Messaggio sensibile in chat',
    variants: ['Il filtro AI ha rilevato un tema sensibile: apri la chat della cliente appena puoi.'],
  },
  no_checkin_coach_alert: {
    title: 'Cliente silenziosa',
    variants: [
      '{clientName}: nessun check-in da {days} giorni. Un messaggio può riaccendere il percorso.',
    ],
  },
  stall_coach_alert: {
    title: 'Peso in stallo',
    variants: [
      '{clientName}: media mobile ferma da {stallDays} giorni. Il motore ha già adattato il piano: può servire anche la tua voce.',
    ],
  },
  menu_not_followed_coach_alert: {
    title: 'Menu non seguito',
    variants: [
      '{clientName} ha segnato che non ha seguito il menu: un tuo messaggio può aiutarla a rimettersi in carreggiata.',
    ],
  },
  visit_reminder_staff: {
    title: 'Visita in agenda domani',
    variants: ['Domani visita con {clientName}: {when}.'],
  },
  // ---------- Email ----------
  'mail.verify.subject': { title: '', variants: ['Metabole — conferma la tua email'] },
  'mail.verify.body': {
    title: '',
    variants: [
      '<p>Benvenuta/o in Metabole!</p><p>Per confermare il tuo indirizzo email clicca qui: <a href="{link}">conferma email</a></p><p>Oppure usa questo codice nell\'app: <code>{token}</code></p><p>Il link scade tra 48 ore. Se non ti sei registrata/o tu, ignora questa email.</p>',
    ],
  },
  'mail.reset.subject': { title: '', variants: ['Metabole — reimposta la password'] },
  'mail.reset.body': {
    title: '',
    variants: [
      '<p>Hai chiesto di reimpostare la password del tuo account Metabole.</p><p style="margin:20px 0"><a href="{link}" style="display:inline-block;background:#12A386;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:600;font-family:Arial,Helvetica,sans-serif">Reimposta la password</a></p><p style="font-size:13px;color:#5F6E6B">Se il pulsante non funziona, copia questo link nel browser:<br/><a href="{link}">{link}</a></p><p style="font-size:13px;color:#5F6E6B">Il link scade tra 1 ora. Se non l\'hai richiesto tu, ignora questa email: la password resta invariata.</p>',
    ],
  },
  'mail.credentials.subject': { title: '', variants: ['Metabole — le tue credenziali di accesso'] },
  'mail.credentials.body': {
    title: '',
    variants: [
      '<p>Ciao {name},</p><p>Ti abbiamo creato l\'accesso a <strong>Metabole</strong>. Ecco le tue credenziali:</p><p>Email: <strong>{email}</strong><br>Password provvisoria: <code>{password}</code></p><p>Accedi dall\'app: <a href="{link}">{link}</a></p>{storeButtons}<p>Al primo accesso completerai un breve questionario e poi potrai impostare una tua password personale.</p><p>A presto!</p>',
    ],
  },
  'mail.bank.subject': { title: '', variants: ['Metabole — estremi per il bonifico ({description})'] },
  'mail.bank.body': {
    title: '',
    variants: [
      '<p>Grazie per il tuo acquisto: <strong>{description}</strong>.</p><p>Importo: <strong>€ {amount}</strong></p><p>Estremi per il bonifico:</p><pre style="background:#f4f6f5;padding:12px;border-radius:8px">{bankDetails}</pre><p>Causale da indicare: <strong>{reference}</strong></p><p>Appena effettuato il bonifico, carica la contabile nell\'app: un nostro operatore la verificherà e il tuo percorso si attiverà subito dopo l\'approvazione.</p>',
    ],
  },
  'mail.receipt.subject': { title: '', variants: ['Metabole — ricevuta di pagamento'] },
  'mail.receipt.body': {
    title: '',
    variants: [
      '<p>Il tuo pagamento è stato confermato. 🎉</p><table style="border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0"><strong>Descrizione</strong></td><td>{description}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Importo</strong></td><td>€ {amount}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Data</strong></td><td>{date}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Riferimento</strong></td><td>{paymentId}</td></tr></table><p>Conserva questa email come ricevuta. Il tuo percorso è attivo: ti aspettiamo nell\'app!</p>',
    ],
  },
  'mail.refund.subject': { title: '', variants: ['Metabole — ricevuta di rimborso'] },
  'mail.refund.body': {
    title: '',
    variants: [
      '<p>Ti confermiamo lo storno del tuo acquisto.</p><table style="border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0"><strong>Descrizione</strong></td><td>{description}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Importo rimborsato</strong></td><td>€ {amount}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Data</strong></td><td>{date}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Riferimento</strong></td><td>{paymentId}</td></tr></table><p>Il riaccredito segue i tempi del metodo di pagamento originale. In allegato trovi la ricevuta di rimborso.</p>',
    ],
  },
  'mail.notification.subject': { title: '', variants: ['Metabole — {title}'] },
  'mail.notification.body': {
    title: '',
    variants: ['<p><strong>{title}</strong></p><p>{body}</p><p style="color:#667">Ricevi questa email perché hai attivato le notifiche via email nelle preferenze. Puoi disattivarle in qualsiasi momento dall\'app.</p>'],
  },
  // ---------- Etichette ----------
  'label.days_always': { title: '', variants: ['sempre'] },
  'label.days_count': { title: '', variants: ['{days} giorni'] },
};

const en: Catalog = {
  checkin_reminder: {
    title: 'How are you today?',
    variants: [
      'Thirty seconds for your check-in: mood and energy steer your plan.',
      'Today\'s check-in is waiting: two taps and the plan adapts to you.',
      'Tell us how you feel: your plan works best when it listens to you.',
    ],
  },
  measurement_reminder: {
    title: 'Measurement day',
    variants: [
      'Today\'s weight and centimetres: two minutes, trends are what matter.',
      'Time for your measurements: a small habit that keeps the journey on track.',
      'Two minutes for measurements: it\'s the trend that guides, not the single number.',
    ],
  },
  pre_event_today: {
    title: 'Enjoy your event today!',
    variants: [
      'No menu today: freedom without guilt. Tomorrow we start again together.',
      'Enjoy the day: no rules today. Back on rhythm from tomorrow.',
    ],
  },
  pre_event_upcoming: {
    title: 'Event in {days} days',
    variants: [
      'In the days before we lighten the plan, so you arrive feeling great.',
      '{days} days to "{eventLabel}": the plan gets lighter so you arrive at your best.',
    ],
  },
  mini_plan: {
    title: 'A little help to stay balanced',
    variants: [
      'Weight is up {deviationKg} kg since your break started: here\'s a light mini-plan for the next few days, then back to normal.',
    ],
  },
  rating_request: {
    title: 'How were your meals?',
    variants: [
      'You have {count} dishes to rate: your votes teach the menu what you love.',
      '{count} recipes are waiting for your rating: the more you tell us, the better you eat.',
    ],
  },
  visit_reminder: {
    title: 'Upcoming visit',
    variants: [
      'Tomorrow you have your visit with your nutritionist: {when}. See you there!',
      'Reminder: visit tomorrow, {when}. Bring your questions!',
    ],
  },
  progress_cheer: {
    title: 'Your measurements speak volumes 🎉',
    variants: [
      'Your measurements have improved: the journey is working, keep going!',
      'Progress recorded! Every centimetre down is a promise kept to yourself.',
    ],
  },
  /* Same rules as the Italian entries: motivating, never congratulatory, factual, no advice. */
  progress_support: {
    title: 'Measurement saved',
    variants: [
      'Your weight is up {gainKg} kg since the last measurement. A single reading says little — sleep, fluids and salt move it more than food does: what counts is the trend over the coming weeks, and seeing it means carrying on measuring.',
      'The scale reads {gainKg} kg more than last time. Logging it anyway is the useful part: the journey shows up over weeks, and if you want to make sense of it your nutritionist is one message away.',
    ],
  },
  progress_support_waist: {
    title: 'Two numbers pointing different ways',
    variants: [
      'Your weight is up {gainKg} kg, but your waist is down {waistCm} cm. They point in opposite directions, and on body shape the tape often tells more than the scale: keep recording both.',
      'Scale up {gainKg} kg, waist down {waistCm} cm. Weight alone can\'t tell what changed underneath: it\'s the two measurements together that show the direction.',
    ],
  },
  engine_daily_supportive: {
    title: 'One step at a time',
    variants: [
      'Busy week? Today\'s plan is here to support you, not to ask for more.',
      'Today consistency and self-kindness matter most: the menu meets you halfway.',
    ],
  },
  engine_daily_neutral: {
    title: 'Your plan for today',
    variants: [
      'Today\'s plan is ready: we continue at the current pace.',
      'All confirmed for today: the journey continues as planned.',
    ],
  },
  engine_daily_encouraging: {
    title: 'Things are moving!',
    variants: [
      'Your signals point the right way: today\'s plan rides the momentum.',
      'You\'re building something: today\'s menu supports your progress.',
    ],
  },
  engine_daily_celebratory: {
    title: 'Goal in sight! 🎉',
    variants: [
      'Your goal is closer and closer: today we celebrate with a plan tailored to the next step.',
      'What a journey! Today\'s plan celebrates your results and sets up the next step.',
    ],
  },
  engine_daily_gentle: {
    title: 'Gently, together',
    variants: [
      'Today\'s plan slows the pace a little: listening to your body is part of the journey.',
      'We take it easier today, and that\'s the right call: your team is close by.',
    ],
  },
  payment_approved_subscription: {
    title: 'Payment confirmed! 🎉',
    variants: ['Your payment is confirmed: your journey is active and the menu is on its way.'],
  },
  payment_approved_order: {
    title: 'Payment confirmed! 🎉',
    variants: ['Your payment is confirmed: your order is being prepared.'],
  },
  payment_rejected: {
    title: 'Receipt needs another look',
    variants: [
      'The uploaded receipt could not be verified: {reason}. You can upload a new one from the app.',
    ],
  },
  chat_reply: {
    title: 'New chat message',
    variants: ['You have a reply in your thread: open the chat to read it. 💬'],
  },
  chat_message_staff: {
    title: 'New chat message',
    variants: ['One of your clients wrote to you: open the chat to reply. 💬'],
  },
  chat_sensitive_alert: {
    title: 'Sensitive message in chat',
    variants: ['The AI filter detected a sensitive topic: open the client\'s chat as soon as you can.'],
  },
  no_checkin_coach_alert: {
    title: 'Quiet client',
    variants: ['{clientName}: no check-in for {days} days. A message can reignite the journey.'],
  },
  stall_coach_alert: {
    title: 'Weight plateau',
    variants: [
      '{clientName}: moving average flat for {stallDays} days. The engine has already adjusted the plan: your voice can help too.',
    ],
  },
  menu_not_followed_coach_alert: {
    title: 'Menu not followed',
    variants: [
      '{clientName} marked the menu as not followed: a message from you can help her get back on track.',
    ],
  },
  visit_reminder_staff: {
    title: 'Visit scheduled tomorrow',
    variants: ['Tomorrow: visit with {clientName}, {when}.'],
  },
  'mail.verify.subject': { title: '', variants: ['Metabole — confirm your email'] },
  'mail.verify.body': {
    title: '',
    variants: [
      '<p>Welcome to Metabole!</p><p>To confirm your email address click here: <a href="{link}">confirm email</a></p><p>Or use this code in the app: <code>{token}</code></p><p>The link expires in 48 hours. If you didn\'t sign up, please ignore this email.</p>',
    ],
  },
  'mail.reset.subject': { title: '', variants: ['Metabole — reset your password'] },
  'mail.reset.body': {
    title: '',
    variants: [
      '<p>You asked to reset your Metabole account password.</p><p style="margin:20px 0"><a href="{link}" style="display:inline-block;background:#12A386;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:600;font-family:Arial,Helvetica,sans-serif">Reset your password</a></p><p style="font-size:13px;color:#5F6E6B">If the button doesn\'t work, copy this link into your browser:<br/><a href="{link}">{link}</a></p><p style="font-size:13px;color:#5F6E6B">The link expires in 1 hour. If you didn\'t request it, ignore this email: your password stays unchanged.</p>',
    ],
  },
  /* Mancavano: una cliente con locale 'en' riceveva in italiano proprio la mail delle
     credenziali, cioè la prima che legge. Il test di completezza del catalogo era rosso
     da prima di questo lavoro e lo segnalava. */
  'mail.credentials.subject': { title: '', variants: ['Metabole — your login details'] },
  'mail.credentials.body': {
    title: '',
    variants: [
      '<p>Hi {name},</p><p>We\'ve created your <strong>Metabole</strong> account. Here are your login details:</p><p>Email: <strong>{email}</strong><br>Temporary password: <code>{password}</code></p><p>Sign in from the app: <a href="{link}">{link}</a></p>{storeButtons}<p>On your first sign-in you\'ll fill in a short questionnaire, then you can set a password of your own.</p><p>See you soon!</p>',
    ],
  },
  'mail.bank.subject': { title: '', variants: ['Metabole — bank transfer details ({description})'] },
  'mail.bank.body': {
    title: '',
    variants: [
      '<p>Thank you for your purchase: <strong>{description}</strong>.</p><p>Amount: <strong>€ {amount}</strong></p><p>Bank transfer details:</p><pre style="background:#f4f6f5;padding:12px;border-radius:8px">{bankDetails}</pre><p>Payment reference: <strong>{reference}</strong></p><p>Once you\'ve made the transfer, upload the receipt in the app: an operator will verify it and your journey will activate right after approval.</p>',
    ],
  },
  'mail.receipt.subject': { title: '', variants: ['Metabole — payment receipt'] },
  'mail.receipt.body': {
    title: '',
    variants: [
      '<p>Your payment has been confirmed. 🎉</p><table style="border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0"><strong>Description</strong></td><td>{description}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Amount</strong></td><td>€ {amount}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Date</strong></td><td>{date}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Reference</strong></td><td>{paymentId}</td></tr></table><p>Keep this email as your receipt. Your journey is active: see you in the app!</p>',
    ],
  },
  'mail.refund.subject': { title: '', variants: ['Metabole — refund receipt'] },
  'mail.refund.body': {
    title: '',
    variants: [
      '<p>We confirm the refund of your purchase.</p><table style="border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0"><strong>Description</strong></td><td>{description}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Refunded amount</strong></td><td>€ {amount}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Date</strong></td><td>{date}</td></tr><tr><td style="padding:4px 12px 4px 0"><strong>Reference</strong></td><td>{paymentId}</td></tr></table><p>The credit follows the timing of your original payment method. The refund receipt is attached.</p>',
    ],
  },
  'mail.notification.subject': { title: '', variants: ['Metabole — {title}'] },
  'mail.notification.body': {
    title: '',
    variants: ['<p><strong>{title}</strong></p><p>{body}</p><p style="color:#667">You receive this email because you enabled email notifications in your preferences. You can turn them off anytime from the app.</p>'],
  },
  'label.days_always': { title: '', variants: ['ever'] },
  'label.days_count': { title: '', variants: ['{days} days'] },
};

export const CATALOGS: Record<Locale, Catalog> = { it, en };
