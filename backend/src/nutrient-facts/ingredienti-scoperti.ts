/**
 * GLI INGREDIENTI CHE IL CONTO NON SA CONTARE — l'elenco di lavoro, non una diagnostica.
 *
 * Richiesta di Simone, 19/8 sera, sulla voce dei nomi liberi: **«crea una tabella dove possiamo
 * correggere a mano»**. Fino a oggi questo elenco esisteva solo dentro `npm run diag:crudo-cotto` e
 * `npm run diag:ricerca`, cioè come testo su una shell di Render che deve aprire lui. ⚠️ Un elenco
 * di lavoro che vive in un posto dove chi deve lavorarci non entra è un elenco che nessuno lavora.
 *
 * ## Cosa risponde
 *
 * Per ogni nome di ingrediente usato nelle ricette **attive**, se il conto di quella ricetta può
 * davvero usarlo — e se non può, **perché**, perché i tre perché si chiudono in tre modi diversi:
 *
 * | motivo | cosa vuol dire | come si chiude |
 * |---|---|---|
 * | `non_in_tabella` | il nome non porta a nessuna riga | si aggiunge la riga, **o** si aggiunge il nome come sinonimo di una riga che c'è già |
 * | `solo_da_cotto` | la riga c'è ma è il valore da cotto | serve la riga a crudo: nelle ricette le grammature sono a crudo |
 * | `senza_stato` | la riga c'è e non dice se è crudo o cotto | si dichiara lo stato |
 *
 * ⚠️ **`suggerito` è il pezzo che fa risparmiare il lavoro**: quando il nome non è in tabella ma
 * l'abbinamento saprebbe portarlo a una riga esistente («olio extravergine» → «olio extravergine di
 * oliva»), lo si dice. Chi lavora l'elenco aggiunge un sinonimo invece di scrivere una riga nuova,
 * e con una riga sola chiude migliaia di ricette. ⛔ **Ma il sinonimo lo scrive una persona**: qui
 * si suggerisce, non si applica — è la stessa regola per cui l'abbinamento automatico ha un elenco
 * chiuso di qualificatori e non «tutto quello che somiglia».
 *
 * ⚠️ **Una ricetta che usa lo stesso ingrediente due volte è UNA ricetta**, non due: senza il `Set`
 * per ricetta, un piatto che ripete l'olio salirebbe in cima da solo.
 *
 * ⚠️ **Solo le ricette attive.** Una ricetta spenta non è nel piatto di nessuno, e contarla farebbe
 * salire in cima un alimento che oggi non mangia nessuno — cioè farebbe lavorare per niente.
 *
 * ⚠️ Modulo **puro**: niente Prisma, niente Nest. Le regole («questa riga si può usare per una
 * ricetta?», «questo nome porta a quale riga?») **non si riscrivono qui**: sono `scegliPerRicetta` e
 * `abbina`, le stesse che usa il conto vero. Il primo giro in produzione del 19/8 ha mostrato cosa
 * succede a ricopiarle: la diagnostica bocciava «quinoa (cruda)» perché la sua copia confrontava
 * con `['crudo']` al maschile — due risposte alla stessa domanda, e quella sbagliata era la copia.
 */

import { abbinaPerRicetta, paroleChe } from './abbinamento-alimenti';
import { scegliPerRicetta } from './stato-alimento';
import { normalizzaNome } from './valori-nutrizionali.service';

export type MotivoScoperto = 'non_in_tabella' | 'solo_da_cotto' | 'senza_stato';

export interface RigaTabella {
  name: string;
  synonyms: string[];
  state?: string | null;
}

export interface RicettaConIngredienti {
  ingredients: unknown;
}

export interface Scoperto {
  /** Il nome **normalizzato** com'è scritto nelle ricette: è la chiave su cui si lavora. */
  nome: string;
  /** Quante ricette attive lo usano. È la priorità, ed è un fatto, non un giudizio. */
  ricette: number;
  motivo: MotivoScoperto;
  /** La riga a cui il nome si abbinerebbe: chi lavora l'elenco può aggiungerlo come sinonimo. */
  suggerito: string | null;
}

/** Quante ricette attive usano ciascun nome di ingrediente. */
export function usiNegliIngredienti(ricette: readonly RicettaConIngredienti[]): Map<string, number> {
  const usi = new Map<string, number>();
  for (const r of ricette ?? []) {
    if (!Array.isArray(r?.ingredients)) continue;
    const nella = new Set<string>();
    for (const i of r.ingredients as { name?: unknown }[]) {
      const k = normalizzaNome(String((i ?? {}).name ?? ''));
      if (k) nella.add(k);
    }
    for (const k of nella) usi.set(k, (usi.get(k) ?? 0) + 1);
  }
  return usi;
}

/**
 * L'elenco di lavoro, ordinato per **quante ricette** lo usano.
 *
 * ⚠️ L'ordine è per uso e non per gravità di proposito: «quante persone se lo trovano nel piatto» è
 * un fatto oggettivo, mentre «quanto è grave» è un giudizio clinico che non tocca a questo codice.
 */
export function ingredientiScoperti(
  usi: ReadonlyMap<string, number>,
  righe: readonly RigaTabella[],
): Scoperto[] {
  const perNome = new Map<string, RigaTabella[]>();
  for (const r of righe ?? []) {
    for (const n of [r.name, ...(r.synonyms ?? [])].map(normalizzaNome).filter(Boolean)) {
      perNome.set(n, [...(perNome.get(n) ?? []), r]);
    }
  }

  /**
   * ⚠️ **UN INDICE, NON UN GIRO DENTRO L'ALTRO** — corretto il 19/8 sera dopo la revisione
   * avversariale, e non è un'ottimizzazione per far bella figura.
   *
   * La prima versione chiamava `abbina` per **ogni** nome fuori tabella contro **ogni** riga:
   * 7831 × 250 righe × i loro sinonimi, con `paroleChe` che ri-normalizzava ogni nome ogni volta.
   * Misurato: **~5 secondi di CPU bloccante**. E questo passo gira **dentro il processo che serve
   * le clienti** (il cron di Render è un `curl` sull'endpoint, non un processo a parte): cinque
   * secondi di event loop fermo su Node, che è a thread singolo, con l'health check a 5 secondi.
   *
   * ⛔ L'8/8 un'istanza è già stata uccisa per un health check andato in timeout, e sta scritto nel
   * `render.yaml`. Qui la causa gliela stavo mettendo dentro io.
   *
   * ⚠️ La correzione non cambia una virgola del risultato: si prepara **una volta** l'elenco delle
   * righe candidate per prima parola, e `abbina` si chiama solo su quelle. Le regole restano quelle
   * di `abbinamento-alimenti.ts` — è il giro che si stringe, non la regola.
   */
  const perPrimaParola = new Map<string, RigaTabella[]>();
  for (const r of righe ?? []) {
    const chiavi = new Set<string>();
    for (const n of [r.name, ...(r.synonyms ?? [])]) {
      for (const p of paroleChe(normalizzaNome(n))) chiavi.add(p);
    }
    for (const k of chiavi) perPrimaParola.set(k, [...(perPrimaParola.get(k) ?? []), r]);
  }

  const fuori: Scoperto[] = [];
  for (const [nome, ricette] of usi) {
    const trovate = perNome.get(nome);
    if (!trovate) {
      /**
       * ⚠️ Non in tabella **col suo nome**. Ma l'abbinamento potrebbe portarlo a una riga che c'è
       * già: se ci arriva, si suggerisce quella riga — un sinonimo scritto a mano chiude il caso, e
       * chiude insieme tutte le ricette che scrivono quel nome.
       */
      /**
       * ⚠️ Solo le righe che hanno **almeno una parola in comune** con questo nome: l'abbinamento
       * chiede comunque che tutte le parole della riga compaiano nell'ingrediente, quindi una riga
       * senza nemmeno una parola in comune non può abbinarsi — provarla è tempo buttato, e moltiplicato
       * per settemila nomi diventa il blocco dell'event loop.
       */
      const candidate = new Set<RigaTabella>();
      for (const p of paroleChe(nome)) for (const r of perPrimaParola.get(p) ?? []) candidate.add(r);
      const forse = candidate.size ? abbinaPerRicetta(nome, [...candidate]) : null;
      fuori.push({ nome, ricette, motivo: 'non_in_tabella', suggerito: forse?.riga.name ?? null });
      continue;
    }
    const scelta = scegliPerRicetta(trovate);
    if (scelta.tipo === 'va_bene') continue;
    if (scelta.tipo === 'stato_ignoto') {
      fuori.push({ nome, ricette, motivo: 'senza_stato', suggerito: trovate[0].name });
      continue;
    }
    if (scelta.tipo === 'solo_cotto') {
      fuori.push({ nome, ricette, motivo: 'solo_da_cotto', suggerito: trovate[0].name });
    }
    /**
     * ⚠️ `niente` non finisce qui: vuol dire che l'elenco delle righe era vuoto, e a questo punto
     * del codice non può esserlo — `perNome` non contiene chiavi senza righe. Aggiungere un ramo
     * per un caso impossibile vorrebbe dire scrivere codice che nessuno potrà mai leggere in
     * funzione, cioè codice che invecchia senza che nessuno se ne accorga.
     */
  }
  return fuori.sort((a, b) => b.ricette - a.ricette || a.nome.localeCompare(b.nome));
}
