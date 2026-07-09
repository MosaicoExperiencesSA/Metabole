/**
 * Assistente AI di primo filtro — DETERMINISTICO (spec sez. 5: "L'assistente AI
 * fa da primo filtro: FAQ → instrada a coach/nutrizionista; temi sensibili →
 * escalation"). L'AI generativa arriverà in M10 solo come layer di supporto.
 *
 * Puro e testabile: testo → classificazione.
 */

export type FilterResult =
  | { kind: 'sensitive'; reason: string; reply: string }
  | { kind: 'faq'; faqKey: string; reply: string }
  | { kind: 'route_coach'; reply: string }
  | { kind: 'route_nutritionist'; reason: string; reply: string };

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Temi sensibili (rapporto problematico col cibo, malessere): SEMPRE escalation. */
const SENSITIVE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /vomit|mi faccio vomitare|butto fuori/, reason: 'possibile condotta di eliminazione' },
  { pattern: /digiun\w* (da|per) (piu di )?\d|non mangio da|salto (tutti i|i) pasti/, reason: 'digiuno prolungato' },
  { pattern: /odio il mio corpo|mi faccio schifo|non valgo niente/, reason: 'immagine corporea fortemente negativa' },
  { pattern: /abbuffat|binge|non riesco a fermarmi a mangiare/, reason: 'possibile episodio di abbuffata' },
  { pattern: /lassativ|diuretic/, reason: 'possibile uso improprio di farmaci' },
  { pattern: /svenut|svengo|capogir|giramenti di testa|mi sento svenire/, reason: 'sintomo fisico da valutare' },
  { pattern: /dolore (forte|al petto)|male al petto|palpitazioni/, reason: 'sintomo fisico da valutare' },
  { pattern: /incint|gravidanz|allatt/, reason: 'gravidanza/allattamento: serve il nutrizionista' },
  { pattern: /farmac|medicinal|antibiotic|cortison/, reason: 'interazione con farmaci' },
];

/** Domande cliniche/nutrizionali specifiche: al nutrizionista, non alla coach. */
const NUTRITIONIST_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /intolleran|allergi|celiac|lattosio/, reason: 'intolleranze/allergie' },
  { pattern: /glicemi|colesterol|tiroid|analisi|referto|esami del sangue/, reason: 'valori clinici' },
  { pattern: /integrator|vitamin|proteine in polvere/, reason: 'integrazione' },
];

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

export const SENSITIVE_HANDOFF_REPLY =
  'Grazie per avermelo scritto: questa è una cosa importante e voglio che se ne occupi una persona, non un assistente. Ho già avvisato la tua nutrizionista, che ti contatterà al più presto. Nel frattempo sono qui per qualsiasi altra cosa. 💚';

export const ROUTE_COACH_REPLY =
  'Bella domanda! L\'ho girata alla tua coach, che ti risponderà nel vostro thread appena possibile. 💬';

export const ROUTE_NUTRITIONIST_REPLY =
  'Per questa domanda serve la tua nutrizionista: le ho già inoltrato il messaggio, ti risponderà nel vostro thread. 🩺';

export function classifyMessage(text: string): FilterResult {
  const normalized = normalize(text);

  for (const { pattern, reason } of SENSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'sensitive', reason, reply: SENSITIVE_HANDOFF_REPLY };
    }
  }
  for (const { key, pattern, reply } of FAQ_LIBRARY) {
    if (pattern.test(normalized)) {
      return { kind: 'faq', faqKey: key, reply };
    }
  }
  for (const { pattern, reason } of NUTRITIONIST_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'route_nutritionist', reason, reply: ROUTE_NUTRITIONIST_REPLY };
    }
  }
  return { kind: 'route_coach', reply: ROUTE_COACH_REPLY };
}
