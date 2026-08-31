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
import { leggiElenco, eUnElenco } from './elenco-alimenti';

/** «sostituisci», «sostituisci sempre», e i refusi che compaiono davvero. */
const VERBO = '(?:sostitu[ai]?sc[iae]|sostitu[ai]sci|sostituire|cambia|rimpiazza)';
/** «sempre», «in tutti i menu»: parole di rinforzo che non cambiano l'ordine. */
const RINFORZO = '(?:\\s+(?:sempre|ovunque|in\\s+tutti\\s+i\\s+men[uù]|nei\\s+men[uù]))?';

const FORMA = new RegExp(`\\b${VERBO}${RINFORZO}\\s+(.+?)\\s+con\\s+(.+)$`, 'i');

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
  const m = FORMA.exec(testo ?? '');
  if (!m) return false;
  return eUnElenco(m[1]) || eUnElenco(m[2]);
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
  const m = FORMA.exec(testo ?? '');
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
