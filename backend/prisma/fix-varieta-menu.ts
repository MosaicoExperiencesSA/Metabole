/**
 * Una-tantum: ACCENDE la varietà dei menu sui parametri LIVE.
 *
 * Il seed non sovrascrive mai il `value` di un parametro già esistente (l'admin potrebbe
 * averlo cambiato), quindi il nuovo default di codice non basta: in produzione
 * `menu_penalty_repeat` è rimasto a 0 (penalità di ripetizione SPENTA) dal primo seed.
 * Questo script:
 *
 *   1. porta `menu_penalty_repeat` da 0 a 1 (solo se è ancora 0, cioè mai personalizzato);
 *   2. crea `menu_variety_min_gap_days` = 2 se manca (distanza minima stesso piatto);
 *   3. segnala le diete che hanno un override per-dieta (ProductRule) che spegne la varietà.
 *
 * Non tocca valori già personalizzati dal backoffice (a meno di --force).
 *
 *   npm run fix:varieta            # DRY-RUN
 *   npm run fix:varieta -- --apply # applica
 *   npm run fix:varieta -- --apply --force   # forza anche se già personalizzato
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

const TARGETS: { key: string; value: string; type: string; description: string; onlyIf?: string }[] = [
  {
    key: 'menu_penalty_repeat',
    value: '1',
    type: 'number',
    description:
      'R11 — penalità di ripetizione nello scoring dei menu: penalizza le ricette servite di recente per favorire la varietà (0 = disattivata; 1 = una ricetta già servita nella finestra passa dietro a una mai servita)',
    onlyIf: '0', // si aggiorna solo se è ancora il valore seminato (mai personalizzato)
  },
  {
    key: 'menu_variety_min_gap_days',
    value: '2',
    type: 'number',
    description:
      "Varietà — giorni minimi prima che lo stesso piatto possa tornare nello stesso pasto: se il pool della dieta offre un'alternativa entro la tolleranza kcal viene usata quella (0 = guard disattivato)",
  },
  {
    key: 'menu_repeat_window_days',
    value: '14',
    type: 'number',
    description: 'R11 — finestra (giorni) su cui contare le ripetizioni recenti di una ricetta per la penalità di ripetizione',
  },
];

async function main() {
  console.log(APPLY ? '>>> APPLICA <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply <<<\n');

  for (const t of TARGETS) {
    const row = (await prisma.configParam.findUnique({ where: { key: t.key } })) as { key: string; value: string } | null;
    if (!row) {
      console.log(`  + ${t.key}: assente → creo con ${t.value}`);
      if (APPLY) {
        await prisma.configParam.create({ data: { key: t.key, value: t.value, type: t.type, description: t.description } as never });
      }
      continue;
    }
    if (row.value === t.value) {
      console.log(`  = ${t.key}: già ${row.value} — nulla da fare`);
      continue;
    }
    if (t.onlyIf !== undefined && row.value !== t.onlyIf && !FORCE) {
      console.log(`  ! ${t.key}: valore personalizzato (${row.value}) → NON lo tocco (usa --force per forzare a ${t.value})`);
      continue;
    }
    console.log(`  ~ ${t.key}: ${row.value} → ${t.value}`);
    if (APPLY) {
      await prisma.configParam.update({ where: { key: t.key }, data: { value: t.value, description: t.description } });
    }
  }

  // Override per-dieta che spengono la varietà: il valore globale non li vince.
  const rules = (await prisma.productRule.findMany({
    where: { ruleCode: { in: ['menu_penalty_repeat', 'menu_variety_min_gap_days'] } },
    select: { dietId: true, ruleCode: true, enabled: true, params: true },
  })) as { dietId: string | null; ruleCode: string; enabled: boolean; params: unknown }[];
  const zeroing = rules.filter((r) => r.enabled && Number((r.params as { value?: unknown } | null)?.value ?? 1) === 0);
  if (zeroing.length) {
    console.log('\n  ⚠  Override PER DIETA che spengono la varietà (da rivedere in "Regole motore"):');
    for (const r of zeroing) {
      const d = r.dietId
        ? ((await prisma.diet.findUnique({ where: { id: r.dietId }, select: { name: true } })) as { name: string } | null)
        : null;
      console.log(`      · dieta "${d?.name ?? r.dietId}" — ${r.ruleCode} = 0`);
    }
  } else {
    console.log('\n  Nessun override per-dieta che spegne la varietà.');
  }

  console.log(
    APPLY
      ? '\n✔ Fatto. I nuovi menu useranno la varietà (i giorni già erogati restano come sono).'
      : '\nNessuna modifica applicata. Per applicare: npm run fix:varieta -- --apply',
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
