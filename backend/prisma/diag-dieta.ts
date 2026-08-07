/**
 * DIAGNOSTICA di UNA famiglia di diete: dove sono finite davvero le ricette.
 *
 * Nasce da una domanda concreta (8/8): «il nutrizionista dice di aver fatto Basso indice
 * glicemico onnivoro 5 pasti fino alla settimana 9, perché ne vedo solo 25?». Le risposte
 * possibili sono più d'una e dal backoffice non si distinguono:
 *  - le settimane sono state generate su un'ALTRA variante (altro obiettivo, altra struttura
 *    pasti, altro regime): la famiglia ne ha fino a 18, e i pulsanti si somigliano tutti;
 *  - le settimane 1-4 risultavano «già fatte» perché le 28 giornate vecchie esistono, quindi
 *    il lavoro è partito dalla 5 e il mese che le clienti ricevono è rimasto magro;
 *  - le ricette ci sono ma non sono attive, e l'elenco filtrato non le mostra.
 *
 * Questo script guarda variante per variante: giornate, piatti diversi per pasto, e da quale
 * settimana vengono (dal tag `sett:N` messo dal generatore).
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:dieta -- "Basso indice glicemico"
 *   npm run diag:dieta                → elenca i nomi disponibili
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOME_PASTO: Record<string, string> = {
  breakfast: 'colaz.', morning_snack: 'spunt.', lunch: 'pranzo',
  afternoon_snack: 'merenda', dinner: 'cena',
};

async function main(): Promise<void> {
  const nome = process.argv.slice(2).join(' ').trim();
  if (!nome) {
    const nomi = (await prisma.diet.findMany({
      select: { name: true, style: true },
      distinct: ['name', 'style'],
      orderBy: { name: 'asc' },
    })) as { name: string; style: string }[];
    console.log('Indica il nome della dieta, per esempio:\n  npm run diag:dieta -- "Basso indice glicemico"\n');
    console.log('Nomi in catalogo:');
    for (const n of nomi) console.log(`  · ${n.name}  (${n.style})`);
    return;
  }

  const varianti = (await prisma.diet.findMany({
    where: { name: nome },
    select: {
      id: true, name: true, style: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true, clientVisible: true,
    },
    orderBy: [{ regime: 'asc' }, { objective: 'asc' }, { mealsPerDay: 'desc' }],
  })) as {
    id: string; name: string; style: string; regime: string; objective: string | null;
    mealsPerDay: number; fasting: boolean | null; status: string; clientVisible: boolean;
  }[];

  if (varianti.length === 0) {
    console.log(`Nessuna dieta con nome esatto "${nome}". Lancia lo script senza argomenti per l'elenco.`);
    return;
  }

  console.log(`Famiglia "${nome}": ${varianti.length} varianti.\n`);
  const tabella: Record<string, unknown>[] = [];

  for (const d of varianti) {
    const templates = (await prisma.dietDayTemplate.findMany({
      where: { dietId: d.id },
      select: { dayIndex: true, meals: true },
      orderBy: { dayIndex: 'asc' },
    })) as { dayIndex: number; meals: unknown }[];

    const perPasto = new Map<string, Set<string>>();
    const tutte = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        const set = perPasto.get(m.slot) ?? new Set<string>();
        set.add(m.recipeId);
        perPasto.set(m.slot, set);
        tutte.add(m.recipeId);
      }
    }
    const conteggi = [...perPasto.entries()].map(([slot, set]) => ({ slot, n: set.size }));
    const minimo = conteggi.length ? Math.min(...conteggi.map((c) => c.n)) : 0;
    const giorni = templates.length ? Math.max(...templates.map((t) => t.dayIndex)) : 0;

    // Da quale settimana vengono le ricette (tag `sett:N`) e quante sono attive.
    const ricette = tutte.size
      ? ((await prisma.recipe.findMany({
          where: { id: { in: [...tutte] } },
          select: { tags: true, active: true },
        })) as { tags: string[]; active: boolean }[])
      : [];
    const perSettimana = new Map<string, number>();
    for (const r of ricette) {
      const t = (r.tags ?? []).find((x) => x.startsWith('sett:')) ?? 'senza tag (vecchie)';
      perSettimana.set(t, (perSettimana.get(t) ?? 0) + 1);
    }
    const attive = ricette.filter((r) => r.active).length;

    tabella.push({
      variante: `${d.regime} · ${d.objective ?? '—'} · ${d.fasting ? 'digiuno' : `${d.mealsPerDay} pasti`}`,
      stato: d.status + (d.clientVisible ? ' · visibile' : ''),
      giorni,
      'sett. complete': Math.floor(minimo / 7),
      ricette: tutte.size,
      attive,
      'per pasto': conteggi.map((c) => `${NOME_PASTO[c.slot] ?? c.slot} ${c.n}`).join(' · ') || '—',
      provenienza: [...perSettimana.entries()].sort().map(([k, v]) => `${k}=${v}`).join(' · ') || '—',
    });
  }

  console.table(tabella);
  console.log(
    '\nCome si legge:\n' +
    '· "giorni" = quante giornate ha il ciclo. "sett. complete" = quante settimane hanno davvero\n' +
    '  7 piatti diversi in OGNI pasto. Una dieta con 63 giorni e 0 settimane complete ha le\n' +
    '  giornate ma pochissimi piatti: le sta ricombinando.\n' +
    '· "provenienza" dice da quale settimana viene ogni ricetta (tag `sett:N` messo dal\n' +
    '  generatore). "senza tag (vecchie)" = generate col metodo di prima dell\'8/8.\n' +
    '· Se il lavoro fatto non compare sulla variante che ti aspetti, guarda le altre righe:\n' +
    '  quasi sempre è finito su un\'altra combinazione di regime, obiettivo o struttura pasti.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
