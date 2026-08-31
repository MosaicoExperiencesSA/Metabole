/**
 * DIAGNOSTICA: **quante ricette si fermerebbero, e quante sono già in regola** — sola lettura.
 *
 * Sono i due numeri promessi al capo nutrizionista nel §5 del foglio del 31/8, *prima* di scrivere
 * una riga di codice: se le ricette che si fermano fossero troppe, la proposta si rivede insieme.
 *
 * ⛔ **NON SCRIVE NIENTE.** Non tocca `allergens`, non tocca `allergensReviewed`, non tocca le
 * ricette. Legge, conta e stampa.
 *
 * ## Cosa chiede, a una ricetta alla volta
 *
 * 1. **So che cos'è ogni suo ingrediente?** — cioè ogni nome porta a una riga della tabella
 *    alimenti (col suo nome, con un sinonimo, o per somiglianza). Se anche uno solo non ci porta,
 *    la ricetta **si ferma**: non entra in nessun menu e finisce nella coda che guarda una persona.
 * 2. Se sì, **quali allergeni risultano** dagli ingredienti — e soprattutto **come cambia** rispetto
 *    a quello che la ricetta dichiara oggi.
 *
 * ⚠️ Il numero che conta più di tutti non è quante si fermano: è **quante ricette oggi dichiarano
 * MENO allergeni di quelli che risultano dai loro ingredienti**. Quelle sono già in catalogo, e a
 * una cliente allergica risultano sicure adesso.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:allergeni-deducibili                → tutte le ricette attive
 *   TUTTE=1 npm run diag:allergeni-deducibili        → anche quelle spente
 *   ESEMPI=30 npm run diag:allergeni-deducibili      → più esempi per ogni elenco (default 15)
 */
import { PrismaClient } from '@prisma/client';
import {
  Dizionario, deduci, differenza, indicizza,
} from '../src/catalog/allergeni-deterministici';
import { allergenLabel } from '../src/catalog/allergens';

const prisma = new PrismaClient();

const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 15) || 15);
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
  riga('  ALLERGENI DEDOTTI — quante ricette si fermano, quante passano');
  riga(`  Sola lettura. Ricette: ${TUTTE ? 'TUTTE (anche spente)' : 'solo ATTIVE'}.`);
  riga('==================================================================');

  const righe = (await prisma.nutrientFact.findMany({
    select: { name: true, synonyms: true, state: true },
  })) as { name: string; synonyms: string[]; state: string | null }[];

  const ricette = (await prisma.recipe.findMany({
    where: TUTTE ? {} : { active: true },
    select: { id: true, name: true, regime: true, mealSlot: true, ingredients: true, allergens: true, allergensReviewed: true },
  })) as {
    id: string; name: string; regime: string; mealSlot: string;
    ingredients: unknown; allergens: string[]; allergensReviewed: boolean;
  }[];

  riga('');
  riga(`Tabella alimenti: ${righe.length} righe.`);
  riga(`Ricette in esame: ${ricette.length}.`);

  const dz: Dizionario = indicizza(righe);

  let passano = 0;
  let fermate = 0;
  let senzaIngredienti = 0;
  let conAbbinamento = 0;
  let conPreparazioni = 0;
  let identiche = 0;
  let soloGuadagni = 0;
  let soloPerdite = 0;
  let entrambi = 0;
  const bloccanti = new Map<string, number>();
  /**
   * ⚠️ Gli ignoti di ogni ricetta ferma si tengono da parte: la curva qui sotto li rilegge cinque
   * volte, e rifare `deduci` su quindicimila ricette per ogni soglia vuol dire far girare
   * l'abbinamento cinque volte per niente — su una shell di Render, con qualcuno che aspetta.
   */
  const ignotiPerRicetta: string[][] = [];
  const guadagnatiPerCodice = new Map<string, number>();
  const persiPerCodice = new Map<string, number>();
  const esempiGuadagno: string[] = [];
  const esempiFermate: string[] = [];
  const esempiPreparazioni: string[] = [];
  /**
   * Col contrassegno acceso. ⚠️ **Non** «guardate da una persona una per una»: `allergensReviewed`
   * comprende le conferme in blocco del 19/8, dove gli allergeni li aveva scritti il riconoscitore.
   * Chiamarlo «confermate a mano» — come faceva la prima stesura — fa concludere a chi legge che
   * qualcuno le abbia viste, e su un numero che riguarda gli allergeni è la bugia peggiore possibile.
   */
  let confermate = 0;
  let confermateChePassano = 0;
  let confermateCheNonTornano = 0;

  for (const r of ricette) {
    const e = deduci(r.ingredients, dz);
    if (r.allergensReviewed) confermate += 1;

    if (e.allergeni === null) {
      fermate += 1;
      if (e.motivoArresto === 'senza_ingredienti') senzaIngredienti += 1;
      for (const n of e.ignoti) bloccanti.set(n, (bloccanti.get(n) ?? 0) + 1);
      if (e.ignoti.length) ignotiPerRicetta.push(e.ignoti);
      if (esempiFermate.length < ESEMPI) {
        esempiFermate.push(`  · «${r.name}» (${r.regime}/${r.mealSlot}) — ferma su: ${e.ignoti.slice(0, 4).join(', ') || 'nessun ingrediente leggibile'}`);
      }
      continue;
    }

    passano += 1;
    if (e.perAbbinamento.length) conAbbinamento += 1;
    if (e.preparazioni.length) {
      conPreparazioni += 1;
      if (esempiPreparazioni.length < ESEMPI) {
        esempiPreparazioni.push(`  · «${r.name}» — ${e.preparazioni.slice(0, 3).join(', ')}`);
      }
    }

    const d = differenza(r.allergens ?? [], e.allergeni);
    for (const c of d.guadagnati) guadagnatiPerCodice.set(c, (guadagnatiPerCodice.get(c) ?? 0) + 1);
    for (const c of d.persi) persiPerCodice.set(c, (persiPerCodice.get(c) ?? 0) + 1);
    if (!d.guadagnati.length && !d.persi.length) identiche += 1;
    else if (d.guadagnati.length && d.persi.length) entrambi += 1;
    else if (d.guadagnati.length) soloGuadagni += 1;
    else soloPerdite += 1;

    if (r.allergensReviewed) {
      confermateChePassano += 1;
      if (d.guadagnati.length || d.persi.length) confermateCheNonTornano += 1;
    }

    if (d.guadagnati.length && esempiGuadagno.length < ESEMPI) {
      esempiGuadagno.push(
        `  · «${r.name}» — oggi dichiara [${(r.allergens ?? []).map(allergenLabel).join(', ') || 'niente'}], `
        + `dagli ingredienti risulta ANCHE: ${d.guadagnati.map(allergenLabel).join(', ')}`
        + (r.allergensReviewed ? '  ⚠️ ed è già confermata a mano' : ''),
      );
    }
  }

  const tot = ricette.length;

  /**
   * ⚠️ Il secondo conto serve a separare due cose che il primo numero mescola: «la ricetta è
   * scritta in un modo che nessuno può classificare» e «la tabella alimenti è indietro». Sono due
   * lavori diversi, e uno dei due non richiede di rivedere niente della proposta.
   */
  let passanoLargo = 0;
  for (const r of ricette) if (deduci(r.ingredients, dz, 'largo').allergeni !== null) passanoLargo += 1;

  titolo('I DUE NUMERI');
  riga('');
  riga(`  SI FERMANO           ${fermate}  (${pct(fermate, tot)})  → coda da guardare a mano`);
  riga(`  PASSANO              ${passano}  (${pct(passano, tot)})  → allergeni scritti dagli ingredienti`);
  riga('');
  riga(`  Di quelle che si fermano, ${senzaIngredienti} non hanno nessun ingrediente leggibile.`);
  riga(`  Di quelle che passano, ${conAbbinamento} (${pct(conAbbinamento, passano)}) hanno almeno un ingrediente`);
  riga('  riconosciuto per SOMIGLIANZA e non col suo nome: l\'abbinamento è un\'euristica.');
  riga('');
  riga('  ── e quanto di quella coda è colpa della TABELLA e non delle ricette ──');
  riga('');
  riga(`  Passerebbero col criterio largo: ${passanoLargo} (${pct(passanoLargo, tot)}).`);
  riga(`  Cioè ${passanoLargo - passano} ricette si fermano solo perché l'alimento non ha la sua riga,`);
  riga('  pur essendo fatto di parole che il sistema conosce da altri elenchi.');
  riga('');
  riga('  ⛔ Il criterio largo NON è una proposta: non si servono piatti su «conosco le parole».');
  riga('  «insalata di riso» ha due parole note e uscirebbe senza allergeni. Serve a dire quanta');
  riga('  parte della coda si chiude riempiendo la tabella invece che riscrivendo le ricette.');
  riga('  ⚠️ Ed è a sua volta un MINIMO: una parola che non compare in NESSUN elenco — un aggettivo');
  riga('  raro, un nome commerciale — ferma anche il largo. Il numero vero sta fra i due.');

  titolo('LA CODA È FATTA DI POCHI NOMI? (quanto lavoro serve davvero)');
  const ordinati = [...bloccanti.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  riga('');
  riga(`  Nomi di ingrediente diversi che fermano almeno una ricetta: ${ordinati.length}.`);
  riga('');
  riga('  I più pesanti (quante ricette ciascuno ferma):');
  for (const [nome, n] of ordinati.slice(0, ESEMPI)) riga(`  · ${String(n).padStart(5)}  ${nome}`);
  riga('');
  riga('  ⚠️ La somma NON è il numero delle ricette ferme: una ricetta può fermarsi su più nomi.');
  riga('  ⚠️ E non è un guadagno garantito: `abbina` torna «non lo so» quando DUE righe vanno bene');
  riga('  uguale, quindi aggiungere una riga può far perdere un riconoscimento che c\'era. La curva');
  riga('  dice quanto lavoro serve, non promette che ogni riga aggiunta sblocchi e basta.');
  riga('  Le ricette che si sbloccherebbero sistemando i primi N nomi (una riga o un sinonimo ciascuno):');
  for (const n of [10, 25, 50, 100, 250]) {
    if (n > ordinati.length) break;
    const primi = new Set(ordinati.slice(0, n).map(([x]) => x));
    const sbloccate = ignotiPerRicetta.filter((ig) => ig.every((x) => primi.has(x))).length;
    riga(`  · primi ${String(n).padStart(3)} nomi → ${sbloccate} ricette (${pct(sbloccate, fermate)} della coda)`);
  }

  titolo('COSA CAMBIA SU QUELLE CHE PASSANO');
  riga('');
  riga(`  Identiche a oggi                       ${identiche}  (${pct(identiche, passano)})`);
  riga(`  ⚠️ Guadagnano un allergene              ${soloGuadagni}`);
  riga(`  Ne perdono uno                         ${soloPerdite}`);
  riga(`  Guadagnano e perdono                   ${entrambi}`);
  riga('');
  riga('  ⛔ «Guadagnano» = allergeni che il piatto OGGI NON DICHIARA e che dagli ingredienti');
  riga('  risultano. Sono già in catalogo, e a una cliente allergica risultano sicuri adesso.');
  riga('');
  riga('  Per allergene, quante ricette lo guadagnerebbero:');
  for (const [c, n] of [...guadagnatiPerCodice.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`  · ${String(n).padStart(5)}  ${allergenLabel(c)}`);
  }
  riga('');
  riga('  Per allergene, quante lo perderebbero (menu più poveri, non un rischio):');
  for (const [c, n] of [...persiPerCodice.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`  · ${String(n).padStart(5)}  ${allergenLabel(c)}`);
  }
  riga('');
  riga(`  Ricette col contrassegno di verifica acceso: ${confermate}.`);
  riga('  ⛔ Qui c\'era scritto «confermate A MANO», ed era una bugia comoda: `allergensReviewed`');
  riga('  comprende le conferme IN BLOCCO del 19/8, dove gli allergeni li aveva scritti il');
  riga('  riconoscitore. Chi leggeva concludeva che qualcuno le avesse guardate. Corretta il 31/8.');
  riga(`  · di queste, ${confermateChePassano} passano la deduzione e si possono confrontare;`);
  riga(`  · ${confermate - confermateChePassano} SI FERMANO, quindi con la deduzione non si confrontano affatto;`);
  riga(`  · fra quelle confrontate, ${confermateCheNonTornano} non tornano.`);
  riga('  ⚠️ I tre numeri hanno denominatori diversi ed è tutto il punto: la prima stesura stampava');
  riga('  «di queste, N non tornano» contando N solo sulle confrontate — e chi leggeva concludeva che');
  riga('  quasi tutte tornassero, mentre la maggioranza non era stata nemmeno guardata.');
  riga('  ⚠️ Chi non torna non vuol dire che sbagli la persona: è o un buco degli elenchi o un');
  riga('  allergene messo a mano che dagli ingredienti non risulta. Si guardano una per una.');

  titolo('IL LIMITE, MISURATO (§4.2 del foglio: gli ingredienti composti)');
  riga('');
  riga(`  Ricette che passano avendo dentro un ingrediente dal nome di PREPARAZIONE: ${conPreparazioni} (${pct(conPreparazioni, passano)}).`);
  riga('  ⚠️ Sono riconosciute, quindi la deduzione dice la sua — ma il nome non dice cosa contengono.');
  riga('  È il caso su cui il foglio dice che il sistema «si ferma invece di tirare a indovinare»:');
  riga('  ⛔ oggi NON si ferma, perché la riga in tabella c\'è. Si chiude dichiarando gli allergeni');
  riga('  sull\'ALIMENTO, non allungando un elenco di parole.');
  if (esempiPreparazioni.length) { riga(''); esempiPreparazioni.forEach(riga); }

  titolo(`ESEMPI — ricette che si fermano (${Math.min(ESEMPI, esempiFermate.length)})`);
  riga('');
  esempiFermate.forEach(riga);

  titolo(`ESEMPI — ricette che oggi dichiarano MENO di quello che hanno (${Math.min(ESEMPI, esempiGuadagno.length)})`);
  riga('');
  esempiGuadagno.forEach(riga);

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
