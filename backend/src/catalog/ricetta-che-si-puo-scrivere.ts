import { nomiIngredienti, statoElenco } from './elenco-ingredienti';
import { classifica } from './etichetta-contro-contenuto';
import { REGIMI_IN_ORDINE } from '../common/regimi';

/**
 * ⛔ **I DUE CANCELLI ALLA PORTA CHE SCRIVE UNA RICETTA IN CATALOGO.**
 *
 * Sono due decisioni di Simone del 4/9, prese su due difetti misurati su `origin/main`:
 *
 * · *«1 deve essere bloccante, non fa salvare la ricetta»* — l'elenco ingredienti vuoto;
 * · *«2 chiede doppia conferma»* — il regime dichiarato che il contenuto smentisce.
 *
 * ## ⚠️ Perché una porta sola basta, e quali sono le tre che ci passano
 *
 * `catalog.service.createRecipe` la chiamano **tutte e tre** le strade che una persona guida: la
 * pagina Ricette, la finestra «Nuova ricetta» dentro il menu della cliente (4/9) e **Vera**, che
 * detta la ricetta passo passo (`vera/scrittura-ricetta.ts`). Mettere il controllo lì vuol dire
 * chiuderle insieme; metterlo su una schermata vorrebbe dire che le altre due restano aperte, ed è
 * la forma esatta del difetto `assignments` che `CLAUDE.md` racconta.
 *
 * ⛔ **Le due strade che NON ci passano, dichiarate**: il generatore notturno
 * (`engine-rules.service.ts`) scrive con `prisma.recipe.create` e ha **già** il suo controllo
 * sull'elenco vuoto dal 2/9 — quello va riusato, non raddoppiato; `agente-pasti-leggeri.service.ts`
 * scrive anche lui e non ha nessuno dei due. Resta aperto e va detto: una porta chiusa e una no non
 * è un cancello, è un cartello.
 *
 * ## ⛔ Perché uno blocca e l'altro chiede
 *
 * Non è una gradazione di gravità: sono due domande diverse.
 *
 * · **L'elenco vuoto non è una scelta di nessuno.** Nessuno decide che una ricetta non dica cosa ci
 *   va dentro: è una cosa dimenticata. E il danno è già scritto in `elenco-ingredienti.ts` —
 *   il filtro del regime, la deduzione degli allergeni e le esclusioni della cliente guardano
 *   **tutti** l'elenco, e con l'elenco vuoto non dicono «attenzione», dicono **«ok»**. Non c'è
 *   niente da confermare, perché non c'è nessuna ragione per volerlo.
 * · **L'etichetta invece È una decisione**, e a volte la persona ne sa più del riconoscitore: in
 *   questo catalogo esistono «Polpo di ceci» e «Branzino di melanzane». Bloccare vorrebbe dire non
 *   poter più scrivere metà delle imitazioni. Quindi si chiede, si nomina l'ingrediente, e la
 *   forzatura **resta scritta nel registro**.
 */

/** Cosa può dire questo controllo. */
export type EsitoScrittura =
  /** Si scrive. */
  | { esito: 'ok' }
  /** ⛔ Non si scrive, punto: non c'è niente da confermare. */
  | { esito: 'ferma'; problema: string }
  /** ⚠️ Si scrive solo se chi chiama lo conferma **dopo** aver letto questa frase. */
  | { esito: 'conferma'; problema: string };

const PERCHE_NON_VA: Record<string, string> = {
  assente: 'Questa ricetta non ha un elenco ingredienti.',
  vuoto: 'L\'elenco ingredienti è vuoto.',
  /**
   * ⚠️ **Il caso che inganna ha una frase sua**: `[{qty: 100}]` da fuori sembra un elenco compilato
   * e `ingredients.length` risponde 1. Chi legge «l'elenco è vuoto» va a cercare un elenco che c'è.
   */
  'senza nomi': 'L\'elenco ingredienti ha delle righe ma nessun nome dentro (solo le quantità).',
};

/** Quanto è largo un regime: più avanti sta nella scala, più cose può contenere. */
const quantoLargo = (regime: string): number =>
  (REGIMI_IN_ORDINE as readonly string[]).indexOf(String(regime ?? '').trim());

export interface RicettaDaScrivere {
  nome: string;
  regime: string;
  /** La colonna `Json` così come arriva: la forma la giudica `statoElenco`. */
  ingredienti: unknown;
}

/**
 * ⛔ **PRIMA l'elenco, POI l'etichetta**, e l'ordine non è di stile: senza ingredienti `classifica`
 * non ha niente da leggere e risponderebbe «ok» su un piatto di cui non si sa niente. Un via libera
 * dato al buio è peggio di nessun controllo, perché sembra un controllo.
 */
export function controllaRicettaDaScrivere(r: RicettaDaScrivere): EsitoScrittura {
  const stato = statoElenco(r.ingredienti);
  if (stato !== 'ok') {
    return {
      esito: 'ferma',
      problema:
        `${PERCHE_NON_VA[stato]} Senza gli ingredienti non funziona nessun controllo: `
        + 'né gli allergeni, né le esclusioni delle clienti, né il regime. Scrivili prima di salvare.',
    };
  }

  const regime = String(r.regime ?? '').trim();
  const esito = classifica(r.nome, nomiIngredienti(r.ingredienti), regime);
  /**
   * ⚠️ **Solo `sicura`**, cioè carne o pesce **fra gli ingredienti** e nessun segno di imitazione.
   * `dubbia` — il nome che dice pesce e l'elenco che non ce l'ha — non chiede niente: sarebbe una
   * conferma su ogni «Polpo di ceci» del catalogo, e un avviso che arriva sempre insegna a non
   * leggere gli avvisi.
   */
  if (esito.tipo === 'sicura' && quantoLargo(regime) < quantoLargo(esito.regimeGiusto)) {
    return {
      esito: 'conferma',
      problema:
        `Fra gli ingredienti c'è «${esito.prova}»: un piatto dichiarato ${regime} non dovrebbe contenerlo. `
        + `Se è una versione vegetale va bene; altrimenti correggi l'elenco, oppure dichiaralo ${esito.regimeGiusto}.`,
    };
  }

  /**
   * ⛔ **QUELLO CHE QUESTO CONTROLLO NON GUARDA, e va detto invece di lasciarlo credere: le UOVA e
   * i LATTICINI dentro un piatto dichiarato VEGANO.**
   *
   * `classifica` conosce carne e pesce; `formaggio` e `uova` stanno fuori dai suoi elenchi, e lo
   * dichiara `piatto-di-cosa.ts` in testa. Quindi una «Frittata di zucchine» dichiarata vegana passa
   * di qui senza una parola.
   *
   * ⚠️ **Provato, e quello che resta è misurato.** La strada è dedurre `latte` e `uova` dagli
   * ingredienti con `suggestAllergens`. Fino al 4/9 non si poteva, perché chiedeva conferma su
   * **«melagrana»** e **«piselli sgranati»** — e quella ragione **è caduta con questa stessa
   * consegna**: la porta unica delle chiavi è chiusa, `grana` non fa più scattare il latte.
   *
   * ⛔ Restano due falsi misurati su quaranta piatti vegani plausibili: **«ricotta di mandorla»** e
   * **«uova di lino»**. Sono nomi di imitazione che `senzaImitazioni` non conosce — «di mandorla»
   * non è fra i segni vegetali — quindi la conferma arriverebbe sui piatti vegani veri, che è il
   * verso peggiore per un avviso.
   *
   * ⚠️ **Non è un rinvio senza data**: si chiude allungando i segni vegetali di
   * `piatto-di-cosa.ts`, che è un elenco di parole e va guardato con la stessa cautela di tutti gli
   * altri — «chi allunga questo elenco controlli prima i nomi del catalogo». Non di sponda a questa
   * consegna.
   */
  return { esito: 'ok' };
}
