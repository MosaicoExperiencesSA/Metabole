/**
 * QUANTE CLIENTI HANNO RISCHIATO UN PASTO IN PIÙ — sola lettura.
 *
 * ⛔ **Il difetto**: dalla Fase 1, con `panieri_sorgente_pool = paniere`, la composizione bilanciata
 * (DayCombo) prendeva il numero di pasti della giornata dalle **chiavi del pool**, cioè dal
 * paniere — che è famiglia × regime e raccoglie anche varianti con una struttura diversa. Una
 * cliente a 3 pasti il cui paniere ne contiene di 5 poteva vedersi comporre 5 pasti: kcal in più di
 * quelle che le spettano, senza che niente lo dicesse.
 *
 * ⚠️ Corretto l'1/9 (`menu/struttura-della-giornata.ts`): la struttura la dettano le sue giornate.
 * Questo tabulato serve a sapere **chi è stato esposto**, cioè per quali clienti vale la pena
 * guardare i menu composti nella finestra fra lo spostamento dell'interruttore e il rilascio.
 *
 * ⛔ **NON SCRIVE NIENTE** e non corregge nessun menu: conta e basta.
 *
 * ## Come si legge
 *
 * Esposta = la dieta ha DayCombo acceso (o il menu a necessità, che lo accende da sé) **e** il suo
 * paniere ha almeno uno slot che le sue giornate non hanno. Le altre non erano raggiungibili dal
 * difetto: senza DayCombo la giornata la compone il selettore sul template, che la struttura giusta
 * ce l'ha sempre avuta.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:struttura
 *   ESEMPI=60 npm run diag:struttura   (default 30)
 */
import { PrismaClient } from '@prisma/client';
import { paniereDellaVariante } from '../src/catalog/appartenenza-panieri';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 30) || 30);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('STRUTTURA DELLA DIETA CONTRO STRUTTURA DEL PANIERE');

  const [diete, giornate, panieri, regole, clienti, param] = await Promise.all([
    prisma.diet.findMany({ select: { id: true, name: true, regime: true, mealsPerDay: true, fasting: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; mealsPerDay: number | null; fasting: boolean | null }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
    prisma.paniereRicetta.findMany({
      select: { slot: true, paniere: { select: { famiglia: true, regime: true } } },
    }) as unknown as Promise<{ slot: string; paniere: { famiglia: string; regime: string } }[]>,
    prisma.productRule.findMany({
      where: { ruleCode: { in: ['menu_daycombo_enabled', 'menu_kcal_need_enabled'] } },
      select: { dietId: true, ruleCode: true, enabled: true, params: true },
    }) as unknown as Promise<{ dietId: string; ruleCode: string; enabled: boolean; params: unknown }[]>,
    prisma.$queryRaw`
      SELECT diet_id AS "dietId", COUNT(DISTINCT client_id)::int AS clienti
      FROM menu_day WHERE date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY diet_id
    ` as Promise<{ dietId: string; clienti: number }[]>,
    prisma.configParam.findUnique({ where: { key: 'panieri_sorgente_pool' }, select: { value: true, updatedAt: true } }) as unknown as
      Promise<{ value: string; updatedAt: Date } | null>,
  ]);

  riga('');
  if (!param) {
    riga('  `panieri_sorgente_pool` non è scritto: vale il default `giornate`.');
    riga('  ⚠️ Con le giornate il difetto non era raggiungibile: il pool era già quello della sua dieta.');
  } else {
    riga(`  \`panieri_sorgente_pool\` = ${param.value}  ·  ultima modifica: ${param.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}`);
    if (param.value !== 'paniere') {
      riga('  ⚠️ Non è su `paniere`: il difetto non era raggiungibile ORA. Se lo è stato in passato,');
      riga('     la finestra da guardare va da quando è stato spostato a quando è stato rimesso.');
    }
  }

  /** Gli slot che le giornate di ogni dieta prevedono davvero. */
  const strutturaDi = new Map<string, Set<string>>();
  for (const g of giornate) {
    const meals = Array.isArray(g.meals) ? (g.meals as { slot?: string; recipeId?: string }[]) : [];
    const s = strutturaDi.get(g.dietId) ?? new Set<string>();
    for (const m of meals) if (m?.slot && m?.recipeId) s.add(m.slot);
    strutturaDi.set(g.dietId, s);
  }

  /** Gli slot che ogni paniere contiene. */
  const slotDelPaniere = new Map<string, Set<string>>();
  for (const r of panieri) {
    const k = `${r.paniere.famiglia}|${r.paniere.regime}`;
    const s = slotDelPaniere.get(k) ?? new Set<string>();
    s.add(r.slot);
    slotDelPaniere.set(k, s);
  }

  const acceso = new Map<string, Set<string>>();
  for (const r of regole) {
    const v = (r.params as { value?: unknown } | null)?.value;
    const attiva = typeof v === 'boolean' ? v : r.enabled;
    if (!attiva) continue;
    const s = acceso.get(r.dietId) ?? new Set<string>();
    s.add(r.ruleCode);
    acceso.set(r.dietId, s);
  }

  const clientiPer = new Map(clienti.map((c) => [c.dietId, Number(c.clienti)]));

  const righe: { nome: string; struttura: number; inPiu: string[]; regole: string[]; clienti: number }[] = [];
  for (const d of diete) {
    const esito = paniereDellaVariante(d as never);
    if (esito.tipo !== 'paniere') continue;
    const sua = strutturaDi.get(d.id) ?? new Set<string>();
    if (sua.size === 0) continue;
    const suo = slotDelPaniere.get(`${esito.famiglia}|${esito.regime}`) ?? new Set<string>();
    const inPiu = [...suo].filter((s) => !sua.has(s));
    if (!inPiu.length) continue;
    righe.push({
      nome: d.name,
      struttura: sua.size,
      inPiu,
      regole: [...(acceso.get(d.id) ?? [])],
      clienti: clientiPer.get(d.id) ?? 0,
    });
  }

  const esposte = righe.filter((r) => r.regole.length > 0);
  const conClienti = esposte.filter((r) => r.clienti > 0);

  riga('');
  riga(`  Varianti il cui paniere ha slot che le sue giornate NON hanno: ${righe.length}`);
  riga(`  …di queste, con DayCombo o menu a necessità acceso (ESPOSTE): ${esposte.length}`);
  riga(`  …di queste, con clienti servite negli ultimi 30 giorni:       ${conClienti.length}`);
  riga(`  Clienti distinte dietro quelle varianti:                      ${conClienti.reduce((s, r) => s + r.clienti, 0)}`);

  if (!esposte.length) {
    riga('');
    riga('  ✅ Nessuna variante esposta: dove il paniere è più largo, la composizione bilanciata è');
    riga('     spenta, quindi la giornata la faceva il selettore sul template — struttura giusta.');
  } else {
    riga('');
    riga('  ┌─ variante ─────────────────────────────┬ suoi ┬ in più ──────────────┬ clienti ┐');
    for (const r of esposte.sort((a, b) => b.clienti - a.clienti).slice(0, ESEMPI)) {
      const nome = r.nome.slice(0, 38).padEnd(38);
      const piu = r.inPiu.join(' ').slice(0, 20).padEnd(20);
      riga(`  │ ${nome} │ ${String(r.struttura).padStart(4)} │ ${piu} │ ${String(r.clienti).padStart(7)} │`);
    }
    riga('  └────────────────────────────────────────┴──────┴──────────────────────┴─────────┘');
    if (esposte.length > ESEMPI) riga(`  …e altre ${esposte.length - ESEMPI}. Alza ESEMPI per vederle.`);
    riga('');
    riga('  ⚠️ Cosa farne: per queste clienti vale la pena guardare i `menu_day` composti nella');
    riga('     finestra fra lo spostamento dell\'interruttore e il rilascio della correzione, e');
    riga('     contare quanti pasti hanno. Da lì in avanti la struttura la detta la loro dieta.');
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
