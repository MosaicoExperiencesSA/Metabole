/**
 * «PESCE TRANNE SALMONE» — la frase che va chiarita con una persona (voce 267, chiusa il 19/8).
 *
 * ## Cosa c'era già, e cosa mancava
 *
 * Dal 18/8 le cinque porte da cui si scrivono i cibi esclusi **segnalano** mentre si scrive:
 * «pesce tranne salmone» come termine intero non esclude niente, e spezzato sulla virgola rende
 * escluso il **salmone**, cioè l'opposto (`common/esclusioni-scritte-bene.ts`). ⚠️ Ma l'avviso
 * **non corregge**, di proposito: la correzione più ovvia — tenere la prima parola — escluderebbe
 * tutto il pesce, salmone compreso.
 *
 * Restava la domanda vera, e la risposta di Simone (19/8) è: **la fa una persona.** Chi ha scritto
 * quella frase è l'unica che sa cosa intendeva, e «quindi il tonno lo mangi?» è una domanda che si
 * risponde bene solo parlando.
 *
 * ## ⚠️ Perché un'attività della coach e non una domanda di Gaia
 *
 * Stessa ragione della finestra del digiuno (`finestra-mai-chiesta.ts`), più una: qui la cliente ha
 * **già scritto** cosa non vuole mangiare. Una domanda automatica a freddo su una frase che ha
 * scritto lei suona come «non ti abbiamo capita» — e la prima volta che una persona sente questo, la
 * volta dopo scrive meno. Una coach che chiede la stessa cosa sta invece facendo il suo mestiere.
 *
 * ⚠️ Si chiede **una volta sola per come è scritto l'elenco**: il riferimento è l'impronta del testo
 * (vedi `impronta`). Se lei riscrive le esclusioni e ci rimette un «tranne», è una frase nuova e la
 * domanda si rifà; se la coach segna l'attività fatta e l'elenco resta com'è, non si ripropone —
 * vuol dire che ne hanno parlato e va bene così.
 */
import { createHash } from 'crypto';
import { problemiEsclusioni } from '../common/esclusioni-scritte-bene';

/** Il tipo dell'attività: è anche metà della chiave di unicità (`clientId + kind + refId`). */
export const TIPO_ESCLUSIONI_DA_CHIARIRE = 'esclusioni_da_chiarire';

/**
 * Il riferimento dell'attività: **l'impronta dell'elenco**, non una data né un id.
 *
 * ⚠️ Con un riferimento fisso, una cliente che riscrive le esclusioni e ci rimette dentro un'altra
 * frase ambigua non verrebbe più richiamata: la domanda risulterebbe «già fatta» su un testo che non
 * esiste più. Con la data, l'attività rinascerebbe ogni notte sulla stessa frase. L'impronta cambia
 * quando cambia il testo, che è esattamente quando la domanda torna ad avere senso.
 */
export function impronta(voci: readonly string[]): string {
  const normalizzato = (voci ?? [])
    .map((v) => (v ?? '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
  return createHash('sha1').update(normalizzato).digest('hex').slice(0, 12);
}

/**
 * Le frasi da chiarire, o `[]`.
 *
 * ⚠️ **Solo quelle con una parola di eccezione** («tranne», «a parte», «solo se»…): sono le uniche
 * che possono fare l'**opposto** di quello che la cliente voleva. Una frase come «non mi piace la
 * cicoria» è scritta male ma non è pericolosa — l'avviso mentre scrive basta, e trasformarla in un
 * lavoro per la coach vorrebbe dire riempirle la colonna di cose che non cambiano cosa mangia.
 */
export function frasiDaChiarire(voci: readonly string[]): string[] {
  return problemiEsclusioni(voci ?? [])
    .filter((p) => p.tipo === 'eccezione')
    .map((p) => p.voce);
}

/**
 * Il testo dell'attività.
 *
 * ⚠️ Dice **cosa succede intanto**, come quello della finestra: senza, una coach può credere che il
 * piano sia fermo. Qui intanto non succede niente di rotto — quel termine semplicemente non toglie
 * nessun piatto — ma il risultato è che lei riceve una cosa che pensava di aver escluso.
 */
export function testoEsclusioniDaChiarire(nome: string | null | undefined, frasi: readonly string[]): { title: string; description: string } {
  const chi = (nome ?? '').trim() || 'la cliente';
  const elenco = frasi.map((f) => `«${f}»`).join(', ');
  return {
    title: `Chiedi a ${chi} cosa intendeva: ${elenco}`,
    description:
      `Fra i cibi esclusi ha scritto ${elenco}, che è una frase e non un alimento. ⚠️ Intanto non è ` +
      'ferma e non è rotta: quel termine semplicemente non toglie nessun piatto, quindi il cibo che ' +
      'credeva di aver escluso continua ad arrivarle. ⚠️ E non correggiamo noi: su «pesce tranne ' +
      'salmone» la correzione più ovvia — tenere la prima parola — toglierebbe TUTTO il pesce, ' +
      'salmone compreso, che è il contrario di quello che ha chiesto. Sentitela e riscrivete ' +
      'insieme l\'elenco alimento per alimento, dalla scheda (Modifica → «Cibi esclusi») o dal ' +
      'Profilo dell\'app. Se ne parlate e l\'elenco resta com\'è, segna l\'attività fatta: non te la ' +
      'ripropongo finché non lo riscrive.',
  };
}
