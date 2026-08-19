/**
 * LE CODE NELLA FORMA VECCHIA DIVENTANO `queued` — la coda della voce 258 (19/8).
 *
 * Dal 19/8 un piano che comincia più avanti nasce `queued`. Le righe scritte **prima** sono ancora
 * nella forma vecchia — `active` con la partenza nel futuro — perché la migrazione dello stato è
 * additiva e non tocca i dati. La fotografia del 19/8 (`npm run diag:coda`) ne conta **4**: due che
 * partono il 22/08 e due il 31/08.
 *
 * ## Perché convertirle, e non lasciarle finire da sole
 *
 * ⚠️ **Il codice capisce tutte e due le forme** (`eInCodaPerStato`), quindi nessuna cliente si
 * romperebbe. Ma finché convivono, due clienti nella stessa identica situazione vengono **descritte
 * in modo diverso** dalle stesse schermate: quella vecchia passa i filtri che chiedono `active`,
 * quella nuova no. Chi guarda una lista non ha niente sullo schermo che glielo spieghi.
 *
 * ⚠️ E soprattutto: `promuoviCodeArrivate` — il lavoro notturno che fa partire le code — cerca
 * `status: 'queued'`. Le quattro righe vecchie **non le vede**, quindi partono da sole come è sempre
 * stato (le date bastano), ma non finiscono né nel registro né nell'avviso dei piani in ritardo. Il
 * solo allarme costruito per questa cosa, su di loro, non suona.
 *
 * ## Come si usa
 *
 * `npm run converti:code` → **prova a vuoto**: stampa riga per riga cosa toccherebbe e non scrive
 * niente. `CONFERMA=1 npm run converti:code` → scrive davvero.
 *
 * ⚠️ **PRIMA IL DEPLOY, POI QUESTO SCRIPT.** L'ordine non è indifferente: il codice vecchio in
 * produzione cerca `status: 'active'`, quindi una riga convertita prima del rilascio sparirebbe in
 * blocco dalle sue letture — quelle clienti resterebbero senza menu e «senza piano» su ogni
 * schermata. Convertire dopo, invece, non rompe niente: il codice nuovo capisce tutte e due le
 * forme.
 *
 * ⚠️ Si convertono **solo** le righe che sono in coda *adesso*: `active`, con `startDate` nel futuro
 * e la fine non ancora passata. Un piano che sta erogando non si tocca nemmeno per sbaglio — è la
 * sola cosa che questo script potrebbe rompere, e la guardia sta anche nella `updateMany`, non solo
 * nella lettura: fra la fotografia e la scrittura passano dei secondi, e in mezzo c'è un cron.
 */
import { PrismaClient } from '@prisma/client';
import { eInCodaPerStato } from '../src/commerce/stati-abbonamento';

type Riga = { id: string; clientId: string; status: string; startDate: Date | null; endDate: Date | null };

const giorno = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const prisma = new PrismaClient();
  const conferma = process.env.CONFERMA === '1';
  const oggi = new Date();
  try {
    const righe = (await prisma.subscription.findMany({
      // ⚠️ La lettura chiede già la partenza nel futuro, con lo **stesso confronto** della guardia in
      // scrittura più sotto: leggere per giorno e scrivere per istante lascerebbe fuori le code che
      // partono più tardi oggi, e lo script finirebbe dicendo «fatto» su un lavoro a metà.
      where: { status: 'active' as never, startDate: { gt: oggi } },
      select: { id: true, clientId: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
      take: 500,
    })) as Riga[];

    // La fine passata non è una coda: è una riga da chiudere, e chiuderla non è una decisione di
    // questo script. (`eInCodaPerStato` ridice quello che ha già chiesto la query: se un giorno una
    // delle due cambia, la differenza si vede qui e non in produzione.)
    const daConvertire = righe.filter(
      (r) => eInCodaPerStato(r, oggi) && (!r.endDate || r.endDate.getTime() >= oggi.getTime()),
    );

    console.log('');
    console.log('==================================================================');
    console.log('  CODE NELLA FORMA VECCHIA → `queued`');
    console.log(conferma ? '  SCRITTURA VERA: le righe qui sotto vengono cambiate.' : '  Prova: non scrivo niente.');
    console.log('==================================================================');
    console.log('');
    console.log(`Righe 'active' con la partenza nel futuro: ${righe.length}`);
    console.log(`Di queste, da convertire (fine non passata): ${daConvertire.length}`);
    console.log('');

    if (!daConvertire.length) {
      console.log('Niente da fare: nessuna coda nella forma vecchia.');
      return;
    }

    for (const r of daConvertire) {
      console.log(`· cliente ${r.clientId}`);
      console.log(`    parte il ${giorno(r.startDate)}, finisce il ${giorno(r.endDate)}`);
      console.log(`    active → queued   [${r.id}]`);
    }
    console.log('');

    if (!conferma) {
      console.log('Prova: non ho scritto niente. Rileggi l\'elenco riga per riga, poi CONFERMA=1.');
      return;
    }

    let fatte = 0;
    let saltate = 0;
    for (const r of daConvertire) {
      /**
       * ⚠️ La guardia si ripete nella scrittura, e non è una ridondanza inutile: fra la lettura e
       * questa riga passano dei secondi, e in mezzo possono esserci il cron notturno o un'operatrice
       * che disdice. `status: 'active'` **e** la partenza ancora nel futuro: se una delle due non è
       * più vera, quella riga non è più la riga che ho letto e la si lascia stare.
       */
      const { count } = await prisma.subscription.updateMany({
        where: { id: r.id, status: 'active' as never, startDate: { gt: new Date() } },
        data: { status: 'queued' as never },
      });
      if (count > 0) {
        fatte++;
        // Una riga di registro per ognuna: fra un mese, chi trova uno `queued` con la data vecchia
        // deve poter sapere che è stato questo script e non l'acquisto.
        // ⚠️ Se il registro non scrive **si vede**: qui non c'è `AuditService`, e un `.catch` muto
        // avrebbe fatto stampare «Convertite: 4» senza che di quelle quattro restasse traccia — cioè
        // proprio la ragione per cui questa riga esiste.
        await prisma.auditLog
          .create({
            data: {
              action: 'commerce.plan.queued_backfill',
              entityType: 'subscription',
              entityId: r.id,
              metadata: {
                clientId: r.clientId,
                inizio: r.startDate?.toISOString() ?? null,
                fine: r.endDate?.toISOString() ?? null,
                da: 'active',
                a: 'queued',
              } as never,
            } as never,
          })
          .catch((e) => console.log(`  ⚠️ registro non scritto per ${r.clientId}: ${String(e)}`));
      } else {
        saltate++;
        console.log(`  ⚠️ saltata: la riga di ${r.clientId} è cambiata mentre lavoravo [${r.id}]`);
      }
    }

    console.log('');
    console.log(`Convertite: ${fatte}${saltate ? ` · saltate: ${saltate}` : ''}.`);
    console.log('Ricontrolla con `npm run diag:coda`: la forma vecchia deve essere scesa a zero.');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
