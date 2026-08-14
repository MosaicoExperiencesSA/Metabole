/**
 * L'IMPORT DELLA TABELLA DELL'INDICE GLICEMICO — **in prova, salvo CONFERMA=1.**
 *
 * Decisioni: §10 del 13/8 (si carica CONFERMATO di default: `verifiedById` = capo nutrizionista,
 * perché «vuoti = da confermare» finirebbe in una coda che nessuno ha chiesto) e §16 (il
 * crudo/cotto è sciolto: OGNI riga della tabella porta lo stato esplicito).
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run importa:ig              → elenca cosa farebbe, non scrive niente
 *   CONFERMA=1 npm run importa:ig   → scrive
 *
 * ## Le tre sorti di una riga
 *
 * 1. **Nome nuovo** → si CREA, confermata dal capo nutrizionista, con stato, IG e macro.
 * 2. **Nome già in tabella SENZA indice glicemico** → si aggiunge SOLO l'IG (indice, min, max,
 *    fonte, affidabilità). ⚠️ Le macro esistenti NON si toccano: potrebbero essere state curate a
 *    mano, e questo import è nato per portare l'IG, non per riscrivere il lavoro di qualcuno.
 * 3. **Nome già in tabella CON indice glicemico** → non si tocca niente.
 *
 * ⚠️ Il capo nutrizionista si individua a runtime (head_nutritionist attivo): se ce n'è più d'uno
 * si prende il più vecchio per data di creazione e LO SI DICE nell'output — chi conferma va letto,
 * non dedotto.
 */
import { PrismaClient } from '@prisma/client';
import { FONTE_IG, FONTE_IG_REF, RIGHE_IG } from './dati-ig';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  console.log('');
  console.log('==================================================================');
  console.log('  INDICE GLICEMICO — import della tabella del capo nutrizionista');
  console.log(conferma ? '  ⚠️  CONFERMA=1: SCRIVO.' : '  Prova: non scrivo niente.');
  console.log('==================================================================');
  console.log('');

  // Chi conferma: il capo nutrizionista (Decisioni §10).
  const capi = (await prisma.user.findMany({
    where: { role: 'head_nutritionist', status: 'active', deletedAt: null } as never,
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })) as { id: string; email: string; createdAt: Date }[];
  if (!capi.length) {
    console.log('⚠️ Nessun capo nutrizionista attivo: senza chi conferma non carico niente.');
    return;
  }
  const capo = capi[0];
  const staffCapo = (await prisma.staff.findUnique({
    where: { userId: capo.id } as never,
    select: { id: true, displayName: true },
  })) as { id: string; displayName: string | null } | null;
  if (!staffCapo) {
    console.log(`⚠️ Il capo ${capo.email} non ha una riga staff: non so a chi intestare la conferma.`);
    return;
  }
  console.log(`Conferma intestata a: ${staffCapo.displayName ?? capo.email}${capi.length > 1 ? `  (⚠️ i capi attivi sono ${capi.length}: preso il più anziano)` : ''}`);
  console.log('');

  const conto = { create: 0, soloIg: 0, gia: 0 };
  for (const [nome, sinonimi, categoria, stato, ig, igMin, igMax, kcal, prot, carb, gras, fibre, affidabilita, nota] of RIGHE_IG) {
    const esistente = (await prisma.nutrientFact.findUnique({
      where: { name: nome },
      select: { id: true, glycemicIndex: true },
    })) as { id: string; glycemicIndex: number | null } | null;

    if (esistente && esistente.glycemicIndex !== null) {
      conto.gia++;
      console.log(`· ha già l'IG, non tocco niente  [${nome}]`);
      continue;
    }

    if (esistente) {
      conto.soloIg++;
      console.log(`~ esiste senza IG: aggiungo SOLO l'indice  [${nome}]`);
      if (conferma) {
        await prisma.nutrientFact.update({
          where: { id: esistente.id },
          data: {
            glycemicIndex: ig,
            glycemicIndexMin: igMin,
            glycemicIndexMax: igMax,
            glycemicIndexSource: FONTE_IG,
            glycemicIndexReliability: affidabilita,
          } as never,
        });
      }
      continue;
    }

    conto.create++;
    console.log(`+ nuova, confermata  [${nome}]  (${stato}, IG ${ig ?? '~0'}, ${kcal} kcal)`);
    if (conferma) {
      await prisma.nutrientFact.create({
        data: {
          name: nome,
          synonyms: sinonimi,
          category: categoria,
          state: stato,
          glycemicIndex: ig,
          glycemicIndexMin: igMin,
          glycemicIndexMax: igMax,
          glycemicIndexSource: FONTE_IG,
          glycemicIndexReliability: affidabilita,
          kcal, protein: prot, carbs: carb, fat: gras, fiber: fibre,
          source: FONTE_IG,
          sourceRef: FONTE_IG_REF,
          note: nota,
          verifiedById: staffCapo.id,
          verifiedAt: new Date(),
        } as never,
      });
    }
  }

  console.log('');
  console.log(`Righe della tabella: ${RIGHE_IG.length} · nuove: ${conto.create} · solo IG aggiunto: ${conto.soloIg} · già complete: ${conto.gia}`);
  if (!conferma) {
    console.log('\nProva: non ho scritto niente. Rileggi l\'elenco riga per riga, poi CONFERMA=1.\n');
  } else {
    console.log('\nFatto. I valori sono CONFERMATI (Decisioni §10): Gaia li usa da subito, con lo stato dichiarato.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
