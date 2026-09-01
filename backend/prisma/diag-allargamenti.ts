/**
 * LE GIORNATE COMPOSTE ALLARGANDO LA BANDA KCAL — sola lettura.
 *
 * ⚠️ Decisione di Simone dell'1/9 (Fase 3): quando nessuna combinazione entra nella banda del
 * target, la giornata si compone lo stesso allargando la banda a passi — **e si scrive di quanto**,
 * in `menu_day.allargamento_banda_pct`. Questo tabulato legge quella colonna.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## Cosa si guarda
 *
 * ⚠️ Non il numero in sé: **da quali diete arriva**. Una giornata allargata ogni tanto è il sistema
 * che fa il suo mestiere. Una dieta che allarga tutti i giorni sta dicendo un'altra cosa: il suo
 * paniere non ha piatti che sommino al target, e la risposta non è alzare il tetto — è che a quel
 * paniere mancano ricette, o che il target di quella dieta non è raggiungibile coi piatti che ha.
 *
 * ⛔ E le giornate che il tetto ha **fermato** qui non si vedono: quelle non hanno una riga
 * allargata, hanno la giornata pre-costruita e basta. Si trovano nei log, con la riga «composte
 * allargando la banda» assente e il ripiego che scatta — è il limite di questo tabulato, scritto
 * perché chi lo legge non concluda «nessun problema» da una tabella vuota.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:allargamenti              → ultimi 30 giorni
 *   GIORNI=90 npm run diag:allargamenti
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 30) || 30);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo(`GIORNATE COMPOSTE ALLARGANDO LA BANDA — ultimi ${GIORNI} giorni`);

  const totali = (await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS giornate,
           COUNT(allargamento_banda_pct)::int AS allargate
    FROM menu_day
    WHERE date >= CURRENT_DATE - INTERVAL '${GIORNI} days'
  `)) as { giornate: number; allargate: number }[];

  const g = Number(totali[0]?.giornate ?? 0);
  const a = Number(totali[0]?.allargate ?? 0);

  riga('');
  riga(`  Giornate composte: ${g}`);
  riga(`  …di cui allargando la banda: ${a}${g > 0 ? ` (${((a / g) * 100).toFixed(1)}%)` : ''}`);

  if (a === 0) {
    riga('');
    riga('  ✅ Nessuna giornata ha avuto bisogno di allargare.');
    riga('  ⛔ Attenzione a come si legge: questa tabella NON mostra le giornate che il TETTO ha');
    riga('     fermato — quelle ripiegano sulla giornata pre-costruita e non lasciano un numero qui.');
    riga('     Se la colonna è vuota perché la migrazione è appena passata, aspetta una notte.');
    return;
  }

  const perDieta = (await prisma.$queryRawUnsafe(`
    SELECT d.name AS dieta,
           COUNT(*)::int AS allargate,
           MAX(m.allargamento_banda_pct)::int AS massimo,
           ROUND(AVG(m.allargamento_banda_pct)::numeric, 1) AS media,
           COUNT(DISTINCT m.client_id)::int AS clienti
    FROM menu_day m JOIN diet d ON d.id = m.diet_id
    WHERE m.date >= CURRENT_DATE - INTERVAL '${GIORNI} days' AND m.allargamento_banda_pct IS NOT NULL
    GROUP BY d.name ORDER BY COUNT(*) DESC
  `)) as { dieta: string; allargate: number; massimo: number; media: unknown; clienti: number }[];

  riga('');
  riga('  ┌─ dieta ────────────────────────────────┬ gg ──┬ media ┬ max ─┬ clienti ┐');
  for (const r of perDieta.slice(0, ESEMPI)) {
    riga(`  │ ${String(r.dieta).slice(0, 38).padEnd(38)} │ ${String(r.allargate).padStart(4)} │ ${String(r.media).padStart(5)} │ ${String(r.massimo).padStart(4)} │ ${String(r.clienti).padStart(7)} │`);
  }
  riga('  └────────────────────────────────────────┴──────┴───────┴──────┴─────────┘');
  if (perDieta.length > ESEMPI) riga(`  …e altre ${perDieta.length - ESEMPI}.`);

  riga('');
  riga('  ⚠️ Il numero da guardare non è il totale, è **quali diete** allargano ogni giorno: quelle');
  riga('     stanno dicendo che al loro paniere mancano piatti che sommino al target, o che il');
  riga('     target non è raggiungibile con i piatti che hanno. La risposta non è alzare il tetto.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
