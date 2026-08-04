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
 *
 * Nessuna scrittura.
 *
 *   npm run diag:varieta                          # flotta: le clienti col menu più ripetitivo
 *   npm run diag:varieta -- --email=tizia@mail.it # dettaglio di una cliente
 *   npm run diag:varieta -- --email=... --days=45
 */
import { PrismaClient } from '@prisma/client';

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

/** Quante ricette diverse la dieta approvata offre per ogni slot (il "tetto" della varietà). */
async function poolSizes(dietId: string, level: number): Promise<Map<string, { id: string; name: string; kcal: number }[]>> {
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
    select: { id: true, name: true, kcal: true },
  })) as { id: string; name: string; kcal: number }[];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const out = new Map<string, { id: string; name: string; kcal: number }[]>();
  for (const [slot, ids] of idsBySlot) {
    out.set(
      slot,
      [...ids].map((id) => byId.get(id) ?? { id, name: '(ricetta mancante)', kcal: 0 }).sort((a, b) => a.kcal - b.kcal),
    );
  }
  return out;
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

async function reportClient(clientId: string, email: string) {
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
  }
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
  console.log('  Dettaglio di una cliente:  npm run diag:varieta -- --email=...\n');
}

async function main() {
  console.log(`Diagnostica varietà menu — finestra ${DAYS} giorni\n`);
  await showConfig();
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
