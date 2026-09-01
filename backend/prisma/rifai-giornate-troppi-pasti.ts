/**
 * LE GIORNATE COMPOSTE CON PIÙ PASTI DI QUANTI NE PREVEDE LA DIETA — si rifanno.
 *
 * ⛔ **SOLA LETTURA finché non gli si dice `APPLICA=1`.**
 *
 * ⚠️ **Non "corregge" niente: cancella.** L'erogazione compone solo le date che **non esistono**
 * (`upsert` con `update: {}`), quindi l'unico modo di rifare una giornata è toglierla di mezzo.
 *
 * ⛔ **E SI CANCELLA UNA CODA, NON I GIORNI SBAGLIATI.** La prima stesura di questo script
 * cancellava solo le quattro giornate col pasto in più, ed è stata fermata da
 * `una-porta-per-i-giorni.spec.ts` prima di girare: `deliverIfEligible` **non cerca i buchi** —
 * guarda l'ULTIMO giorno in calendario, e se è oltre oggi esce. Togliere il 2 e il 3 settembre
 * lasciando il 4 avrebbe aperto due buchi **permanenti**: quelle clienti avrebbero letto «menu in
 * preparazione» su quelle date per sempre, senza un errore da nessuna parte.
 *
 * ⚠️ Per questo la coda la calcola `codaDaRifare` (`vera/menu-da-rifare.ts`), che è anche l'unica
 * che sa dire i **due no diversi**: la cliente l'ha aperto (suo, non si tocca) e **non sappiamo**
 * se l'ha aperto — che non è «no». Riscrivere qui la condizione a mano vorrebbe dire cambiare il
 * menu di domani a chi l'ha già letto con l'app vecchia.
 *
 * ⛔ **DOPO LA CANCELLAZIONE LE GIORNATE NON TORNANO DA SOLE, E IL CRON NON C'ENTRA.**
 *
 * ⚠️ Scritto male la prima volta (1/9): dicevo «le ricompone il cron notturno». **Falso**, e il
 * commento in cima a `cron.controller.ts` lo dice da mesi: *«i menu non li compone questo cron.
 * `engine.runBatch()` valuta le regole e scrive decisioni; a comporre i menu è
 * `deliverIfEligible`, che gira quando la cliente apre l'app»* — e al salvataggio di una misura.
 *
 * Quindi: le giornate cancellate tornano **quando quella cliente apre l'app**, e ripartono dal
 * primo giorno mancante perché l'erogazione guarda l'ultimo giorno in calendario. Chi non vuole
 * aspettare il suo prossimo accesso usa **«Rigenera menu» dalla sua scheda** nel back office.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run rifai:troppi-pasti             → dice cosa cancellerebbe, cliente per cliente
 *   APPLICA=1 npm run rifai:troppi-pasti   → cancella
 */
import { PrismaClient } from '@prisma/client';
import { CAMPI_DEL_GIORNO, codaDaRifare, type GiornoDaValutare } from '../src/vera/menu-da-rifare';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const riga = (s = '') => console.log(s);
const giornoIt = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  riga('');
  riga('==================================================================');
  riga('  GIORNATE CON PASTI IN PIÙ — si rifanno');
  riga(`  ${APPLICA ? '⚠️  APPLICA=1: CANCELLA le code elencate.' : 'Sola lettura: non cancella niente.'}`);
  riga('==================================================================');

  const param = (await prisma.configParam.findUnique({
    where: { key: 'panieri_sorgente_pool' },
    select: { updatedAt: true },
  })) as { updatedAt: Date } | null;
  const da = process.env.DA ? new Date(process.env.DA) : (param?.updatedAt ?? new Date(Date.now() - 7 * 86_400_000));

  const templates = (await prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } })) as unknown as
    { dietId: string; meals: unknown }[];
  const strutturaDi = new Map<string, Set<string>>();
  for (const t of templates) {
    const s = strutturaDi.get(t.dietId) ?? new Set<string>();
    for (const m of (Array.isArray(t.meals) ? t.meals as { slot?: string; recipeId?: string }[] : [])) {
      if (m?.slot && m?.recipeId) s.add(m.slot);
    }
    strutturaDi.set(t.dietId, s);
  }

  /** Le giornate SBAGLIATE: composte nella finestra, con pasti che la loro dieta non prevede. */
  const sospette = (await prisma.menuDay.findMany({
    where: { createdAt: { gte: da } },
    select: { id: true, clientId: true, dietId: true, meals: true },
  })) as unknown as { id: string; clientId: string; dietId: string; meals: unknown }[];

  const sbagliate = new Set<string>();
  const clienti = new Set<string>();
  for (const g of sospette) {
    const sua = strutturaDi.get(g.dietId);
    if (!sua || sua.size === 0) continue;
    const avuti = (Array.isArray(g.meals) ? g.meals as { slot?: string }[] : [])
      .map((m) => String(m?.slot ?? '')).filter(Boolean);
    if (avuti.some((s) => !sua.has(s))) { sbagliate.add(g.id); clienti.add(g.clientId); }
  }

  riga('');
  riga(`  Finestra: dalle ${da.toISOString().slice(0, 16).replace('T', ' ')} a adesso`);
  riga(`  Giornate con pasti in più: ${sbagliate.size}  ·  clienti coinvolte: ${clienti.size}`);

  if (!sbagliate.size) {
    /**
     * ⛔ **«Niente da rifare» diceva due cose opposte — corretto l'1/9.** Zero giornate sbagliate
     * vuol dire «sono tutte giuste» **oppure** «non ce ne sono affatto», per esempio perché sono
     * appena state cancellate e il giro di erogazione non è ancora passato. Sotto la stessa riga
     * verde stavano «a posto» e «due clienti con lo schermo vuoto».
     */
    const conMenu = await prisma.menuDay.count({ where: { createdAt: { gte: da } } });
    riga('');
    riga('  Nessuna giornata con pasti in più.');
    if (conMenu === 0) {
      riga('  ⛔ MA in questa finestra non è stata composta NESSUNA giornata: questo non è un ✅.');
      riga('     Se hai appena cancellato delle giornate per farle rifare, il motore non le rifà in');
      riga('     quel momento: le rifà `deliverIfEligible`, che gira quando la cliente APRE L\'APP.');
      riga('     ⛔ Il cron `daily` NON compone menu. Per non aspettare il suo prossimo accesso:');
      riga('     «Rigenera menu» dalla sua scheda nel back office. Poi `npm run diag:senza-menu`.');
    } else {
      riga(`  ✅ Niente da rifare, e ${conMenu} giornate composte in questa finestra sono a posto.`);
    }
    riga('');
    return;
  }

  let daCancellare: string[] = [];
  let bloccate = 0;
  let nonSapute = 0;

  for (const clientId of clienti) {
    /**
     * ⛔ **Il calendario INTERO di quella cliente, non solo i giorni sbagliati.** `codaDaRifare`
     * taglia per data e ha bisogno di vedere anche i giorni che NON si toccano — sono quelli che
     * decidono dove finisce la coda. Passandogli i soli colpiti, la coda sarebbe sempre «tutti» e
     * la protezione non scatterebbe mai.
     *
     * ⚠️ E una cliente per volta: la coda è di una persona sola, e mescolarle è l'errore che
     * `codaDaRifare` solleva invece di correggere in silenzio.
     */
    const giorni = (await prisma.menuDay.findMany({
      where: { clientId },
      select: CAMPI_DEL_GIORNO,
      orderBy: { date: 'asc' },
    })) as unknown as GiornoDaValutare[];

    const coda = codaDaRifare(giorni, (g) => sbagliate.has(g.id));
    const chi = clientId.slice(0, 8);

    if (coda.esito === 'coda') {
      riga('');
      riga(`  · cliente ${chi}: ${coda.giorni.length} giornate da rifare dal ${giornoIt(coda.daQuando)} in poi.`);
      if (coda.lasciatiIndietro) {
        riga(`    ⚠️ ${coda.lasciatiIndietro} giornate sbagliate più vicine NON si toccano (già aperte, o non lo sappiamo): lì il pasto in più resta.`);
      }
      daCancellare = daCancellare.concat(coda.giorni.map((g) => g.id));
    } else if (coda.esito === 'bloccata') {
      bloccate += 1;
      riga('');
      riga(`  · cliente ${chi}: ⛔ non si tocca — il menu del ${giornoIt(coda.apertoIl)} l'ha già aperto in app.`);
      riga('    Serve «Rigenera menu» dalla sua scheda, e lo decide una persona.');
    } else if (coda.esito === 'non_lo_so') {
      nonSapute += 1;
      riga('');
      riga(`  · cliente ${chi}: ⚠️ non lo so — dal ${giornoIt(coda.dalGiorno)} la sua app non diceva ancora se apriva i giorni.`);
      riga('    Non è «non l\'ha aperto»: è l\'assenza di un fatto, e nel dubbio non si tocca.');
    }
  }

  riga('');
  riga(`  Da cancellare in tutto: ${daCancellare.length} giornate`);
  riga(`  Clienti bloccate (menu già aperto): ${bloccate}  ·  di cui non sappiamo: ${nonSapute}`);

  if (!APPLICA) {
    riga('');
    riga('  Sola lettura. Per cancellare: APPLICA=1 npm run rifai:troppi-pasti');
    riga('');
    return;
  }
  if (!daCancellare.length) {
    riga('');
    riga('  Niente da cancellare.');
    riga('');
    return;
  }

  const esito = await prisma.menuDay.deleteMany({ where: { id: { in: daCancellare } } });
  riga('');
  riga(`  Cancellate: ${esito.count} su ${daCancellare.length} attese.`);
  riga(esito.count === daCancellare.length ? '  ✅ Il conto torna.' : '  ⛔ IL CONTO NON TORNA: guarda prima di rilanciare.');
  riga('');
  riga('  ⚠️ ADESSO QUELLE CLIENTI NON HANNO QUEI GIORNI. Le ricompone `deliverIfEligible`, che gira');
  riga('     QUANDO LA CLIENTE APRE L\'APP (e al salvataggio di una misura).');
  riga('  ⛔ Il cron `daily` NON compone menu: valuta le regole e scrive decisioni. Se non vuoi');
  riga('     aspettare il loro prossimo accesso, usa «Rigenera menu» dalla scheda di ciascuna.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
