/**
 * DIAGNOSTICA: **il vocabolario degli allergeni — cosa non conosce, e quanto costa** — sola lettura.
 *
 * Tre conti, col giudizio in `src/catalog/vocabolario-allergeni.ts` e le sue prove:
 *  1. le parole CANDIDATE (taleggio, robiola, fontina… seppie, frutti di mare): quante ricette le
 *     hanno in un ingrediente e NON portano il tag → i piatti che oggi arrivano a chi ha
 *     dichiarato quell'allergia;
 *  2. le forme «senza ‹allergene›» («pasta senza glutine») che portano il tag lo stesso, separando
 *     quelle in cui il tag viene comunque da un altro ingrediente;
 *  3. quanto divergono i DUE vocabolari (tag e esclusioni).
 *
 * ⚠️ **Non scrive niente.** Con questi numeri si decide se allargare il vocabolario e riparare i tag.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:vocabolario-allergeni
 *   TUTTE=1 npm run diag:vocabolario-allergeni     → anche le ricette spente
 */
import { PrismaClient } from '@prisma/client';
import { contaCandidati, contaDivergenzeSulCatalogo, contaSenza, divergenze } from '../src/catalog/vocabolario-allergeni';

const prisma = new PrismaClient();
const TUTTE = process.env.TUTTE === '1';

async function main(): Promise<void> {
  const ricette = (await prisma.recipe.findMany({
    where: TUTTE ? {} : { active: true },
    select: { id: true, name: true, ingredients: true, allergens: true, active: true },
  })) as { id: string; name: string; ingredients: unknown; allergens: string[]; active: boolean }[];
  console.log(`Ricette guardate: ${ricette.length} (${TUTTE ? 'tutte' : 'solo attive'})`);

  console.log('\n=== 1. LE PAROLE CHE IL VOCABOLARIO NON CONOSCE — «senzaTag» è il numero che decide ===');
  const c = contaCandidati(ricette);
  const totaleSenzaTag = c.reduce((n, r) => n + r.senzaTag, 0);
  console.table(c.map((r) => ({ allergene: r.allergene, parola: r.parola, ricette: r.ricette, senzaTag: r.senzaTag, esempi: r.esempi.join(' · ') })));
  console.log(`Ricette che perdono almeno un tag (righe sommate, una ricetta può contare due volte): ${totaleSenzaTag}`);

  console.log('\n=== 2. «SENZA ‹ALLERGENE›» CHE PORTA IL TAG LO STESSO — conta la differenza, non il totale ===');
  const s = contaSenza(ricette);
  console.table(s.map((r) => ({ allergene: r.allergene, forma: r.forma, colTag: r.colTagLoStesso, giustificate: r.giustificate, daTogliere: r.colTagLoStesso - r.giustificate, esempi: r.esempi.join(' · ') })));

  console.log('\n=== 3. I DUE VOCABOLARI (tag / esclusioni): parole in uno solo dei due ===');
  for (const d of divergenze()) {
    console.log(`· ${d.allergene}: solo nei TAG → ${d.soloNeiTag.join(', ') || '—'}`);
    console.log(`  ${' '.repeat(d.allergene.length)}  solo nelle ESCLUSIONI → ${d.soloNelleEsclusioni.join(', ') || '—'}`);
  }
  console.log('\n=== 4. QUANTO COSTA UNIFICARE: parole solo nelle ESCLUSIONI, ricette che le hanno senza il tag ===');
  const u = contaDivergenzeSulCatalogo(ricette);
  console.table(u.filter((r) => r.senzaTag > 0).map((r) => ({ allergene: r.allergene, parola: r.parola, ricette: r.ricette, senzaTag: r.senzaTag, esempi: r.esempi.join(' · ') })));
  console.log(`Tag che l'unificazione scriverebbe (righe sommate): ${u.reduce((n, r) => n + r.senzaTag, 0)}`);
  console.log('\n⚠️ Sola lettura: niente è stato scritto.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
