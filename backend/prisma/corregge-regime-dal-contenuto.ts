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
import { eCarne, eCarneIngrediente, ePesce } from '../src/catalog/piatto-di-cosa';

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

/** ⚠️ Solo chi dichiara di non contenerli: un piatto onnivoro col pesce dentro è normale. */
const REGIMI_CHE_NON_POSSONO = ['vegan', 'vegetarian'];
const nomiIngredienti = (ing: unknown): string[] =>
  (Array.isArray(ing) ? (ing as { name?: string }[]) : [])
    .map((x) => (typeof x?.name === 'string' ? x.name.trim() : ''))
    .filter((x) => x !== '');

type Esito = { id: string; nome: string; regime: string; cosa: 'carne' | 'pesce'; prova: string };

async function main() {
  titolo("L'ETICHETTA CONTRO IL CONTENUTO — regime dichiarato vs cosa c'è dentro");
  riga('');
  riga(APPLICA ? '  ⚠️ APPLICA=1: le SICURE verranno corrette.' : '  Sola lettura. Per correggere: APPLICA=1');

  const ricette = (await prisma.recipe.findMany({
    where: { active: true, regime: { in: REGIMI_CHE_NON_POSSONO } },
    select: { id: true, name: true, regime: true, ingredients: true },
  })) as unknown as { id: string; name: string; regime: string; ingredients: unknown }[];

  const sicure: Esito[] = [];
  const dubbie: Esito[] = [];
  for (const r of ricette) {
    const ingredienti = nomiIngredienti(r.ingredients);
    /**
     * ⛔ **La carne si guarda per prima e vince**, come in `verdettoPescetariano`: un piatto che ha
     * tutti e due va all'onnivoro, non al pescetariano. «Mare e monti» esiste.
     */
    /**
     * ⛔ **`eCarneIngrediente`, non `eCarne`** — 1/9, dopo un falso positivo in produzione: un
     * Buddha Bowl di lenticchie stava per diventare onnivoro perché fra gli ingredienti c'è
     * «Carota **tagliata** sottile». Su un ingrediente le preparazioni non servono: se la carne c'è,
     * l'ingrediente la nomina.
     */
    const carneIng = ingredienti.find((i) => eCarneIngrediente(i));
    const pesceIng = ingredienti.find((i) => ePesce(i));
    if (carneIng) { sicure.push({ id: r.id, nome: r.name, regime: r.regime, cosa: 'carne', prova: carneIng }); continue; }
    if (pesceIng) { sicure.push({ id: r.id, nome: r.name, regime: r.regime, cosa: 'pesce', prova: pesceIng }); continue; }
    /** ⚠️ Solo il nome: può essere un piatto vegetale che si chiama come un pesce. Non si tocca. */
    if (eCarne(r.name)) { dubbie.push({ id: r.id, nome: r.name, regime: r.regime, cosa: 'carne', prova: r.name }); continue; }
    if (ePesce(r.name)) dubbie.push({ id: r.id, nome: r.name, regime: r.regime, cosa: 'pesce', prova: r.name });
  }

  titolo('IL CONTO');
  riga('');
  riga(`  Ricette attive dichiarate vegane o vegetariane   ${ricette.length}`);
  riga(`  · con carne o pesce negli INGREDIENTI (sicure)   ${sicure.length}`);
  riga(`  · solo nel NOME (dubbie, non si toccano)         ${dubbie.length}`);
  riga('');
  riga(`  Delle sicure: ${sicure.filter((x) => x.cosa === 'pesce').length} andrebbero a «pescetarian», `
    + `${sicure.filter((x) => x.cosa === 'carne').length} a «omnivore».`);

  if (dubbie.length) {
    titolo('LE DUBBIE — le legge una persona, una per una');
    riga('');
    riga('  ⚠️ Qui ha scattato solo il NOME. Può essere un piatto vegetale che si chiama come un');
    riga('  pesce — «Polpo d\'Alghe Nori» è vegano davvero — oppure una ricetta a cui manca');
    riga('  l\'ingrediente nell\'elenco. Il primo caso si lascia, il secondo si sistema a mano.');
    riga('');
    for (const d of dubbie.slice(0, ESEMPI)) riga(`  · [${d.cosa}] «${d.nome}»  (oggi «${d.regime}»)`);
    if (dubbie.length > ESEMPI) riga(`  … e altre ${dubbie.length - ESEMPI}. ESEMPI=${dubbie.length} per vederle tutte.`);
  }

  if (sicure.length) {
    titolo('LE SICURE — il termine sta negli ingredienti');
    riga('');
    for (const x of sicure.slice(0, ESEMPI)) {
      riga(`  · «${x.nome}»`);
      riga(`      oggi «${x.regime}» → «${x.cosa === 'pesce' ? 'pescetarian' : 'omnivore'}»   (ingrediente: «${x.prova}»)`);
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
      data: { regime: x.cosa === 'pesce' ? 'pescetarian' : 'omnivore' } as never,
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
