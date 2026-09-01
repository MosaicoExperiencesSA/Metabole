/**
 * **RIFÀ LE GIORNATE FUTURE CHE OGGI NON PASSEREBBERO IL CONTROLLO DI SICUREZZA.**
 *
 * ⛔ Serve perché `MenuDay` è uno **snapshot** e l'upsert ha `update: {}`: una giornata già in
 * calendario resta com'era il giorno in cui è stata composta, **con il codice di allora**. Correggere
 * il motore non corregge il calendario — e il 31/8, correggendo `swapDislikedDishes`, restavano
 * scritte le giornate composte prima.
 *
 * Guarda **due cose** (`menu/giorni-non-sicuri.ts`): un piatto che non si sarebbe dovuto servire, e
 * un piatto ammissibile a cui **manca la sostituzione** sul pasto — la merenda con le albicocche
 * secche, che è ammissibile solo se alla cliente si dice cosa non mettere.
 *
 * ⚠️ Cancellare un giorno vuol dire farlo ricomporre al motore, e **non si cancella un giorno che la
 * cliente ha già aperto**: quella decisione non è di questo script, è della porta unica
 * `vera/menu-da-rifare.ts` (`codaDaRifare`), che sa dire anche «non lo so» — e nel dubbio non toglie
 * un menu di mano a nessuno.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run rifai:non-sicuri              → SOLA LETTURA: dice cosa farebbe, e non tocca niente
 *   APPLICA=1 npm run rifai:non-sicuri    → cancella le code, il motore le ricompone al prossimo giro
 *
 * ⚠️ Il default è leggere. Uno script che cancella menu non parte mai da solo.
 */
import { PrismaClient } from '@prisma/client';
import { ProfiloConEsclusioni, RicettaDaValutare, esclusioniDi } from '../src/menu/esclusioni-della-cliente';
import { pastiDaSistemare } from '../src/menu/giorni-non-sicuri';
import { statoSupervisione, type ProfiloDaSupervisionare } from '../src/clients/via-libera-clinico';
import { attivoInCorso } from '../src/commerce/abbonamento-in-corso';
import { STATI_CON_UN_PIANO } from '../src/commerce/stati-abbonamento';
import { toDateOnly } from '../src/common/date-only';
import { perchePotrebbeNonRicomporre } from '../src/menu/perche-non-ricompone';
import {
  CAMPI_DEL_GIORNO,
  GiornoDaValutare,
  codaDaRifare,
  daQuandoSiPuoRifare,
  ricetteDelGiorno,
} from '../src/vera/menu-da-rifare';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';

type ProfiloDelloScript = {
  userId: string;
  name: string | null;
  planStartDate: Date | null;
  planHeldAt: Date | null;
  screeningFlag: boolean | null;
  idoneita: string | null;
  idoneitaVisitaEntro: Date | null;
  allergies: string[];
  intolerances: string[];
  dislikedFoods: string[];
};

/**
 * ⛔ **UNA GIORNATA SCRITTA A MANO NON SI CANCELLA.** La giornata dettata dalla nutrizionista in
 * chat e il piatto cambiato d'accordo con la cliente nascono **senza** le sostituzioni scritte (è
 * la voce `porte-che-scrivono-piatti-senza-controllo`): per questo script sembrerebbero «da
 * rifare», e rifarle vorrebbe dire buttare via il lavoro di una persona senza dirlo a nessuno.
 * Vanno in «da guardare a mano».
 */
function scrittaAMano(meals: unknown): boolean {
  if (!Array.isArray(meals)) return false;
  return (meals as { cambioPiatto?: unknown; substitutions?: { origine?: string }[] }[]).some(
    (m) => !!m?.cambioPiatto || (m?.substitutions ?? []).some((s) => s?.origine === 'chat' || s?.origine === 'app'),
  );
}
const giornoIt = (d: Date) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

async function main(): Promise<void> {
  console.log('='.repeat(74));
  console.log('  GIORNATE FUTURE DA RIFARE — piatti che oggi non passerebbero il controllo');
  console.log(APPLICA ? '  ⚠️  APPLICA=1: le code verranno CANCELLATE (il motore le ricompone).' : '  Sola lettura: non viene toccato niente. Per agire: APPLICA=1');
  console.log('='.repeat(74));

  /**
   * ⚠️ **Anche le intolleranze**, e non è pignoleria: `esclusioniDi` costruisce la regola dei
   * solfiti guardando tutti e due i campi, apposta, «perché passargliene uno solo lo rendeva cieco
   * su chi li ha scritti nel posto sbagliato» (24/8). Filtrando qui sulle sole `allergies` lo
   * script non guarderebbe proprio le clienti che quella riga esiste per non perdere.
   */
  const profili = (await prisma.clientProfile.findMany({
    where: { OR: [{ allergies: { isEmpty: false } }, { intolerances: { isEmpty: false } }] },
    select: {
      userId: true, name: true, planStartDate: true, planHeldAt: true,
      // I tre campi del via libera clinico: senza, la domanda sulla visita non si può fare.
      screeningFlag: true, idoneita: true, idoneitaVisitaEntro: true,
      allergies: true, intolerances: true, dislikedFoods: true,
    },
  })) as ProfiloDelloScript[];

  console.log(`Clienti con allergie o intolleranze dichiarate: ${profili.length}.`);
  const oggi = new Date();
  let conGiorniDaRifare = 0;
  const daGuardareAMano: string[] = [];
  let giorniTotali = 0;
  let bloccate = 0;

  for (const p of profili) {
    const giorni = ((await prisma.menuDay.findMany({
      where: { clientId: p.userId, date: { gte: daQuandoSiPuoRifare(oggi) } } as never,
      select: CAMPI_DEL_GIORNO as never,
      orderBy: { date: 'asc' } as never,
    })) ?? []) as GiornoDaValutare[];
    if (!giorni.length) continue;

    const idRicette = [...new Set(giorni.flatMap((g) => ricetteDelGiorno(g.meals)))];
    if (!idRicette.length) continue;
    const ricette = ((await prisma.recipe.findMany({
      where: { id: { in: idRicette } },
      select: { id: true, name: true, ingredients: true, allergens: true },
    })) ?? []) as RicettaDaValutare[];
    const perId = new Map(ricette.map((r) => [r.id, r]));

    const e = esclusioniDi(p as ProfiloConEsclusioni);
    const motivi = new Map<string, string[]>();
    for (const g of giorni) {
      const fuori = pastiDaSistemare(g.meals, perId, e);
      if (fuori.length) motivi.set(g.id, fuori.map((f) => `${f.slot} — ${f.motivo}`));
    }
    if (!motivi.size) continue;

    const chi = p.name ?? p.userId;
    const dichiarate = [...p.allergies, ...p.intolerances].join(', ');
    console.log(`\n⚠️  ${chi} — dichiarate: ${dichiarate}`);
    for (const g of giorni) {
      const m = motivi.get(g.id);
      if (m) for (const riga of m) console.log(`      ${giornoIt(g.date)}  ${riga}`);
    }

    /**
     * ⛔ **NON SI TOGLIE UN MENU A CHI IL MOTORE NON RICOMPORRÀ** (revisione del 31/8). Tutta la
     * premessa di `codaDaRifare` è «cancello, e il motore ricompone al prossimo giro»: dove quel
     * giro non arriva, cancellare apre un buco **permanente** — proprio quello che questo script
     * esiste per chiudere.
     *
     * ⚠️ **E la domanda va fatta come la fa il motore.** La prima stesura chiedeva
     * `findFirst({status:'active'})`: è la riga che il progetto ha già tolto una volta da
     * `menu.service.ts` (fra due piani attivi ne sceglieva uno a caso), e copre uno solo dei cinque
     * modi in cui `deliverIfEligible` esce a mani vuote. Qui si passa da `attivoInCorso` e si
     * guardano anche il piano fermato, il monitoraggio, la fine passata e la pausa in corso.
     */
    const aMano = giorni.filter((g) => motivi.has(g.id) && scrittaAMano(g.meals));
    if (aMano.length) {
      daGuardareAMano.push(`${chi} — ${motivi.size} giornate non sicure, ma ${aMano.length} sono scritte a mano (chat o giornata dettata): non tocco niente.`);
      continue;
    }

    const motivoFermo = await perchePotrebbeNonRicomporre(prisma as never, p, oggi);
    if (motivoFermo) {
      daGuardareAMano.push(`${chi} — ${motivi.size} giornate non sicure, ma ${motivoFermo}: non tocco niente.`);
      continue;
    }

    conGiorniDaRifare += 1;
    const coda = codaDaRifare(giorni, (g) => motivi.has(g.id));
    if (coda.esito === 'coda') {
      giorniTotali += coda.giorni.length;
      console.log(`   → ${coda.giorni.length} giornate da rifare dal ${giornoIt(coda.daQuando)} in poi.`);
      if (coda.lasciatiIndietro) {
        console.log(`   ⚠️  ${coda.lasciatiIndietro} giornate più vicine NON si toccano (già aperte, o non lo sappiamo): lì il piatto resta.`);
      }
      if (APPLICA) {
        await prisma.menuDay.deleteMany({ where: { id: { in: coda.giorni.map((g) => g.id) } } });
        console.log('   ✅ cancellate: le ricompone il motore al prossimo giro.');
      }
    } else if (coda.esito === 'bloccata') {
      bloccate += 1;
      console.log(`   ⛔ Non si tocca: il menu del ${giornoIt(coda.apertoIl)} l'ha già aperto in app. Serve «Rigenera menu» dalla sua scheda.`);
    } else if (coda.esito === 'non_lo_so') {
      bloccate += 1;
      console.log(`   ⚠️  Non si tocca: dal ${giornoIt(coda.dalGiorno)} non sappiamo se li ha aperti (app vecchia). Nel dubbio non le togliamo un menu di mano.`);
    }
  }

  if (daGuardareAMano.length) {
    console.log('\n' + '─'.repeat(74));
    console.log('  DA GUARDARE A MANO — hanno giornate non sicure ma il motore non le ricomporrebbe:');
    for (const riga of daGuardareAMano) console.log(`   · ${riga}`);
  }

  console.log('\n' + '─'.repeat(74));
  if (!conGiorniDaRifare) {
    console.log('  ✅ Nessuna giornata futura da rifare: il calendario regge il controllo di oggi.');
  } else {
    console.log(
      `  ESITO: ${conGiorniDaRifare} clienti guardate, ${giorniTotali} giornate ${APPLICA ? 'cancellate' : 'da cancellare'}` +
        `${bloccate ? `, ${bloccate} ferme perché la cliente ha già aperto un menu (o non lo sappiamo)` : ''}` +
        `${daGuardareAMano.length ? `, ${daGuardareAMano.length} da guardare a mano` : ''}.`,
    );
    if (!APPLICA) console.log('  Per agire davvero: APPLICA=1 npm run rifai:non-sicuri');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
