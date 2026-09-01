/**
 * LE GIORNATE COMPOSTE CON PIÙ PASTI DI QUANTI NE PREVEDE LA DIETA — sola lettura.
 *
 * ⛔ **Il difetto**: fra lo spostamento di `panieri_sorgente_pool` su `paniere` e il rilascio della
 * correzione, la composizione bilanciata prendeva il numero di pasti dalle chiavi del pool — cioè
 * dal paniere, che raccoglie anche varianti con una struttura diversa. Una cliente a 3 pasti poteva
 * vedersene comporre 5: kcal in più di quelle che le spettano.
 *
 * ⚠️ `diag:struttura` dice chi **poteva** essere colpita. Questo dice a chi è **successo**, con le
 * date. Sono due domande diverse e la seconda è quella che si guarda per decidere cosa fare: una
 * variante esposta le cui clienti non hanno avuto giornate composte in quella finestra non ha
 * bisogno di niente.
 *
 * ⛔ **NON SCRIVE NIENTE**, e non rifà nessun menu.
 *
 * ## Come si legge
 *
 * ⚠️ Una giornata con **meno** pasti della struttura non è questo difetto e non compare: gli
 * spuntini tolti da Vera e la finestra del digiuno tolgono pasti per mestiere, ed è giusto così.
 * Qui si cercano solo le giornate con pasti **in più**.
 *
 * ⚠️ La colonna «aperta» dice se la cliente ha già visto quel giorno. Una giornata futura e non
 * aperta si può ancora rifare; una già aperta no — quella è una cosa da dire a voce alla cliente,
 * non da correggere nel database alle sue spalle.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:troppi-pasti
 *   DA=2026-09-01T05:00 npm run diag:troppi-pasti   (default: da quando l'interruttore è cambiato)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 40) || 40);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('GIORNATE CON PIÙ PASTI DI QUANTI NE PREVEDE LA DIETA');

  const param = (await prisma.configParam.findUnique({
    where: { key: 'panieri_sorgente_pool' },
    select: { value: true, updatedAt: true },
  })) as { value: string; updatedAt: Date } | null;

  /**
   * ⚠️ La finestra parte da quando l'interruttore è stato spostato, non da una data a caso: prima
   * di quel momento il pool veniva dalle giornate della cliente e il difetto non esisteva.
   */
  const da = process.env.DA ? new Date(process.env.DA) : (param?.updatedAt ?? new Date(Date.now() - 7 * 86_400_000));
  riga('');
  riga(`  Finestra: dalle ${da.toISOString().slice(0, 16).replace('T', ' ')} a adesso (giornate CREATE in questo intervallo)`);
  if (param) riga(`  \`panieri_sorgente_pool\` = ${param.value}, spostato il ${param.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}`);

  const [giornate, templates] = await Promise.all([
    prisma.menuDay.findMany({
      where: { createdAt: { gte: da } },
      select: {
        id: true, clientId: true, date: true, dietId: true, meals: true,
        apertoDallaClienteIl: true, visibleFrom: true,
        diet: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }) as unknown as Promise<{
      id: string; clientId: string; date: Date; dietId: string; meals: unknown;
      apertoDallaClienteIl: Date | null; visibleFrom: Date; diet: { name: string } | null;
    }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
  ]);

  const strutturaDi = new Map<string, Set<string>>();
  for (const t of templates) {
    const s = strutturaDi.get(t.dietId) ?? new Set<string>();
    for (const m of (Array.isArray(t.meals) ? t.meals as { slot?: string; recipeId?: string }[] : [])) {
      if (m?.slot && m?.recipeId) s.add(m.slot);
    }
    strutturaDi.set(t.dietId, s);
  }

  riga('');
  riga(`  Giornate composte nella finestra: ${giornate.length}`);
  if (!giornate.length) {
    riga('');
    riga('  ✅ Nessuna giornata è stata composta in questa finestra: il difetto non ha avuto occasione');
    riga('     di colpire nessuno. ⚠️ Il cron notturno gira di notte — se l\'interruttore è stato');
    riga('     spostato dopo, l\'unica composizione possibile era quella su richiesta.');
    riga('');
    return;
  }

  const cattive: { cliente: string; dieta: string; data: string; suoi: number; avuti: number; inPiu: string[]; aperta: boolean }[] = [];
  for (const g of giornate) {
    const sua = strutturaDi.get(g.dietId);
    if (!sua || sua.size === 0) continue;
    const slotAvuti = new Set(
      (Array.isArray(g.meals) ? g.meals as { slot?: string }[] : []).map((m) => String(m?.slot ?? '')).filter(Boolean),
    );
    const inPiu = [...slotAvuti].filter((s) => !sua.has(s));
    if (!inPiu.length) continue;
    cattive.push({
      cliente: g.clientId,
      dieta: g.diet?.name ?? '—',
      data: g.date.toISOString().slice(0, 10),
      suoi: sua.size,
      avuti: slotAvuti.size,
      inPiu,
      aperta: !!g.apertoDallaClienteIl,
    });
  }

  riga(`  …con pasti IN PIÙ rispetto alla struttura della dieta: ${cattive.length}`);
  if (!cattive.length) {
    riga('');
    riga('  ✅ Nessuna giornata sbagliata. Le clienti esposte non sono state colpite.');
    riga('');
    return;
  }

  const clienti = new Set(cattive.map((c) => c.cliente));
  const aperte = cattive.filter((c) => c.aperta).length;
  riga(`  Clienti coinvolte: ${clienti.size}`);
  riga(`  …di cui giornate GIÀ APERTE dalla cliente: ${aperte}  ·  ancora da aprire: ${cattive.length - aperte}`);

  riga('');
  riga('  ┌─ dieta ────────────────────────────────┬ data ──────┬ suoi ┬ avuti ┬ aperta ┐');
  for (const c of cattive.slice(0, ESEMPI)) {
    riga(`  │ ${c.dieta.slice(0, 38).padEnd(38)} │ ${c.data} │ ${String(c.suoi).padStart(4)} │ ${String(c.avuti).padStart(5)} │ ${(c.aperta ? 'sì' : 'no').padStart(6)} │`);
  }
  riga('  └────────────────────────────────────────┴────────────┴──────┴───────┴────────┘');
  if (cattive.length > ESEMPI) riga(`  …e altre ${cattive.length - ESEMPI}. Alza ESEMPI per vederle.`);

  riga('');
  riga('  ⚠️ Cosa farne, e sono due cose diverse:');
  riga('     · le giornate ANCORA DA APRIRE si possono rifare: si cancellano e il giro successivo');
  riga('       le ricompone con la struttura giusta, perché l\'erogazione compone solo le date che');
  riga('       non esistono. Serve uno script apposta — non l\'ho scritto, si scrive quando si sa');
  riga('       quante sono.');
  riga('     · le giornate GIÀ APERTE non si toccano. Quella cliente ha visto quel menu: cambiarlo');
  riga('       nel database alle sue spalle vorrebbe dire che l\'app le mostra una cosa diversa da');
  riga('       quella che ha letto. Si dice alla sua nutrizionista, e decide una persona.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
