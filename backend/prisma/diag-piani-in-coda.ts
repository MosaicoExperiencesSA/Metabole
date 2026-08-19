/**
 * QUANTI PIANI SONO IN CODA, E IN CHE FORMA — la fotografia da guardare PRIMA di scrivere `queued`.
 *
 * Voce 258. Lo stato `queued` esiste dal 18/8 ma **non lo scrive ancora nessuno**: la scrittura è la
 * consegna dopo, e in mezzo c'è questa. Serve a rispondere a tre domande, in quest'ordine:
 *
 *  1. **Quanti piani in coda ci sono davvero adesso?** Sono le righe scritte `active` con la
 *     partenza nel futuro. Sono quelle che la consegna dopo convertirà, e sapere se sono tre o
 *     trecento cambia come la si fa.
 *  2. **Ci sono già righe `queued`?** Prima della consegna dopo la risposta giusta è zero. Se non
 *     lo è, qualcuno le sta scrivendo da un'altra parte e va trovato prima di andare avanti.
 *  3. ⚠️ **Ci sono clienti con DUE piani che erogano insieme?** È lo stato rotto che ha prodotto il
 *     caso Lorena. Non lo chiude questa voce, ma è il numero che dice quanto è urgente il vincolo
 *     in banca dati — che di proposito non è in questa consegna.
 *
 * ⚠️ Sola lettura. `npm run diag:coda`.
 */
import { PrismaClient } from '@prisma/client';
import { eInCodaPerStato } from '../src/commerce/stati-abbonamento';
import { staErogando } from '../src/commerce/abbonamento-in-corso';

type Riga = { id: string; clientId: string; status: string; startDate: Date | null; endDate: Date | null };

async function main() {
  const prisma = new PrismaClient();
  const oggi = new Date();
  try {
    const righe = (await prisma.subscription.findMany({
      where: { status: { in: ['active', 'queued'] } as never },
      select: { id: true, clientId: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    })) as Riga[];

    const inCoda = righe.filter((r) => eInCodaPerStato(r, oggi));
    const formaVecchia = inCoda.filter((r) => r.status === 'active');
    const formaNuova = righe.filter((r) => r.status === 'queued');

    console.log('');
    console.log('==================================================================');
    console.log('  PIANI IN CODA — fotografia del ' + oggi.toISOString().slice(0, 10));
    console.log('==================================================================');
    console.log('');
    console.log(`Righe con un piano (active + queued): ${righe.length}`);
    console.log(`In coda (partenza nel futuro):        ${inCoda.length}`);
    console.log(`  · nella forma VECCHIA (active):     ${formaVecchia.length}  ← le convertirà la consegna dopo`);
    console.log(`  · con lo stato nuovo (queued):      ${formaNuova.length}`);
    if (formaNuova.length) {
      console.log('');
      console.log('⚠️ Ci sono già righe `queued` e in questa consegna NESSUNO le scrive.');
      console.log('   Vuol dire che qualcosa le scrive da un\'altra parte: va trovato prima di andare avanti.');
    }

    /** ⚠️ Lo stato rotto: due piani che erogano lo stesso giorno alla stessa persona. */
    const perCliente = new Map<string, Riga[]>();
    for (const r of righe) perCliente.set(r.clientId, [...(perCliente.get(r.clientId) ?? []), r]);
    const doppi = [...perCliente.entries()].filter(([, rs]) => rs.filter((r) => staErogando(r, oggi)).length > 1);

    console.log('');
    console.log(`Clienti con DUE piani che erogano insieme: ${doppi.length}`);
    if (doppi.length) {
      console.log('⚠️ È lo stato che ha prodotto il caso Lorena. Il vincolo in banca dati NON è in questa');
      console.log('   consegna, di proposito: prima lo stato vive. Ma questo numero dice quanto è urgente.');
      for (const [clientId, rs] of doppi.slice(0, 20)) {
        console.log(`   cliente ${clientId}: ${rs.length} righe`);
        for (const r of rs) {
          const q = staErogando(r, oggi) ? 'EROGA ' : eInCodaPerStato(r, oggi) ? 'in coda' : '       ';
          console.log(`     ${q} ${r.status.padEnd(7)} ${r.startDate?.toISOString().slice(0, 10) ?? '—'} → ${r.endDate?.toISOString().slice(0, 10) ?? 'senza fine'}`);
        }
      }
      if (doppi.length > 20) console.log(`   … e altri ${doppi.length - 20}.`);
    }

    /**
     * ⚠️ LE CODE ARRIVATE A SCADENZA SENZA MAI PARTIRE — aggiunto il 19/8 con la promozione notturna.
     *
     * `promuoviCodeArrivate` **non le promuove** di proposito (da attive-e-finite prenderebbero il
     * report di fine percorso e la cancellazione della personalizzazione) e le grida nei log di
     * Render. Ma i log di Render ruotano e non li apre nessuno: se non ci fosse un posto dove
     * guardarle, resterebbero `queued` per sempre e nessuno lo saprebbe — che è il difetto di
     * famiglia di questo progetto, appena un livello più su.
     */
    const scadutePerSempre = righe.filter(
      (r) => r.status === 'queued' && r.endDate && r.endDate.getTime() < oggi.getTime(),
    );
    console.log('');
    console.log(`Code arrivate a scadenza SENZA MAI PARTIRE: ${scadutePerSempre.length}`);
    if (scadutePerSempre.length) {
      console.log('⚠️ Queste clienti hanno pagato un piano che non ha erogato niente. Restano «in coda»');
      console.log('   di proposito: portarle ad attive farebbe partire il report di fine percorso e la');
      console.log('   cancellazione della personalizzazione. Serve una decisione, una per una.');
      for (const r of scadutePerSempre.slice(0, 30)) {
        console.log(
          `   cliente ${r.clientId}: doveva partire il ${r.startDate?.toISOString().slice(0, 10) ?? '—'}, ` +
            `finita il ${r.endDate?.toISOString().slice(0, 10) ?? '—'}`,
        );
      }
      if (scadutePerSempre.length > 30) console.log(`   … e altre ${scadutePerSempre.length - 30}.`);
    }

    console.log('');
    if (formaVecchia.length) {
      console.log('Le code nella forma vecchia, per data di partenza:');
      for (const r of formaVecchia.slice(0, 30)) {
        console.log(`  ${r.startDate?.toISOString().slice(0, 10) ?? '—'}  cliente ${r.clientId}`);
      }
      if (formaVecchia.length > 30) console.log(`  … e altre ${formaVecchia.length - 30}.`);
      console.log('');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
