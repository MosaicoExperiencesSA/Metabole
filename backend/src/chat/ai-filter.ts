/**
 * Assistente AI di primo filtro — DETERMINISTICO (spec sez. 5: «L'assistente AI fa da primo filtro:
 * FAQ → instrada a coach/nutrizionista; temi sensibili → escalation»).
 *
 * Puro e testabile: testo → classificazione. Nessuna chiamata di rete, quindi decide sempre allo stesso
 * modo — ed è il motivo per cui i temi sensibili passano da qui e non dal modello.
 *
 * L'AI generativa **c'è** (`ai.service.assistantReply`, con la banca dati nutrizionale a fare da
 * ancora e `guardia-risposta-ai.ts` a controllare l'uscita): questo filtro non è più «in attesa di
 * M10», è il primo dei due strati. Il commento precedente diceva che sarebbe arrivata, e leggendolo si
 * concludeva che in chat non ci fosse un modello.
 */

export type FilterResult =
  | { kind: 'sensitive'; reason: string; reply: string; target: 'coach' | 'nutritionist' }
  | { kind: 'faq'; faqKey: string; reply: string }
  | {
      kind: 'route_coach';
      reply: string;
      /** Perché è finita alla coach: compilato solo dai rami espliciti (es. dati personali). */
      reason?: string;
      /**
       * Vero = questa risposta NON va riformulata dall'AI generativa. Serve dove la frase esatta
       * è la sostanza: dire «non ho accesso ai tuoi dati» è una garanzia, e un modello che la
       * riscrive potrebbe rispondere *come se* quei dati li avesse.
       */
      senzaAi?: boolean;
    }
  | { kind: 'route_nutritionist'; reason: string; reply: string };

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Temi sensibili → SEMPRE escalation. Instradamento (decisione socio 14/07):
 * al nutrizionista SOLO i temi MEDICI; tutto il resto (emotivo/comportamentale)
 * alla COACH, che è il primo filtro e inoltra al nutrizionista se serve.
 */
// MEDICI → nutrizionista: sintomi fisici, gravidanza, terapie farmacologiche.
const MEDICAL_SENSITIVE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /svenut|svengo|capogir|giramenti di testa|mi sento svenire/, reason: 'sintomo fisico da valutare' },
  { pattern: /dolore (forte|al petto)|male al petto|palpitazioni/, reason: 'sintomo fisico da valutare' },
  { pattern: /incint|gravidanz|allatt/, reason: 'gravidanza/allattamento: serve il nutrizionista' },
  { pattern: /farmac|medicinal|antibiotic|cortison/, reason: 'interazione con farmaci' },
];
// EMOTIVI/COMPORTAMENTALI → coach (primo filtro): rapporto col cibo, immagine corporea, condotte.
const BEHAVIORAL_SENSITIVE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /vomit|mi faccio vomitare|butto fuori/, reason: 'possibile condotta di eliminazione' },
  { pattern: /lassativ|diuretic/, reason: 'possibile condotta di eliminazione' },
  { pattern: /digiun\w* (da|per) (piu di )?\d|non mangio da|salto (tutti i|i) pasti/, reason: 'digiuno prolungato' },
  { pattern: /odio il mio corpo|mi faccio schifo|non valgo niente/, reason: 'immagine corporea fortemente negativa' },
  { pattern: /abbuffat|binge|non riesco a fermarmi a mangiare/, reason: 'possibile episodio di abbuffata' },
];

/** Domande cliniche/nutrizionali specifiche: al nutrizionista, non alla coach. */
const NUTRITIONIST_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /intolleran|allergi|celiac|lattosio/, reason: 'intolleranze/allergie' },
  { pattern: /glicemi|colesterol|tiroid|analisi|referto|esami del sangue/, reason: 'valori clinici' },
  { pattern: /integrator|vitamin|proteine in polvere/, reason: 'integrazione' },
];

/**
 * DATI PERSONALI E AMMINISTRATIVI: Gaia non li vede, e la risposta giusta è dirlo.
 *
 * Richiesta di Simone (8/8): «se la cliente chiede cose sui dati personali a cui Gaia non ha
 * accesso lei può invitarla a contattare la coach». Prima queste domande cadevano nel ramo
 * generico — «Bella domanda! L'ho girata alla tua coach» — che è vero ma suona come se Gaia
 * avesse scelto di non rispondere. Su fatture, pagamenti, contratto, anagrafica e richieste
 * privacy la differenza conta: la cliente ha diritto di sapere che l'assistente quei dati non
 * li ha, e a chi rivolgersi.
 *
 * Il messaggio arriva comunque alla coach (`route_coach`), quindi nessuna domanda si perde: qui
 * cambia solo la frase che la cliente legge, e il fatto che l'AI generativa non la riscriva.
 */
const DATI_PERSONALI_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /fattur|ricevut|scontrin|iban|bonific|carta di credito|addebit|rimbors|pagament|quanto ho pagat|quando pago|scadenz.{0,12}pagament/,
    reason: 'pagamenti e documenti fiscali',
  },
  {
    pattern: /contratt|abbonament|rinnov|disdett|disdire|recess|annullare (l.)?(abbonament|iscrizion)|sospendere (l.)?abbonament/,
    reason: 'contratto e abbonamento',
  },
  {
    pattern: /(cambiar|modificar|aggiornar|correggere).{0,25}(indirizzo|email|e-mail|numero di telefono|cellulare|codice fiscale|dati (personali|anagrafici))|i miei dati (personali|anagrafici)/,
    reason: 'dati anagrafici',
  },
  {
    pattern: /(cancellar|eliminar|cancellazione).{0,25}(account|profilo|i miei dati|dati)|revocare il consenso|revoca del consenso|diritto all.oblio|privacy/,
    reason: 'privacy e cancellazione dati',
  },
];

/**
 * La frase. Dice tre cose in tre righe: non ho accesso (non «non voglio rispondere»), a chi
 * scrivere, e che il messaggio è già partito — così la cliente non deve riscriverlo.
 */
export const ROUTE_DATI_PERSONALI_REPLY =
  'Su questo non posso aiutarti io: ai tuoi dati personali e amministrativi — pagamenti, fatture, contratto, anagrafica — io non ho accesso, e non voglio dirti qualcosa di impreciso. ' +
  'Ci pensa la tua coach: le ho già girato il messaggio, ti risponde nel vostro thread. 💚';

/** Libreria FAQ (parole chiave → risposta pronta). */
const FAQ_LIBRARY: { key: string; pattern: RegExp; reply: string }[] = [
  {
    key: 'menu_sblocco',
    pattern: /(quando|come).*(nuovo menu|prossimo menu|si sblocca|sblocco)|menu.*(non|nn).*(arriva|vedo)/,
    reply:
      'Il menu arriva 2 giorni alla volta: i giorni successivi si sbloccano automaticamente dopo il check-in quotidiano. Se oggi non l\'hai ancora fatto, apri la home e completa il check-in! 💚',
  },
  {
    key: 'lista_spesa',
    pattern: /lista (della )?spesa|cosa (devo )?comprare/,
    reply:
      'Trovi la lista della spesa nella sezione Menu: raccoglie già gli ingredienti dei giorni erogati, e puoi spuntare quello che hai comprato.',
  },
  {
    key: 'misure_quando',
    pattern: /(quando|ogni quanto).*(pesar|peso|misur)/,
    reply:
      'Peso e misure vanno registrati circa ogni 2 giorni, meglio al mattino a digiuno. Non fissarti sul singolo numero: il sistema ragiona sulle tendenze, mai sul giorno singolo.',
  },
  {
    key: 'acqua',
    pattern: /quanta acqua|obiettivo.*acqua|bicchieri/,
    reply: 'L\'obiettivo standard è 8 bicchieri al giorno: registra i bicchieri nella home e ci pensiamo noi a fare i conti.',
  },
  {
    key: 'obiettivo_cambio',
    pattern: /cambiare.*(obiettivo|peso target)|modificare l.?obiettivo/,
    reply:
      'Puoi modificare il tuo obiettivo dal profilo: il sistema verifica che il ritmo resti sostenibile e poi coach e nutrizionista lo riconfermano. Meglio pochi etti a settimana mantenuti che corse che non durano!',
  },
  {
    key: 'eventi_pause',
    pattern: /vacanz|evento|matrimonio|cena (fuori|importante)|periodo senza dieta|pausa/,
    reply:
      'Aggiungi l\'evento o il periodo di pausa dal calendario: nei giorni prima alleggeriamo il piano, il giorno sei libera, e al rientro si riparte con calma. Anticipare, mai punire. 🌿',
  },
  {
    key: 'valutazioni',
    pattern: /valutare.*(ricett|piatt)|stelle|non mi (e |è )?piaciut/,
    reply:
      'Dopo ogni pasto puoi dare da 1 a 5 stelle alla ricetta: serve al motore per proporti più spesso quello che ami e tenere alla larga quello che non ti piace.',
  },
  {
    key: 'contatto_umano',
    pattern: /parlare con (una persona|qualcuno|la coach|la nutrizionista)|persona vera/,
    reply:
      'Certo! Hai il thread diretto con la tua coach qui in chat, e per le questioni cliniche c\'è quello con la tua nutrizionista. Scrivi pure lì: ti risponderanno appena possibile.',
  },
];

export const SENSITIVE_HANDOFF_NUTRITIONIST =
  'Grazie per avermelo scritto: questa è una cosa importante e voglio che se ne occupi una persona, non un assistente. Ho già avvisato la tua nutrizionista, che ti contatterà al più presto. Nel frattempo sono qui per qualsiasi altra cosa. 💚';
export const SENSITIVE_HANDOFF_COACH =
  'Grazie per avermelo scritto: questa è una cosa importante e voglio che se ne occupi una persona, non un assistente. Ho già avvisato la tua coach, che ti contatterà al più presto. Nel frattempo sono qui per qualsiasi altra cosa. 💚';

export const ROUTE_COACH_REPLY =
  'Bella domanda! L\'ho girata alla tua coach, che ti risponderà nel vostro thread appena possibile. 💬';

export const ROUTE_NUTRITIONIST_REPLY =
  'Per questa domanda serve la tua nutrizionista: le ho già inoltrato il messaggio, ti risponderà nel vostro thread. 🩺';

export function classifyMessage(text: string): FilterResult {
  const normalized = normalize(text);

  // Prima i temi MEDICI → nutrizionista.
  for (const { pattern, reason } of MEDICAL_SENSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'sensitive', reason, reply: SENSITIVE_HANDOFF_NUTRITIONIST, target: 'nutritionist' };
    }
  }
  // Poi i temi EMOTIVI/COMPORTAMENTALI → coach (primo filtro, inoltra se serve).
  for (const { pattern, reason } of BEHAVIORAL_SENSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'sensitive', reason, reply: SENSITIVE_HANDOFF_COACH, target: 'coach' };
    }
  }
  // Dati personali e amministrativi PRIMA delle FAQ: «posso sospendere l'abbonamento?» non è la
  // FAQ delle pause dalla dieta, e rispondere con quella sarebbe fuori bersaglio.
  for (const { pattern, reason } of DATI_PERSONALI_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'route_coach', reply: ROUTE_DATI_PERSONALI_REPLY, reason, senzaAi: true };
    }
  }
  for (const { key, pattern, reply } of FAQ_LIBRARY) {
    if (pattern.test(normalized)) {
      return { kind: 'faq', faqKey: key, reply };
    }
  }
  /**
   * «INDICE GLICEMICO» NON È «GLICEMIA» (11/8, con la banca dati nutrizionale).
   *
   * `NUTRITIONIST_PATTERNS` manda alla nutrizionista tutto quello che contiene «glicemi», e per la
   * glicemia di una persona è giusto: è un valore clinico suo. Ma l'**indice** glicemico è una
   * proprietà di un alimento, che adesso sta nella nostra banca dati con la fonte accanto — e con la
   * regola di prima una domanda come «il basmati ha un indice glicemico più basso dell'integrale?»
   * usciva dalla chat senza risposta, cioè esattamente la domanda per cui abbiamo costruito la
   * tabella.
   *
   * Quindi la frase «indice/carico glicemico» si toglie dal testo prima di cercare i temi clinici.
   * «La mia glicemia è alta» resta clinica e va alla nutrizionista come sempre: cambia solo la
   * domanda sul cibo.
   */
  const senzaIndiceGlicemico = normalized.replace(/(indice|carico)\s+glicemic\w*/g, ' ');
  for (const { pattern, reason } of NUTRITIONIST_PATTERNS) {
    if (pattern.test(senzaIndiceGlicemico)) {
      return { kind: 'route_nutritionist', reason, reply: ROUTE_NUTRITIONIST_REPLY };
    }
  }
  return { kind: 'route_coach', reply: ROUTE_COACH_REPLY };
}
