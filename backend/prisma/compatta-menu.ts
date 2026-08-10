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
 * ## I piatti fantasma (aggiunto l'11/8)
 *
 * I pasti di una giornata stanno in un campo JSON, quindi **niente impedisce di cancellare una
 * ricetta ancora nominata da una giornata**. Prima questo script si fidava di quei riferimenti e li
 * rimetteva in fila come piatti buoni: contava sette pranzi dove ce n'erano sei, e dichiarava «piena»
 * una settimana con un buco. Ora verifica che ogni ricetta esista, li conta in una colonna a parte
 * («rotti esclusi») e li lascia fuori — quindi compattare **ripulisce** anche quei buchi, perché le
 * giornate si riscrivono solo con i piatti veri.
 *
 * La colonna «in bozza» dice quanti dei piatti veri non sono ancora attivi: sono nel ciclo ma il
 * motore non li usa finché non si valida. Un pasto con sette piatti tutti in bozza da fuori si vede
 * vuoto, e non è un problema di compattazione: è la validazione che manca.
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

  /**
   * LE RICETTE CHE ESISTONO DAVVERO, e quali sono attive (11/8).
   *
   * Prima questo script contava i piatti leggendoli dalle giornate e **fidandosi**: un `recipeId`
   * che nel frattempo era stato cancellato veniva contato come un piatto buono e rimesso in fila
   * nelle giornate nuove. Quindi il comando che deve mettere in ordine il catalogo era cieco
   * proprio sul difetto peggiore che il catalogo può avere — e dichiarava «settimana piena» una
   * settimana con un buco dentro.
   *
   * I pasti stanno in un campo JSON (`diet_day_template.meals`): nessun vincolo del database
   * impedisce di cancellare una ricetta ancora nominata da una giornata. Quindi la verifica va
   * fatta qui, a mano, ed è una query sola.
   */
  const esistenti = new Map<string, boolean>();
  for (const r of (await prisma.recipe.findMany({ select: { id: true, active: true } })) as { id: string; active: boolean }[]) {
    esistenti.set(r.id, r.active);
  }
  let rottiTotali = 0;

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
    /** Riferimenti a ricette che non esistono più: si contano e si buttano, non si rimettono in fila. */
    const rotti = new Set<string>();
    let inBozza = 0;
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        if (!esistenti.has(m.recipeId)) { rotti.add(m.recipeId); continue; }
        const lista = perSlot.get(m.slot) ?? [];
        if (!lista.includes(m.recipeId)) {
          lista.push(m.recipeId);
          if (esistenti.get(m.recipeId) === false) inBozza += 1;
        }
        perSlot.set(m.slot, lista);
      }
    }
    rottiTotali += rotti.size;

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
      // Due colonne nuove (11/8): i piatti fantasma esclusi dal conteggio, e quanti dei piatti veri
      // sono ancora in bozza — cioè quanti il motore NON usa finché non si valida.
      'rotti esclusi': rotti.size || '',
      'in bozza': inBozza || '',
      esito: giorniNuovi === 0
        ? '⚠ nemmeno una settimana piena'
        : giorniNuovi === giorniOra ? 'già in ordine ✓' : 'da compattare',
    });

    if (giorniNuovi > 0 && giorniNuovi !== giorniOra) {
      lavori.push({ dietId: d.id, slots, perSlot, giorni: giorniNuovi });
    }
  }

  console.table(tabella);
  if (rottiTotali > 0) {
    console.log(
      `\n⚠️  ${rottiTotali} riferimenti a ricette CANCELLATE trovati nelle giornate ed esclusi dal ` +
      'conteggio.\n' +
      '   Sono i pasti che dal backoffice si vedono vuoti pur avendo la giornata: compattando\n' +
      '   spariscono, perché le giornate si riscrivono solo con i piatti che esistono.',
    );
  }
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
  for (const [i, w] of lavori.entries()) {
    try {
      // Le giornate si riscrivono in blocco: su tutto il catalogo sono decine di migliaia di
      // righe, e una `create` per volta significa una andata e ritorno per riga — dieci minuti
      // di attesa davanti a un terminale fermo, con il rischio che qualcuno lo interrompa a
      // metà. `deleteMany` + `createMany` dentro una transazione: o si riscrive tutta la dieta
      // o non si tocca niente.
      const righe: { dietId: string; level: number; dayIndex: number; meals: unknown }[] = [];
      for (let d = 1; d <= w.giorni; d++) {
        const pasti = w.slots
          .map((sl) => {
            const lista = w.perSlot.get(sl) ?? [];
            const id = lista[d - 1];
            return id ? { slot: sl, recipeId: id } : null;
          })
          .filter((m): m is { slot: string; recipeId: string } => !!m);
        if (pasti.length === 0) break;
        righe.push({ dietId: w.dietId, level: 1, dayIndex: d, meals: pasti });
      }
      if (righe.length === 0) continue;
      await prisma.$transaction([
        prisma.dietDayTemplate.deleteMany({ where: { dietId: w.dietId } }),
        prisma.dietDayTemplate.createMany({ data: righe as never }),
      ]);
      fatte += 1;
      if ((i + 1) % 25 === 0) console.log(`  …${i + 1} di ${lavori.length}`);
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
