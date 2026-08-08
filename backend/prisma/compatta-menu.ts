/**
 * COMPATTA le settimane di una dieta: prima quelle piene, in fondo quello che avanza.
 *
 * ## Il problema che risolve
 *
 * Il catalogo si è formato a strati: un pezzo col metodo vecchio (pochi piatti ricombinati),
 * un pezzo generato bene settimana per settimana, qualche piatto corretto a mano. Il risultato
 * è che i piatti ci sono, ma sono **sparsi**: la settimana 6 ha quattordici spuntini e la 2 ne
 * ha tre, la 1 usa piatti che compaiono anche nella 5. Contando a mano non torna mai niente, e
 * la striscia delle settimane resta gialla anche dopo aver generato.
 *
 * Questo comando non genera niente e non chiama l'AI: **ridistribuisce quello che c'è già**.
 * Per ogni pasto prende i piatti distinti della dieta, li mette in fila e ricostruisce le
 * giornate in ordine — sette piatti diversi per pasto in ogni settimana, dalla 1 in avanti.
 * Quello che avanza resta da parte: sarà il generatore a usarlo quando gli si chiede la
 * settimana successiva (le ricette avanzate vengono ripescate: vedi `engine-rules.service.ts`,
 * «ricette orfane»).
 *
 * ## Che cosa NON fa
 *
 * Non cancella ricette, non ne crea, non tocca gli stati. Riscrive solo le **giornate**
 * (`diet_day_template`), che sono la disposizione dei piatti nel ciclo.
 *
 * ## Il ciclo si accorcia — e va bene così
 *
 * Se una dieta ha 84 giorni ma solo 44 pranzi diversi, dopo la compattazione avrà 42 giorni
 * (6 settimane piene). Sembra un passo indietro e non lo è: quei 42 giorni sono **tutti
 * diversi**, mentre gli 84 di prima contenevano quaranta ripetizioni. Per la cliente il ciclo
 * ricomincia prima, ma dentro il ciclo non si ripete niente — che è la promessa.
 *
 * USO (shell di Render, dentro la cartella del backend):
 *   npm run compatta:menu                              → tutto il catalogo, mostra e basta
 *   npm run compatta:menu -- "Basso indice glicemico"  → una sola famiglia
 *   CONFERMA=1 npm run compatta:menu -- "..."          → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GIORNI_SETTIMANA = 7;

const SLOT_5 = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
const SLOT_3 = ['breakfast', 'lunch', 'dinner'];
const SLOT_FASTING = ['lunch', 'afternoon_snack', 'dinner'];

const NOME_PASTO: Record<string, string> = {
  breakfast: 'colaz.', morning_snack: 'spunt.', lunch: 'pranzo',
  afternoon_snack: 'merenda', dinner: 'cena',
};

async function main(): Promise<void> {
  const nome = process.argv.slice(2).join(' ').trim();
  const conferma = process.env.CONFERMA === '1';

  const diete = (await prisma.diet.findMany({
    where: { ...(nome ? { name: nome } : {}), status: { not: 'rejected' } } as never,
    select: { id: true, name: true, regime: true, objective: true, mealsPerDay: true, fasting: true },
    orderBy: [{ name: 'asc' }, { regime: 'asc' }],
  })) as {
    id: string; name: string; regime: string; objective: string | null;
    mealsPerDay: number; fasting: boolean | null;
  }[];

  if (diete.length === 0) {
    console.log(nome ? `Nessuna dieta con nome "${nome}".` : 'Nessuna dieta in catalogo.');
    return;
  }

  const tabella: Record<string, unknown>[] = [];
  const lavori: { dietId: string; slots: string[]; perSlot: Map<string, string[]>; giorni: number }[] = [];

  for (const d of diete) {
    const slots = d.fasting ? SLOT_FASTING : d.mealsPerDay === 5 ? SLOT_5 : SLOT_3;
    const templates = (await prisma.dietDayTemplate.findMany({
      where: { dietId: d.id },
      orderBy: { dayIndex: 'asc' },
      select: { dayIndex: true, meals: true },
    })) as { dayIndex: number; meals: unknown }[];
    if (templates.length === 0) continue;

    // Piatti distinti per pasto, nell'ordine in cui compaiono oggi: così le ricette corrette a
    // mano (che stanno nelle prime settimane) restano nelle prime settimane.
    const perSlot = new Map<string, string[]>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        const lista = perSlot.get(m.slot) ?? [];
        if (!lista.includes(m.recipeId)) lista.push(m.recipeId);
        perSlot.set(m.slot, lista);
      }
    }

    const conteggi = slots.map((sl) => (perSlot.get(sl) ?? []).length);
    const minimo = conteggi.length ? Math.min(...conteggi) : 0;
    const settimanePiene = Math.floor(minimo / GIORNI_SETTIMANA);
    const giorniNuovi = settimanePiene * GIORNI_SETTIMANA;
    const giorniOra = Math.max(...templates.map((t) => t.dayIndex));

    tabella.push({
      dieta: `${d.name} · ${d.regime} · ${d.objective ?? '—'} · ${d.fasting ? 'digiuno' : `${d.mealsPerDay} pasti`}`,
      'giorni ora': giorniOra,
      'giorni dopo': giorniNuovi,
      'settimane piene': settimanePiene,
      'piatti per pasto': slots.map((sl) => `${NOME_PASTO[sl] ?? sl} ${(perSlot.get(sl) ?? []).length}`).join(' · '),
      avanzano: slots
        .map((sl) => Math.max(0, (perSlot.get(sl) ?? []).length - giorniNuovi))
        .reduce((a, b) => a + b, 0),
      esito: giorniNuovi === 0
        ? '⚠ nemmeno una settimana piena'
        : giorniNuovi === giorniOra ? 'già in ordine ✓' : 'da compattare',
    });

    if (giorniNuovi > 0 && giorniNuovi !== giorniOra) {
      lavori.push({ dietId: d.id, slots, perSlot, giorni: giorniNuovi });
    }
  }

  console.table(tabella);
  console.log(
    '\nCome si legge:\n' +
    '· «giorni dopo» = settimane PIENE ricavabili dai piatti che ci sono già (7 diversi per\n' +
    '  pasto, per settimana). Se è meno di «giorni ora» il ciclo si accorcia: quei giorni però\n' +
    '  sono tutti diversi, mentre quelli di prima contenevano ripetizioni.\n' +
    '· «avanzano» = piatti che restano fuori dal ciclo. Non si perdono: il generatore li\n' +
    '  ripesca quando gli chiedi la settimana successiva, prima di chiamare l\'AI.\n' +
    '· «nemmeno una settimana piena» = mancano proprio i piatti (meno di 7 in qualche pasto):\n' +
    '  lì non c\'è niente da compattare, va generato.',
  );

  if (lavori.length === 0) {
    console.log('\nNiente da compattare ✓');
    return;
  }
  console.log(`\nDa compattare: ${lavori.length} diete.`);
  if (!conferma) {
    console.log(`Niente scritto: rilancia con  CONFERMA=1 npm run compatta:menu${nome ? ` -- "${nome}"` : ''}`);
    return;
  }

  let fatte = 0;
  for (const w of lavori) {
    try {
      await prisma.dietDayTemplate.deleteMany({ where: { dietId: w.dietId } });
      for (let d = 1; d <= w.giorni; d++) {
        const pasti = w.slots
          .map((sl) => {
            const lista = w.perSlot.get(sl) ?? [];
            const id = lista[d - 1];
            return id ? { slot: sl, recipeId: id } : null;
          })
          .filter((m): m is { slot: string; recipeId: string } => !!m);
        if (pasti.length === 0) break;
        await prisma.dietDayTemplate.create({
          data: { dietId: w.dietId, level: 1, dayIndex: d, meals: pasti as never },
        });
      }
      fatte += 1;
    } catch (e) {
      console.log(`⚠️  ${w.dietId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n✓ Compattate ${fatte} diete su ${lavori.length}.`);
  console.log('Ora le settimane sono piene dalla 1 in avanti: nel generatore restano gialle solo');
  console.log('quelle da fare davvero, e i piatti avanzati verranno usati per prime.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
