/**
 * DIAGNOSTICA: **quanto è buono il riconoscitore di allergeni?** — sola lettura.
 *
 * Nasce dalla decisione di Simone del 19/8 sulla conferma in blocco. Da quel giorno migliaia di
 * ricette entrano in catalogo con gli allergeni **dedotti dagli ingredienti** (`suggestAllergens`,
 * per parole chiave) e un nutrizionista che dice «di queste mi fido», non che le guarda una per una.
 *
 * ⚠️ È una scelta ragionevole — l'alternativa era una coda ferma per sempre — **ma sposta il
 * cancello**: prima davanti al piatto di una cliente allergica c'era una persona, adesso c'è un
 * elenco di parole chiave. E quanto sia buono quell'elenco non l'aveva mai misurato nessuno.
 *
 * ## Come si misura, e su cosa
 *
 * Il metro di paragone sono le ricette che **una persona ha confermato a mano**, riconosciute dal
 * registro (`catalog.recipe.allergens.set`, che è la conferma singola dal riquadro «Rivedi»).
 * ⚠️ Le conferme in blocco (`catalog.recipe.allergens.bulk`) **non fanno testo**: lì gli allergeni
 * li ha scritti il riconoscitore, quindi confrontarcisi vorrebbe dire misurarlo con se stesso e
 * ottenere sempre 100%.
 *
 * Due errori, e sono molto diversi:
 *
 *   · ⚠️ **MANCATO** — la persona ha segnato un allergene che il riconoscitore non vede. È il caso
 *     che fa male: la ricetta entra in catalogo dichiarata sicura per chi a quell'allergene è
 *     allergica.
 *   · **INVENTATO** — il riconoscitore ne vede uno che la persona ha tolto. Costa un menu più
 *     povero, non la salute di nessuno.
 *
 * ## ⚠️ Il limite di questa misura, che va letto insieme al numero
 *
 * Le ricette confermate a mano sono quelle **vecchie**, scritte dallo staff; quelle che il blocco
 * conferma sono **generate dall'AI**, con nomi di ingredienti più fantasiosi. Un buon voto qui non
 * garantisce lo stesso voto là. Serve a dire «il riconoscitore è affidabile / non lo è» su un
 * terreno noto, non a chiudere la domanda.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:allergeni              → tutte le ricette confermate a mano
 *   ESEMPI=20 npm run diag:allergeni    → più esempi stampati (default 10)
 *
 * ⚠️ Non scrive niente: legge e basta.
 */
import { PrismaClient } from '@prisma/client';
import { allergenLabel, suggestAllergens } from '../src/catalog/allergens';

const prisma = new PrismaClient();

const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 10) || 10);

const insieme = (v: unknown): Set<string> =>
  new Set(Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []);

async function main() {
  console.log('');
  console.log('==================================================================');
  console.log('  ALLERGENI — quanto è buono il riconoscitore automatico');
  console.log('  Sola lettura. Metro: le ricette confermate A MANO da una persona.');
  console.log('==================================================================');
  console.log('');

  /**
   * ⚠️ Le ricette toccate dalla conferma SINGOLA: è quella che passa dal riquadro «Rivedi», dove una
   * persona ha guardato le caselle. Il blocco scrive un'altra azione apposta per poterlo distinguere
   * — senza, dopo la prima conferma in blocco questa diagnostica avrebbe misurato il riconoscitore
   * con se stesso.
   */
  const righe = (await prisma.auditLog.findMany({
    where: { action: 'catalog.recipe.allergens.set' } as never,
    select: { entityId: true },
  })) as { entityId: string | null }[];
  const idsAMano = [...new Set(righe.map((r) => r.entityId).filter((x): x is string => !!x))];

  if (!idsAMano.length) {
    console.log('⚠️  Nessuna ricetta risulta confermata a mano dal riquadro «Rivedi».');
    console.log('   Senza un metro di paragone questa diagnostica non può dire niente — e «non lo so»');
    console.log('   non è «va tutto bene». Fai confermare a mano una cinquantina di ricette e rilancia.');
    console.log('');
    return;
  }

  const ricette = (await prisma.recipe.findMany({
    where: { id: { in: idsAMano } } as never,
    select: { id: true, name: true, ingredients: true, allergens: true } as never,
  })) as { id: string; name: string; ingredients: unknown; allergens: unknown }[];

  let identiche = 0;
  const mancatiPerAllergene = new Map<string, number>();
  const inventatiPerAllergene = new Map<string, number>();
  const casiMancati: { nome: string; mancati: string[] }[] = [];
  const casiInventati: { nome: string; inventati: string[] }[] = [];

  for (const r of ricette) {
    const persona = insieme(r.allergens);
    const macchina = new Set(suggestAllergens(r.ingredients).map((s) => s.allergen));
    const mancati = [...persona].filter((a) => !macchina.has(a));
    const inventati = [...macchina].filter((a) => !persona.has(a));
    if (!mancati.length && !inventati.length) identiche += 1;
    for (const a of mancati) mancatiPerAllergene.set(a, (mancatiPerAllergene.get(a) ?? 0) + 1);
    for (const a of inventati) inventatiPerAllergene.set(a, (inventatiPerAllergene.get(a) ?? 0) + 1);
    if (mancati.length) casiMancati.push({ nome: r.name, mancati });
    if (inventati.length) casiInventati.push({ nome: r.name, inventati });
  }

  const tot = ricette.length;
  const pc = (n: number) => (tot ? `${Math.round((n / tot) * 1000) / 10}%` : '—');

  console.log(`1) IL CAMPIONE: ${tot} ricette confermate a mano.`);
  if (tot < 30) {
    console.log('   ⚠️  Sono poche: su un campione così un numero si muove di dieci punti per due');
    console.log('      ricette. Leggilo come un indizio, non come una misura.');
  }
  console.log('');

  console.log(`2) D'ACCORDO IN TUTTO: ${identiche} su ${tot} (${pc(identiche)}).`);
  console.log('');

  console.log(`3) ⚠️  MANCATI — la persona ha segnato un allergene che la macchina non vede.`);
  console.log(`   Ricette con almeno un mancato: ${casiMancati.length} (${pc(casiMancati.length)}).`);
  console.log('   ⚠️  È il numero che conta: sono ricette che entrerebbero in catalogo dichiarate');
  console.log('      sicure per chi a quell\'allergene è allergica.');
  if (mancatiPerAllergene.size) {
    console.log('   Per allergene:');
    for (const [a, n] of [...mancatiPerAllergene.entries()].sort((x, y) => y[1] - x[1])) {
      console.log(`     · ${allergenLabel(a).padEnd(22)} ${n}`);
    }
  }
  for (const c of casiMancati.slice(0, ESEMPI)) {
    console.log(`     ▸ ${c.nome} — non visti: ${c.mancati.map(allergenLabel).join(', ')}`);
  }
  if (casiMancati.length > ESEMPI) console.log(`     … e altre ${casiMancati.length - ESEMPI} (ESEMPI=n per vederne di più)`);
  console.log('');

  console.log(`4) INVENTATI — la macchina ne vede uno che la persona ha tolto.`);
  console.log(`   Ricette con almeno un inventato: ${casiInventati.length} (${pc(casiInventati.length)}).`);
  console.log('   Costa un menu più povero, non la salute di nessuno: si guarda dopo i mancati.');
  if (inventatiPerAllergene.size) {
    for (const [a, n] of [...inventatiPerAllergene.entries()].sort((x, y) => y[1] - x[1])) {
      console.log(`     · ${allergenLabel(a).padEnd(22)} ${n}`);
    }
  }
  for (const c of casiInventati.slice(0, ESEMPI)) {
    console.log(`     ▸ ${c.nome} — visti a torto: ${c.inventati.map(allergenLabel).join(', ')}`);
  }
  console.log('');

  console.log('──────────────────────────────────────────────────────────────────');
  console.log('  ⚠️  DA LEGGERE INSIEME AL NUMERO: le ricette confermate a mano sono quelle');
  console.log('     vecchie, scritte dallo staff; quelle che il blocco conferma sono generate');
  console.log('     dall\'AI, con nomi di ingredienti più fantasiosi. Un buon voto qui non');
  console.log('     garantisce lo stesso voto là.');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
