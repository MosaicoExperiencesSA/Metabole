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
 * ## Cosa dice questa diagnostica
 *
 * Tre elenchi, ordinati per **quante ricette usano quell'alimento** — che è una priorità oggettiva e
 * non un giudizio clinico:
 *
 *   1. alimenti in tabella **senza stato**, usati nelle ricette: sono quelli su cui Gaia dice un
 *      numero senza dire da che parte;
 *   2. alimenti usati nelle ricette e **non in tabella**: su quelli Gaia non può dire niente;
 *   3. alimenti già presenti in **più stati**: qui il sistema fa la cosa giusta, e si contano per
 *      sapere quanti sono a posto.
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

  const senzaStato: { nome: string; quante: number }[] = [];
  const fuoriTabella: { nome: string; quante: number }[] = [];
  let conPiuStati = 0;
  const giaVisti = new Set<string>();

  for (const [k, quante] of usi) {
    const righe = perNome.get(k);
    if (!righe) { fuoriTabella.push({ nome: k, quante }); continue; }
    const stati = new Set(righe.map((r) => (r.state ?? '').trim().toLowerCase()).filter(Boolean));
    if (stati.size > 1) { conPiuStati += 1; continue; }
    if (stati.size === 0) {
      const nome = righe[0].name;
      if (giaVisti.has(nome)) continue;
      giaVisti.add(nome);
      senzaStato.push({ nome, quante });
    }
  }

  const perUso = (a: { quante: number }, b: { quante: number }) => b.quante - a.quante;
  senzaStato.sort(perUso);
  fuoriTabella.sort(perUso);

  console.log(`1) ⚠️  IN TABELLA MA SENZA STATO, e usati nelle ricette: ${senzaStato.length}.`);
  console.log('   Su questi Gaia dice un numero senza dire da che parte pesare. Ordinati per');
  console.log('   quante ricette li usano: i primi sono quelli che arrivano a più clienti.');
  for (const x of senzaStato.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (senzaStato.length > QUANTI) console.log(`     … e altri ${senzaStato.length - QUANTI} (QUANTI=n per vederne di più)`);
  console.log('');

  console.log(`2) FUORI TABELLA — usati nelle ricette e sconosciuti a Gaia: ${fuoriTabella.length}.`);
  console.log('   Su questi non dice niente, che è meglio di un numero sbagliato ma resta un buco.');
  for (const x of fuoriTabella.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (fuoriTabella.length > QUANTI) console.log(`     … e altri ${fuoriTabella.length - QUANTI}`);
  console.log('');

  console.log(`3) GIÀ A POSTO — alimenti presenti in più stati: ${conPiuStati}.`);
  console.log('   Qui il sistema fa la cosa giusta: se la domanda non dice crudo o cotto, non');
  console.log('   sceglie e lo dichiara.');
  console.log('');

  console.log('──────────────────────────────────────────────────────────────────');
  console.log('  ⚠️  Lo stato NON si indovina: «il grano saraceno delle ricette sarà cotto» è una');
  console.log('     supposizione, e metterla in banca dati vuol dire far dire a Gaia un numero');
  console.log('     deciso da chi non è nutrizionista. L\'elenco si riempie dalla pagina Alimenti.');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
