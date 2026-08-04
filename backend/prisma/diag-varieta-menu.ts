/**
 * Diagnostica (SOLA LETTURA): perché un menu risulta RIPETITIVO.
 *
 * Per una cliente (o per tutta la flotta) misura la varietà davvero erogata e la
 * confronta con le alternative disponibili nella dieta approvata:
 *
 *   1. Parametri di composizione attivi (penalità varietà, DayCombo, menu a necessità…).
 *   2. Piatti serviti negli ultimi N giorni, per slot: quanti distinti su quanti giorni,
 *      quante volte ciascuno, e la "serie" più lunga dello stesso piatto di fila.
 *   3. AMPIEZZA DEL POOL: quante ricette diverse la dieta approvata mette a disposizione
 *      per ogni slot (se il pool ha 3 colazioni, nessun algoritmo può fare di meglio).
 *   4. POOL EFFETTIVO: quante di quelle alternative sopravvivono ai non graditi e alle
 *      intolleranze della cliente. È il numero che decide davvero, e può essere molto
 *      più basso di quello nominale senza che nulla segnali un errore.
 *   5. Piatti erogati FUORI dal pool, con regime e difficoltà di ciascuno: identificano
 *      quale passaggio post-composizione li ha introdotti.
 *   6. Coerenza nome ↔ regime delle diete approvate, con quante clienti serve ognuna.
 *
 * In modalità flotta segnala anche le clienti il cui pool effettivo è sotto soglia: per
 * loro nessun parametro di varietà può bastare.
 *
 * Nessuna scrittura.
 *
 *   npm run diag:varieta                          # flotta: le clienti col menu più ripetitivo
 *   npm run diag:varieta -- --email=tizia@mail.it # dettaglio di una cliente
 *   npm run diag:varieta -- --email=... --days=45
 */
import { PrismaClient } from '@prisma/client';
// Le stesse regole di esclusione usate dal motore: i conteggi qui sotto devono essere una
// misura, non una stima.
import { exclusionKeys, hitsExclusion, recipeHaystack } from '../src/menu/exclusions';

const prisma = new PrismaClient();

const argOf = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const EMAIL = argOf('email');
const DAYS = Number(argOf('days') ?? 30) || 30;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

interface Meal {
  slot: string;
  recipeId: string;
  name?: string;
}
interface Day {
  date: Date;
  dietId: string | null;
  level: number | null;
  meals: Meal[];
}

async function loadDays(clientId: string): Promise<Day[]> {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const rows = (await prisma.menuDay.findMany({
    where: { clientId, date: { gte: since } },
    select: { date: true, dietId: true, level: true, meals: true },
    orderBy: { date: 'asc' },
  })) as { date: Date; dietId: string | null; level: number | null; meals: unknown }[];
  return rows.map((r) => ({
    date: r.date,
    dietId: r.dietId,
    level: r.level,
    meals: ((r.meals as Meal[]) ?? []).filter((m) => m && m.slot),
  }));
}

/** Statistiche di varietà per slot: distinti/giorni, conteggi, serie consecutiva più lunga. */
function slotStats(days: Day[]) {
  const bySlot = new Map<string, { seq: { id: string; label: string }[] }>();
  for (const d of days) {
    for (const m of d.meals) {
      if (!bySlot.has(m.slot)) bySlot.set(m.slot, { seq: [] });
      bySlot.get(m.slot)!.seq.push({ id: m.recipeId, label: m.name ?? m.recipeId });
    }
  }
  const out: {
    slot: string;
    total: number;
    distinct: number;
    maxStreak: number;
    counts: { label: string; n: number }[];
  }[] = [];
  for (const [slot, { seq }] of bySlot) {
    const counts = new Map<string, { label: string; n: number }>();
    let maxStreak = 1;
    let streak = 1;
    for (let i = 0; i < seq.length; i++) {
      const c = counts.get(seq[i].id) ?? { label: seq[i].label, n: 0 };
      c.n++;
      counts.set(seq[i].id, c);
      if (i > 0 && seq[i].id === seq[i - 1].id) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else streak = 1;
    }
    out.push({
      slot,
      total: seq.length,
      distinct: counts.size,
      maxStreak,
      counts: [...counts.values()].sort((a, b) => b.n - a.n),
    });
  }
  return out;
}

/**
 * Insieme delle ricette che la dieta+livello mette a disposizione (unione di tutti gli slot).
 * Serve a stabilire se un piatto ERGATO proviene davvero dal piano approvato o è stato
 * introdotto da uno dei passaggi successivi (ricette semplici, swap non graditi, gemelle).
 * In cache: la stessa coppia dieta/livello ricorre su molti giorni.
 */
const poolCache = new Map<string, Set<string>>();
async function poolIdsFor(dietId: string, level: number): Promise<Set<string>> {
  const key = `${dietId}|${level}`;
  const hit = poolCache.get(key);
  if (hit) return hit;
  const templates = (await prisma.dietDayTemplate.findMany({
    where: { dietId, level },
    select: { meals: true },
  })) as { meals: unknown }[];
  const ids = new Set<string>();
  for (const t of templates) {
    for (const m of ((t.meals as Meal[]) ?? [])) if (m?.recipeId) ids.add(m.recipeId);
  }
  poolCache.set(key, ids);
  return ids;
}

interface PoolRecipe {
  id: string;
  name: string;
  kcal: number;
  ingredients?: unknown;
}

/** Quante ricette diverse la dieta approvata offre per ogni slot (il "tetto" della varietà). */
async function poolSizes(dietId: string, level: number): Promise<Map<string, PoolRecipe[]>> {
  const templates = (await prisma.dietDayTemplate.findMany({
    where: { dietId, level },
    select: { meals: true },
    orderBy: { dayIndex: 'asc' },
  })) as { meals: unknown }[];
  const idsBySlot = new Map<string, Set<string>>();
  for (const t of templates) {
    for (const m of ((t.meals as Meal[]) ?? [])) {
      if (!m?.slot || !m.recipeId) continue;
      if (!idsBySlot.has(m.slot)) idsBySlot.set(m.slot, new Set());
      idsBySlot.get(m.slot)!.add(m.recipeId);
    }
  }
  const allIds = [...new Set([...idsBySlot.values()].flatMap((s) => [...s]))];
  const recipes = (await prisma.recipe.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true, kcal: true, ingredients: true },
  })) as PoolRecipe[];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const out = new Map<string, PoolRecipe[]>();
  for (const [slot, ids] of idsBySlot) {
    out.set(
      slot,
      [...ids].map((id) => byId.get(id) ?? { id, name: '(ricetta mancante)', kcal: 0 }).sort((a, b) => a.kcal - b.kcal),
    );
  }
  return out;
}

/**
 * Il POOL EFFETTIVO: quante alternative restano davvero dopo aver tolto i piatti che
 * contengono qualcosa che la cliente non gradisce o non tollera. È il numero che conta,
 * e non coincide quasi mai con l'ampiezza nominale del pool: una lista di non graditi
 * lunga può azzerare una dieta senza che nessuno se ne accorga, perché il motore non
 * fallisce — ripiega silenziosamente su altro.
 */
const MIN_ALTERNATIVES = 3;

function reportEffectivePool(pool: Map<string, PoolRecipe[]>, excluded: Set<string>): void {
  if (!excluded.size) {
    console.log('\n  POOL EFFETTIVO: nessuna esclusione sul profilo, coincide con il pool nominale.');
    return;
  }
  console.log('\n  POOL EFFETTIVO (dopo non graditi e intolleranze):');
  const critical: string[] = [];
  for (const [slot, list] of pool) {
    const blocked: { name: string; why: string }[] = [];
    for (const r of list) {
      const hit = hitsExclusion(recipeHaystack(r.name, r.ingredients), excluded);
      if (hit) blocked.push({ name: r.name, why: hit });
    }
    const left = list.length - blocked.length;
    const flag = left < MIN_ALTERNATIVES ? '  ⚠' : '';
    console.log(`      ${slot.padEnd(12)} ${String(left).padStart(3)} su ${list.length} utilizzabili${flag}`);
    for (const b of blocked) console.log(`          ✗ ${b.name}  → contiene "${b.why}"`);
    if (left < MIN_ALTERNATIVES) critical.push(`${slot} (${left})`);
  }
  if (critical.length) {
    console.log(`\n      ⚠  Sotto ${MIN_ALTERNATIVES} alternative: ${critical.join(', ')}.`);
    console.log('         Con così poche scelte la varietà non è ottenibile da nessun parametro:');
    console.log('         o si amplia il pool della dieta, o si assegna una dieta compatibile');
    console.log('         con le esclusioni, o si rivede la lista dei non graditi con la cliente.');
  }
}

async function showConfig() {
  const keys = [
    'menu_days_delivered',
    'menu_penalty_repeat',
    'menu_repeat_window_days',
    'menu_variety_min_gap_days',
    'menu_daycombo_enabled',
    'menu_kcal_need_enabled',
    'menu_kcal_balance_tolerance_pct',
  ];
  const rows = (await prisma.configParam.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  })) as { key: string; value: string }[];
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  console.log('PARAMETRI DI COMPOSIZIONE');
  for (const k of keys) console.log(`  ${k.padEnd(34)} = ${byKey.get(k) ?? '(assente → default di codice)'}`);
  const penalty = Number(byKey.get('menu_penalty_repeat') ?? 0);
  if (!penalty) {
    console.log('  ⚠  penalità di ripetizione SPENTA: un piatto già servito non viene sfavorito.');
  }
  console.log('');
}

/**
 * Profilo della cliente: i campi che DECIDONO cosa finisce nel piatto oltre ai template
 * (regime usato per scegliere la dieta e per pescare le alternative, preferenza "ricette
 * semplici", esclusioni). Senza questi, i piatti fuori pool restano inspiegabili.
 */
async function reportProfile(clientId: string) {
  const p = (await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: {
      regime: true, dietStyle: true, mealsPerDay: true, objective: true,
      prefersSimpleRecipes: true, allergies: true, intolerances: true, dislikedFoods: true,
      planStartDate: true, travelState: true,
    },
  })) as {
    regime: string | null; dietStyle: string | null; mealsPerDay: number | null; objective: string | null;
    prefersSimpleRecipes: boolean; allergies: string[]; intolerances: string[]; dislikedFoods: string[];
    planStartDate: Date | null; travelState: string | null;
  } | null;
  if (!p) { console.log('PROFILO: assente\n'); return null; }
  const list = (a: string[]) => (a?.length ? a.join(', ') : '—');
  console.log('PROFILO');
  console.log(`  regime = ${p.regime ?? '—'} | pasti/giorno = ${p.mealsPerDay ?? '—'} | stile = ${p.dietStyle ?? '—'} | obiettivo = ${p.objective ?? '—'}`);
  console.log(`  inizio piano = ${p.planStartDate ? ymd(p.planStartDate) : '—'}${p.travelState ? ` | viaggio: ${p.travelState}` : ''}`);
  console.log(`  preferenza "ricette semplici": ${p.prefersSimpleRecipes ? 'SÌ — il motore sostituisce i piatti del piano con ricette difficulty=semplice dello STESSO REGIME' : 'no'}`);
  console.log(`  allergie: ${list(p.allergies)} | intolleranze: ${list(p.intolerances)} | non graditi: ${list(p.dislikedFoods)}`);
  console.log('');
  return p;
}

/**
 * Il controllo decisivo: quali piatti erogati NON provengono dai template della dieta di
 * quel giorno. Per ciascuno stampa regime e difficoltà della ricetta, che identificano il
 * passaggio responsabile (semplici / swap non graditi / gemelle bigiornaliere).
 */
async function reportOutOfPool(days: Day[]) {
  const rows: { date: Date; slot: string; id: string; label: string }[] = [];
  let totalMeals = 0;
  for (const d of days) {
    if (!d.dietId) continue;
    const pool = await poolIdsFor(d.dietId, d.level ?? 1);
    if (pool.size === 0) continue; // nessun template: non si può giudicare
    for (const m of d.meals) {
      totalMeals++;
      if (!pool.has(m.recipeId)) rows.push({ date: d.date, slot: m.slot, id: m.recipeId, label: m.name ?? m.recipeId });
    }
  }
  if (!totalMeals) return;
  console.log(`\n  PIATTI FUORI DAL POOL DELLA DIETA: ${rows.length} su ${totalMeals} pasti erogati`);
  if (!rows.length) {
    console.log('      (nessuno: tutti i piatti vengono dai template del piano approvato)');
    return;
  }
  const ids = [...new Set(rows.map((r) => r.id))];
  const recipes = (await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, regime: true, difficulty: true, mealSlot: true, kcal: true, active: true },
  })) as { id: string; name: string; regime: string; difficulty: string; mealSlot: string; kcal: number; active: boolean }[];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const perSlot = new Map<string, number>();
  for (const r of rows) perSlot.set(r.slot, (perSlot.get(r.slot) ?? 0) + 1);
  console.log(`      per pasto: ${[...perSlot].map(([s, n]) => `${s} ${n}`).join(', ')}`);
  console.log('      ricette coinvolte:');
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const rec = byId.get(r.id);
    const n = rows.filter((x) => x.id === r.id).length;
    if (!rec) { console.log(`          · ${r.label} — RICETTA NON TROVATA (id ${r.id})`); continue; }
    const flags = [`regime=${rec.regime}`, `difficoltà=${rec.difficulty}`, rec.active ? 'attiva' : 'DISATTIVATA'];
    console.log(`          · ${String(n)}×  ${rec.name} (${rec.kcal} kcal) — ${flags.join(', ')}`);
  }
  const semplici = [...seen].filter((id) => byId.get(id)?.difficulty === 'semplice').length;
  console.log('');
  console.log(`      → ${semplici}/${seen.size} sono ricette "semplici": compatibili con la preferenza "ricette semplici",`);
  console.log('        che pesca dall\'intero catalogo del REGIME della cliente, non dal pool della dieta.');
}

async function reportClient(clientId: string, email: string) {
  const profile = await reportProfile(clientId);
  const days = await loadDays(clientId);
  console.log(`CLIENTE ${email} — ultimi ${DAYS} giorni: ${days.length} giornate di menu`);
  if (days.length === 0) {
    console.log('  (nessun menu nel periodo)\n');
    return;
  }
  console.log(`  periodo: ${ymd(days[0].date)} → ${ymd(days[days.length - 1].date)}`);

  const stats = slotStats(days);
  for (const s of stats) {
    console.log(`\n  [${s.slot}] piatti distinti: ${s.distinct}/${s.total} giorni — serie più lunga dello stesso piatto: ${s.maxStreak}`);
    for (const c of s.counts) console.log(`      ${String(c.n).padStart(3)}×  ${c.label}`);
  }

  const lastWithDiet = [...days].reverse().find((d) => d.dietId);
  if (lastWithDiet?.dietId) {
    const diet = (await prisma.diet.findUnique({
      where: { id: lastWithDiet.dietId },
      select: { name: true, regime: true, levels: true },
    })) as { name: string; regime: string; levels: unknown } | null;
    const level = lastWithDiet.level ?? 1;
    const pool = await poolSizes(lastWithDiet.dietId, level);
    console.log(`\n  POOL DELLA DIETA "${diet?.name ?? lastWithDiet.dietId}" (${diet?.regime ?? '?'}) livello ${level}:`);
    if (pool.size === 0) console.log('      (nessun template per questo livello)');
    for (const [slot, list] of pool) {
      const served = stats.find((s) => s.slot === slot)?.distinct ?? 0;
      console.log(`      ${slot.padEnd(12)} ${String(list.length).padStart(3)} alternative disponibili — servite ${served}`);
      for (const r of list) console.log(`          · ${r.name} (${r.kcal} kcal)`);
    }
    reportEffectivePool(
      pool,
      exclusionKeys([
        ...(profile?.dislikedFoods ?? []),
        ...(profile?.intolerances ?? []),
        ...(profile?.allergies ?? []),
      ]),
    );
  }
  await reportOutOfPool(days);
  console.log('');
}

/**
 * Coerenza nome ↔ regime delle diete approvate. `pickDiet` sceglie la dieta SOLO per
 * regime+pasti: una dieta chiamata "Pescetariana" ma registrata come `omnivore` viene
 * abbinata a clienti onnivore, e — cosa più delicata — le alternative pescate per regime
 * (ricette semplici, sostituzioni) possono includere carne in un piano che la cliente
 * vede come pescetariano. Sola lettura: qui si segnala soltanto.
 */
const NAME_HINTS: { re: RegExp; regime: string }[] = [
  { re: /pescetar/i, regime: 'pescetarian' },
  { re: /vegan/i, regime: 'vegan' },
  { re: /vegetarian/i, regime: 'vegetarian' },
];

async function reportDietRegimeCoherence() {
  const diets = (await prisma.diet.findMany({
    where: { status: 'approved' as never },
    select: { id: true, name: true, clientName: true, regime: true, mealsPerDay: true },
    orderBy: { name: 'asc' },
  })) as { id: string; name: string; clientName: string | null; regime: string; mealsPerDay: number }[];
  const bad: { id: string; name: string; regime: string; expected: string; mealsPerDay: number }[] = [];
  for (const d of diets) {
    const label = `${d.name} ${d.clientName ?? ''}`;
    // "vegetarian" matcha anche dentro "vegan"? no, ma l'ordine conta: vegan prima.
    const hint = NAME_HINTS.find((h) => h.re.test(label));
    if (hint && d.regime !== hint.regime) {
      bad.push({ id: d.id, name: d.name, regime: d.regime, expected: hint.regime, mealsPerDay: d.mealsPerDay });
    }
  }
  console.log(`COERENZA NOME ↔ REGIME (${diets.length} diete approvate)`);
  if (!bad.length) { console.log('  ok: nessun disallineamento.\n'); return; }

  // Quante clienti sta servendo ciascuna dieta incoerente: senza questo numero il referto
  // non dice al backoffice quanto è urgente, né su chi ricadrebbe la correzione.
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const links = (await prisma.menuDay.findMany({
    where: { date: { gte: since }, dietId: { in: bad.map((b) => b.id) } },
    select: { dietId: true, clientId: true },
    distinct: ['dietId', 'clientId'],
  })) as { dietId: string | null; clientId: string }[];
  const clientsByDiet = new Map<string, number>();
  for (const l of links) if (l.dietId) clientsByDiet.set(l.dietId, (clientsByDiet.get(l.dietId) ?? 0) + 1);

  bad.sort((a, b) => (clientsByDiet.get(b.id) ?? 0) - (clientsByDiet.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  console.log(`  ${bad.length} diete con nome e regime disallineati:\n`);
  console.log(`  ${'id'.padEnd(26)} ${'nome'.padEnd(22)} ${'registrato'.padEnd(12)} ${'atteso'.padEnd(12)} pasti  clienti`);
  for (const b of bad) {
    const n = clientsByDiet.get(b.id) ?? 0;
    console.log(
      `  ${b.id.padEnd(26)} ${b.name.slice(0, 22).padEnd(22)} ${b.regime.padEnd(12)} ${b.expected.padEnd(12)} ${String(b.mealsPerDay).padStart(5)}  ${String(n).padStart(7)}${n ? '' : '  (nessuna servita nel periodo)'}`,
    );
  }
  const totalClients = [...clientsByDiet.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  Clienti servite da queste diete negli ultimi ${DAYS} giorni: ${totalClients}.`);
  console.log('  Conseguenza: `pickDiet` abbina la dieta per regime, quindi queste finiscono a clienti');
  console.log('  del regime REGISTRATO, non di quello che il nome promette; e le sostituzioni pescano');
  console.log('  alternative sempre per regime. Correzione = dato (regime o nome), non codice: solo lo');
  console.log('  staff sa quale dei due campi è quello sbagliato.');
  console.log('');
}

const poolSizesCache = new Map<string, Map<string, PoolRecipe[]>>();
async function poolSizesCached(dietId: string, level: number) {
  const key = `${dietId}|${level}`;
  const hit = poolSizesCache.get(key);
  if (hit) return hit;
  const val = await poolSizes(dietId, level);
  poolSizesCache.set(key, val);
  return val;
}

/**
 * Le clienti nella stessa condizione di quella che si è lamentata: una lista di esclusioni
 * che riduce sotto soglia il pool della dieta assegnata. Per loro il motore non può produrre
 * varietà, e ripiega su alternative fuori dal piano — che è il modo in cui la carne è finita
 * in un piano di pesce. Sola lettura.
 */
async function reportInsufficientPools(clientIds: string[]) {
  const rows: { email: string; diet: string; worst: string; left: number; of: number; excl: number }[] = [];
  for (const clientId of clientIds) {
    const profile = (await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { dislikedFoods: true, intolerances: true, allergies: true },
    })) as { dislikedFoods: string[]; intolerances: string[]; allergies: string[] } | null;
    if (!profile) continue;
    const terms = [...(profile.dislikedFoods ?? []), ...(profile.intolerances ?? []), ...(profile.allergies ?? [])];
    if (!terms.length) continue;
    const excluded = exclusionKeys(terms);
    const days = await loadDays(clientId);
    const last = [...days].reverse().find((d) => d.dietId);
    if (!last?.dietId) continue;
    const pool = await poolSizesCached(last.dietId, last.level ?? 1);
    if (!pool.size) continue;
    let worst: { slot: string; left: number; of: number } | null = null;
    for (const [slot, list] of pool) {
      const left = list.filter((r) => !hitsExclusion(recipeHaystack(r.name, r.ingredients), excluded)).length;
      if (!worst || left < worst.left) worst = { slot, left, of: list.length };
    }
    if (!worst || worst.left >= MIN_ALTERNATIVES) continue;
    const u = (await prisma.user.findUnique({ where: { id: clientId }, select: { email: true } })) as { email: string } | null;
    const diet = (await prisma.diet.findUnique({ where: { id: last.dietId }, select: { name: true } })) as { name: string } | null;
    rows.push({
      email: u?.email ?? clientId,
      diet: diet?.name ?? last.dietId,
      worst: worst.slot,
      left: worst.left,
      of: worst.of,
      excl: terms.length,
    });
  }
  console.log(`\nPOOL EFFETTIVO INSUFFICIENTE (meno di ${MIN_ALTERNATIVES} alternative in almeno un pasto)`);
  if (!rows.length) {
    console.log('  ok: nessuna cliente in questa condizione.\n');
    return;
  }
  rows.sort((a, b) => a.left - b.left || b.excl - a.excl);
  for (const r of rows) {
    console.log(
      `  ⚠  ${r.email.padEnd(34)} "${r.diet}" — ${r.worst}: ${r.left}/${r.of} utilizzabili (${r.excl} esclusioni sul profilo)`,
    );
  }
  console.log(`\n  → ${rows.length} clienti per cui nessun parametro di varietà può bastare: serve`);
  console.log('    ampliare il pool della dieta, assegnarne una compatibile, o rivedere le esclusioni.');
  console.log('');
}

async function reportFleet() {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const rows = (await prisma.menuDay.findMany({
    where: { date: { gte: since } },
    select: { clientId: true },
    distinct: ['clientId'],
  })) as { clientId: string }[];
  console.log(`FLOTTA — clienti con menu negli ultimi ${DAYS} giorni: ${rows.length}\n`);

  const scored: { email: string; days: number; worst: string; ratio: number; streak: number }[] = [];
  for (const { clientId } of rows) {
    const days = await loadDays(clientId);
    if (days.length < 5) continue; // troppo pochi giorni per giudicare
    const stats = slotStats(days);
    if (!stats.length) continue;
    // slot peggiore = quello con meno piatti distinti in proporzione ai giorni
    const worst = stats.reduce((a, b) => (b.distinct / b.total < a.distinct / a.total ? b : a));
    const u = (await prisma.user.findUnique({ where: { id: clientId }, select: { email: true } })) as { email: string } | null;
    scored.push({
      email: u?.email ?? clientId,
      days: days.length,
      worst: worst.slot,
      ratio: worst.distinct / worst.total,
      streak: Math.max(...stats.map((s) => s.maxStreak)),
    });
  }
  scored.sort((a, b) => a.ratio - b.ratio || b.streak - a.streak);
  console.log('Le 20 clienti col menu più ripetitivo (piatti distinti / giorni, nello slot peggiore):');
  for (const s of scored.slice(0, 20)) {
    console.log(
      `  · ${s.email.padEnd(34)} ${s.days} gg — slot "${s.worst}": ${(s.ratio * 100).toFixed(0)}% distinti — stesso piatto fino a ${s.streak} giorni di fila`,
    );
  }
  const bad = scored.filter((s) => s.ratio < 0.4 || s.streak >= 3).length;
  console.log(`\n  → clienti con varietà bassa (<40% distinti o ≥3 giorni uguali di fila): ${bad}/${scored.length}`);
  console.log('  Dettaglio di una cliente:  npm run diag:varieta -- --email=...');
  await reportInsufficientPools(rows.map((r) => r.clientId));
}

async function main() {
  console.log(`Diagnostica varietà menu — finestra ${DAYS} giorni\n`);
  await showConfig();
  await reportDietRegimeCoherence();
  if (EMAIL) {
    const user = (await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, email: true } })) as
      | { id: string; email: string }
      | null;
    if (!user) {
      console.log(`Nessun utente con email ${EMAIL}`);
      return;
    }
    await reportClient(user.id, user.email);
  } else {
    await reportFleet();
  }
  console.log('Fine diagnostica.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
