/**
 * LA LISTA DELLA MATTINA — «Vera gli sottopone tutte le cose che deve fare, numerate» (Simone, 19/8).
 *
 * ## Cosa c'era già, e cosa mancava
 *
 * Dal 14/8 «hai segnalazioni per me?» compone il **quadro** della giornata leggendo le tabelle vere
 * (`guidaGiornata`), e subito dopo `cosaTiPorto` porta **la prima cosa da fare**; risolta quella,
 * porta la successiva da sola. L'ordine è già una decisione presa: le cliniche in testa, poi chi ha
 * qualcuno che aspetta, in fondo la manutenzione.
 *
 * ⚠️ **Ma il quadro sono CONTEGGI, non voci.** «3 segnalazioni, 2 proposte, 1 domanda» dice quanto
 * lavoro c'è, non *quale*: non si può dire «faccio la 3», non si vede il nome di chi aspetta, e non
 * si depenna niente. Chi legge un conteggio sa solo che è indietro.
 *
 * ⚠️ E la coda **«Da validare»** — le decisioni del motore in attesa — nel quadro **non c'era
 * affatto**: viveva solo nel riquadro della home. Un elenco che dice «queste sono tutte le cose che
 * devi fare» e ne salta una intera categoria è peggio di nessun elenco, perché chi lo legge smette
 * di guardare altrove.
 *
 * ## ⚠️ Perché le azioni sono un ELENCO CHIUSO per tipo, e non un campo libero
 *
 * Decisione di Simone (19/8): «Vera propone le azioni già pronte». È la stessa scelta già fatta per
 * la coda «Da validare» (`engine/causa-decisione.ts`, deciso con Nocanty): per ogni causa si offrono
 * **solo** le azioni che hanno senso per quella causa. Un campo libero costringerebbe a decidere due
 * volte — prima cosa fare, poi come dirlo — e finirebbe per contenere una copia dei cambi dieta, che
 * è il modo in cui nascono i buchi nei permessi.
 *
 * ⚠️ **Le azioni del motore NON si riscrivono qui**: si importano. Se un domani Nocanty toglie
 * «blocca il piano» dall'energia bassa, deve sparire da tutte e due i posti — o fra un mese la coda
 * e la chat offriranno due cose diverse sulla stessa riga.
 */
import { AZIONI, type AzioneDecisione, azioniPerCausa, DESCRIZIONE_AZIONE, ETICHETTA_CAUSA, isCausa } from '../engine/causa-decisione';

/** Da dove viene una voce. Serve a sapere **dove si scrive** quando è risolta. */
export type TipoVoce =
  /** Segnalazione clinica su una cliente (`Escalation`, category `clinical`). */
  | 'segnalazione_clinica'
  /** Ogni altra segnalazione aperta. */
  | 'segnalazione'
  /** Decisione del motore in attesa (`EngineDecision.flaggedForReview`) — la coda «Da validare». */
  | 'da_validare'
  /** Proposta di una nutrizionista che aspetta il capo. */
  | 'proposta_da_approvare'
  /** Domanda aperta di Vera: una parola che non sa tradurre (allergia, intolleranza). */
  | 'domanda_aperta'
  /** Cambio concordato in chat con la cliente, da verificare. */
  | 'sostituzione_da_verificare'
  /** Ricette o diete generate che aspettano l'approvazione. */
  | 'catalogo_da_approvare'
  /** Manutenzione: una famiglia del dizionario che è invecchiata. */
  | 'dizionario_invecchiato';

/**
 * L'ORDINE — è una decisione, non un caso, ed è la stessa già presa il 14/8 per il quadro.
 *
 * ⚠️ In testa le **cliniche** (Simone, 14/8: «se ci sono problemi clinici vanno in testa a tutte le
 * richieste»). Poi le cose dietro cui **c'è qualcuno che aspetta oggi**: una decisione del motore
 * ferma è una cliente il cui piano non va avanti; una proposta in coda è una collega ferma; una
 * domanda aperta è una cliente il cui piatto oggi non è filtrato. In fondo quello dietro cui **non
 * aspetta nessuno**: il catalogo che non cresce, il dizionario che invecchia.
 *
 * ⚠️ Numeri distanziati di dieci: fra due tipi ce ne può entrare un terzo senza rinumerare tutto —
 * e una rinumerazione a mano è il modo in cui due tipi finiscono con lo stesso peso senza accorgersene.
 */
export const PESO_TIPO: Record<TipoVoce, number> = {
  segnalazione_clinica: 10,
  da_validare: 20,
  segnalazione: 30,
  proposta_da_approvare: 40,
  domanda_aperta: 50,
  sostituzione_da_verificare: 60,
  catalogo_da_approvare: 70,
  dizionario_invecchiato: 80,
};

/** Quello che il nutrizionista può fare su una voce, oltre alle azioni del motore. */
export const AZIONI_LISTA = {
  /** Chiude la segnalazione con una nota. È quello che fa già la pagina Segnalazioni. */
  SEGNA_RISOLTA: 'segna_risolta',
  /** Rifà la base personale della cliente (pool bloccato / dieta cambiata). */
  RIFAI_BASE: 'rifai_base',
  /** Salta: non ora. ⚠️ Non chiude niente e la voce torna domani — vedi `DESCRIZIONE_LISTA`. */
  RIMANDA: 'rimanda',
} as const;

export type AzioneLista = (typeof AZIONI_LISTA)[keyof typeof AZIONI_LISTA];
export type Azione = AzioneDecisione | AzioneLista;

export const DESCRIZIONE_LISTA: Record<AzioneLista, { etichetta: string; cosaFa: string }> = {
  [AZIONI_LISTA.SEGNA_RISOLTA]: {
    etichetta: 'Segna risolta',
    cosaFa:
      'Chiude la segnalazione con la nota che scrivi. ⚠️ Non cambia niente sul piano della cliente: dice che l’hai guardata e cosa hai deciso. Se la situazione peggiora la segnalazione si riapre da sola.',
  },
  [AZIONI_LISTA.RIFAI_BASE]: {
    etichetta: 'Rifai la base personale',
    cosaFa:
      'Ricalcola le ricette sicure per lei dal catalogo di adesso. Serve quando il pool era sotto soglia per un’allergia appena tradotta o una dieta cambiata.',
  },
  [AZIONI_LISTA.RIMANDA]: {
    etichetta: 'Rimanda',
    cosaFa:
      '⚠️ Non chiude niente e non scrive niente: la voce torna domani. È l’unica risposta onesta a «questa non la so ancora» — e serve, perché senza di lei si finisce per chiudere una riga per toglierla dall’elenco.',
  },
};

/**
 * LE AZIONI PER TIPO.
 *
 * ⚠️ Per `da_validare` **non c'è una riga qui**: le azioni le decide `azioniPerCausa`, che è la
 * tabella concordata con Nocanty. Ricopiarle vorrebbe dire che il giorno in cui lei ne toglie una,
 * la coda e la chat offrono due cose diverse sulla stessa riga.
 *
 * ⛔ **La tabella delle segnalazioni è una proposta, non una decisione presa.** Qui ci sono solo
 * azioni che **non toccano il piano**: aprire la scheda, scrivere in chat, chiudere con una nota,
 * rifare la base. Le azioni che cambiano cosa mangia una persona — alzare le calorie, bloccare il
 * piano — su una segnalazione non le metto io: vanno decise da chi risponde sul piano clinico, una
 * categoria per volta. Finché non ci sono, «Apri la scheda» porta dove quelle leve vivono già coi
 * loro permessi.
 */
/**
 * Taglia un titolo alla lunghezza data, e **lo dice** con un'ellissi.
 *
 * ⚠️ `slice(0, 90)` e basta produce una riga che finisce a metà parola — «…in percorso
 * supervisionato (ha dichiarato farmaci o condizioni in registrazi» — e chi legge non sa se il
 * testo finisce lì o se manca qualcosa. È la riga su cui si sceglie «la 3»: *se degradi, dillo*,
 * anche quando il degrado è tre caratteri.
 */
export function tronca(testo: string, quanti: number): string {
  const t = (testo ?? '').trim();
  return t.length <= quanti ? t : `${t.slice(0, quanti - 1).trimEnd()}…`;
}

export const AZIONI_PER_TIPO: Record<Exclude<TipoVoce, 'da_validare'>, Azione[]> = {
  segnalazione_clinica: [AZIONI.APRI_SCHEDA, AZIONI.SCRIVI_IN_CHAT, AZIONI_LISTA.SEGNA_RISOLTA, AZIONI_LISTA.RIMANDA],
  segnalazione: [AZIONI.APRI_SCHEDA, AZIONI.SCRIVI_IN_CHAT, AZIONI_LISTA.RIFAI_BASE, AZIONI_LISTA.SEGNA_RISOLTA, AZIONI_LISTA.RIMANDA],
  proposta_da_approvare: [AZIONI.APRI_SCHEDA, AZIONI_LISTA.RIMANDA],
  /**
   * ⛔ **«Apri la scheda» c'è, e serve** — aggiunta in revisione il 25/8. Dal 25/8 fra le domande
   * aperte c'è il promemoria sui percorsi supervisionati, e quel testo dice testualmente *«dalla sua
   * scheda puoi scrivere “Può proseguire”»*: senza questa azione la lista portava la domanda e
   * offriva **solo** di rimandarla, cioè mandava a cercare a mano la schermata che aveva appena
   * nominato. ⚠️ Non tocca niente e non decide niente: porta dove le leve vivono già coi loro
   * permessi, che è la stessa regola delle altre righe di questa tabella.
   */
  domanda_aperta: [AZIONI.APRI_SCHEDA, AZIONI_LISTA.RIMANDA],
  sostituzione_da_verificare: [AZIONI.APRI_SCHEDA, AZIONI_LISTA.RIMANDA],
  catalogo_da_approvare: [AZIONI_LISTA.RIMANDA],
  dizionario_invecchiato: [AZIONI_LISTA.RIMANDA],
};

export interface VoceDaFare {
  tipo: TipoVoce;
  /** L'id della riga di origine: serve a scrivere dove va scritto. */
  id: string;
  /** Una riga, con dentro il nome di chi aspetta. */
  titolo: string;
  /** La causa, per le decisioni del motore: decide le azioni. */
  causa?: string | null;
  /** Il numero assegnato dalla lista. Lo scrive `numera`. */
  n?: number;
}

/** Le azioni di una voce — con le decisioni del motore prese da dove sono già scritte. */
export function azioniDi(v: Pick<VoceDaFare, 'tipo' | 'causa'>): Azione[] {
  if (v.tipo === 'da_validare') {
    const dalMotore = azioniPerCausa(v.causa);
    /**
     * ⚠️ Una causa che questa versione non conosce (righe scritte prima dell'11/8) non resta senza
     * risposte: si offrono i due rimandi, che non modificano niente. Una voce numerata su cui
     * digitando il numero non succede nulla insegna a non fidarsi dei numeri.
     */
    const base: Azione[] = dalMotore.length ? [...dalMotore] : [AZIONI.APRI_SCHEDA, AZIONI.SCRIVI_IN_CHAT];
    return [...base, AZIONI_LISTA.RIMANDA];
  }
  return AZIONI_PER_TIPO[v.tipo];
}

/** Etichetta e spiegazione di un'azione, da qualunque delle due tabelle venga. */
export function descriviAzione(a: Azione): { etichetta: string; cosaFa: string } {
  return (DESCRIZIONE_AZIONE as Record<string, { etichetta: string; cosaFa: string }>)[a]
    ?? (DESCRIZIONE_LISTA as Record<string, { etichetta: string; cosaFa: string }>)[a];
}

/**
 * L'ordine e i numeri.
 *
 * ⚠️ **A parità di tipo l'ordine non si tocca**: resta quello con cui è arrivato dal chiamante, che
 * lo legge dal database ordinato per data. Un secondo criterio inventato qui farebbe muovere le
 * righe fra una lettura e l'altra — e su una lista in cui si risponde «faccio la 3», una riga che si
 * sposta è una cosa fatta al posto di un'altra.
 */
export function numera(voci: readonly VoceDaFare[]): VoceDaFare[] {
  return voci
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (PESO_TIPO[a.v.tipo] ?? 99) - (PESO_TIPO[b.v.tipo] ?? 99) || a.i - b.i)
    .map((x, k) => ({ ...x.v, n: k + 1 }));
}

/**
 * IL NUMERO CHE HA DETTO — «3», «la 3», «faccio la terza», «numero 3».
 *
 * ⚠️ Fuori dall'elenco è `null` e **non si sceglie il più vicino**: se ha scritto 12 e le voci sono
 * 7, fargli fare la 7 vuol dire fargli fare una cosa che non ha chiesto — su una lista di decisioni
 * cliniche è il tipo di aiuto che non si dà.
 *
 * ⚠️ E un numero dentro una frase più lunga non si prende: «ho 3 clienti da chiamare» non è «fai la
 * 3». Si accettano solo le forme in cui il numero è la risposta.
 */
const PAROLE_ORDINALI: Record<string, number> = {
  prima: 1, primo: 1, seconda: 2, secondo: 2, terza: 3, terzo: 3, quarta: 4, quarto: 4,
  quinta: 5, quinto: 5, sesta: 6, sesto: 6, settima: 7, settimo: 7, ottava: 8, ottavo: 8,
  nona: 9, nono: 9, decima: 10, decimo: 10,
};

export function leggiIlNumero(testo: string, quante: number): number | null {
  const t = (testo ?? '').trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!t || quante <= 0) return null;
  const soloNumero = /^(?:(?:fa(?:cciamo|i)?|vai(?:\s+con)?|prendi|apri|numero|la|il|l')\s+)*(\d{1,2})$/.exec(t);
  const ordinale = /^(?:(?:fa(?:cciamo|i)?|vai(?:\s+con)?|prendi|apri|la|il)\s+)*([a-zà-ú]+)$/.exec(t);
  const n = soloNumero ? Number(soloNumero[1]) : ordinale ? PAROLE_ORDINALI[ordinale[1]] : undefined;
  if (!n || !Number.isFinite(n)) return null;
  return n >= 1 && n <= quante ? n : null;
}

/**
 * IL TESTO DELLA LISTA.
 *
 * ⚠️ Il numero sta **all'inizio della riga**: è quello che si rilegge scorrendo, e in fondo si
 * perderebbe fra i nomi. ⚠️ E si dice **come si risponde**: una lista numerata senza istruzioni fa
 * scrivere «la prima» a metà delle persone e «apri Giulia» all'altra metà.
 */
export function testoDellaLista(voci: readonly VoceDaFare[], nome?: string | null): string {
  const chi = (nome ?? '').trim();
  if (!voci.length) {
    return `${chi ? `${chi}, ` : ''}oggi non c'è niente che aspetti te. 💚`.replace(/^./, (c) => c.toUpperCase());
  }
  const righe = voci.map((v) => `${v.n}. ${v.titolo}`);
  const quante = voci.length === 1 ? 'una cosa' : `${voci.length} cose`;
  return [
    `${chi ? `Buongiorno ${chi}. ` : 'Buongiorno. '}Oggi ti aspettano ${quante}, in ordine:`,
    '',
    ...righe,
    '',
    'Dimmi il numero di quella che vuoi fare.',
  ].join('\n');
}

/** «Fatto. Ne restano 6.» — il depennamento, che è metà del motivo per cui la lista è numerata. */
export function testoDepennata(quanteRestano: number): string {
  if (quanteRestano <= 0) return 'Fatto: l’elenco è finito. 💚';
  return `Fatto. ${quanteRestano === 1 ? 'Ne resta una' : `Ne restano ${quanteRestano}`}: dimmi il numero, o «elenco» per rivederle.`;
}
