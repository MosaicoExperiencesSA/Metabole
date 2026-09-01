/**
 * LE RICETTE SPENTE CHE IL MOTORE SERVE LO STESSO — sola lettura.
 *
 * È il §2.4 del piano, quello rimasto aperto: il pool che `buildScoringContext` legge chiede le
 * ricette **per id e basta** — `where: { id: { in: [...poolIds] } }`, senza `active: true`. Una
 * ricetta archiviata, o una bozza che l'agente notturno ha scritto e che nessuno ha ancora
 * guardato, se sta nel paniere finisce nel piatto di una cliente.
 *
 * ⛔ **QUESTO SCRIPT NON CORREGGE NIENTE, E NON DEVE.** Filtrare `active: true` nel pool è una riga
 * sola, ma quella riga **restringe il pool di tutte le clienti insieme**: la cella che oggi ha 40
 * piatti e ne ha 12 attivi domani ne ha 12, e da quel momento il motore ripete. È la lezione della
 * Fase 1 — l'interruttore si sposta **dopo** aver contato, non prima. Qui si conta.
 *
 * ## Le tre domande, in quest'ordine
 *
 * 1. **Quanto è grande il buco oggi**: quante appartenenze puntano a una ricetta spenta.
 * 2. **Quanto costerebbe chiuderlo**: cella per cella, quanto resta filtrando — e **quali celle
 *    scendono sotto la soglia**, cioè quali clienti comincerebbero a rivedere gli stessi piatti.
 * 3. **Sta già succedendo?**: quanti pasti già composti puntano a una ricetta spenta, e a quante
 *    clienti sono già arrivati. È il numero che dice se la cosa è teorica o no.
 *
 * ⚠️ **La soglia è per CELLA, e la cella è più grande di quello che una cliente vede davvero.**
 * Sopra il paniere passano ancora le sue esclusioni, i suoi allergeni, le stagioni e la banda kcal:
 * il pool vero di una singola cliente è **più piccolo** di questi numeri, sempre. Una cella sopra
 * soglia qui non è una promessa; una cella sotto soglia qui è una certezza al contrario.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:spente                → soglia 30, ultimi 30 giorni di menu
 *   SOGLIA=20 npm run diag:spente      → soglia diversa
 *   GIORNI=90 npm run diag:spente      → guarda più indietro nei menu già composti
 *   ESEMPI=40 npm run diag:spente      → più righe di dettaglio (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE, IMPOSSIBILI, REGIMI } from '../src/catalog/appartenenza-panieri';
import { GIORNATA_CINQUE, slotDaCuiPescare } from '../src/common/slot-pasto';

const prisma = new PrismaClient();
/**
 * ⚠️ 30 non è un numero magico: è la finestra della coppia pranzo/cena
 * (`menu_coppia_pranzo_cena_giorni`). Sotto quella cifra il motore, in un mese, **deve** ripetere.
 */
const SOGLIA = Math.max(1, Number(process.env.SOGLIA ?? 30) || 30);
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 30) || 30);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};
const num = (n: number, w = 6) => String(n).padStart(w);

async function main() {
  riga('');
  riga('==================================================================');
  riga('  RICETTE SPENTE NEL POOL — sola lettura (§2.4)');
  riga('==================================================================');
  riga('');
  riga(`  Soglia per cella: ${SOGLIA} piatti.  Menu guardati: ultimi ${GIORNI} giorni.`);

  const da = new Date();
  da.setDate(da.getDate() - GIORNI);

  const [ricette, panieri, righe, giorni] = await Promise.all([
    prisma.recipe.findMany({ select: { id: true, name: true, active: true, regime: true, mealSlot: true } }) as unknown as
      Promise<{ id: string; name: string; active: boolean; regime: string; mealSlot: string }[]>,
    prisma.paniere.findMany({ select: { id: true, famiglia: true, regime: true } }) as unknown as
      Promise<{ id: string; famiglia: string; regime: string }[]>,
    prisma.paniereRicetta.findMany({ select: { paniereId: true, recipeId: true, slot: true } }) as unknown as
      Promise<{ paniereId: string; recipeId: string; slot: string }[]>,
    /**
     * ⚠️ Le giornate **già composte**, non le giornate future: qui si vuole sapere cosa è già
     * uscito, non cosa uscirebbe. `apertoDallaClienteIl` separa «composto» da «già letto», ed è la
     * differenza fra un errore rimediabile e uno che la cliente ha visto.
     */
    prisma.menuDay.findMany({
      where: { date: { gte: da } },
      select: { clientId: true, date: true, meals: true, apertoDallaClienteIl: true },
    }) as unknown as Promise<{ clientId: string; date: Date; meals: unknown; apertoDallaClienteIl: Date | null }[]>,
  ]);

  const spenta = new Map(ricette.map((r) => [r.id, !r.active]));
  const nomeDi = new Map(ricette.map((r) => [r.id, r.name]));
  const spente = ricette.filter((r) => !r.active);

  titolo('1. IL CATALOGO');
  riga('');
  riga(`  Ricette in tutto      ${num(ricette.length)}`);
  riga(`  …spente              ${num(spente.length)}   (archiviate o bozze mai validate)`);
  riga(`  …attive              ${num(ricette.length - spente.length)}`);
  riga('');
  riga('  Le spente per regime:');
  for (const rg of REGIMI) {
    const n = spente.filter((r) => r.regime === rg).length;
    if (n) riga(`    · ${rg.padEnd(14)} ${num(n)}`);
  }

  titolo('2. QUANTE SONO ENTRATE NEI PANIERI');
  riga('');
  const spenteInPaniere = new Set(righe.filter((r) => spenta.get(r.recipeId)).map((r) => r.recipeId));
  const appartenenzeSpente = righe.filter((r) => spenta.get(r.recipeId)).length;
  riga(`  Appartenenze in tabella          ${num(righe.length)}`);
  riga(`  …che puntano a una ricetta spenta ${num(appartenenzeSpente)}`);
  riga(`  Ricette spente distinte nei panieri ${num(spenteInPaniere.size)}  su ${spente.length} spente in catalogo`);
  if (!appartenenzeSpente) {
    riga('');
    riga('  ✅ Nessuna ricetta spenta sta in un paniere: il filtro `active` nel pool oggi non');
    riga('  toglierebbe niente a nessuno. Resta comunque da mettere, perché domani ne entra una.');
  }

  titolo('3. CELLA PER CELLA: COSA RESTA SE FILTRIAMO');
  riga('');
  const idDi = new Map(panieri.map((p) => [`${p.famiglia}|${p.regime}`, p.id]));
  const perPaniere = new Map<string, Map<string, Set<string>>>();
  for (const r of righe) {
    const slots = perPaniere.get(r.paniereId) ?? new Map<string, Set<string>>();
    const set = slots.get(r.slot) ?? new Set<string>();
    set.add(r.recipeId);
    slots.set(r.slot, set);
    perPaniere.set(r.paniereId, slots);
  }

  const sotto: { chiave: string; slot: string; prima: number; dopo: number }[] = [];
  const giaSotto: string[] = [];
  let celleGuardate = 0;
  let celleChePeggiorano = 0;

  for (const famiglia of FAMIGLIE) {
    for (const regime of REGIMI) {
      const chiave = `${famiglia}|${regime}`;
      if (IMPOSSIBILI.includes(chiave)) continue;
      const id = idDi.get(chiave);
      if (!id) continue;
      celleGuardate += 1;
      const slots = perPaniere.get(id) ?? new Map<string, Set<string>>();
      let peggiora = false;
      for (const sl of GIORNATA_CINQUE) {
        /** ⚠️ Gemelli uniti (Fase 2): spuntino e merenda sono un paniere solo, e la cliente li vede così. */
        const uniti = new Set<string>();
        for (const g of slotDaCuiPescare(sl)) for (const rid of slots.get(g) ?? []) uniti.add(rid);
        const prima = uniti.size;
        const dopo = [...uniti].filter((rid) => !spenta.get(rid)).length;
        if (prima === dopo) continue;
        peggiora = true;
        /**
         * ⛔ **Due liste, non una.** Una cella che era già sotto soglia PRIMA del filtro è un
         * problema che il filtro non crea: dirla insieme alle altre farebbe sembrare che togliere
         * le spente rompa qualcosa che era già rotto, e allora nessuno filtrerebbe più niente.
         */
        if (prima < SOGLIA) giaSotto.push(`  · ${chiave} · ${sl} — ${prima} → ${dopo} (era già sotto)`);
        else if (dopo < SOGLIA) sotto.push({ chiave, slot: sl, prima, dopo });
      }
      if (peggiora) celleChePeggiorano += 1;
    }
  }

  riga(`  Celle esistenti guardate                 ${num(celleGuardate)}`);
  riga(`  …in cui il filtro toglierebbe qualcosa    ${num(celleChePeggiorano)}`);
  riga('');
  if (!sotto.length) {
    riga(`  ✅ NESSUNA cella scenderebbe sotto ${SOGLIA} piatti per colpa del filtro.`);
  } else {
    riga(`  ⛔ ${sotto.length} caselle (cella × pasto) scenderebbero sotto ${SOGLIA} filtrando le spente.`);
    riga('  ⚠️ Su queste il motore comincerebbe a ripetere entro il mese. Prima di filtrare,');
    riga('  queste caselle vanno riempite — o si valida quello che c\'è dentro spento.');
    riga('');
    sotto.sort((a, b) => a.dopo - b.dopo).slice(0, ESEMPI).forEach((c) => {
      riga(`  · ${c.chiave} · ${c.slot.padEnd(15)} ${num(c.prima, 5)} → ${num(c.dopo, 5)}`);
    });
    if (sotto.length > ESEMPI) riga(`  … e altre ${sotto.length - ESEMPI}. ESEMPI=${sotto.length} per vederle tutte.`);
  }
  if (giaSotto.length) {
    riga('');
    riga(`  ⚠️ Altre ${giaSotto.length} caselle erano già sotto ${SOGLIA} prima del filtro: il filtro non`);
    riga('  le peggiora oltre, ma sono povere comunque e vanno riempite lo stesso.');
    giaSotto.slice(0, ESEMPI).forEach(riga);
  }

  titolo('4. STA GIÀ SUCCEDENDO?');
  riga('');
  let pastiSpenti = 0;
  const clientiToccati = new Set<string>();
  const clientiCheHannoVisto = new Set<string>();
  const esempi: string[] = [];
  for (const g of giorni) {
    const pasti = Array.isArray(g.meals) ? (g.meals as { slot?: string; recipeId?: string }[]) : [];
    for (const m of pasti) {
      if (!m?.recipeId || !spenta.get(m.recipeId)) continue;
      pastiSpenti += 1;
      clientiToccati.add(g.clientId);
      if (g.apertoDallaClienteIl) clientiCheHannoVisto.add(g.clientId);
      if (esempi.length < ESEMPI) {
        const quando = g.date.toISOString().slice(0, 10);
        const letto = g.apertoDallaClienteIl ? 'GIÀ APERTO' : 'non ancora aperto';
        esempi.push(`  · ${quando} · ${String(m.slot ?? '?').padEnd(15)} ${nomeDi.get(m.recipeId) ?? m.recipeId}  [${letto}]`);
      }
    }
  }
  riga(`  Giornate guardate (ultimi ${GIORNI} gg)   ${num(giorni.length)}`);
  riga(`  Pasti che puntano a una ricetta spenta ${num(pastiSpenti)}`);
  riga(`  Clienti toccate                        ${num(clientiToccati.size)}`);
  riga(`  …di cui hanno già aperto quel giorno   ${num(clientiCheHannoVisto.size)}`);
  if (!pastiSpenti) {
    riga('');
    riga('  ✅ Nessun pasto già composto punta a una ricetta spenta in questa finestra.');
    riga('  ⚠️ Non vuol dire che il buco non c\'è: vuol dire che finora la sorte ha aiutato.');
  } else {
    riga('');
    esempi.forEach(riga);
    if (pastiSpenti > esempi.length) riga(`  … e altri ${pastiSpenti - esempi.length}.`);
  }

  titolo('IL VERDETTO');
  riga('');
  if (!sotto.length && appartenenzeSpente) {
    riga('  ✅ Il filtro `active: true` nel pool si può mettere: toglie piatti che non');
    riga('  dovevano esserci e non manda sotto soglia nessuna casella.');
  } else if (!appartenenzeSpente) {
    riga('  ✅ Non c\'è niente da togliere oggi. Il filtro va messo lo stesso, come guardia.');
  } else {
    riga(`  ⛔ NON filtrare ancora: ${sotto.length} caselle scenderebbero sotto ${SOGLIA}.`);
    riga('  Prima si riempiono quelle caselle (o si validano le bozze che ci stanno dentro),');
    riga('  poi si rilancia questo tabulato, e solo quando dice ✅ si tocca il pool.');
  }
  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
