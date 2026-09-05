import { nomiIngredienti, statoElenco } from './elenco-ingredienti';
import { classifica } from './etichetta-contro-contenuto';
import { REGIMI_IN_ORDINE } from '../common/regimi';
import { suggestAllergens } from './allergens';

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
 * scrive anche lui, e **il suo vaglio è già più stretto di questi due cancelli** (riletto il 4/9
 * sera, dopo che una prima stesura di questo commento diceva «non ha nessuno dei due» — per
 * deduzione, non per lettura): `vaglia` scarta «senza ingredienti» **e** scarta ogni piatto di carne
 * o pesce, perché a colazione e negli spuntini non ci vanno — quindi il regime che il contenuto
 * smentisce lì non può nemmeno nascere. Due porte con regole diverse restano due porte, e va detto;
 * ma nessuna delle due è aperta.
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

/** Un ingrediente che si dichiara vegetale da sé: «formaggio vegano», «panna vegetale», «maionese veg». */
const DETTO_VEGETALE = /\b(?:vegan[oaei]?|vegetal[ei]|veg)\b/;

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
   * ⛔ **LE UOVA E I LATTICINI DENTRO UN PIATTO DICHIARATO VEGANO** — chiuso il 4/9 sera, dopo essere
   * stato dichiarato aperto la mattina.
   *
   * `classifica` conosce carne e pesce; `formaggio` e `uova` stanno fuori dai suoi elenchi, e lo
   * dichiara `piatto-di-cosa.ts` in testa. Qui si chiede alla deduzione degli allergeni, che le
   * conosce: se in un piatto vegano trova `latte` o `uova`, si chiede conferma — **si chiede, non si
   * ferma**, per la stessa ragione della carne: chi scrive ne sa più del riconoscitore.
   *
   * ⚠️ **Perché fino a stasera non si poteva.** La mattina chiedeva conferma su «melagrana» e
   * «piselli sgranati» (`grana` dentro una parola più lunga) — caduto con la porta unica delle
   * chiavi. Restavano **«ricotta di mandorla»** e **«uova di lino»**, che sono derivati vegetali
   * scritti in una forma che le frasi «non sono» non conoscevano: chiuso con `derivatoVegetale` in
   * `menu/exclusions.ts`, che è una regola di forma («‹nome› vegano», «‹nome› di ‹pianta›») e non
   * dieci frasi in più. La conferma arriva quindi sui piatti vegani **sbagliati**, non su quelli veri.
   *
   * ⚠️ **«formaggio vegano» qui NON chiede, e per gli allergeni resta latte: sono due porte con due
   * verso.** La deduzione degli allergeni lo tiene (decisione del 31/8: il caseinato nei prodotti
   * «vegetali» in commercio), perché toglie un tag e per un'allergia si sbaglia verso il tag che
   * resta. Questo cancello invece **chiede**, e una domanda su un ingrediente che si dichiara vegano
   * da sé è una domanda che insegna a non leggere le domande. Quindi chi scrive «vegano»,
   * «vegetale» o «veg» nel nome dell'ingrediente passa senza conferma — e il tag latte, se c'è,
   * resta scritto, che è il verso giusto.
   *
   * ⚠️ Solo `vegan`: il vegetariano le uova e i latticini li mangia.
   */
  if (regime === 'vegan') {
    const animali = suggestAllergens(r.ingredienti)
      .filter((a) => a.allergen === 'latte' || a.allergen === 'uova')
      .map((a) => ({ ...a, matched: a.matched.filter((nome) => !DETTO_VEGETALE.test(nome)) }))
      .filter((a) => a.matched.length);
    if (animali.length) {
      const cosa = animali.map((a) => (a.allergen === 'latte' ? 'latticini' : 'uova')).join(' e ');
      const prova = animali[0].matched[0];
      return {
        esito: 'conferma',
        problema:
          `Fra gli ingredienti c'è «${prova}»: un piatto dichiarato vegano non dovrebbe contenere ${cosa}. `
          + 'Se è una versione vegetale, scrivilo nel nome dell\'ingrediente («formaggio vegano», «ricotta di mandorla») e non chiederà più; '
          + 'altrimenti correggi l\'elenco, oppure dichiaralo vegetarian.',
      };
    }
  }

  return { esito: 'ok' };
}
