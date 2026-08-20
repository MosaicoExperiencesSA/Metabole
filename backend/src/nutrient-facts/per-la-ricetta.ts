/**
 * «QUESTO INGREDIENTE DI RICETTA, CHE RIGA È E LA POSSO USARE?» — la domanda intera, in un posto.
 *
 * È la domanda che fa il conto dei macro quando la nutrizionista detta una ricetta, ed è la stessa
 * che fa il passo notturno per decidere se un nome è un lavoro da fare. Sono **la stessa domanda**,
 * e fino al 20/8 avevano due risposte scritte in due file.
 *
 * ## ⚠️ PERCHÉ ESISTE QUESTO MODULO, E NON È ORDINE PER L'ORDINE
 *
 * La risposta si compone di tre passi, e ognuno è un'occasione di divergere:
 *
 *   1. il nome esatto (nome o sinonimo, normalizzati)
 *   2. se non c'è, l'abbinamento — `abbinaPerRicetta`
 *   3. e su quello che si trova, la convenzione del crudo — `scegliPerRicetta`
 *
 * ⛔ Il 20/8 il passo 2 è divergito davvero, e ha fatto danno: `diag:crudo-cotto` abbinava **senza
 * passare lo stato della riga**, quindi rispondeva «non si abbina» su nomi che in produzione si
 * abbinano — e quella diagnostica è il foglio da cui la nutrizionista decide quali righe scrivere a
 * mano. La stava mandando a fare un lavoro che non serve.
 *
 * ⚠️ **E su una seconda divergenza mi sono sbagliato io, prima di consegnarla.** Avevo scritto che
 * anche il passo 3 divergeva — il passo notturno raccoglieva le righe «con lo stesso nome» dall'indice
 * per **nome-o-sinonimo**, la produzione per uguaglianza sul `name` — e l'avevo messo nel commento
 * come un difetto trovato. ⛔ **Non può manifestarsi**, e a dirmelo è stata una mutazione che non
 * mordeva: se un'altra riga porta quel nome (come nome **o** come sinonimo), `abbina` la vede come
 * un secondo candidato di pari peso e torna `null` — «due righe che vanno bene uguale = non lo so».
 * Quindi quando l'abbinamento risponde, quella riga è unica e i due criteri **coincidono sempre**.
 * Verificato eseguendo, non ragionandoci.
 *
 * ⚠️ *Una ragione falsa in un commento è peggio di nessun commento*: chi legge si fida, e ci
 * costruisce sopra. Il modulo resta — e resta per la ragione vera, che è **il passo 2**: tre passi
 * scritti in due posti divergono, e quando divergono nessuno se ne accorge da fuori, perché la
 * produzione conta bene e l'elenco di lavoro racconta un'altra cosa. *Due punti che rispondono alla
 * stessa domanda non devono somigliarsi: chiamano tutti e due questo.*
 */

import { abbinaPerRicetta, type RigaDiTabella } from './abbinamento-alimenti';
import { type EsitoPerRicetta, scegliPerRicetta } from './stato-alimento';
import { normalizzaNome } from './valori-nutrizionali.service';

export interface RigaPerRicetta extends RigaDiTabella {
  state?: string | null;
}

/**
 * L'esito per un ingrediente scritto libero, contro tutta la tabella.
 *
 * ⚠️ **Le righe con lo stesso nome si guardano insieme**, e non è un dettaglio: «riso» a crudo e
 * «riso» bollito sono due righe, e la convenzione decide fra loro. Prendendone una sola, quale
 * risponde lo deciderebbe l'ordine di lettura del database — che è il difetto da cui è nata la
 * voce 228.
 *
 * ⚠️ Il confronto è per **nome uguale**. Allargarlo a «nome o sinonimo» darebbe lo stesso risultato
 * — quando `abbina` risponde, quella riga è unica per costruzione — ma direbbe una cosa più larga di
 * quella che si intende, e il giorno che `abbina` cambia regola la differenza diventerebbe vera.
 */
export function esitoPerIngrediente<T extends RigaPerRicetta>(
  nome: string,
  tutte: readonly T[],
): EsitoPerRicetta<T> {
  const t = normalizzaNome(nome);
  if (t.length < 3) return { tipo: 'niente' };

  const esatti = tutte.filter((v) => [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).includes(t));
  if (esatti.length) return scegliPerRicetta(esatti);

  const trovato = abbinaPerRicetta(nome, tutte);
  if (!trovato) return { tipo: 'niente' };
  const stessoNome = tutte.filter((v) => v.name === trovato.riga.name);
  return scegliPerRicetta(stessoNome.length ? stessoNome : [trovato.riga]);
}

/** La riga a cui l'abbinamento arriva, per poterla **suggerire** anche quando non si può usare. */
export function rigaSuggerita<T extends RigaPerRicetta>(nome: string, candidate: readonly T[]): T | null {
  return abbinaPerRicetta(nome, candidate)?.riga ?? null;
}
