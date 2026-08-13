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
  | 'conferma'        // ecco cosa sto per fare, e cosa comporta
  | 'ambito'          // solo per questa cliente o per tutte?
  | 'revisione'       // (solo il capo) ti sottopongo una proposta per volta
  | 'motivo_rifiuto'  // (solo il capo) perché la respingi
  | 'richiesta'       // una domanda aperta dal sistema: cosa tolgo dal piatto?
  | 'richiesta_generale'; // …e vale come regola per tutte?

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
    'Ciao. Sono l\'assistente che scrive per te nei moduli: mi detti a parole cosa vuoi fare e io lo ' +
    'traduco in regole vere, mostrandoti sempre cosa sto per scrivere prima di scriverlo.\n\n' +
    'La prima cosa la scegli tu: **come vuoi chiamarmi?** (se non ti viene in mente niente, dimmi ' +
    '«scegli tu»).',

  nomePreso: (nome: string) =>
    `Da adesso mi chiamo ${nome}. Puoi cominciare quando vuoi: per esempio «a Giulia Rossi niente ` +
    'formaggi molli, solo il grana».',

  nonCapito: (tentativi: number) =>
    tentativi < MAX_TENTATIVI
      ? 'Non ci arrivo. Puoi riscriverla dicendo **su chi** e **cosa** — per esempio «a Giulia Rossi ' +
        'niente formaggi molli»?'
      : 'Non ci arrivo nemmeno adesso, e preferisco fermarmi invece di indovinare. Questa la puoi ' +
        'fare dalla scheda della cliente. Quando vuoi ricominciamo con un\'altra frase.',

  fuoriPortata: (cosa: 'regola_dieta' | 'ricetta', dettaglio: string) =>
    cosa === 'regola_dieta'
      ? `Ho capito che parli del tipo di dieta (${dettaglio}), non di una singola cliente. Questo ` +
        'ancora non lo so fare: cambia il menu di tutte le clienti di quella dieta, e deve passare ' +
        'dall\'approvazione. Se intendevi una cliente sola, dimmi il suo nome.'
      : 'Ho capito che parli di una ricetta. Questo ancora non lo so fare — le ricette entrano nel ' +
        'catalogo di tutte, e passano dalla coda «Da validare».',

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

  approvata: (riepilogo: string) => `Approvata. ${riepilogo}`,

  chiediMotivo: () =>
    'Perché la respingi? Il motivo lo legge chi l\'ha proposta, e serve a farle capire cosa cambiare — ' +
    'quindi non lo salto.',

  respinta: () => 'Respinta, con il tuo motivo scritto accanto.',

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
