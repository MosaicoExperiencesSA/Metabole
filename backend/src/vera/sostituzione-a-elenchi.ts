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
/**
 * ⛔ **La forma passiva e il vocativo vivono in `food-swaps/forme-di-sostituzione.ts`.**
 *
 * Ci sono finiti il 3/9: li usa anche la strada singola (`sostituzioniNelMessaggio`), che la passiva
 * non la conosceva — quindi «il merluzzo può essere sostituito con orata **o spigola**» si leggeva e
 * «…con orata» no. ⚠️ La stessa frase capita o buttata via a seconda di quante alternative aveva
 * scritto la nutrizionista: una forma scritta in due posti diverge, una scritta in uno solo no.
 */
import { FORME_CON_IL_NOME_PRIMA, VOCATIVO } from '../food-swaps/forme-di-sostituzione';

/** «sostituisci», «sostituisci sempre», e i refusi che compaiono davvero. */
const VERBO = '(?:sostitu[ai]?sc[iae]|sostitu[ai]sci|sostituire|cambia|rimpiazza)';
/** «sempre», «in tutti i menu»: parole di rinforzo che non cambiano l'ordine. */
const RINFORZO = '(?:\\s+(?:sempre|ovunque|in\\s+tutti\\s+i\\s+men[uù]|nei\\s+men[uù]))?';

const FORMA = new RegExp(`\\b${VERBO}${RINFORZO}\\s+(.+?)\\s+con\\s+(.+)$`, 'i');

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
/**
 * ⛔ **LA NEGAZIONE SI CERCA NELLA PROPOSIZIONE DELL'ORDINE, non nel messaggio intero.**
 *
 * `daScartare` è nata per una frase sola. Applicandola al messaggio intero — che è quello che fa il
 * ramo passivo, ancorato a `^` — si perdono le frasi in cui la negazione sta in un'**altra**
 * proposizione, e in italiano è quasi sempre lì:
 *
 * ```
 * non digerisce il glutine, sostituisci la pasta con il riso o la quinoa
 * niente latticini, sostituisci il formaggio con il tofu o il seitan
 * le va bene? sostituisci il pane con le gallette o i cracker
 * ```
 *
 * ⚠️ Sono **diciassette** frasi normali su un campione di prova, tutte spente: misurate in
 * revisione, dopo che il commento di questa correzione dichiarava un costo «misurato» che non lo
 * era. ⛔ *Una guardia che blocca il caso normale non è prudente: è rotta, e sembra prudente* — è
 * scritto in testa a `frasi-normali-che-devono-passare.spec.ts`, e l'ho dovuto imparare due volte.
 *
 * Quindi si guarda **da dove comincia la proposizione che contiene il verbo**: «mai sostituire…» e
 * «evita di sostituire…» ce l'hanno dentro e restano fuori; «non digerisce il glutine, sostituisci…»
 * no e passa.
 */
function clausolaDellOrdine(frase: string, doveIlVerbo: number): string {
  let inizio = 0;
  for (const sep of [',', ';', ':', '?', '!', '.', '\n']) {
    const i = frase.lastIndexOf(sep, doveIlVerbo);
    if (i >= 0 && i + 1 > inizio) inizio = i + 1;
  }
  return frase.slice(inizio);
}

function leggiForma(testo: string): RegExpExecArray | null {
  /**
   * ⛔ **`daScartare` PRIMA DI TUTTO, imperativo compreso** (3/9, trovato scrivendo le prove delle
   * forme nuove — non da una rilettura).
   *
   * Stava **dopo** il ramo imperativo, e il commento diceva «sul ramo passivo si passa da
   * `daScartare`» come se l'asimmetria fosse voluta. Misurato:
   *
   *     «**mai** sostituire il pane con le gallette o i cracker»   → sostituisci pane con gallette
   *     «**evita di** sostituire il pane con le gallette»          → sostituisci pane con gallette
   *
   * ⚠️ Cioè **il contrario di quello che era stato scritto**, nel ramo che *esegue un ordine*. Il
   * «non» lo fermava un controllo più a monte in `capisci`; «mai» ed «evita» no, e arrivavano fino
   * in fondo. È lo stesso difetto che `daScartare` esiste per chiudere — «il merluzzo **non** può
   * essere sostituito con orata» — lasciato aperto dalla porta accanto.
   *
   * ⚠️ Misurato anche il costo: le due frasi vere del 31/8 (Lorena, Jolanda) non contengono nessuna
   * di quelle parole e passano identiche; le frasi con «?» erano già rifiutate, perché la coda
   * («va bene?») rendeva illeggibile l'ultimo pezzo dell'elenco.
   */
  const pulita = senzaCodaDiAmbito(testo ?? '');
  const imperativa = FORMA.exec(pulita);
  if (imperativa) return daScartare(clausolaDellOrdine(pulita, imperativa.index)) ? null : imperativa;
  if (daScartare(testo ?? '')) return null;
  /**
   * ⚠️ **Tutte le forme in cui il nome sta prima**, dallo stesso elenco che usa la strada singola
   * (`food-swaps/forme-di-sostituzione.ts`): la passiva, la freccia e «al posto di» che apre la
   * frase. Prima qui c'era solo la passiva, quindi «al posto del merluzzo può mettere orata **o
   * spigola**» non veniva letta né di qua né di là.
   *
   * ⛔ Il tetto di tre parole vale **solo** dove il pezzo di sinistra non è delimitato (`risalita`):
   * lì contiene tutto quello che c'era prima, e oltre tre parole non è più un nome ma una frase.
   * Dove invece una parola chiave lo delimita — «al posto **del** merluzzo …» — contarle sarebbe
   * rifiutare nomi lunghi legittimi.
   */
  const senzaVocativo = pulita.replace(VOCATIVO, '');
  for (const { re, risalita } of FORME_CON_IL_NOME_PRIMA) {
    const m = re.exec(senzaVocativo);
    if (!m) continue;
    if (risalita && paroleDaLeggere(m[1]) > PAROLE_DEL_NOME) continue;
    return m;
  }
  return null;
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
    const forme = [FORMA.exec(t), ...FORME_CON_IL_NOME_PRIMA.map((f) => f.re.exec(t.replace(VOCATIVO, '')))];
    for (const m of forme) {
      if (m && (eUnElenco(m[1]) || eUnElenco(m[2]))) return true;
    }
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
