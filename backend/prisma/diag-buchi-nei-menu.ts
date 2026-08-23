/**
 * ⛔ **CHI HA UN BUCO NEL CALENDARIO DEI MENU — e da quando.**
 *
 * ## Perché questo elenco esiste
 *
 * Fino al 24/8, tre punti cancellavano giorni di menu **sparsi** invece di una coda: la regola di
 * dieta (dal 13/8), «togli lo spuntino» e «cambia le proteine». Il motore però riparte dall'**ultimo**
 * giorno in calendario e appende da lì — quindi ogni giorno cancellato che ne lasciava uno più avanti
 * è rimasto vuoto **per sempre**. La cliente apre l'app in quella data e trova «menu in preparazione».
 *
 * ⛔ **Il codice è corretto da oggi, ma i buchi già aperti non si richiudono da soli.** Questo script
 * li conta. Non li ripara: prima il numero, poi la decisione — è la stessa regola con cui si è
 * lavorato su tutto il resto, e qui vale doppio perché riparare vuol dire cancellare altre giornate a
 * persone vere.
 *
 * ## Come si riconosce un buco
 *
 * I giorni di menu di una cliente sono consecutivi per costruzione: l'erogazione li appende uno dopo
 * l'altro. Quindi, **fra il primo e l'ultimo giorno in calendario**, ogni data mancante è un buco. Non
 * è una stima: è una data che non c'è in mezzo a date che ci sono.
 *
 * ⚠️ Si guarda **da oggi in avanti**, non tutta la storia. Un buco nel passato può avere altre cause
 * (una sospensione di mesi fa, un piano ripartito) ed è comunque acqua passata: quello che si può
 * ancora riparare — e che una cliente sta ancora per subire — è il buco davanti a lei.
 *
 * ⚠️ **E i giorni in sospensione NON sono buchi.** Durante una vacanza l'erogazione si ferma di
 * proposito: contarli qui vorrebbe dire riempire l'elenco di righe innocenti, cioè renderlo inutile —
 * e un elenco che grida su cose normali è un elenco che si impara a non leggere.
 *
 * ## E la seconda riga, che è peggio della prima
 *
 * Se l'ultimo giorno in calendario è **oltre oggi** e c'è un buco prima, la cliente non solo ha quel
 * giorno vuoto: **non riceve più niente** finché quella data non passa (il buffer anti-cicli-infiniti
 * del motore). Sono le più urgenti, e sono stampate per prime.
 *
 *   npm run diag:buchi-menu
 */
import { PrismaClient } from '@prisma/client';
import { aGiorno } from '../src/common/date-only';
import { buchiFra, senzaIlMenuDiOggi } from '../src/menu/buchi-nel-calendario';

const prisma = new PrismaClient();

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Il giorno di **Roma**, scritto come lo salva `MenuDay.date` (mezzanotte UTC).
 *
 * ⚠️ Era il giorno UTC, calcolato a mano: fra mezzanotte e le 02:00 italiane sono due giorni diversi,
 * e questo script si sarebbe risposto «ieri» proprio nelle ore in cui il progetto ha già pagato tutta
 * una famiglia di difetti. Il conto sta in `common/date-only.ts` e si chiama da lì — era la quarta
 * copia a mano dello stesso confine.
 */
const oggiSalvato = (): Date => aGiorno(new Date());

type Riga = {
  clientId: string;
  nome: string | null;
  buchi: string[];
  ultimo: string;
  ferma: boolean;
  /** Il caso più urgente: erogazione ferma **e** oggi non ha niente in mano. */
  mancaOggi: boolean;
};

async function main() {
  const oggi = oggiSalvato();

  const giorni = (await prisma.menuDay.findMany({
    where: { date: { gte: oggi } },
    select: { clientId: true, date: true },
    orderBy: { date: 'asc' },
  })) as { clientId: string; date: Date }[];

  /**
   * ⚠️ Le sospensioni **che si sovrappongono alla finestra guardata**: una vacanza finita a giugno
   * non c'entra niente, e caricarle tutte su un database di qualche anno vuol dire leggere righe che
   * non si useranno mai.
   */
  const pause = (await prisma.event
    .findMany({
      // ⚠️ `mode: 'pause_period'` è come le scrive il calendario (`calendar/events.service.ts`):
      // non esiste una tabella delle sospensioni, sono righe di `Event`.
      where: { mode: 'pause_period', endDate: { gte: oggi } },
      select: { clientId: true, startDate: true, endDate: true },
    })
    .catch(() => [])) as { clientId: string | null; startDate: Date | null; endDate: Date | null }[];

  const inPausa = new Map<string, { da: number; a: number }[]>();
  for (const p of pause) {
    if (!p.clientId || !p.startDate || !p.endDate) continue;
    const suoi = inPausa.get(p.clientId) ?? [];
    suoi.push({ da: p.startDate.getTime(), a: p.endDate.getTime() });
    inPausa.set(p.clientId, suoi);
  }
  const sospeso = (clientId: string, t: number) =>
    (inPausa.get(clientId) ?? []).some((p) => t >= p.da && t <= p.a);

  /**
   * ⚠️ **La data di inizio piano serve a NON gridare** su chi il piano non l'ha ancora cominciato: il
   * menu si sblocca due giorni prima della partenza, quindi per due giorni una cliente ha solo giorni
   * futuri e nessun menu per oggi — ed è normale. Senza questo dato i due casi sono indistinguibili.
   */
  const piani = (await prisma.clientProfile.findMany({
    where: { userId: { in: [...new Set(giorni.map((g) => g.clientId))] } },
    select: { userId: true, planStartDate: true },
  })) as { userId: string; planStartDate: Date | null }[];
  const inizioPiano = new Map(piani.map((p) => [p.userId, p.planStartDate ? aGiorno(p.planStartDate).getTime() : null]));

  const perCliente = new Map<string, number[]>();
  for (const g of giorni) {
    const suoi = perCliente.get(g.clientId) ?? [];
    suoi.push(g.date.getTime());
    perCliente.set(g.clientId, suoi);
  }

  const righe: Riga[] = [];
  for (const [clientId, date] of perCliente) {
    const ultimo = Math.max(...date);
    const ferma = ultimo > oggi.getTime();
    // ⚠️ Il conto sta in `src/menu/buchi-nel-calendario.ts`, con i suoi test: qui dentro sarebbe un
    // conto che, sbagliando, risponde «nessun buco» — la risposta che chiude la domanda invece di
    // aprirla, davanti al difetto esatto che si sta cercando.
    const buchi = buchiFra(date, (t) => sospeso(clientId, t)).map((t) => iso(new Date(t)));

    /**
     * ⛔ **Il buco che comincia OGGI** — il caso che `buchiFra` da sola non vede, perché oggi è il
     * bordo della finestra e non «il mezzo». La regola, con il perché e il falso allarme che ha
     * evitato (le clienti il cui piano deve ancora partire), sta in `senzaIlMenuDiOggi`, con i test.
     */
    const mancaOggi = senzaIlMenuDiOggi(date, oggi.getTime(), {
      sospeso: (t) => sospeso(clientId, t),
      inizioPiano: inizioPiano.get(clientId) ?? null,
    });

    if (buchi.length || mancaOggi) {
      righe.push({ clientId, nome: null, buchi, ultimo: iso(new Date(ultimo)), ferma, mancaOggi });
    }
  }

  if (!righe.length) {
    console.log('Nessun buco nei calendari dei menu da oggi in avanti. Niente da riparare.');
    return;
  }

  /**
   * ⚠️ I nomi si leggono **solo per chi compare nell'elenco**: sono poche righe, e caricare tutti i
   * profili per stamparne dieci è il modo in cui una diagnosi diventa un carico sul database di
   * produzione.
   */
  const profili = (await prisma.clientProfile.findMany({
    where: { userId: { in: righe.map((r) => r.clientId) } },
    select: { userId: true, name: true },
  })) as { userId: string; name: string | null }[];
  const nomi = new Map(profili.map((p) => [p.userId, p.name]));
  for (const r of righe) r.nome = nomi.get(r.clientId) ?? null;

  // Prima chi oggi non ha niente in mano, poi le ferme, poi il resto.
  righe.sort(
    (a, b) =>
      Number(b.mancaOggi) - Number(a.mancaOggi) ||
      Number(b.ferma) - Number(a.ferma) ||
      b.buchi.length - a.buchi.length,
  );

  const ferme = righe.filter((r) => r.ferma);
  const senzaOggi = righe.filter((r) => r.mancaOggi);
  console.log(`Clienti da guardare (buco in mezzo, o niente in mano oggi): ${righe.length}`);
  console.log(`Di queste, con l'erogazione FERMA (l'ultimo giorno è oltre oggi): ${ferme.length}`);
  console.log(`E di queste, SENZA IL MENU DI OGGI in mano adesso: ${senzaOggi.length}\n`);

  for (const r of righe) {
    const chi = r.nome ?? r.clientId.slice(0, 8);
    const quali = r.buchi.length
      ? 'manca ' + r.buchi.slice(0, 8).join(', ') + (r.buchi.length > 8 ? `, … (${r.buchi.length} in tutto)` : '')
      : 'nessun buco in mezzo';
    const bandiera = r.mancaOggi ? '⛔ SENZA OGGI ' : r.ferma ? '⛔ FERMA      ' : '              ';
    console.log(`${bandiera}${chi}: ${quali} — ultimo giorno in calendario ${r.ultimo}`);
  }

  /**
   * ⚠️ **La riparazione non la fa questo script**, e non è prudenza di maniera: riparare vuol dire
   * cancellare la coda dal primo buco in avanti, cioè rimescolare giornate che qualcuna potrebbe già
   * aver letto o su cui ha fatto la spesa. È una decisione di Simone e Lucia, non di una diagnosi.
   */
  console.log(
    '\nRiparazione: per chi ha un buco in mezzo, cancellare i giorni DAL primo buco in avanti fa ' +
      'ripartire il motore da lì; per chi è «SENZA OGGI» il punto da cui ripartire è oggi. In tutti e ' +
      'due i casi lo fa «Rigenera menu» dalla scheda — che però rifà anche i giorni già arrivati in ' +
      'app. Prima di farlo in massa va guardato caso per caso.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
