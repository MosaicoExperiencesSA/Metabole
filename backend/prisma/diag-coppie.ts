/**
 * LE COPPIE PRANZO/CENA CHE SI RIPETONO — sola lettura.
 *
 * ⚠️ Richiesta di Simone del 26/8: *«se oggi a pranzo spaghetti e a cena branzino, la prossima
 * volta che a pranzo avrò spaghetti mi devi cambiare la cena»*. Dall'1/9 la regola c'è. Questo
 * tabulato dice se **funziona**, e dove il pool è troppo stretto perché possa funzionare.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## Cosa si guarda
 *
 * ⚠️ Non «quante coppie ripetute» in assoluto: **quali clienti**. Una ripetizione ogni tanto vuol
 * dire che dentro la banda kcal non restava altro, ed è dichiarato. Una cliente che ripete tutte le
 * settimane sta dicendo che il suo paniere ha pochi pranzi o poche cene che sommino al target — e
 * la risposta non è allentare la regola, è che a quel paniere mancano piatti.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:coppie
 *   GIORNI=90 npm run diag:coppie      (default 60)
 */
import { PrismaClient } from '@prisma/client';
import { coppiaDellaGiornata } from '../src/menu/coppia-pranzo-cena';

const prisma = new PrismaClient();
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 60) || 60);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo(`COPPIE PRANZO/CENA RIPETUTE — ultimi ${GIORNI} giorni`);

  const da = new Date();
  da.setDate(da.getDate() - GIORNI);

  const righe = (await prisma.menuDay.findMany({
    where: { date: { gte: da } },
    select: { clientId: true, date: true, meals: true, diet: { select: { name: true } } },
    orderBy: { date: 'asc' },
  })) as unknown as { clientId: string; date: Date; meals: unknown; diet: { name: string } | null }[];

  const perCliente = new Map<string, { dieta: string; giornate: number; coppie: Map<string, number> }>();
  for (const r of righe) {
    const c = perCliente.get(r.clientId) ?? { dieta: r.diet?.name ?? '—', giornate: 0, coppie: new Map<string, number>() };
    const k = coppiaDellaGiornata((r.meals as { slot?: string; recipeId?: string }[]) ?? []);
    c.giornate += 1;
    if (k) c.coppie.set(k, (c.coppie.get(k) ?? 0) + 1);
    perCliente.set(r.clientId, c);
  }

  const elenco = [...perCliente.entries()].map(([clientId, c]) => {
    const ripetute = [...c.coppie.values()].filter((n) => n > 1).length;
    const volteInPiu = [...c.coppie.values()].reduce((s, n) => s + Math.max(0, n - 1), 0);
    return { clientId, dieta: c.dieta, giornate: c.giornate, distinte: c.coppie.size, ripetute, volteInPiu };
  }).filter((e) => e.distinte > 0);

  const conRipetizioni = elenco.filter((e) => e.ripetute > 0);

  riga('');
  riga(`  Clienti con almeno una giornata pranzo+cena: ${elenco.length}`);
  riga(`  …con almeno una coppia ripetuta:             ${conRipetizioni.length}`);
  riga(`  Giornate in più sulla stessa coppia, in tutto: ${elenco.reduce((s, e) => s + e.volteInPiu, 0)}`);

  if (!conRipetizioni.length) {
    riga('');
    riga('  ✅ Nessuna coppia ripetuta nella finestra.');
    riga('  ⚠️ Se la regola è appena entrata, questo dice poco: le ripetizioni vecchie restano nei');
    riga('     menu già erogati, che non si riscrivono. Si rilegge fra un mese.');
    return;
  }

  riga('');
  riga('  ┌─ dieta ────────────────────────────────┬ gg ──┬ coppie ┬ ripet ┬ in più ┐');
  for (const e of conRipetizioni.sort((a, b) => b.volteInPiu - a.volteInPiu).slice(0, ESEMPI)) {
    riga(`  │ ${e.dieta.slice(0, 38).padEnd(38)} │ ${String(e.giornate).padStart(4)} │ ${String(e.distinte).padStart(6)} │ ${String(e.ripetute).padStart(5)} │ ${String(e.volteInPiu).padStart(6)} │`);
  }
  riga('  └────────────────────────────────────────┴──────┴────────┴───────┴────────┘');
  if (conRipetizioni.length > ESEMPI) riga(`  …e altre ${conRipetizioni.length - ESEMPI}.`);

  riga('');
  riga('  ⚠️ La colonna «coppie» è quante coppie DIVERSE ha ricevuto quella cliente. Se è bassa');
  riga('     rispetto ai giorni, il suo paniere ha pochi pranzi o poche cene dentro la banda kcal:');
  riga('     la risposta è aggiungere piatti a quel paniere, non allentare la regola.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
