/**
 * DIAGNOSTICA: **quali alimenti non dicono se sono crudi o cotti** — sola lettura.
 *
 * Nasce dalle domande arrivate alla nutrizionista sul **grano saraceno** (19/8). Il numero è lo
 * stesso alimento visto in due modi:
 *
 *     grano saraceno   crudo ~343 kcal → cotto ~92 kcal      rapporto 0,27×
 *
 * ⚠️ Quasi **quattro volte**. Chi legge «80 g di grano saraceno» e lo pesa dalla parte sbagliata non
 * ha un'imprecisione, ha un altro pasto — ed è la stessa cosa già vista sul farro (voce 228).
 *
 * ## Cosa c'è già, e cosa lascia scoperto
 *
 * Dal 18/8 `NutrientFact.state` fa parte del significato dei numeri, e `stato-alimento.ts` fa la
 * cosa giusta: se l'alimento è in tabella **due volte** con stati diversi e la domanda non lo dice,
 * Gaia non sceglie — risponde «dipende se crudo o cotto».
 *
 * ⚠️ **Ma se la riga è UNA SOLA non c'è nessuna ambiguità da dichiarare**, e Gaia dice il numero. Se
 * quella riga è il crudo e la cliente sta pesando il cotto, il numero è giusto in tabella e sbagliato
 * nel piatto. Un dato che agisce e non si vede: nessun errore, nessuna riga rossa.
 *
 * ⚠️ E lo stesso vale nella scheda ricetta: «80 g di grano saraceno» non dice da che parte pesare.
 *
 * ## ⚠️ LA CONVENZIONE, decisa da Simone il 19/8
 *
 * «Diamo per assodato che gli ingredienti siano a crudo in tutte le ricette, come si fa nei libri.»
 * È una buona convenzione perché è **una sola**, ed è quella che una persona si aspetta: nei libri
 * di cucina «80 g di riso» sono 80 g di riso secco.
 *
 * ⚠️ Ma allora il pericolo **cambia forma**, e diventa più preciso: non è «l'alimento non dice se è
 * crudo o cotto», è **«di quell'alimento abbiamo SOLO il valore da cotto»**. Nella tabella verificata
 * sono 37 righe su 96, e sono le più pesanti del piatto: pasta, riso, quinoa, cuscus, orzo, farro,
 * tutti i legumi, le patate. Contare «80 g di quinoa» con la riga bollita (120 kcal/100 g) scrive 96
 * kcal dove ce ne sono ~284 — **tre volte meno**, e il numero sembra buono.
 *
 * ## Cosa dice questa diagnostica
 *
 * Quattro elenchi, ordinati per **quante ricette attive usano quell'alimento** — che è una priorità
 * oggettiva e non un giudizio clinico:
 *
 *   1. ⚠️ alimenti che in tabella ci sono **solo da cotto**, usati nelle ricette: è il pericolo vero;
 *   2. alimenti in tabella **senza stato**, usati nelle ricette: si contano, ma nessuno sa se quel
 *      valore è a crudo — «senza stato» non è «cotto», è «non lo so»;
 *   3. alimenti usati nelle ricette e **non in tabella**: su quelli Gaia non può dire niente;
 *   4. alimenti **già a crudo o a secco**: qui va tutto bene, e si contano per sapere quanti sono.
 *
 * ⚠️ **Non scrive e non indovina nessuno stato.** «Il grano saraceno delle ricette sarà cotto» è una
 * supposizione: metterla in banca dati vorrebbe dire far dire a Gaia un numero deciso da me. L'elenco
 * lo riempie la nutrizionista.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:crudo-cotto
 *   QUANTI=40 npm run diag:crudo-cotto
 */
import { PrismaClient } from '@prisma/client';
import { STATI_A_CRUDO } from '../src/nutrient-facts/stato-alimento';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const QUANTI = Math.max(1, Number(process.env.QUANTI ?? 20) || 20);

async function main() {
  console.log('');
  console.log('==================================================================');
  console.log('  CRUDO O COTTO — quali alimenti non lo dicono');
  console.log('  Sola lettura: non scrive e non indovina nessuno stato.');
  console.log('==================================================================');
  console.log('');

  const alimenti = (await prisma.nutrientFact.findMany({
    select: { name: true, synonyms: true, state: true, kcal: true } as never,
  })) as { name: string; synonyms: string[]; state: string | null; kcal: number | null }[];

  /** Da nome normalizzato (nome o sinonimo) alle righe che lo portano. */
  const perNome = new Map<string, { name: string; state: string | null }[]>();
  for (const a of alimenti) {
    for (const n of [a.name, ...(a.synonyms ?? [])]) {
      const k = normalizzaNome(n);
      if (!k) continue;
      perNome.set(k, [...(perNome.get(k) ?? []), { name: a.name, state: a.state }]);
    }
  }

  /**
   * Quante ricette usano ogni ingrediente. ⚠️ Si conta sulle ricette **attive**: una bozza mai
   * approvata non è nel piatto di nessuno, e contarla farebbe salire in cima alla lista un alimento
   * che oggi non mangia nessuno.
   */
  const ricette = (await prisma.recipe.findMany({
    where: { active: true } as never,
    select: { ingredients: true } as never,
  })) as { ingredients: unknown }[];

  const usi = new Map<string, number>();
  for (const r of ricette) {
    if (!Array.isArray(r.ingredients)) continue;
    // ⚠️ `Set` per ricetta: lo stesso ingrediente due volte nella stessa ricetta è UNA ricetta che
    // lo usa, non due. Senza, un piatto che ripete l'olio salirebbe in cima da solo.
    const nella = new Set<string>();
    for (const i of r.ingredients as { name?: unknown }[]) {
      const k = normalizzaNome(String((i ?? {}).name ?? ''));
      if (k) nella.add(k);
    }
    for (const k of nella) usi.set(k, (usi.get(k) ?? 0) + 1);
  }

  const soloCotto: { nome: string; quante: number; stati: string }[] = [];
  const senzaStato: { nome: string; quante: number }[] = [];
  const fuoriTabella: { nome: string; quante: number }[] = [];
  let aPosto = 0;
  const giaVisti = new Set<string>();

  for (const [k, quante] of usi) {
    const righe = perNome.get(k);
    if (!righe) { fuoriTabella.push({ nome: k, quante }); continue; }
    const nome = righe[0].name;
    if (giaVisti.has(nome)) continue;
    giaVisti.add(nome);
    /**
     * ⚠️ La stessa scelta che fa il codice quando scrive una ricetta (`scegliPerRicetta`): se una
     * riga a crudo o a secco c'è, va tutto bene qualunque altra riga ci sia accanto. Rifarla qui con
     * regole diverse vorrebbe dire che la diagnostica dice «a posto» su un alimento che il calcolo
     * rifiuta — due risposte alla stessa domanda.
     */
    const stati = righe.map((r) => (r.state ?? '').trim().toLowerCase());
    if (stati.some((x) => STATI_A_CRUDO.includes(x))) { aPosto += 1; continue; }
    if (stati.some((x) => !x)) { senzaStato.push({ nome, quante }); continue; }
    soloCotto.push({ nome, quante, stati: [...new Set(stati)].join(', ') });
  }

  const perUso = (a: { quante: number }, b: { quante: number }) => b.quante - a.quante;
  soloCotto.sort(perUso);
  senzaStato.sort(perUso);
  fuoriTabella.sort(perUso);

  console.log('   ⚠️  Convenzione (Simone, 19/8): nelle ricette le grammature sono A CRUDO, come nei libri.');
  console.log('');
  console.log(`1) ⚠️  SOLO DA COTTO, e usati nelle ricette: ${soloCotto.length}. È il pericolo vero.`);
  console.log('   Su una grammatura a crudo quel numero sbaglia di volte (riso e legumi: anche tre),');
  console.log('   e sembra buono. Ordinati per quante ricette attive li usano.');
  for (const x of soloCotto.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}  (in tabella: ${x.stati})`);
  if (soloCotto.length > QUANTI) console.log(`     … e altri ${soloCotto.length - QUANTI} (QUANTI=n per vederne di più)`);
  console.log('');

  console.log(`2) SENZA STATO, e usati nelle ricette: ${senzaStato.length}.`);
  console.log('   Si contano, ma nessuno sa se quel valore è a crudo: «senza stato» non è «cotto»,');
  console.log('   è «non lo so», e il conto lo dichiara invece di tacerlo.');
  for (const x of senzaStato.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (senzaStato.length > QUANTI) console.log(`     … e altri ${senzaStato.length - QUANTI}`);
  console.log('');

  console.log(`3) FUORI TABELLA — usati nelle ricette e sconosciuti a Gaia: ${fuoriTabella.length}.`);
  console.log('   Su questi non dice niente, che è meglio di un numero sbagliato ma resta un buco.');
  for (const x of fuoriTabella.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (fuoriTabella.length > QUANTI) console.log(`     … e altri ${fuoriTabella.length - QUANTI}`);
  console.log('');

  console.log(`4) GIÀ A POSTO — alimenti con la riga a crudo (o a secco): ${aPosto}.`);
  console.log('   Su questi il conto della ricetta usa il numero giusto.');
  console.log('');

  console.log('──────────────────────────────────────────────────────────────────');
  console.log('  ⚠️  I valori a crudo NON si calcolano dal cotto con un fattore: il rapporto cambia da');
  console.log('     alimento ad alimento (il riso assorbe acqua, la carne la perde). Le righe a crudo');
  console.log('     si aggiungono dalla pagina Alimenti, con la fonte.');
  console.log('  ⚠️  E finché una riga a crudo non c\'è, la ricetta dettata a Vera NON si scrive: meglio');
  console.log('     fermarsi che scrivere un totale tre volte più basso del vero in `Recipe.kcal`.');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
