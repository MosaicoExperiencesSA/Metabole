/**
 * QUANTE CLIENTI HANNO «4 PASTI» — 20/8.
 *
 * ## Il fatto, letto nel codice
 *
 * `update-client.dto.ts` accetta `mealsPerDay` fra **3, 4 e 5**. Il catalogo, invece, non ha mai
 * diete a 4 pasti: le varianti si creano con `mealsPerDay = fasting ? 3 : meals === '5' ? 5 : 3`,
 * quindi esistono solo il 3 pasti, il 5 pasti e il digiuno.
 *
 * ⚠️ E su «quali pasti ha una giornata» rispondono **quattro funzioni diverse**, che sul 4 non
 * dicono la stessa cosa:
 *
 *   · `catalog/giornate-complete.ts` → `pastiAttesi(4)`      → colazione, pranzo, cena   (3)
 *   · `engine-rules/copertura-catalogo.ts` → `slotAttesi(4)` → colazione, pranzo, cena   (3)
 *   · `engine-rules.service.ts` (generatore, riga 341)       → non conosce il 4: ricade sul 5
 *   · `engine-rules.service.ts` → `slotsForMeals(4)`         → colazione, pranzo, MERENDA, cena (4)
 *
 * L'unica che sa cos'è una giornata da 4 pasti è l'ultima, e la usa il wizard di creazione.
 *
 * ⛔ **Cosa succede a una cliente messa a 4.** `pickDietFor` non trova nessuna variante a 4 pasti,
 * e allora ricade sul «purché sia dello stesso regime» — cioè le dà una dieta a 3 o a 5 senza dirlo
 * a nessuno. Il fatto non è del tutto invisibile: lo scostamento «chiesto / servito» sulla scheda
 * cliente lo mostra. Ma nessuno lo va a cercare se non sa che c'è da cercarlo.
 *
 * ⚠️ **Il backoffice oggi non lo propone**: la scheda deduce i pasti dal percorso
 * (`classic3 → 3`, `five → 5`, digiuno → 3), quindi il 4 può arrivare solo da uno script, da una
 * chiamata all'API o da un dato vecchio. **Se sono zero, si toglie il 4 dal DTO e la questione è
 * chiusa. Se non sono zero, sono clienti che stanno ricevendo un piano diverso da quello scritto
 * sulla loro scheda**, e va deciso cosa fare di loro.
 *
 *   npm run diag:pasti
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const perPasti = (await prisma.clientProfile.groupBy({
    by: ['mealsPerDay'],
    _count: { _all: true },
  })) as unknown as { mealsPerDay: number | null; _count: { _all: number } }[];

  console.log('');
  console.log('CLIENTI PER NUMERO DI PASTI');
  console.log('──────────────────────────────────────────────');
  for (const r of [...perPasti].sort((a, b) => (a.mealsPerDay ?? 0) - (b.mealsPerDay ?? 0))) {
    const nota = r.mealsPerDay === 3 || r.mealsPerDay === 5 ? '' : r.mealsPerDay == null ? '   (non impostato)' : '   ⛔ nel catalogo non esiste una dieta con questo numero di pasti';
    console.log(`  ${String(r.mealsPerDay ?? '—').padStart(3)} pasti : ${String(r._count._all).padStart(5)}${nota}`);
  }

  const strane = perPasti.filter((r) => r.mealsPerDay != null && r.mealsPerDay !== 3 && r.mealsPerDay !== 5);
  if (strane.length === 0) {
    console.log('');
    console.log('✅ Nessuna cliente fuori da 3 e 5 pasti. Il «4» del DTO si può togliere senza toccare nessuno.');
    console.log('');
    return;
  }

  console.log('');
  console.log('⛔ CHI SONO, E CHE DIETA STANNO RICEVENDO DAVVERO');
  console.log('──────────────────────────────────────────────');
  const profili = (await prisma.clientProfile.findMany({
    where: { mealsPerDay: { in: strane.map((s) => s.mealsPerDay as number) } },
    select: { userId: true, name: true, mealsPerDay: true, regime: true, dietStyle: true, pathType: true },
    take: 200,
  })) as { userId: string; name: string | null; mealsPerDay: number | null; regime: string | null; dietStyle: string | null; pathType: string | null }[];

  for (const p of profili) {
    /**
     * ⚠️ La dieta che sta ricevendo si legge dal **menu vero**, non da quella che il motore
     * sceglierebbe adesso: la domanda è «cosa ha in mano oggi», e rifare la scelta risponderebbe a
     * una domanda diversa — e in modo diverso, se nel frattempo il catalogo è cambiato.
     */
    const giorno = (await prisma.menuDay.findFirst({
      where: { clientId: p.userId },
      orderBy: { date: 'desc' },
      select: { dietId: true, date: true },
    })) as { dietId: string | null; date: Date } | null;
    const dieta = giorno?.dietId
      ? ((await prisma.diet.findUnique({ where: { id: giorno.dietId }, select: { name: true, mealsPerDay: true, fasting: true } })) as { name: string; mealsPerDay: number | null; fasting: boolean | null } | null)
      : null;
    const chi = p.name || p.userId;
    console.log(
      `  ${chi.padEnd(28)} scheda: ${p.mealsPerDay} pasti (${p.regime ?? '—'}, ${p.pathType ?? '—'})` +
        `  →  riceve: ${dieta ? `«${dieta.name}» ${dieta.fasting ? 'digiuno' : `${dieta.mealsPerDay ?? '?'} pasti`}` : 'nessun menu'}`,
    );
  }
  console.log('');
  console.log(`  ${profili.length} clienti. Ognuna riceve un piano con un numero di pasti diverso da quello scritto sulla sua scheda.`);
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
