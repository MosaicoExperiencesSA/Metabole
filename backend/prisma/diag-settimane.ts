/**
 * DIAGNOSTICA: quali diete hanno poche ricette vere, e da quali conviene ripartire.
 *
 * Il vecchio generatore produceva **5 ricette per pasto** e poi le ricombinava per 28 giornate:
 * il catalogo sembrava pieno (28 giorni) ma i piatti erano pochi, e la stessa colazione tornava
 * cinque o sei volte al mese. Dall'8/8 si genera una settimana per volta, con 7 ricette nuove
 * per ogni pasto — ma le diete già create restano come sono finché non si rifanno.
 *
 * Questo script guarda quello che conta davvero: **quante ricette diverse ha ogni pasto**.
 * Una dieta con 28 giornate e 5 colazioni è messa peggio di una con 7 giornate e 7 colazioni.
 *
 * L'ordine di uscita è l'ordine in cui conviene lavorare: prima le diete con più clienti sopra,
 * poi quelle con meno ricette per pasto. Dentro una famiglia si parte sempre dalla variante con
 * PIÙ pasti (5), perché le altre riusano le sue ricette e non costano una seconda generazione.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:settimane
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOME_PASTO: Record<string, string> = {
  breakfast: 'colaz.',
  morning_snack: 'spunt.',
  lunch: 'pranzo',
  afternoon_snack: 'merenda',
  dinner: 'cena',
};

type Riga = {
  dieta: string;
  variante: string;
  clienti: number;
  giornate: number;
  'ricette/pasto (minimo)': number;
  dettaglio: string;
  'da rifare': string;
};

async function main(): Promise<void> {
  const diete = (await prisma.diet.findMany({
    where: { status: { not: 'rejected' } } as never,
    select: {
      id: true, name: true, style: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true,
    },
    orderBy: [{ name: 'asc' }],
  })) as {
    id: string; name: string; style: string; regime: string; objective: string | null;
    mealsPerDay: number; fasting: boolean | null; status: string;
  }[];

  if (diete.length === 0) {
    console.log('Nessuna dieta in catalogo.');
    return;
  }

  const righe: (Riga & { _ordine: number })[] = [];

  for (const d of diete) {
    const templates = (await prisma.dietDayTemplate.findMany({
      where: { dietId: d.id },
      select: { dayIndex: true, meals: true },
    })) as { dayIndex: number; meals: unknown }[];

    // Ricette DIVERSE per pasto: è il numero che conta. Le giornate possono essere 28 e
    // pescare sempre dalle stesse cinque.
    const perPasto = new Map<string, Set<string>>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        const set = perPasto.get(m.slot) ?? new Set<string>();
        set.add(m.recipeId);
        perPasto.set(m.slot, set);
      }
    }
    const conteggi = [...perPasto.entries()].map(([slot, set]) => ({ slot, n: set.size }));
    const minimo = conteggi.length ? Math.min(...conteggi.map((c) => c.n)) : 0;
    const giornate = templates.length ? Math.max(...templates.map((t) => t.dayIndex)) : 0;

    // Clienti che stanno ricevendo menu da questa dieta (ultimi 60 giorni).
    const da = new Date(Date.now() - 60 * 86_400_000);
    const menu = (await prisma.menuDay.findMany({
      where: { dietId: d.id, date: { gte: da } },
      select: { clientId: true },
      take: 5000,
    })) as { clientId: string }[];
    const clienti = new Set(menu.map((m) => m.clientId)).size;

    // Settimane "piene" = quante settimane di piatti diversi ha davvero il pasto più povero.
    const settimaneVere = Math.floor(minimo / 7);
    const settimaneApparenti = Math.ceil(giornate / 7);
    const daRifare = settimaneVere >= settimaneApparenti
      ? '—'
      : `settimane 1-${settimaneApparenti} (ne bastano ${settimaneApparenti})`;

    righe.push({
      dieta: `${d.name} (${d.style})`,
      variante: `${d.regime}${d.objective ? ` · ${d.objective}` : ''} · ${d.fasting ? 'digiuno' : `${d.mealsPerDay} pasti`}`,
      clienti,
      giornate,
      'ricette/pasto (minimo)': minimo,
      dettaglio: conteggi.map((c) => `${NOME_PASTO[c.slot] ?? c.slot} ${c.n}`).join(' · ') || '—',
      'da rifare': daRifare,
      // Ordine di lavoro: prima chi ha clienti sopra, poi chi ha meno ricette, e dentro la
      // famiglia prima la variante con più pasti (le altre riusano le sue).
      _ordine: -clienti * 1000 + minimo * 10 - (d.fasting ? 0 : d.mealsPerDay),
    });
  }

  righe.sort((a, b) => a._ordine - b._ordine);
  const daSistemare = righe.filter((r) => r['da rifare'] !== '—');
  const aPosto = righe.length - daSistemare.length;

  console.log(`Diete in catalogo: ${righe.length}. Già a posto: ${aPosto}. Da rifare: ${daSistemare.length}.\n`);
  console.log('--- ORDINE CONSIGLIATO DI LAVORO (dall\'alto) ---');
  console.table(daSistemare.map(({ _ordine, ...r }) => r));

  if (aPosto > 0) {
    console.log('\n--- Già a posto (7 ricette diverse per pasto in ogni settimana) ---');
    console.table(righe.filter((r) => r['da rifare'] === '—').map(({ _ordine, ...r }) => r));
  }

  console.log(
    '\nCome si legge:\n' +
    '· "giornate" = quanti giorni ha il ciclo. "ricette/pasto (minimo)" = quanti piatti DIVERSI\n' +
    '  ha il pasto messo peggio. Se una dieta ha 28 giornate e 5 colazioni, quella colazione\n' +
    '  torna cinque o sei volte al mese: è il difetto da correggere.\n' +
    '· Dentro una famiglia si parte SEMPRE dalla variante con più pasti (5): le varianti a 3\n' +
    '  pasti e a digiuno riusano le sue ricette e non costano una seconda generazione.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
