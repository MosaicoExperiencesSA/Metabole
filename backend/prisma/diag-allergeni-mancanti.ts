/**
 * DIAGNOSTICA: **quali allergeni le ricette NON dichiarano, e chi glieli farebbe guadagnare** —
 * sola lettura.
 *
 * È il punto 1 della decisione del 31/8 (`DECISIONI_Panieri.md` §1, la via di mezzo): gli allergeni
 * di una ricetta sono la **somma** di quelli dichiarati e di quelli dedotti dagli ingredienti. Prima
 * di scrivere quella somma su ventitremila ricette bisogna sapere due cose, e questa è quella che
 * conta di più.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## Perché non basta `diag:allergeni-deducibili`
 *
 * Quello guarda solo le ricette che **passano il riconoscimento degli ingredienti** — il 16% del
 * catalogo — perché la sua domanda è «la deduzione può decidere da sola?». ⚠️ Ma la SOMMA non ha
 * bisogno di riconoscere gli ingredienti: `suggestAllergens` legge i nomi e basta. Quindi qui si
 * guardano **tutte** le ricette attive, e il numero che ne esce è quello vero.
 *
 * ## ⛔ La colonna che conta è «CHI L'HA FATTO SCATTARE»
 *
 * Aggiungere un allergene a una ricetta la toglie dal catalogo di chi ha quell'allergia. Un
 * allergene **giusto** in più è una persona protetta; uno **sbagliato** in più è un piatto che
 * sparisce dal piano di qualcuno per un errore, e nessuno lo saprà mai.
 *
 * ⚠️ Ne conosciamo già uno, trovato il 31/8 prima di scrivere una riga: `noce moscata` fa scattare
 * **frutta a guscio**, perché contiene «noce» e `PAROLE_CHE_NON_SONO` non ha quell'omonima. La noce
 * moscata non è frutta a guscio. E non è solo un tag: `hitsExclusion` usa le stesse liste, quindi
 * quel piatto **oggi** sparisce già dal piano di chi è allergico alle noci.
 *
 * ⛔ Per questo il tabulato non dice solo «473 ricette guadagnerebbero i solfiti»: dice **con quale
 * ingrediente**, e quante volte. È l'unico modo per vedere i falsi PRIMA di scriverli — e
 * `exclusions.ts` ha una regola scritta apposta: le omonime nascono dalla diagnostica, non a mente.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:allergeni-mancanti           → tutte le ricette attive
 *   TUTTE=1 npm run diag:allergeni-mancanti   → anche quelle spente
 *   ESEMPI=30 npm run diag:allergeni-mancanti → più righe per elenco (default 15)
 *   SCATENANTI=40 ...                         → più ingredienti scatenanti per allergene (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { allergenLabel, suggestAllergens } from '../src/catalog/allergens';

const prisma = new PrismaClient();

const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 15) || 15);
const SCATENANTI = Math.max(1, Number(process.env.SCATENANTI ?? 20) || 20);
const TUTTE = process.env.TUTTE === '1';

const pct = (n: number, tot: number) => (tot ? `${((n / tot) * 100).toFixed(1)}%` : '—');
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  riga('');
  riga('==================================================================');
  riga('  ALLERGENI MANCANTI — cosa aggiungerebbe la somma, e per colpa di chi');
  riga(`  Sola lettura. Ricette: ${TUTTE ? 'TUTTE (anche spente)' : 'solo ATTIVE'}.`);
  riga('==================================================================');

  const ricette = (await prisma.recipe.findMany({
    where: TUTTE ? {} : { active: true },
    select: { id: true, name: true, regime: true, ingredients: true, allergens: true, allergensReviewed: true },
  })) as { id: string; name: string; regime: string; ingredients: unknown; allergens: string[]; allergensReviewed: boolean }[];

  riga('');
  riga(`Ricette in esame: ${ricette.length}.`);

  let cambiano = 0;
  let cambianoConIlContrassegno = 0;
  const guadagnatiPerCodice = new Map<string, number>();
  const persiPerCodice = new Map<string, number>();
  /** allergene → (ingrediente che l'ha fatto scattare → quante ricette). ⛔ La colonna che conta. */
  const scatenanti = new Map<string, Map<string, number>>();
  const esempi: string[] = [];

  for (const r of ricette) {
    const dedotti = suggestAllergens(r.ingredients);
    const dichiarati = new Set(r.allergens ?? []);
    const guadagnati = dedotti.filter((d) => !dichiarati.has(d.allergen));
    const persi = [...dichiarati].filter((c) => !dedotti.some((d) => d.allergen === c));

    for (const c of persi) persiPerCodice.set(c, (persiPerCodice.get(c) ?? 0) + 1);
    if (!guadagnati.length) continue;

    cambiano += 1;
    if (r.allergensReviewed) cambianoConIlContrassegno += 1;
    for (const g of guadagnati) {
      guadagnatiPerCodice.set(g.allergen, (guadagnatiPerCodice.get(g.allergen) ?? 0) + 1);
      const per = scatenanti.get(g.allergen) ?? new Map<string, number>();
      /**
       * ⚠️ Gli ingredienti scatenanti di UNA ricetta si contano una volta sola: un piatto che
       * ripete «uvetta» due volte non deve far sembrare quel nome più diffuso di quello che è.
       */
      for (const nome of new Set(g.matched)) per.set(nome, (per.get(nome) ?? 0) + 1);
      scatenanti.set(g.allergen, per);
    }
    if (esempi.length < ESEMPI) {
      esempi.push(
        `  · «${r.name}» (${r.regime}) — oggi [${(r.allergens ?? []).map(allergenLabel).join(', ') || 'niente'}]`
        + `, guadagnerebbe: ${guadagnati.map((g) => `${allergenLabel(g.allergen)} (da «${[...new Set(g.matched)].slice(0, 2).join('», «')}»)`).join(' + ')}`,
      );
    }
  }

  const tot = ricette.length;

  titolo('QUANTE CAMBIEREBBERO');
  riga('');
  riga(`  Ricette che guadagnerebbero almeno un allergene:  ${cambiano}  (${pct(cambiano, tot)})`);
  riga(`  …di cui col contrassegno di verifica già acceso:  ${cambianoConIlContrassegno}`);
  riga('');
  riga('  ⚠️ «Contrassegno acceso» NON vuol dire «una persona l\'ha guardata una per una»: comprende');
  riga('  le conferme IN BLOCCO decise il 19/8, dove gli allergeni li aveva scritti il riconoscitore.');
  riga('  ⛔ In `diag:allergeni-deducibili` questa riga si chiamava «confermate A MANO», ed era una');
  riga('  bugia comoda: chi la leggeva concludeva che qualcuno le avesse viste. Corretta il 31/8.');

  titolo('PER ALLERGENE — quante ricette lo guadagnerebbero');
  riga('');
  for (const [c, n] of [...guadagnatiPerCodice.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`  · ${String(n).padStart(6)}  ${allergenLabel(c)}`);
  }

  titolo('⛔ E PER COLPA DI CHI — i falsi si vedono QUI, prima di scriverli');
  riga('');
  riga('  Per ogni allergene, gli ingredienti che l\'hanno fatto scattare e su quante ricette.');
  riga('  ⚠️ Si legge cercando i nomi che con quell\'allergene NON c\'entrano: ognuno di quelli è un');
  riga('  piatto che sparirebbe dal piano di chi ha quell\'allergia, per un errore.');
  riga('  Ne conosciamo già uno: «noce moscata» sotto «Frutta a guscio». Non è frutta a guscio.');
  for (const [c, per] of [...scatenanti.entries()].sort((a, b) => (guadagnatiPerCodice.get(b[0]) ?? 0) - (guadagnatiPerCodice.get(a[0]) ?? 0))) {
    riga('');
    riga(`  ── ${allergenLabel(c)} — ${per.size} nomi diversi`);
    for (const [nome, n] of [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, SCATENANTI)) {
      riga(`  · ${String(n).padStart(6)}  ${nome}`);
    }
    if (per.size > SCATENANTI) riga(`     …e altri ${per.size - SCATENANTI}. Alza SCATENANTI per vederli.`);
  }

  titolo('COSA LA SOMMA NON TOCCA — gli allergeni dichiarati che non risultano');
  riga('');
  if (!persiPerCodice.size) {
    riga('  Nessuno.');
  } else {
    for (const [c, n] of [...persiPerCodice.entries()].sort((a, b) => b[1] - a[1])) {
      riga(`  · ${String(n).padStart(6)}  ${allergenLabel(c)}`);
    }
  }
  riga('');
  riga('  ⛔ La somma NON li toglie, ed è la parte più importante della decisione: togliere un');
  riga('  allergene dichiarato da una persona per farlo decidere a un elenco di parole è l\'unico');
  riga('  errore di questa consegna che si vedrebbe addosso a qualcuno. Restano dove sono.');
  riga('  ⚠️ Ma vanno guardati: ognuno è o un buco degli elenchi, o un allergene messo a mano che');
  riga('  dagli ingredienti non risulta — e le due cose si chiudono in modi opposti.');

  titolo(`ESEMPI (${esempi.length})`);
  riga('');
  esempi.forEach(riga);

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
