/**
 * L'ETICHETTA CONTRO IL CONTENUTO — le ricette che dicono di essere vegane e contengono pesce.
 *
 * ⛔ Trovato l'1/9 con `diag:carne-fuori-posto`: **175 piatti** in panieri vegani e vegetariani
 * contengono pesce o carne, e **tutti e 175 hanno il regime «compatibile»** — cioè «Salmone al
 * forno con asparagi e limone» è dichiarato `vegan` in catalogo. Il paniere sta facendo quello che
 * gli è stato detto: a sbagliare è l'etichetta.
 *
 * ⚠️ **E il difetto è più largo del paniere.** Un salmone etichettato `vegan` è vegano dappertutto:
 * nella base personale certificata, nelle tendine del back office, in ogni filtro per regime del
 * motore. Il paniere è solo il posto dove finalmente si vede.
 *
 * ⚠️ E spiega perché `panieri:pesce` trovava «pesce 0» negli onnivori: il pesce non è nei panieri
 * onnivori, è tutto etichettato vegano. La derivazione cercava nel posto giusto una cosa che sta
 * nel posto sbagliato — e correggere l'etichetta la fa comparire dove serve.
 *
 * ## DUE MUCCHI, E SOLO UNO SI CORREGGE A MACCHINA
 *
 * ⛔ In cima all'elenco c'è «Polpo d'Alghe Nori Farcito Riso Integrale Rosso e Edamame»: un piatto
 * vegano col nome di un polpo. Riscrivergli l'etichetta a macchina sarebbe l'errore uguale e
 * contrario a quello che si sta correggendo.
 *
 * - **SICURE**: il termine sta negli **ingredienti** — «acciughe sotto sale» dentro i «Carciofi
 *   alla romana». Un ingrediente è una dichiarazione di cosa c'è dentro, non un nome di fantasia.
 * - **DUBBIE**: ha scattato **solo il nome**. Quelle le legge una persona, e restano com'erano.
 *
 * ## DOVE VANNO
 *
 * Nel nesting di `common/regimi.ts` (vegan ⊂ vegetarian ⊂ pescetarian ⊂ onnivoro) un piatto di
 * pesce è **`pescetarian`** e uno di carne **`omnivore`**: è il regime più stretto che può
 * mangiarlo. ⚠️ Non «onnivoro» per tutti: buttare il pesce nell'onnivoro lo toglierebbe alle
 * pescetariane, che è metà del motivo per cui questa correzione esiste.
 *
 * ⛔ **NON TOCCA I PANIERI.** Cambia solo `Recipe.regime`. Le appartenenze già scritte restano
 * dove sono: si rifanno con `panieri:riempi` e `panieri:pesce` DOPO, ed è giusto che siano due
 * passi separati — questo si può rilanciare e leggere senza muovere il pool di nessuna cliente.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run regime:contenuto              → sola lettura: cosa correggerebbe, e cosa no
 *   ESEMPI=200 npm run regime:contenuto   → tutti i nomi (default 30)
 *   APPLICA=1 npm run regime:contenuto    → corregge SOLO il mucchio sicuro
 */
import { PrismaClient } from '@prisma/client';
import { REGIMI_DA_CONTROLLARE, classifica, type Cosa } from '../src/catalog/etichetta-contro-contenuto';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 30) || 30);
const APPLICA = process.env.APPLICA === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/**
 * ⚠️ Vegane, vegetariane **e onnivore**: queste ultime solo per il pesce (vedi
 * `REGIMI_DA_CONTROLLARE`), perché un salmone dichiarato `omnivore` è il motivo per cui 2351 righe
 * risultano «incompatibili» dentro i panieri pescetariani appena costruiti.
 */
const REGIMI_CHE_NON_POSSONO = [...REGIMI_DA_CONTROLLARE];
const nomiIngredienti = (ing: unknown): string[] =>
  (Array.isArray(ing) ? (ing as { name?: string }[]) : [])
    .map((x) => (typeof x?.name === 'string' ? x.name.trim() : ''))
    .filter((x) => x !== '');

type Riga = { id: string; nome: string; regime: string; cosa: Cosa; prova: string; perche: string };

/**
 * ⛔ **IL GIUDIZIO NON STA QUI**: sta in `catalog/etichetta-contro-contenuto.ts`, con le sue prove.
 * Questo script con `APPLICA=1` riscrive `Recipe.regime` in blocco — 549 ricette al primo giro — e
 * l'1/9 il suo mucchio «sicuro» conteneva due errori nelle prime trenta righe. Li ha visti una
 * persona leggendo l'output, non una prova, perché il giudizio stava dentro lo script.
 *
 * ⚠️ Qui restano il **quando** scrivere e il **come dirlo**.
 */

async function main() {
  titolo("L'ETICHETTA CONTRO IL CONTENUTO — regime dichiarato vs cosa c'è dentro");
  riga('');
  riga(APPLICA ? '  ⚠️ APPLICA=1: le SICURE verranno corrette.' : '  Sola lettura. Per correggere: APPLICA=1');

  const ricette = (await prisma.recipe.findMany({
    where: { active: true, regime: { in: REGIMI_CHE_NON_POSSONO } },
    select: { id: true, name: true, regime: true, ingredients: true },
  })) as unknown as { id: string; name: string; regime: string; ingredients: unknown }[];

  const sicure: (Riga & { regimeGiusto: string })[] = [];
  const dubbie: Riga[] = [];
  for (const r of ricette) {
    const ingredienti = nomiIngredienti(r.ingredients);
    const e = classifica(r.name, ingredienti, r.regime);
    if (e.tipo === 'ok') continue;
    const base = { id: r.id, nome: r.name, regime: r.regime, cosa: e.cosa, prova: e.prova };
    if (e.tipo === 'sicura') sicure.push({ ...base, perche: 'ingrediente', regimeGiusto: e.regimeGiusto });
    else dubbie.push({ ...base, perche: e.perche });
  }

  titolo('IL CONTO');
  riga('');
  riga(`  Ricette attive guardate (vegane, vegetariane, onnivore)  ${ricette.length}`);
  riga(`  · con carne o pesce negli INGREDIENTI (sicure)   ${sicure.length}`);
  riga(`  · dubbie, NON si toccano                         ${dubbie.length}`);
  riga(`      · solo nel nome                              ${dubbie.filter((d) => d.perche === 'solo nel nome').length}`);
  riga(`      · sembrano imitazioni vegetali               ${dubbie.filter((d) => d.perche !== 'solo nel nome').length}`);
  riga('');
  riga(`  Delle sicure: ${sicure.filter((x) => x.regimeGiusto === 'pescetarian').length} andrebbero a «pescetarian», `
    + `${sicure.filter((x) => x.regimeGiusto === 'omnivore').length} a «omnivore».`);

  if (dubbie.length) {
    titolo('LE DUBBIE — le legge una persona, una per una');
    riga('');
    riga('  ⚠️ Due motivi diversi, e vanno letti diversamente.');
    riga('  · «solo nel nome»: può essere un piatto vegetale che si chiama come un pesce — «Polpo');
    riga('    d\'Alghe Nori» è vegano davvero — oppure ⛔ una ricetta a cui MANCA l\'ingrediente');
    riga('    nell\'elenco, che è un difetto di catalogo a sé («Branzino al forno con verdure rosse»');
    riga('    non sembra un\'imitazione: sembra un branzino con la lista incompleta).');
    riga('  · «sembra un\'imitazione»: nel piatto c\'è una parola come «vegetale», «di tofu», «vegan».');
    riga('    ⛔ Non si corregge a macchina in NESSUNO dei due versi: «Prosciutto con contorno');
    riga('    vegetale» è prosciutto vero, e dichiararlo imitazione sarebbe carne lasciata');
    riga('    etichettata vegetariana — l\'errore che qui non si può fare.');
    riga('');
    for (const d of dubbie.slice(0, ESEMPI)) riga(`  · [${d.cosa}] «${d.nome}»  (oggi «${d.regime}» — ${d.perche})`);
    if (dubbie.length > ESEMPI) riga(`  … e altre ${dubbie.length - ESEMPI}. ESEMPI=${dubbie.length} per vederle tutte.`);
  }

  if (sicure.length) {
    titolo('LE SICURE — il termine sta negli ingredienti');
    riga('');
    for (const x of sicure.slice(0, ESEMPI)) {
      riga(`  · «${x.nome}»`);
      riga(`      oggi «${x.regime}» → «${x.regimeGiusto}»   (ingrediente: «${x.prova}»)`);
    }
    if (sicure.length > ESEMPI) riga(`  … e altre ${sicure.length - ESEMPI}. ESEMPI=${sicure.length} per vederle tutte.`);
  }

  if (!APPLICA) {
    riga('');
    riga('  Sola lettura: niente è stato scritto. Per correggere le sicure: APPLICA=1');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let fatte = 0;
  for (const x of sicure) {
    await prisma.recipe.update({
      where: { id: x.id },
      data: { regime: x.regimeGiusto } as never,
    });
    fatte += 1;
  }
  riga(`  ✅ Corrette ${fatte} ricette. Le ${dubbie.length} dubbie sono rimaste come stavano.`);
  riga('');
  riga('  ⚠️ I PANIERI NON SONO STATI TOCCATI: le appartenenze già scritte stanno ancora dove');
  riga('  stavano. ⛔ E rilanciare `panieri:riempi` NON le toglie: quello script solo AGGIUNGE');
  riga('  (`createMany` con `skipDuplicates`), che è ciò che lo rende ripetibile senza disfarlo.');
  riga('  Ora, in questo ordine:');
  riga('     1) npm run panieri:pulisci            → toglie dai panieri chi non ci può stare');
  riga('     2) APPLICA=1 npm run panieri:pesce    → e il pesce entra in quelli pescetariani');
  riga('     3) npm run diag:carne-fuori-posto     → deve restare solo il mucchio dubbio');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
