/**
 * ⛔ **«LE CLIENTI ASSEGNATE A LEI»: ESISTE GIÀ IL DATO?** — la misura che serve prima di scrivere
 * il perimetro della commerciale.
 *
 * Simone, 28/8: il commerciale può cambiare il tipo di dieta, ma **solo delle clienti assegnate a
 * lei**. Oggi non è così: `perimetroClienti` risponde «nessun limite» per il ruolo `sales`, quindi
 * apre la scheda di chiunque.
 *
 * ⚠️ **Prima di aggiungere un campo va guardato quello che c'è.** `CrmRecord.ownerId` (il
 * «titolare» del lead) esiste da sempre, si vede nella tabella lead, nella scheda lead e nella
 * pipeline — e in tutto il backend **non lo scrive nessuna schermata** e **non lo legge nessun
 * permesso**: l'unico punto che lo scrive è `crm.advance`, e nessun frontend gli passa
 * `ownerStaffId`. Quindi la domanda vera è una sola: *quella colonna in produzione è piena o vuota?*
 *
 *  · Se è **piena**, il perimetro si può appoggiare a lei e non serve inventare niente.
 *  · Se è **vuota**, appoggiarcisi vorrebbe dire dare a ogni commerciale **zero clienti** — cioè
 *    toglierle di mano il lavoro invece di limitarlo. Allora serve un campo di assegnazione vero
 *    (come `assignedCoachId`), chi lo scrive e quando: e quella è una decisione, non una riga.
 *
 * ⛔ **Non è una domanda a cui il codice sa rispondere**: il codice dice che il campo esiste, non
 * che qualcuno l'ha riempito. *Misurare prima di decidere.*
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:titolare-lead
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const commerciali = (await prisma.user.findMany({
    where: { role: 'sales', deletedAt: null } as never,
    select: { id: true, email: true, firstName: true, lastName: true },
  })) as { id: string; email: string; firstName: string | null; lastName: string | null }[];

  console.log(`\nCommerciali con un account attivo: ${commerciali.length}.`);
  if (commerciali.length) {
    console.table(commerciali.map((c) => ({ chi: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email })));
  }

  const totale = await prisma.crmRecord.count();
  const conTitolare = await prisma.crmRecord.count({ where: { ownerId: { not: null } } as never });
  /**
   * ⚠️ **Le schede CRM che sono anche CLIENTI**, non tutte: il perimetro serve a decidere quali
   * *schede cliente* si aprono, e un lead senza account non ha una scheda cliente da aprire. È la
   * differenza fra «quanti record hanno un titolare» e «a quante clienti servirebbe davvero».
   */
  const clientiConTitolare = await prisma.crmRecord.count({
    where: { ownerId: { not: null }, clientId: { not: null } } as never,
  });
  const clientiTotali = await prisma.crmRecord.count({ where: { clientId: { not: null } } as never });

  console.log(
    `\nSchede CRM: ${totale} in tutto, di cui ${conTitolare} con un titolare (${
      totale ? Math.round((conTitolare / totale) * 100) : 0
    }%).`,
  );
  console.log(
    `Di quelle che sono anche CLIENTI (${clientiTotali}): ${clientiConTitolare} hanno un titolare.`,
  );

  if (clientiConTitolare === 0) {
    console.log(
      '\n⛔ NESSUNA CLIENTE HA UN TITOLARE. Appoggiare il perimetro della commerciale a questa colonna\n' +
        '   vorrebbe dire darle ZERO clienti: non è limitarla, è toglierle il lavoro. Serve un campo di\n' +
        '   assegnazione vero — chi lo scrive, quando, e cosa succede alle clienti già esistenti.',
    );
  } else {
    /**
     * ⚠️ Si conta a mano invece di `groupBy`: le righe sono al massimo qualche migliaio, e un
     * `groupBy` tipizzato su una colonna nullable qui costerebbe più cast di quanto valga in una
     * diagnostica di sola lettura.
     */
    const righe = (await prisma.crmRecord.findMany({
      where: { ownerId: { not: null }, clientId: { not: null } } as never,
      select: { ownerId: true },
    })) as { ownerId: string | null }[];
    const conteggi = new Map<string, number>();
    for (const r of righe) if (r.ownerId) conteggi.set(r.ownerId, (conteggi.get(r.ownerId) ?? 0) + 1);
    const perTitolare = [...conteggi.entries()].map(([ownerId, quante]) => ({ ownerId, quante }));
    const staff = (await prisma.staff.findMany({
      where: { id: { in: perTitolare.map((r) => r.ownerId) } } as never,
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string | null }[];
    const nome = (id: string) => staff.find((s) => s.id === id)?.displayName ?? id;
    console.log('\nClienti per titolare:');
    console.table(
      perTitolare
        .sort((a, b) => b.quante - a.quante)
        .map((r) => ({ titolare: nome(r.ownerId), clienti: r.quante })),
    );
    console.log(
      '\n✅ Il dato c\'è: il perimetro può appoggiarsi al titolare del lead.\n' +
        '   ⚠️ Resta da guardare chi RESTA FUORI: le clienti senza titolare non le vedrebbe nessun\n' +
        `   commerciale (${clientiTotali - clientiConTitolare} su ${clientiTotali}).`,
    );
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
