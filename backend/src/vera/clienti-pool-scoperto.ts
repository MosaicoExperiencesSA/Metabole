/**
 * QUANTE CLIENTI HANNO IL POOL SOTTO SOGLIA — l'ultimo modulo che mancava a «quello che aspetta me».
 *
 * ## Perché non c'era, e cosa lo sbloccava
 *
 * Il conto del pool esisteva già (`pool-disponibile.ts`), ma **solo per una cliente per volta**,
 * dentro l'anteprima che Vera mostra prima di scrivere una restrizione. Farlo su tutte sembrava
 * caro: leggere il pool di 315 clienti vuol dire 315 letture di ricette.
 *
 * ⚠️ **Non è vero, e la ragione è che il pool non è della cliente: è della DIETA.** Le esclusioni
 * sono sue, il pool no — e le diete sono poche. Si leggono i pool **una volta per dieta**, poi il
 * conto per ogni cliente è aritmetica in memoria. È questo che rende la domanda «quante sono
 * scoperte?» una domanda che si può fare ogni volta che si apre la pagina.
 *
 * ## ⚠️ Tre stati, non due
 *
 * «Nessuna scoperta» e «non lo so» sono due risposte diverse, e questo modulo non le confonde: una
 * cliente **senza dieta assegnata** (o con una dieta di cui non si è letto il pool) non è una
 * cliente a posto — è una di cui non sappiamo niente, e finisce in `nonValutabili`. Chi legge il
 * numero deve poter distinguere «va tutto bene» da «non l'ho guardato».
 */
import { calcolaPool, type RicettaDelPool } from './pool-disponibile';

/** Una cliente, ridotta a ciò che serve: la sua dieta e le chiavi già espanse delle sue esclusioni. */
export interface ClienteDaContare {
  id: string;
  nome: string | null;
  dietId: string | null;
  /** Già passate da `exclusionKeys`: qui non si interpreta niente, si conta. */
  chiaviEscluse: string[];
}

export interface EsitoConteggioPool {
  /** Clienti con almeno un pasto PRINCIPALE sotto soglia. */
  quante: number;
  /** Le prime, per nome: servono al messaggio, non a fare l'elenco. */
  nomi: string[];
  /** Quante sono state davvero guardate. */
  esaminate: number;
  /** ⚠️ Quelle di cui non si può dire niente: senza dieta, o con una dieta di cui manca il pool. */
  nonValutabili: number;
}

/** Quanti nomi si portano dietro: oltre, è un elenco e non un avviso. */
const MAX_NOMI = 5;

/**
 * Le clienti con almeno un pasto principale sotto soglia.
 *
 * `poolPerDieta` va letto **una volta per dieta** dal chiamante: è tutto il senso di questo modulo.
 */
export function contaClientiSottoSoglia(
  clienti: readonly ClienteDaContare[],
  poolPerDieta: ReadonlyMap<string, Map<string, RicettaDelPool[]>>,
  soglia: number,
): EsitoConteggioPool {
  const scoperte: string[] = [];
  let esaminate = 0;
  let nonValutabili = 0;

  for (const c of clienti) {
    const pool = c.dietId ? poolPerDieta.get(c.dietId) : undefined;
    // ⚠️ Una dieta che non c'è, o un pool vuoto, non è «a posto»: è «non lo so». Contarla fra le
    // sane darebbe un numero rassicurante e falso, che è il modo più efficace di non guardare più
    // questo riquadro.
    if (!pool || pool.size === 0) {
      nonValutabili += 1;
      continue;
    }
    esaminate += 1;
    const esito = calcolaPool(pool, c.chiaviEscluse, soglia);
    if (esito.pastiScoperti.length > 0) scoperte.push(c.nome ?? 'una cliente');
  }

  return {
    quante: scoperte.length,
    nomi: scoperte.slice(0, MAX_NOMI),
    esaminate,
    nonValutabili,
  };
}
