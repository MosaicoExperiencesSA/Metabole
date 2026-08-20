/**
 * QUANTO TOGLIE IN PIÙ LA RADICE — la misura che io non posso fare, e che decide una costante.
 *
 * Dal 20/8 il filtro delle esclusioni guarda anche la **radice** della parola chiave: «mandorle»
 * copre «mandorla», «gamberi» copre «gamberetti». Serviva perché quattro piatti del catalogo del
 * repo contenevano l'allergene e passavano lo stesso.
 *
 * ⚠️ Ma quella misura è su **118 ricette**, il catalogo keto che sta nel repo. In produzione ce ne
 * sono migliaia, e su quelle non l'ha verificato nessuno. La domanda che questa diagnostica
 * risponde è una sola: **la radice toglie qualcosa che non c'entra?**
 *
 * Il caso da cui guardarsi l'ho trovato misurando e non ragionando: `polpo` senza vocale finale è
 * `polp`, che sta dentro **polpette**. Con la soglia di `RADICE_MINIMA` a 6 caratteri quel caso non
 * si presenta — ma «polp» non è l'unica parola corta della lingua italiana, e le ricette vere le ha
 * scritte qualcuno che non stava pensando a questo file.
 *
 * ## Come si legge l'esito
 *
 * Per ogni allergene stampa le ricette che **oggi passavano e da adesso no**. Vanno lette una per
 * una, ed è un lavoro di cinque minuti:
 *
 *   · se il piatto **contiene davvero** quell'allergene → è un difetto chiuso, ed è il punto;
 *   · se **non c'entra niente** → la radice è troppo aggressiva su quella parola. Si alza
 *     `RADICE_MINIMA` in `src/menu/exclusions.ts` (sta lì da sola apposta) e si rilancia.
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:esclusioni`.
 */
import { PrismaClient } from '@prisma/client';
import { exclusionKeys, radiceChiave, recipeHaystack } from '../src/menu/exclusions';

/** Gli allergeni che una cliente può davvero dichiarare: le chiavi della mappa e gli alias UE. */
const DA_GUARDARE = [
  'latte', 'glutine', 'uova', 'pesce', 'crostacei', 'molluschi', 'soia', 'sesamo',
  'arachidi', 'frutta a guscio', 'frutta secca', 'legumi', 'sedano', 'senape', 'lupini', 'solfiti',
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const ricette = (await prisma.recipe.findMany({
      where: { active: true } as never,
      select: { id: true, name: true, ingredients: true },
    })) as { id: string; name: string; ingredients: unknown }[];
    console.log(`\nRicette attive in catalogo: ${ricette.length}\n`);

    const fieno = ricette.map((r) => ({ r, h: recipeHaystack(r.name, r.ingredients) }));
    let totaleInPiu = 0;

    for (const allergene of DA_GUARDARE) {
      const chiavi = [...exclusionKeys([allergene])];
      const radici = chiavi.map((k) => radiceChiave(k)).filter((x): x is string => !!x);

      const prima = fieno.filter(({ h }) => chiavi.some((k) => h.includes(k)));
      const inPiu = fieno.filter(({ h }) => !chiavi.some((k) => h.includes(k)) && radici.some((r) => h.includes(r)));
      totaleInPiu += inPiu.length;

      const quota = ((prima.length / (ricette.length || 1)) * 100).toFixed(1);
      console.log(`${allergene.padEnd(18)} toglieva ${String(prima.length).padStart(5)} ricette (${quota}%) · in più: ${inPiu.length}`);
      for (const { r, h } of inPiu) {
        const colpite = radici.filter((x) => h.includes(x));
        console.log(`      ⚠️  ${r.name}   ← radice ${colpite.join(', ')}`);
      }
    }

    console.log(`\nIn tutto la radice toglie ${totaleInPiu} righe in più.`);
    console.log(
      'Vanno lette una per una: se il piatto contiene davvero l\'allergene è un difetto chiuso,\n' +
        'se non c\'entra niente si alza RADICE_MINIMA in src/menu/exclusions.ts e si rilancia.\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
