/**
 * ⛔ **QUANTE RICETTE VEGANE DEL CATALOGO CHIEDEREBBERO CONFERMA OGGI, E PER QUALE PAROLA.**
 *
 * Il cancello del 4/9 sera (`ricetta-che-si-puo-scrivere.ts`) chiede conferma su latte e uova in
 * un piatto dichiarato vegano. Questa diagnostica fa la stessa domanda a **tutte** le ricette
 * vegane attive: quante sono sbagliate davvero, e quali parole fanno scattare la conferma a torto
 * — l'elenco con cui si allungano le piante di `derivatoVegetale`, una alla volta.
 *
 * ⚠️ E i tag già SCRITTI in catalogo non cambiano da soli: una ricetta vegana con `latte` per una
 * «ricotta di mandorla» si ripara con `npm run ripara:allergeni-chiave` (la porta unica ora scarta
 * anche i derivati vegetali, e quello script toglie solo quello di cui sa il perché).
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:vegani-con-latte-e-uova
 */
import { PrismaClient } from '@prisma/client';
import { contaVeganiCheChiedono } from '../src/catalog/vegani-che-chiedono';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ricette = (await prisma.recipe.findMany({
    where: { regime: 'vegan' as never, active: true },
    select: { id: true, name: true, ingredients: true },
  })) as { id: string; name: string; ingredients: unknown }[];

  const c = contaVeganiCheChiedono(ricette);
  console.log(`Ricette vegane attive: ${c.esaminate}`);
  console.log(`Chiederebbero conferma oggi: ${c.chiedono}`);
  if (!c.chiedono) {
    console.log('Nessuna: il cancello non scatta su niente di quello che c\'è.');
    return;
  }
  console.log('\n=== PER INGREDIENTE, dalla più frequente — da leggere una riga per volta ===');
  console.log('⚠️ Se una riga è un derivato vegetale scritto in una forma nuova («… di lupini»), la');
  console.log('   pianta va aggiunta a `PIANTE_DEI_DERIVATI` in `menu/exclusions.ts`. Se è un piatto');
  console.log('   con le uova o il formaggio veri, la ricetta è dichiarata vegana a torto.');
  console.table(c.parole.map((p) => ({ ingrediente: p.ingrediente, ricette: p.ricette, esempi: p.esempi.join(' · ') })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
