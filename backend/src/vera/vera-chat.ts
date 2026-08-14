/**
 * IL DIALOGO DI VERA — stati e frasi, senza banca dati.
 *
 * Stessa forma dei dialoghi guidati di Gaia (`menu/data-inizio-chat.ts`): un tipo per lo stato, un
 * esito per ogni passo, e le frasi scritte qui invece che sparse nel servizio. Il motivo non è
 * l'ordine: è che così le parole che la nutrizionista legge si possono correggere senza toccare
 * niente che scriva sul database.
 *
 * ⚠️ Lo stato vive nel `meta` dell'ULTIMO messaggio dell'agente, non in una tabella di sessione.
 * Nessuna riga da ripulire, e un dialogo abbandonato muore da solo.
 */
import { normalizza } from '../common/nomi-alimento';

export type PassoVera =
  | 'nome'            // il primo incontro: come vuole chiamarmi
  | 'quale_cliente'   // omonimie: nome e cognome, o email
  | 'quale_famiglia'  // «formaggi molli» non lo conosco: quali sono?
  | 'quale_spuntino'  // «togli lo spuntino» secco: quale dei due? (azione 3, Decisioni §14)
  | 'conferma'        // ecco cosa sto per fare, e cosa comporta
  | 'ambito'          // solo per questa cliente o per tutte?
  | 'revisione'       // (solo il capo) ti sottopongo una proposta per volta
  | 'motivo_rifiuto'  // (solo il capo) perché la respingi
  | 'richiesta'       // una domanda aperta dal sistema: cosa tolgo dal piatto?
  | 'richiesta_generale'  // …e vale come regola per tutte?
  | 'aggiorna_famiglia'  // in catalogo è entrato qualcosa che forse è di una tua famiglia
  | 'ricetta_quale'      // quale delle ricette che si chiamano così
  | 'ricetta_testo'      // scrivimela: nome, ingredienti con le quantità, pasto e regime
  | 'ricetta_conferma';  // ecco cosa scrivo, coi macro veri. Confermi?

export interface StatoVera {
  passo: PassoVera;
  /** La frase da cui è nato il giro. Si conserva: finisce nel registro e nel collaudo. */
  frase: string;
  /** L'intento capito, serializzato. */
  intento?: unknown;
  /** Le clienti che combaciano, quando sono più d'una. */
  candidati?: { id: string; nome: string; email: string }[];
  /** Su chi ricadrà l'azione, una volta risolta l'omonimia. */
  clienteId?: string;
  clienteNome?: string;
  /** La famiglia che sto imparando, e quelle che restano da chiedere. */
  famiglia?: string;
  famiglieDaChiedere?: string[];
  /** Gli alimenti proposti da spuntare, per la famiglia in corso. */
  proposti?: string[];
  /** Quante volte di fila non ho capito. A due mi arrendo. */
  tentativi?: number;
  /** La proposta che sto sottoponendo al capo. */
  azioneId?: string;
  /** La voce di dizionario di cui sto chiedendo se allargarla. */
  famigliaId?: string;
  /**
   * LA RICETTA, come l'ha scritta lei, per intero.
   *
   * ⚠️ Si tiene il TESTO e non la ricetta già letta: quando manca il pasto o il regime lei risponde
   * con due parole, e il testo nuovo si appende a questo. Se qui ci fosse l'oggetto già costruito,
   * la seconda risposta sarebbe una ricetta senza ingredienti che sovrascrive la prima.
   */
  testoRicetta?: string;
  modoRicetta?: 'nuova' | 'modifica';
  /** La ricetta esistente che sto modificando. */
  ricettaId?: string;
  tagsRicetta?: string[];
  /** La domanda aperta che sto facendo, e la parola che ne uscirebbe per il dizionario. */
  richiestaId?: string;
  termine?: string;
  alimenti?: string[];
}

/** Cosa il servizio deve fare della risposta di un passo. */
export interface EsitoVera {
  testo: string;
  /** Stato da appendere al `meta`. Assente = giro chiuso. */
  stato?: StatoVera;
  esito: 'in_corso' | 'scritta' | 'in_approvazione' | 'annullata' | 'arresa' | 'non_capito';
  /** L'id della riga di registro, quando è stata scritta. */
  azioneId?: string;
}

/**
 * ⚠️ Quanto resta aperto un dialogo. Per le clienti è un'ora (`SCADENZA_FLUSSO_MS`); qui sono due.
 *
 * Non è un capriccio: una nutrizionista lavora a sessioni, viene interrotta da una visita e torna.
 * Farle ripetere «quale Simone?» perché sono passati sessantadue minuti è il tipo di dazio che
 * insegna a non usare lo strumento. Ma un tetto ci vuole lo stesso: uno stato appeso a un messaggio
 * di stamattina non è una conversazione in corso, è un tranello.
 */
export const SCADENZA_VERA_MS = 2 * 60 * 60 * 1000;

/** A due tentativi a vuoto ci si ferma: un agente che insiste è peggio di uno che ammette. */
export const MAX_TENTATIVI = 2;

// ─────────────────────────────────────────────────────────────── le frasi ────

export const testi = {
  presentazione: () =>
    // Riscritta il 13/8 sera (voce in Lavori dalla sessione che ha costruito Vera): via il
    // «battezzarmi», che suonava strano detto a una professionista. La domanda resta la stessa
    // e `estraiNome` continua a leggerla uguale.
    'Ciao. Sono l\'assistente che scrive per te nei moduli: mi detti a parole cosa vuoi fare e io lo ' +
    'traduco in regole vere, mostrandoti sempre cosa sto per scrivere prima di scriverlo.\n\n' +
    'Prima di cominciare: **che nome mi dai?** Scrivilo qui sotto — oppure dimmi «scegli tu».',

  nomePreso: (nome: string) =>
    `Da adesso mi chiamo ${nome}. Puoi cominciare quando vuoi: per esempio «a Giulia Rossi niente ` +
    'formaggi molli, solo il grana».',

  nomeNonCapito: () =>
    'Non ho capito il nome. Dimmelo secco — per esempio: «Vera» — oppure dimmi «scegli tu» e ne ' +
    'scelgo uno io.',

  nienteDaAnnullare: () =>
    'Non c\'era niente in corso da annullare: non stavo per scrivere nulla. Ripartiamo quando ' +
    'vuoi — per esempio «a Giulia Rossi niente formaggi molli».',

  nonCapito: (tentativi: number) =>
    tentativi < MAX_TENTATIVI
      ? 'Non ci arrivo. Puoi riscriverla dicendo **su chi** e **cosa** — per esempio «a Giulia Rossi ' +
        'niente formaggi molli»?'
      : 'Non ci arrivo nemmeno adesso, e preferisco fermarmi invece di indovinare. Questa la puoi ' +
        'fare dalla scheda della cliente. Quando vuoi ricominciamo con un\'altra frase.',

  fuoriPortata: (dettaglio: string) =>
    `Ho capito che parli del tipo di dieta (${dettaglio}), non di una singola cliente. Questo ` +
    'ancora non lo so fare: cambia il menu di tutte le clienti di quella dieta, e deve passare ' +
    'dall\'approvazione. Se intendevi una cliente sola, dimmi il suo nome.',

  chiediQualeSpuntino: (cliente: string) =>
    `Per ${cliente}: quale spuntino? Dimmi «quello del mattino», «la merenda del pomeriggio», ` +
    'oppure «tutti e due».',

  chiediCliente: () =>
    'Su quale cliente? Dimmi nome e cognome, oppure la sua email.',

  omonimie: (nome: string, quante: number) =>
    `Di ${nome} ne ho ${quante}. Dimmi il cognome o l'email, così non sbaglio persona.`,

  nessunCliente: (nome: string) =>
    `Non trovo nessuna cliente che si chiami «${nome}» fra le tue. Controlla il nome, oppure dimmi ` +
    'la sua email.',

  chiediFamiglia: (famiglia: string, proposti: string[]) =>
    `Non conosco «${famiglia}»: nel catalogo non è una categoria.\n\n` +
    (proposti.length
      ? `Questi sono gli alimenti che potrebbero rientrarci — dimmi **quali sono davvero**, separati ` +
        `da virgola:\n${proposti.map((p) => `· ${p}`).join('\n')}`
      : 'Dimmi tu quali alimenti ne fanno parte, separati da virgola.') +
    '\n\nQuello che mi rispondi me lo ricordo: la prossima volta non te lo chiedo più.',

  famigliaImparata: (famiglia: string, membri: string[]) =>
    `Imparato: per te «${famiglia}» sono ${membri.length} alimenti (${membri.join(', ')}).`,

  /**
   * ⚠️ La domanda dice **da quando**, e non «ci sono novità».
   *
   * «Da quando mi hai insegnato questa parola» spiega in cinque parole perché la sto chiedendo
   * adesso e perché non l'ho chiesta prima. Senza, sembra che l'agente si sia dimenticato la
   * risposta — che è esattamente l'impressione da non dare a chi gliel'ha insegnata.
   */
  dizionarioInvecchiato: (famiglia: string, candidati: string[]) =>
    `Una cosa piccola, quando hai un minuto. Da quando mi hai insegnato **«${famiglia}»**, in ` +
    `catalogo ${candidati.length === 1 ? 'è entrato' : 'sono entrati'}:\n` +
    candidati.map((c) => `· ${c}`).join('\n') +
    `\n\n${candidati.length === 1 ? 'Ne fa parte' : 'Ne fanno parte'}? Dimmi quali, separati da ` +
    'virgola — oppure «nessuno», e non te lo richiedo più.',

  famigliaAllargata: (famiglia: string, aggiunti: string[]) =>
    `Fatto: «${famiglia}» adesso comprende anche ${aggiunti.join(', ')}. Le regole che l'hanno usata ` +
    'valgono da subito anche su questi.',

  dizionarioLasciatoComEra: (famiglia: string) =>
    `Va bene: «${famiglia}» resta com'era, e su questi non ti chiedo più niente.`,

  // ─────────────────────────────────────────────────────────────── le ricette ─

  chiediRicetta: (modo: 'nuova' | 'modifica', nome?: string) =>
    (modo === 'modifica'
      ? `Va bene: riscrivimi **${nome}** com'è adesso, per intero.`
      : 'Scrivimela pure.') +
    '\n\nMi serve il **nome del piatto** su una riga, poi gli **ingredienti uno per riga con la ' +
    'quantità** (per esempio «tonno 120 g»), e alla fine **per quale pasto** e se è **onnivora, ' +
    'vegetariana o vegana**.\n\n' +
    'I valori nutrizionali non me li dire: li prendo dalla tabella nutrienti, così sono quelli veri.',

  mancaNellaRicetta: (manca: string[]) =>
    `Ci siamo quasi, mi manca ${manca.length === 1 ? '' : 'ancora'}:\n` +
    manca.map((m) => `· ${m}`).join('\n') +
    '\n\nScrivimi solo quello che manca, il resto me lo ricordo.',

  /**
   * ⚠️ Gli alimenti fuori tabella FERMANO la ricetta, e la frase deve dire perché — altrimenti
   * sembra un capriccio. Senza i valori veri l'unico modo di riempire le calorie sarebbe
   * indovinarle, e su quei numeri il motore calcola le giornate.
   */
  alimentiFuoriTabella: (mancanti: string[]) =>
    `Non posso ancora scriverla: ${mancanti.join(', ')} ${mancanti.length === 1 ? 'non è' : 'non sono'} ` +
    'nella tabella nutrienti, e i valori non me li invento — il motore ci calcola sopra le giornate.\n\n' +
    'L\'ho segnat' + (mancanti.length === 1 ? 'o' : 'i') + ' fra gli alimenti da aggiungere: si ' +
    'inserisc' + (mancanti.length === 1 ? 'e' : 'ono') + ' dalla pagina **Valori nutrizionali**, e ' +
    'poi la ricetta si scrive in un attimo. Oppure dimmi lo stesso piatto con un ingrediente che ho già.',

  anteprimaRicetta: (
    nome: string, pasto: string, regime: string, ingredienti: string[], macro: string, modo: 'nuova' | 'modifica',
  ) =>
    `Ecco cosa scrivo:\n\n**${nome}** — ${pasto}, ${regime}\n` +
    ingredienti.map((i) => `· ${i}`).join('\n') +
    `\n\n${macro}\n\n` +
    (modo === 'nuova'
      ? '⚠️ Entra come **bozza**, quindi il motore non la può usare: la attiva il capo nutrizionista ' +
        'dalla coda. Prima di finire in un menu servirà comunque la conferma degli allergeni.\n\nConfermo?'
      : '⚠️ Questa ricetta è **già in uso**: la modifica non la applico io — la metto in coda al capo ' +
        'nutrizionista, e diventa vera quando la approva.\n\nConfermo?'),

  ricettaScritta: (nome: string) =>
    `Scritta: **${nome}** è in catalogo come bozza e l'ho messa in coda al capo nutrizionista. ` +
    'Quando la approva diventa attiva; gli allergeni li conferma lui dalla scheda della ricetta.',

  modificaInCoda: (nome: string) =>
    `Fatto: la modifica di **${nome}** è in coda al capo nutrizionista. Fino a quando non la approva, ` +
    'la ricetta resta quella di adesso — nessuna cliente si trova il piatto cambiato stanotte.',

  ricettaNonTrovata: (nome: string) =>
    `Non trovo nessuna ricetta che si chiami «${nome}». Controlla il nome dalla pagina Ricette, ` +
    'oppure scrivimelo come compare lì.',

  ricetteOmonime: (nome: string, quali: string[]) =>
    `Di «${nome}» ne ho ${quali.length}:\n${quali.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` +
    'Dimmi il numero, o il nome per intero.',

  chiediAmbito: (clienteNome: string) =>
    `Vale **solo per ${clienteNome}**, o la estendo a tutte le tue clienti?\n` +
    '(se non dici niente resta solo per lei — rispondi «a tutte» per estenderla)',

  ambitoEsteso: () =>
    'Va bene: la mando in approvazione al capo nutrizionista, perché una regola che vale per tutte ' +
    'cambia il motore e non deve entrare in silenzio. La trovi nel registro come «in approvazione».',

  annullato: () => 'Non ho scritto niente. Dimmi pure un\'altra cosa.',

  scritta: (riepilogo: string) => `Fatto. ${riepilogo}\nLo trovi qui sotto nel registro, con l'annulla.`,

  // ── la coda del capo nutrizionista ──────────────────────────────────────────

  /**
   * ⚠️ Si sottopone **una proposta per volta**, e il numero di quelle che restano si dice.
   *
   * Dire quante ne restano non è cortesia: senza, chi decide non sa se sta guardando l'unica cosa
   * della giornata o la prima di venti — e sono due modi di leggere molto diversi.
   */
  sottoponi: (restanti: number, chi: string, quando: string, frase: string, riepilogo: string, conflitto: boolean) =>
    `${restanti === 1 ? 'C\'è una cosa' : `Ci sono ${restanti} cose`} che aspettano te.\n\n` +
    `**${chi}**, il ${quando}, ha dettato:\n«${frase}»\n\n${riepilogo}` +
    (conflitto ? '\n\n⚠️ Questa era in conflitto con un vincolo sanitario e lei ha confermato lo stesso.' : '') +
    '\n\n**Approvi?** (rispondi «sì» per approvare, «no» per respingere)',

  codaVuota: () => 'Non c\'è niente che aspetta te. Quando arriva una proposta te la porto qui.',

  // ── la guida della giornata (Simone, 14/8) ─────────────────────────────────

  /**
   * Il quadro di «hai segnalazioni per me?»: una riga per fonte, e solo le fonti che hanno
   * qualcosa. ⚠️ L'ordine delle righe lo decide il servizio, e le segnalazioni CLINICHE vanno in
   * testa (Simone, 14/8, pagina Lavori: se ci sono problemi clinici «vanno in testa a tutte»).
   */
  guida: (righe: string[]) => `Ecco il quadro di oggi:\n\n${righe.map((r) => `• ${r}`).join('\n')}`,

  /**
   * ⚠️ «Non lo so» ≠ «nessuno»: una fonte rotta si dice, non si finge uno zero. Fingere lo zero
   * insegnerebbe a fidarsi di un quadro che quel giorno era cieco su una colonna.
   */
  guidaFonteRotta: (cosa: string) => `⚠️ Non sono riuscito a leggere ${cosa}: lì non so dirti se c'è qualcosa.`,

  approvata: (riepilogo: string) => `Approvata. ${riepilogo}`,

  chiediMotivo: () =>
    'Perché la respingi? Il motivo lo legge chi l\'ha proposta, e serve a farle capire cosa cambiare — ' +
    'quindi non lo salto.',

  respinta: () => 'Respinta, con il tuo motivo scritto accanto.',

  /**
   * ⚠️ Quello che sta dentro un testo incollato si PROPONE, non si esegue.
   *
   * Le azioni si eseguono solo da ciò che scrive lei di suo pugno. Il testo che le arriva davanti è
   * spessissimo scritto da qualcun altro — un messaggio di una cliente, un referto, una mail — e
   * dentro può esserci una frase che sembra un'istruzione. Chi ha il potere di scrivere regole su
   * persone vere non deve poter essere comandato da un incollato.
   */
  messaInCoda: () =>
    'L\'ho comunque **messa in coda al capo nutrizionista** con la tua frase, così non si perde: ' +
    'chi può farla la vede. La trovi qui sotto nel registro, come «in approvazione».',

  dallaCitazione: () =>
    'Nel testo che hai incollato c\'è qualcosa che sembra una richiesta.\n\n' +
    '⚠️ **Non l\'ho eseguita**: quello che incolli lo leggo, non lo eseguo. Se vuoi che la faccia, ' +
    'dimmelo tu con parole tue.',

  // ── le domande che aspettano lei ────────────────────────────────────────────

  /**
   * ⚠️ La domanda si mostra **come l'ha scritta chi sa cosa manca**, senza riscriverla.
   *
   * Il contratto dice che il testo lo scrive l'altra parte, «perché è dalla nostra parte che si sa
   * cosa manca». Riformularlo qui vorrebbe dire due versioni della stessa domanda, e quella che
   * legge la nutrizionista sarebbe la mia — cioè quella di chi non sa cosa manca.
   */
  richiesta: (restanti: number, testo: string) =>
    `${restanti === 1 ? 'C\'è una domanda' : `Ci sono ${restanti} domande`} che aspettano te.\n\n${testo}\n\n` +
    '(elencami gli alimenti da togliere, separati da virgola — oppure scrivi «lascia stare»)',

  rispostaScritta: (cliente: string | null, alimenti: string[]) =>
    alimenti.length
      ? `Fatto: per ${cliente ?? 'questa cliente'} ho aggiunto alle esclusioni ${alimenti.join(', ')}.`
      : 'Va bene, non tocco niente sul suo profilo.',

  /**
   * ⚠️ La domanda «vale per tutte?» si fa SEPARATA, e dopo aver già scritto sulla cliente.
   *
   * È il §2 del contratto: da una risposta escono due scritture diverse, e non vanno fuse. Una
   * traduzione clinica data di fretta su una cliente non deve entrare nel vocabolario di tutte
   * perché qualcuno ha risposto in fretta a una domanda.
   */
  chiediGenerale: (termine: string, alimenti: string[]) =>
    `Vale come **regola generale**? Cioè: ogni volta che qualcuno scrive «${termine}», devo intendere ` +
    `${alimenti.join(', ')}?\n(se dici sì non lo applico da solo: lo propongo al capo nutrizionista)`,

  propostaDizionario: (termine: string) =>
    `L'ho proposta al capo: se la approva, «${termine}» diventa una parola che conosco per tutte. ` +
    'Fino ad allora resta scritta solo sulla cliente.',
} as const;

/**
 * Legge un sì o un no da una risposta scritta a mano.
 *
 * ⚠️ Nel dubbio è `null` — non «sì». La conferma è l'ultimo cancello prima di scrivere su una
 * persona vera: interpretare come assenso un «mah, forse» è esattamente il tipo di comodità che
 * rende inutile mettere un cancello.
 *
 * ⚠️ Si passa da `normalizza` (che toglie gli accenti) PRIMA di confrontare, e non è un dettaglio:
 * in JavaScript il confine di parola `\b` è ASCII, quindi `sì\b` non combacia **mai** — dopo la «ì»
 * non c'è nessun confine. Senza questa riga, la risposta più naturale che esista a «Confermi?»
 * verrebbe letta come «non ho capito». È lo stesso difetto della «é» di «perché» in `capisci.ts`:
 * la seconda volta che lo paghiamo, e per questo sta scritto in tutti e due i posti.
 */
export function leggiConferma(testo: string): boolean | null {
  const t = normalizza(testo ?? '');
  if (!t) return null;
  if (/^(si|ok|okay|va bene|confermo|procedi|certo|esatto|perfetto|d'accordo|vai)\b/.test(t)) return true;
  if (/^(no|annulla|lascia|ferma|aspetta|non|meglio di no)\b/.test(t)) return false;
  return null;
}

/** «a tutte» / «solo per lei». Nel dubbio: solo per lei, che è la risposta predefinita. */
export function leggiAmbito(testo: string): 'cliente' | 'tutte' {
  const t = normalizza(testo ?? '');
  return /\b(a tutte|per tutte|tutte le|estendi|estendila|regola generale)\b/.test(t) ? 'tutte' : 'cliente';
}

/** Un elenco scritto a mano: «mozzarella, stracchino e ricotta». */
export function leggiElenco(testo: string): string[] {
  return (testo ?? '')
    .split(/\s*,\s*|\s+e\s+|\s+ed\s+|\n/i)
    .map((x) => x.replace(/^[\s·\-–*]+|[\s.;]+$/g, '').trim())
    .filter((x) => x.length >= 2);
}

// ─────────────────────────────────────────────────────────── il battesimo ────

export type EsitoNome = { tipo: 'scegli_tu' } | { tipo: 'nome'; nome: string };

/**
 * Il nome dalla risposta al battesimo — o `null`, che vuol dire «questa non è una risposta alla
 * domanda del nome».
 *
 * ⚠️ Nato da un difetto vero (13/8, screenshot di Simone): l'estrattore prendeva la PRIMA parola
 * della frase, per cui «Ciao ti chiamerò Vera» avrebbe battezzato l'assistente «Ciao». E lo stato
 * «nome» scadeva con la conversazione (`SCADENZA_VERA_MS`), rendendo il battesimo irraggiungibile
 * per sempre: per questo il chiamante lo usa come CONDIZIONE SUI DATI (nomeAgente vuoto), non come
 * stato appeso al messaggio.
 *
 * Qui non si indovina: o la frase è una forma esplicita («ti chiamerò/chiamerai X», «voglio
 * chiamarti X», «sarà X», «ti battezzo X»...), o è il nome secco (al massimo con un saluto davanti), o è «scegli tu». Tutto il resto è
 * `null` — meglio richiedere che chiamarsi «Ciao» per sempre.
 */
export function estraiNome(frase: string): EsitoNome | null {
  const f = (frase ?? '').trim();
  if (!f) return null;
  if (/\b(scegli tu|decidi tu|come vuoi|fai tu|non so)\b/i.test(f)) return { tipo: 'scegli_tu' };

  const esplicita =
    /(?:ti\s+chiam[\wà-ù]+|chiamart[\wà-ù]+|ti\s+battezz[\wà-ù]+|battezzart[\wà-ù]+|sar[àa]i?|il\s+tuo\s+nome\s+(?:è|sar[àa]))\s+[«"']?([a-zA-ZÀ-ÿ]{2,30})/i.exec(f);
  if (esplicita) return { tipo: 'nome', nome: esplicita[1] };

  // Il nome secco, eventualmente con un saluto o un «ok» davanti e la punteggiatura in coda.
  const secco = f
    .replace(/^(?:ciao|buongiorno|buonasera|salve|ehi|ok|va bene)[\s,!.]*/i, '')
    .replace(/[\s!.?«»"']+$/g, '')
    .trim();
  if (/^[a-zA-ZÀ-ÿ]{2,30}$/.test(secco)) return { tipo: 'nome', nome: secco };
  return null;
}

/**
 * L'ETICHETTA di un tipo di notifica, per il quadro della giornata.
 *
 * ⚠️ Non è un catalogo completo dei tipi — nascono più in fretta di qualunque elenco. Il ripiego
 * (`tipo` con gli underscore tolti) è brutto apposta: si vede, e la parola giusta si aggiunge qui.
 */
const ETICHETTE_AVVISI: Record<string, string> = {
  vera_conflitto_sanitario: 'conflitti sanitari',
  stall_coach_alert: 'clienti ferme col peso',
  no_checkin_coach_alert: 'check-in mancati',
  chat_reply: 'risposte in chat',
};

export function etichettaAvviso(tipo: string): string {
  return ETICHETTE_AVVISI[tipo] ?? (tipo ?? '').replace(/_/g, ' ');
}
