import { PrismaClient } from '@prisma/client';
import { suggestAllergens } from '../src/catalog/allergens';
import { contaPortaUnica, type RicettaDaContare } from '../src/catalog/allergeni-porta-unica';

/**
 * ⛔ **LA SECONDA COPIA DI «QUESTA CHIAVE VALE?» — quanto costa chiuderla. SOLA LETTURA.**
 *
 * `menu/exclusions.ts` risponde con tre filtri: le parole omonime, le frasi che non sono, e — dal
 * 4/9 — `SOLO_A_INIZIO_PAROLA`, che è la risposta alle **famiglie aperte**. `catalog/allergens.ts`
 * ne ha una copia sua che conosce i primi due e **non il terzo**. Quindi la regola scritta per
 * «grana» e «grano» vale per le esclusioni della cliente e **non** per i tag allergene, che però
 * vengono *scritti* sulle ricette.
 *
 * ⚠️ **Il conto NON sta qui**: sta in `catalog/allergeni-porta-unica.ts`, che è puro e ha le sue
 * prove. Da questo numero dipende se la porta unica si accende in blocco o si legge riga per riga,
 * e un giudizio che decide non sta in un file di `prisma/` che nessun test guarda.
 *
 * ⚠️ **L'errore ha un verso solo**: la porta unica *toglie* tag, non ne aggiunge. Ogni riga qui è
 * un piatto che **torna disponibile** a chi ha quell'allergia. La domanda, per ognuna, è una sola:
 * *quella parola conteneva davvero l'allergene?*
 *
 *     npm run diag:chiave-doppia
 */

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/** ⚠️ Quante coppie si stampano: l'elenco si legge, quindi ha un tetto e lo dice. */
const TETTO_COPPIE = Number(process.env.COPPIE ?? 40);

async function main() {
  riga('==================================================================');
  riga('  «QUESTA CHIAVE VALE?» — la seconda copia, e quanto costa chiuderla');
  riga('  Sola lettura. Ricette: solo ATTIVE.');
  riga('==================================================================');

  const ricette = (await prisma.recipe.findMany({
    where: { active: true } as never,
    select: { id: true, name: true, ingredients: true, allergens: true, allergensReviewed: true },
  })) as unknown as RicettaDaContare[];

  const conto = contaPortaUnica(
    ricette,
    (i) => suggestAllergens(i).map((a) => ({ allergen: a.allergen, matched: a.matched })),
  );

  titolo('I TRE NUMERI');
  riga('');
  riga(`  Ricette attive esaminate                      ${String(conto.esaminate).padStart(7)}`);
  riga(`  Cambia l'elenco DEDOTTO                       ${String(conto.cambiano).padStart(7)}`);
  riga(`  ⛔ Cambia quello che è SCRITTO in catalogo     ${String(conto.cambianoDavvero).padStart(7)}`);
  riga(`     …e di quelle, con la spunta di conferma    ${String(conto.cambianoConfermate).padStart(7)}`);
  riga('');
  riga('  ⚠️ I due numeri hanno denominatori diversi ed è tutto il punto: il primo conta');
  riga('     l\'elenco che la deduzione produrrebbe, il secondo conta le ricette che hanno');
  riga('     quell\'allergene SCRITTO — cioè quelle che tornerebbero servibili a un\'allergica.');
  riga('     Si decide sul secondo.');
  riga('  ⚠️ La terza riga pesa diverso: lì il tag qualcuno l\'ha accettato. ⛔ Ma «confermata»');
  riga('     comprende anche le conferme IN BLOCCO del 19/8, dove gli allergeni li aveva scritti il');
  riga('     riconoscitore: non vuol dire «guardata una per una», vuol dire «qualcuno ha premuto».');

  if (conto.guadagnati > 0) {
    riga('');
    riga('==================================================================');
    riga(`  ⛔ FERMI: ${conto.guadagnati} ricette GUADAGNANO un allergene.`);
    riga('  La porta unica aggiunge un filtro, quindi non dovrebbe poter guadagnare niente.');
    riga('  Vuol dire che le due copie divergevano in un modo che nessuno aveva capito:');
    riga('  questa misura va riletta PRIMA di toccare qualunque cosa.');
    riga('==================================================================');
  }

  titolo(`DA LEGGERE UNA PER UNA — ${conto.coppie.length} coppie (chiave dentro una parola più lunga)`);
  riga('');
  riga('  ⚠️ NON è l\'elenco delle 239 occorrenze del riquadro del 4/9: una parola compare qui solo');
  riga('     se, tolta lei, l\'allergene si perde per intero. Una ricetta con «melograno» E «farina»');
  riga('     il glutine lo tiene, e la parola non si vede.');
  riga('');
  riga('  Per ognuna: «questa PAROLA contiene davvero quell\'allergene?»');
  riga('    · NO → la porta unica la scarta, e il piatto torna a chi ha quell\'allergia;');
  riga('    · SÌ → attenzione: accendendo la porta unica si TOGLIE una protezione.');
  riga('');
  for (const c of conto.coppie.slice(0, TETTO_COPPIE)) {
    riga(
      `  · ${c.allergen.padEnd(16)} «${c.chiave}» dentro «${c.parola}»`
      + `   ${String(c.ricette).padStart(5)} ricette, ${String(c.scritte).padStart(5)} lo hanno SCRITTO`
      + `, ${String(c.confermate).padStart(5)} con la spunta`,
    );
    for (const e of c.esempi) riga(`        ${e}`);
  }
  if (conto.coppie.length > TETTO_COPPIE) {
    riga('');
    riga(`  …e altre ${conto.coppie.length - TETTO_COPPIE}. Alza COPPIE per vederle tutte.`);
  }

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
