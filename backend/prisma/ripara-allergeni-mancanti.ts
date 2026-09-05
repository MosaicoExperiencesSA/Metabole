/**
 * RIPARAZIONE: **i tag allergene che MANCANO** — la deduzione di oggi li trova, la ricetta non li porta.
 *
 * Il 5/9 il vocabolario è stato unificato (i tag leggono anche le parole delle esclusioni) e
 * allargato (taleggio, scamorza, burrata, seppie…). `diag:vocabolario-allergeni` ha misurato
 * 616 + 224 tag mancanti. ⛔ Correggere il vocabolario non riporta indietro quello che è già
 * scritto: questo script aggiunge i tag che mancano. **Aggiunge, mai toglie** (per togliere c'è
 * `ripara:allergeni-chiave`, con la sua regola più stretta). Il giudizio sta in
 * `src/catalog/allergeni-mancanti.ts`, con le sue prove.
 *
 * ⛔ Chi ha scelto gli allergeni a mano (`catalog.recipe.allergens.set` nel registro) NON si tocca
 * nemmeno per aggiungere: esce in un elenco a parte e lo guarda una persona.
 * ⚠️ `allergensReviewed` non si tocca: azzerarla toglierebbe il piatto dalle basi personali.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *     npm run ripara:allergeni-mancanti              → sola lettura
 *     CONFERMA=1 npm run ripara:allergeni-mancanti   → scrive
 *     RIGHE=50 …                                     → più esempi
 */
import { PrismaClient } from '@prisma/client';
import { allergeniMancantiDaAggiungere, contaMancanti } from '../src/catalog/allergeni-mancanti';
import type { RicettaDaRiparare } from '../src/catalog/allergeni-porta-unica';
import { allergenLabel } from '../src/catalog/allergens';

const prisma = new PrismaClient();
const SCRIVE = process.env.CONFERMA === '1';
const TETTO_RIGHE = Math.max(1, Number(process.env.RIGHE ?? 15) || 15);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => { riga(''); riga('──────────────────────────────────────────────'); riga(`  ${s}`); riga('──────────────────────────────────────────────'); };

async function main(): Promise<void> {
  riga('==================================================================');
  riga('  I TAG ALLERGENE CHE MANCANO — si aggiungono, non si toglie niente');
  riga(SCRIVE ? '  ⛔ CONFERMA=1: questo giro SCRIVE.' : '  Sola lettura. Per scrivere: CONFERMA=1');
  riga('==================================================================');

  // Anche le spente: una bozza si riaccende, e il tag deve esserci già.
  const ricette = (await prisma.recipe.findMany({
    select: { id: true, name: true, ingredients: true, allergens: true, allergensReviewed: true, active: true },
  })) as unknown as (RicettaDaRiparare & { active: boolean })[];
  const aMano = new Set(((await prisma.auditLog.findMany({
    where: { action: 'catalog.recipe.allergens.set', entityType: 'recipe' } as never,
    select: { entityId: true },
  })) as { entityId: string | null }[]).map((x) => String(x.entityId ?? '')));
  const conRegistro = ricette.map((r) => ({ ...r, toccataAMano: aMano.has(r.id) }));
  const conto = contaMancanti(conRegistro);
  const daGuardare = ricette.filter((r) => aMano.has(r.id) && allergeniMancantiDaAggiungere({ ...r, toccataAMano: false }).length);

  titolo('I NUMERI');
  riga(`  Ricette esaminate (attive e spente)        ${String(conto.esaminate).padStart(7)}`);
  riga(`  ⛔ Che guadagnano almeno un tag             ${String(conto.daRiparare).padStart(7)}`);
  riga(`     …e di quelle, con la spunta di conferma ${String(conto.confermate).padStart(7)}`);
  riga(`  ⚠️ Non toccate perche toccate a mano        ${String(daGuardare.length).padStart(7)}`);
  for (const r of daGuardare.slice(0, TETTO_RIGHE)) riga(`       · ${r.name}`);

  titolo('PER ALLERGENE');
  for (const p of conto.perAllergene) {
    riga(`  · ${allergenLabel(p.allergen).padEnd(28)} ${String(p.ricette).padStart(6)} ricette`);
    for (const e of p.esempi) riga(`        ${e}`);
  }

  if (!SCRIVE) {
    riga('');
    riga('  Fine. Niente è stato scritto. Per applicare:  CONFERMA=1 npm run ripara:allergeni-mancanti');
    return;
  }

  titolo('SCRITTURA');
  let toccate = 0;
  for (const r of conRegistro) {
    const m = allergeniMancantiDaAggiungere(r);
    if (!m.length) continue;
    const nuovi = [...new Set([...(r.allergens ?? []).map(String), ...m.map((x) => x.allergen)])];
    await prisma.recipe.update({ where: { id: r.id }, data: { allergens: nuovi } as never });
    toccate += 1;
    if (toccate <= TETTO_RIGHE) riga(`  · ${r.name}: + ${m.map((x) => `${allergenLabel(x.allergen)} (${x.ingrediente})`).join(', ')}`);
  }
  riga('');
  riga(`  ✅ Scritte ${toccate} ricette. Rilancia \`npm run diag:vocabolario-allergeni\`: la tabella 1 deve dare zero.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
