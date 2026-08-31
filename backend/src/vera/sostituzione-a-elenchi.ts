/**
 * ⛔ **«SOSTITUISCI A, B, C CON X, Y» — la forma che la nutrizionista usa e che nessuno leggeva.**
 *
 * Dalle frasi vere del 31/8, pagina «frasi che non ho capito»:
 *
 *   · «a lorena polidoro sostituisci sempre Indivia, Scarola, Verza, Cavolo, Finocchio… con
 *      zucchine, melanzane, peperoni, carciofi…»
 *   · «a jolanda sostitusci ceci con fagioli o lenticchie»
 *
 * Il riconoscitore che c'era legge **un** alimento per parte (`impara-dalla-chat.ts`, nato per
 * imparare dalle chat con le clienti, dove le sostituzioni sono una alla volta). Su un elenco non
 * falliva: rispondeva una **parte** — ed è il modo peggiore di sbagliare.
 *
 * ## Perché un file suo e non due righe là dentro
 *
 * Perché sono due mestieri. Là si **impara** da una conversazione: si cerca una sostituzione dentro
 * un testo che parla d'altro, e va bene non trovarla. Qui si **esegue** un ordine: chi scrive sta
 * dettando una regola sul cibo di una persona, e una lettura parziale è peggio di nessuna lettura.
 * Le due funzioni rispondono a domande diverse e possono sbagliare in versi diversi.
 *
 * ⚠️ **Il verbo si scrive anche storto.** «sostitusci» compare due volte nelle frasi vere: chi
 * scrive di fretta sbaglia, e un traduttore che si offende per una lettera non serve a niente. Le
 * varianti stanno nella regexp, non in un correttore che indovina.
 */
import { daScartare, paroleDaLeggere } from '../food-swaps/impara-dalla-chat';
import { leggiElenco, eUnElenco } from './elenco-alimenti';

/** «sostituisci», «sostituisci sempre», e i refusi che compaiono davvero. */
const VERBO = '(?:sostitu[ai]?sc[iae]|sostitu[ai]sci|sostituire|cambia|rimpiazza)';
/** «sempre», «in tutti i menu»: parole di rinforzo che non cambiano l'ordine. */
const RINFORZO = '(?:\\s+(?:sempre|ovunque|in\\s+tutti\\s+i\\s+men[uù]|nei\\s+men[uù]))?';

const FORMA = new RegExp(`\\b${VERBO}${RINFORZO}\\s+(.+?)\\s+con\\s+(.+)$`, 'i');

/**
 * ⛔ **LA FORMA PASSIVA: «il merluzzo può essere sostituito con orata, salmone o spigola».**
 *
 * È come scrive chi detta una regola invece di dare un ordine, ed è la frase vera del 31/8. Qui il
 * primo alimento sta **prima** del verbo, quindi la forma imperativa qui sopra non può leggerla: il
 * gruppo che cattura sarebbe vuoto, e la frase moriva in «non ci arrivo».
 *
 * ⛔ **L'ausiliare è obbligatorio, e non è pignoleria.** La prima stesura accettava il participio
 * **nudo** (`sostituito con`) con un `^(.+?)` pigro davanti: la revisione l'ha smontata misurando —
 * «il pane **era stato** sostituito con gallette» diventava una regola, e «**in teoria** il riso può
 * essere sostituito con quinoa» metteva «in teoria il riso» al posto dell'alimento. Una lettura
 * plausibile e sbagliata è peggio di un «non ci arrivo».
 */
const FORMA_PASSIVA = new RegExp(
  '^(.+?)\\s+(?:' +
    '(?:pu[òo]|possono|deve|devono)\\s+essere\\s+(?:sostituit[oaie]|cambiat[oaie])|' +
    '(?:va|vanno)\\s+(?:sostituit[oaie]|cambiat[oaie])|' +
    'si\\s+(?:pu[òo]|possono)\\s+(?:sostituire|cambiare)' +
  ')\\s+con\\s+(.+)$',
  'i',
);

/**
 * ⛔ **LA CODA CHE DICE «PER CHI VALE» NON È UN ALIMENTO**, e va staccata prima di leggere.
 *
 * «…con orata, salmone o spigola **estendi la regola a tutti**»: senza questa riga l'ultimo pesce
 * dell'elenco diventa «spigola estendi la regola a tutti», che non è leggibile come nome — e
 * siccome un elenco letto a metà vale `null`, **tutta** la frase cadeva in «non ci arrivo».
 *
 * ⛔ **L'inizio è ancorato a un confine di parola**, e la ragione è un difetto vero trovato in
 * revisione: con `[\\s,;]*` davanti a `(?:e\\s+)?` la «e» **finale della parola precedente** veniva
 * scambiata per la congiunzione, e la regola si scriveva su «lenticchi», «spigol», «melanzan». Un
 * troncamento silenzioso dentro una regola è esattamente ciò che questo modulo esiste per abolire.
 *
 * ⚠️ Accetta «a tutt**i**», non solo «a tutt**e**»: la frase vera diceva «tutti».
 */
const CODA_AMBITO = new RegExp(
  '(?:^|[\\s,;])\\s*(?:e\\s+)?(?:' +
    'estendi(?:la)?(?:\\s+la\\s+regola)?\\s+(?:a|per|su)\\s+tutt[ie]|' +
    '(?:vale|valga|valida)\\s+per\\s+tutt[ie]|' +
    '(?:a|per)\\s+tutt[ie](?:\\s+(?:le|i)\\s+(?:client[ie]|pazient[ie]))?|' +
    'regola\\s+generale' +
  ')\\s*$',
  'i',
);

/**
 * Il vocativo che apre la frase: «**a Marta** il merluzzo può essere sostituito con…».
 *
 * ⛔ Senza staccarlo, il nome della cliente finisce **dentro il nome dell'alimento** («al posto di
 * "a Marta il merluzzo"…»). Chi lo legge poi come cliente è `nomePersona`, che lavora sulla frase
 * intera: qui si toglie solo per non sporcare l'alimento.
 */
const VOCATIVO = /^(?:a|ad|per|alla|al)\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+)?[\s,;]+/u;

/**
 * La frase senza la coda che dice per chi vale. Se la coda non c'è, torna la frase com'è.
 *
 * ⚠️ Il pezzo staccato **non** viene riletto da nessuno: l'ambito lo si chiede comunque, un passo
 * più avanti. Vuol dire che a chi scrive «regola generale» Vera domanda lo stesso «per chi vale?» —
 * una domanda in più, non un errore. *La ragione scritta qui dev'essere quella vera:* la prima
 * stesura di questo commento diceva che `leggiAmbito` lo rileggeva, e non era così.
 */
export function senzaCodaDiAmbito(testo: string): string {
  return (testo ?? '').replace(CODA_AMBITO, '').trim();
}

/**
 * L'imperativo o la passiva, sulla frase ripulita da coda d'ambito e vocativo.
 *
 * ⛔ Sul ramo passivo si passa da `daScartare`: «il merluzzo **non** può essere sostituito con
 * orata» diceva il **contrario** di quello che veniva scritto, e nessuna riga di questo file lo
 * fermava. ⚠️ E il lato sinistro non può essere una mezza frase: oltre tre parole vere non è più il
 * nome di un alimento, è il resto del discorso.
 */
function leggiForma(testo: string): RegExpExecArray | null {
  const pulita = senzaCodaDiAmbito(testo ?? '');
  const imperativa = FORMA.exec(pulita);
  if (imperativa) return imperativa;
  if (daScartare(testo ?? '')) return null;
  const passiva = FORMA_PASSIVA.exec(pulita.replace(VOCATIVO, ''));
  if (!passiva) return null;
  return paroleDaLeggere(passiva[1]) <= PAROLE_DEL_NOME ? passiva : null;
}

/** Oltre tre parole vere, il lato sinistro di una passiva non è un alimento ma una frase. */
const PAROLE_DEL_NOME = 3;

export interface SostituzioneAElenchi {
  da: string[];
  a: string[];
}

/**
 * Vero se la frase **chiede** una sostituzione in forma di elenco, indipendentemente dal fatto che
 * poi si riesca a leggerla.
 *
 * ⚠️ Serve a chi chiama per distinguere «non è questa forma» da «è questa forma e non l'ho letta
 * tutta»: nel secondo caso non si deve ripiegare su un riconoscitore più permissivo, che
 * risponderebbe con la mezza lettura che stiamo togliendo.
 */
export function chiedeUnaSostituzioneAElenchi(testo: string): boolean {
  /**
   * ⛔ **Si guarda anche la frase GREZZA**, non solo quella ripulita dalla coda d'ambito. Se
   * togliendo la coda sparisce l'unica virgola, `eUnElenco` diventa falso su tutte e due le parti e
   * questa guardia smetteva di scattare: la frase cadeva sul riconoscitore vecchio, che di
   * «tacchino e vitello» leggeva solo il tacchino e **perdeva il resto in silenzio**. È il caso
   * Lorena in miniatura, rinato dalla porta accanto (trovato in revisione, 31/8).
   */
  for (const t of [testo ?? '', senzaCodaDiAmbito(testo ?? '')]) {
    const m = FORMA.exec(t) ?? FORMA_PASSIVA.exec(t.replace(VOCATIVO, ''));
    if (m && (eUnElenco(m[1]) || eUnElenco(m[2]))) return true;
  }
  return false;
}

/**
 * Gli elenchi di una frase di sostituzione, oppure `null` se la frase non è di questa forma **o**
 * se non si legge per intero.
 *
 * ⛔ I due `null` sono volutamente indistinguibili qui: chi vuole saperlo chiede a
 * `chiedeUnaSostituzioneAElenchi`. Restituire «letta a metà» come valore vorrebbe dire offrire a
 * qualcuno la possibilità di usarla.
 */
export function sostituzioneAElenchi(testo: string): SostituzioneAElenchi | null {
  const m = leggiForma(testo);
  if (!m) return null;
  /**
   * ⚠️ Si legge a elenco **solo** se almeno una delle due parti ne ha la forma. Senza questo
   * controllo passerebbe di qui anche «sostituisci il pollo con il tacchino», che il riconoscitore
   * di sempre legge già bene: due strade per lo stesso caso sono due strade che divergono.
   */
  if (!eUnElenco(m[1]) && !eUnElenco(m[2])) return null;
  const da = leggiElenco(m[1]);
  const a = leggiElenco(m[2]);
  if (!da || !a) return null;
  return { da, a };
}
