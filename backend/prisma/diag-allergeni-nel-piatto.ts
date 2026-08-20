/**
 * ⚠️ **STA GIÀ ARRIVANDO NEL PIATTO?** — la domanda che decide tutto il resto.
 *
 * Trovato il 20/8 leggendo `evaluateMeals`, la funzione che i commenti chiamano «la sicurezza»
 * (`menu.service.ts`, §2/§7). Costruisce l'elenco delle esclusioni da **intolleranze** (bloccanti) e
 * **cibi non graditi** (sostituibili). ⛔ Le **allergie** non ci sono: si leggono solo per la regola
 * del delattosato. E la prima riga della funzione è
 *
 *     if (!intolerances.length && !dislikes.length) return { violations: [], subsByRecipe: {} };
 *
 * cioè una cliente che ha dichiarato **soltanto allergie** esce di lì senza che si sia guardato
 * niente.
 *
 * ⚠️ Le allergie invece SONO controllate altrove: nelle sostituzioni di Gaia
 * («su questo non si media»), nel pool delle ricette semplici, e nella base personale — che usa
 * perfino i tag confermati dal nutrizionista. Tre punti su quattro: quello che manca è proprio la
 * composizione del menu.
 *
 * ## Perché una diagnostica e non una correzione
 *
 * Aggiungere le allergie all'elenco bloccante di `evaluateMeals` non è una riga: `violations` fa
 * **fermare l'erogazione** (`return []` + escalation). Se una dieta assegnata contiene l'allergene
 * di una cliente, da domattina quella cliente **non riceve il menu** invece di riceverne uno
 * sbagliato. Può darsi che sia giusto — ma è una decisione clinica e di prodotto, e chi scrive il
 * codice non la prende da solo alle sei di sera.
 *
 * Questa diagnostica dice **quante clienti e quali piatti**, cioè il numero da cui si decide:
 *
 *   · se è **zero**, le diete assegnate sono già scelte bene e la correzione è una rete di sicurezza
 *     che non cambia niente a nessuno: si fa e basta;
 *   · se **non è zero**, quelle righe sono piatti che stanno arrivando adesso a persone che hanno
 *     dichiarato un'allergia, e prima si sistemano quelle.
 *
 * ⚠️ Guarda **due strade**, perché sono due difetti diversi: le parole chiave (`exclusionKeys`, la
 * stessa del motore) e i **tag allergene confermati** sulla ricetta — che il motore dei menu non
 * legge affatto, mentre la base personale sì.
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:allergeni-piatto`.
 */
import { PrismaClient } from '@prisma/client';
import { EU_ALLERGEN_CODES } from '../src/catalog/allergens';
import { aGiorno } from '../src/common/date-only';
import { exclusionKeys, hitsExclusion, recipeHaystack } from '../src/menu/exclusions';

type Pasto = { slot: string; recipeId: string; name?: string };

async function main() {
  const prisma = new PrismaClient();
  try {
    const profili = (await prisma.clientProfile.findMany({
      where: { NOT: { allergies: { isEmpty: true } } } as never,
      select: { userId: true, name: true, allergies: true, intolerances: true },
    })) as { userId: string; name: string | null; allergies: string[]; intolerances: string[] }[];
    console.log(`\nClienti con almeno un'allergia dichiarata: ${profili.length}`);
    const soloAllergie = profili.filter((p) => !(p.intolerances ?? []).length);
    console.log(`Di cui SENZA intolleranze — quelle che escono subito da evaluateMeals: ${soloAllergie.length}\n`);

    const da = new Date(aGiorno(new Date()).getTime() - 14 * 86_400_000);
    let clientiColpiti = 0;
    let righe = 0;

    for (const p of profili) {
      const giorni = (await prisma.menuDay.findMany({
        where: { clientId: p.userId, date: { gte: da } } as never,
        select: { date: true, meals: true },
        orderBy: { date: 'asc' },
      })) as { date: Date; meals: unknown }[];
      if (!giorni.length) continue;

      const chiavi = exclusionKeys(p.allergies ?? []);
      const codici = new Set((p.allergies ?? []).filter((a) => EU_ALLERGEN_CODES.includes(a)));

      const ids = new Set<string>();
      for (const g of giorni) for (const m of ((g.meals ?? []) as Pasto[])) if (m?.recipeId) ids.add(m.recipeId);
      const ricette = (await prisma.recipe.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true, ingredients: true, allergens: true, allergensReviewed: true },
      })) as { id: string; name: string; ingredients: unknown; allergens: string[]; allergensReviewed: boolean }[];
      const perId = new Map(ricette.map((r) => [r.id, r]));

      const trovati: string[] = [];
      for (const g of giorni) {
        for (const m of ((g.meals ?? []) as Pasto[])) {
          const r = perId.get(m?.recipeId);
          if (!r) continue;
          const perParola = hitsExclusion(recipeHaystack(r.name, r.ingredients), chiavi);
          const perTag = (r.allergens ?? []).find((a) => codici.has(a));
          if (!perParola && !perTag) continue;
          const quando = g.date.toISOString().slice(0, 10);
          const come = [perParola ? `parola «${perParola}»` : null, perTag ? `TAG ${perTag}${r.allergensReviewed ? ' (confermato)' : ' (non confermato)'}` : null]
            .filter(Boolean)
            .join(' + ');
          trovati.push(`      ${quando} ${m.slot.padEnd(10)} ${r.name}   ← ${come}`);
        }
      }
      if (trovati.length) {
        clientiColpiti++;
        righe += trovati.length;
        console.log(`⚠️  ${p.name ?? p.userId} — allergie: ${(p.allergies ?? []).join(', ')}${(p.intolerances ?? []).length ? '' : '   [nessuna intolleranza: evaluateMeals non guarda niente]'}`);
        for (const t of trovati.slice(0, 12)) console.log(t);
        if (trovati.length > 12) console.log(`      …e altri ${trovati.length - 12} pasti`);
      }
    }

    console.log(`\n=== ESITO: ${clientiColpiti} clienti, ${righe} pasti negli ultimi 14 giorni e a venire.`);
    if (!clientiColpiti) {
      console.log(
        'Zero: le diete assegnate sono già scelte bene. Aggiungere le allergie alla guardia di\n' +
          '`evaluateMeals` sarebbe una rete di sicurezza che non cambia niente a nessuno — si fa e basta.',
      );
    } else {
      console.log(
        '⛔ Non è zero: questi piatti stanno arrivando adesso a persone che hanno dichiarato\n' +
          'un\'allergia. Prima si sistemano queste, poi si decide come chiudere il buco nel motore.',
      );
    }
    console.log('\n--- fine. Niente è stato modificato. ---\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
