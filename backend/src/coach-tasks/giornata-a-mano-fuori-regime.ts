/**
 * ⛔ **LA GIORNATA SCRITTA A MANO CHE SOPRAVVIVE A UN CAMBIO DI TIPO DIETA.**
 *
 * È l'ultimo dei limiti dichiarati il 3/9 in `menu-a-mano-cosa-non-copre`, e l'unico rimasto a
 * poter arrivare nel piatto di qualcuno.
 *
 * Il caso: la nutrizionista compone a mano il menu di giovedì, con del salmone. Mercoledì la
 * cliente passa a vegana. `redeliverFutureDays` rifà le giornate future — **ma quella la salta**,
 * perché è scritta a mano. ⛔ E lì la protezione lavora **contro la cliente**: la stessa regola che
 * tiene il lavoro di una persona tiene anche un piatto che non le si può più servire.
 *
 * ## ⚠️ Perché si SEGNALA e non si cancella
 *
 * Cancellare sarebbe la scelta comoda, e sbagliata due volte: butterebbe via il lavoro di una
 * persona **senza dirglielo** — cioè il difetto che l'intoccabilità esiste per impedire — e lo
 * farebbe su un giudizio che questo modulo non è in grado di dare con certezza. «Branzino di
 * melanzane» e «Polpo d'Alghe Nori» sono piatti vegani davvero, e `classifica` li manda nei
 * **dubbi** apposta.
 *
 * ⚠️ E c'è tempo: `redeliverFutureDays` tocca solo i giorni **dopo oggi**. Un'attività alla
 * nutrizionista, con scadenza il giorno prima, arriva prima del piatto.
 *
 * ⛔ **Ma la segnalazione dev'essere una ATTIVITÀ, non un log.** È la lezione di
 * `pasti-non-serviti.ts`: quel difetto era «misurato, registrato e invisibile» — *un dato che agisce
 * e non si vede*. E dal 3/9 la nutrizionista le sue attività le vede anche nell'app.
 *
 * ## ⚠️ Cosa NON copre, detto qui
 *
 * `classifica` guarda **carne e pesce**. Un cambio verso «senza glutine» o «senza lattosio» non lo
 * vede: quelli però non sono un regime, sono esclusioni della cliente — e quelle passano dal filtro
 * che gira **a ogni scrittura**, compresa quella a mano. Il buco vero che resta è un regime nuovo
 * che questo modulo non conosce.
 */
import { classifica } from '../catalog/etichetta-contro-contenuto';

/** ⚠️ Dentro `TIPI_DELLA_NUTRIZIONISTA`: è lei che ha scritto la giornata, ed è lei che la rivede. */
export const TIPO_GIORNATA_A_MANO_DA_RIVEDERE = 'giornata_a_mano_fuori_regime';

export interface PiattoDaControllare {
  name: string;
  ingredienti: string[];
}

export interface GiornataDaRivedere {
  /** `AAAA-MM-GG`: è anche metà della chiave di unicità. */
  giorno: string;
  /** I piatti che il regime nuovo non ammette, col perché in italiano. */
  piatti: { nome: string; perche: string }[];
  /** Vero se almeno uno è un caso **certo** (non un'imitazione dubbia). */
  certo: boolean;
}

/**
 * ⛔ **Il riferimento è il GIORNO**, non la cliente: due giornate scritte a mano che diventano
 * entrambe fuori regime sono due cose da guardare, e accorparle vorrebbe dire chiuderne una sola.
 * ⚠️ Al contrario di `pasti-non-serviti`, dove il riferimento è il problema di catalogo perché il
 * rimedio è uno solo.
 */
export const riferimentoGiornataDaRivedere = (giorno: string): string => giorno;

/**
 * Quali giornate scritte a mano il regime nuovo non ammette.
 *
 * ⚠️ `regimeNuovo` nullo o `omnivore` → **niente**: l'onnivora mangia tutto, e chiedere di rivedere
 * una giornata che va bene è il modo di insegnare a chiudere le attività senza leggerle.
 */
export function giornateDaRivedere(
  giornate: readonly { giorno: string; piatti: readonly PiattoDaControllare[] }[],
  regimeNuovo: string | null | undefined,
): GiornataDaRivedere[] {
  const regime = (regimeNuovo ?? '').trim();
  if (!regime || regime === 'omnivore') return [];

  const out: GiornataDaRivedere[] = [];
  for (const g of giornate ?? []) {
    const piatti: { nome: string; perche: string }[] = [];
    let certo = false;
    for (const p of g.piatti ?? []) {
      const esito = classifica(p.name ?? '', p.ingredienti ?? [], regime);
      if (esito.tipo === 'ok') continue;
      if (esito.tipo === 'sicura') {
        certo = true;
        piatti.push({ nome: p.name, perche: `contiene ${esito.cosa} (${esito.prova})` });
      } else {
        piatti.push({ nome: p.name, perche: `forse ${esito.cosa} (${esito.prova}) — ${esito.perche}` });
      }
    }
    if (piatti.length) out.push({ giorno: g.giorno, piatti, certo });
  }
  return out;
}

/**
 * Il testo dell'attività.
 *
 * ⚠️ **Dice cosa fare, non solo cosa non va**: «riscrivila o cancellala» è l'unica frase che chiude
 * il giro — la giornata è intoccabile dal motore, quindi se non la tocca lei non la tocca nessuno.
 * ⛔ E dice **che il piatto arriva lo stesso**: un avviso che non nomina la conseguenza si legge
 * come una segnalazione di catalogo, e si rimanda.
 */
export function testoGiornataDaRivedere(
  g: GiornataDaRivedere,
  regimeNuovo: string,
): { title: string; description: string } {
  const quando = g.giorno.split('-').reverse().join('/');
  const elenco = g.piatti.map((p) => `${p.nome} — ${p.perche}`).join('; ');
  return {
    title: `Menu scritto a mano del ${quando}: piatti fuori dal regime «${regimeNuovo}»`,
    description:
      `Questa cliente è passata a «${regimeNuovo}», e la giornata del ${quando} l'avevi scritta a mano: `
      + `il motore non la rifà — è protetta apposta — quindi quei piatti le arrivano così come sono. `
      + `${g.certo ? 'Da rivedere' : 'Da controllare'}: ${elenco}. `
      + 'Riscrivila dalla sua scheda («Scrivi menu a mano»), oppure toglila e lascia che il motore la ricomponga.',
  };
}
