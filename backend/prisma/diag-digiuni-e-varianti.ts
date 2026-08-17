/**
 * DIAGNOSTICA: **cosa mangia davvero chi ha scelto il digiuno**, e cosa manca alle 18 varianti.
 *
 * Nasce dalla richiesta di Simone del 17/8 («uno script che genera tutte le 18 varianti… e i
 * digiuni creati sono sbagliati»). Prima di generare qualcosa — o di spendere in chiamate all'AI —
 * servono due numeri che oggi non abbiamo, e questo script li stampa. **Non scrive niente.**
 *
 * ## Parte 1 — i digiuni
 *
 * La variante `fasting: true` in catalogo ha tre slot FISSI: pranzo, merenda, cena
 * (`engine-rules.service.ts`, `giornate-complete.ts`). Cioè è, di fatto, la variante «salta la
 * colazione», e nessun campo lo dice. Poi l'erogazione toglie dalla giornata gli slot della
 * finestra scelta dalla cliente (`slotEsclusiTotali`) — su un pool che la colazione non ce l'ha.
 *
 * ⚠️ Quindi chi ha scelto «salto la cena» dovrebbe ricevere colazione, spuntino e pranzo, e riceve
 * **il solo pranzo**. Questo script lo dice cliente per cliente, con nome ed email, confrontando i
 * pasti che la finestra promette con quelli che restano davvero.
 *
 * ## Parte 2 — le varianti
 *
 * Una famiglia (nome + stile) si declina su 3 regimi × 2 obiettivi × 3 strutture pasti = 18. Per
 * ognuna si stampa se esiste, se è approvata e quante settimane di giornate ha.
 *
 * E soprattutto si divide quello che manca in due mucchi molto diversi:
 *
 *  - **riempibile subito, senza AI**: manca solo la struttura pasti, e una variante sorella con lo
 *    stesso nome+stile+regime+obiettivo ha già le ricette. È il caso che il generatore stesso
 *    dichiara («le tre varianti di struttura CONDIVIDONO le ricette»);
 *  - **da generare con l'AI**: manca il REGIME o l'OBIETTIVO. Lì non si può riciclare niente —
 *    mettere una ricetta onnivora in una dieta vegana è l'errore che il generatore evita apposta, e
 *    servire un mantenimento con porzioni da dimagrimento è la stessa cosa in versione silenziosa.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:digiuni
 */
import { PrismaClient } from '@prisma/client';
import { FINESTRE_DIGIUNO, slotEsclusiTotali } from '../src/menu/finestre-digiuno';
import { pickDietFor } from '../src/catalog/pick-diet';
import { pastiAttesi, NOME_PASTO } from '../src/catalog/giornate-complete';

const prisma = new PrismaClient();

const GIORNI_SETTIMANA = 7;
const REGIMI = ['omnivore', 'vegetarian', 'vegan'] as const;
const OBIETTIVI = ['dimagrimento', 'mantenimento'] as const;
/** Le tre strutture pasti della griglia, come le chiama il backoffice. */
const STRUTTURE = ['3', '5', 'fasting'] as const;

const TUTTI_GLI_SLOT = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];

/** Come si chiama questa cliente: il nome del profilo, poi quello dell'utente. Come `diag:cliente`. */
const nomeDi = (p: { name?: string | null; user?: { firstName?: string | null; lastName?: string | null } | null }): string =>
  p.name?.trim() || `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim() || '(senza nome)';

const inItaliano = (slots: string[]): string =>
  slots.length ? slots.map((s) => NOME_PASTO[s] ?? s).join(', ') : '— NIENTE —';

type DietaRiga = {
  id: string;
  name: string;
  style: string | null;
  regime: string;
  objective: string | null;
  mealsPerDay: number;
  fasting: boolean | null;
  status: string;
};

/** La struttura pasti di una riga `Diet`, nei termini della griglia. */
const strutturaDi = (d: { mealsPerDay: number; fasting: boolean | null }): string =>
  d.fasting ? 'fasting' : String(d.mealsPerDay);

// ─────────────────────────────────────────────────────────────────────────────
// Parte 1 — i digiuni
// ─────────────────────────────────────────────────────────────────────────────

async function digiuni(diete: DietaRiga[]): Promise<void> {
  console.log('\n════════ 1. CHI HA SCELTO IL DIGIUNO, E COSA RICEVE ════════\n');

  const profili = (await prisma.clientProfile.findMany({
    where: { pathType: 'intermittent_fasting' } as never,
    select: {
      userId: true, name: true, regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
      objective: true, pathType: true, fastingWindow: true, pastiEsclusi: true,
      // ⚠️ `User` non ha un campo `name`: ha `firstName` e `lastName`. Il nome «buono» è quello
      // scritto sul profilo (`ClientProfile.name`), e si ripiega sui due dell'utente — è lo stesso
      // ordine che usa `diag:cliente`, e due diagnostiche che chiamano la stessa persona in due modi
      // diversi costringono chi legge a capire quale delle due ha ragione.
      user: { select: { email: true, firstName: true, lastName: true } },
    } as never,
  })) as unknown as {
    userId: string; name: string | null; regime: string | null; dietStyle: string | null;
    dietFamily: string | null; mealsPerDay: number | null; objective: string | null;
    pathType: string | null; fastingWindow: string | null; pastiEsclusi: string[] | null;
    user: { email: string | null; firstName: string | null; lastName: string | null } | null;
  }[];

  if (!profili.length) {
    console.log('Nessuna cliente in digiuno intermittente. (Il difetto resta, ma oggi non tocca nessuno.)');
    return;
  }

  const perFinestra = new Map<string, number>();
  const rotte: Record<string, string>[] = [];
  const sane: Record<string, string>[] = [];

  for (const p of profili) {
    const finestra = p.fastingWindow ?? '(non impostata)';
    perFinestra.set(finestra, (perFinestra.get(finestra) ?? 0) + 1);

    // La dieta che il motore servirebbe ADESSO: stessa funzione dell'erogazione, nessuna copia.
    const servita = await pickDietFor<DietaRiga>(
      async (where) =>
        (await prisma.diet.findFirst({
          where: where as never,
          orderBy: { approvedAt: 'desc' },
          select: { id: true, name: true, style: true, regime: true, objective: true, mealsPerDay: true, fasting: true, status: true },
        })) as DietaRiga | null,
      p,
    );

    const esclusi = slotEsclusiTotali(p.pathType, p.fastingWindow, p.pastiEsclusi);
    // Quello che la finestra PROMETTE: tutti i pasti meno quelli che dice di saltare.
    const promessi = TUTTI_GLI_SLOT.filter((s) => !esclusi.has(s));
    // Quello che il catalogo può davvero servire: i pasti della dieta servita, meno gli esclusi.
    const inCatalogo = servita ? pastiAttesi(servita) : [];
    const ricevuti = inCatalogo.filter((s) => !esclusi.has(s));

    const riga = {
      cliente: `${nomeDi(p)} · ${p.user?.email ?? '—'}`,
      finestra,
      'dovrebbe ricevere': inItaliano(promessi),
      'riceve davvero': inItaliano(ricevuti),
      'dieta servita': servita ? `${servita.name} · ${servita.regime} · ${strutturaDi(servita)}` : '⚠️ NESSUNA',
    };
    const mancanti = promessi.filter((s) => !ricevuti.includes(s));
    if (mancanti.length) rotte.push({ ...riga, mancano: inItaliano(mancanti) });
    else sane.push(riga);
  }

  console.log(`Clienti in digiuno: ${profili.length}\n`);
  console.log('Per finestra scelta:');
  for (const f of FINESTRE_DIGIUNO) {
    const n = perFinestra.get(f.valore) ?? 0;
    console.log(`${String(n).padStart(6)}  ${f.etichettaStaff}`);
  }
  const senza = perFinestra.get('(non impostata)') ?? 0;
  if (senza) console.log(`${String(senza).padStart(6)}  ⚠️ finestra non impostata (i pasti li decide la dieta)`);

  if (rotte.length) {
    console.log(`\n⚠️ ${rotte.length} client${rotte.length === 1 ? 'e riceve' : 'i ricevono'} MENO pasti di quelli che la finestra promette:\n`);
    console.table(rotte);
    console.log(
      '\nNon è un arrotondamento: il catalogo `fasting` ha solo pranzo, merenda e cena, e la finestra\n' +
      'toglie da lì. Chi salta la cena resta col solo pranzo — un pasto al giorno.',
    );
  } else {
    console.log('\n✅ Nessuna cliente riceve meno pasti di quelli promessi dalla sua finestra.');
  }
  if (sane.length) {
    console.log(`\n${sane.length} client${sane.length === 1 ? 'e riceve' : 'i ricevono'} i pasti giusti:`);
    console.table(sane);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parte 2 — le 18 varianti
// ─────────────────────────────────────────────────────────────────────────────

async function varianti(diete: DietaRiga[]): Promise<void> {
  console.log('\n\n════════ 2. LE 18 VARIANTI, FAMIGLIA PER FAMIGLIA ════════\n');

  // Settimane di catalogo per dieta: il giorno più alto fra le giornate, come le conta il generatore.
  const perDieta = new Map<string, number>();
  for (const d of diete) {
    const ultimo = (await prisma.dietDayTemplate.findFirst({
      where: { dietId: d.id },
      orderBy: { dayIndex: 'desc' },
      select: { dayIndex: true },
    })) as { dayIndex: number } | null;
    perDieta.set(d.id, Math.ceil((ultimo?.dayIndex ?? 0) / GIORNI_SETTIMANA));
  }

  // Quante clienti stanno su ogni famiglia: è l'ordine in cui conviene lavorare.
  const clientiPerFamiglia = new Map<string, number>();
  const profili = (await prisma.clientProfile.findMany({
    select: { dietFamily: true },
  })) as unknown as { dietFamily: string | null }[];
  for (const p of profili) {
    if (!p.dietFamily) continue;
    clientiPerFamiglia.set(p.dietFamily, (clientiPerFamiglia.get(p.dietFamily) ?? 0) + 1);
  }

  const famiglie = new Map<string, DietaRiga[]>();
  for (const d of diete) {
    const k = `${d.name} ${d.style ?? ''}`;
    if (!famiglie.has(k)) famiglie.set(k, []);
    famiglie.get(k)!.push(d);
  }

  let totRiempibili = 0;
  let totDaGenerare = 0;

  const ordinate = [...famiglie.entries()].sort(
    (a, b) => (clientiPerFamiglia.get(b[1][0].name) ?? 0) - (clientiPerFamiglia.get(a[1][0].name) ?? 0),
  );

  for (const [, righe] of ordinate) {
    const nome = righe[0].name;
    const stile = righe[0].style ?? '—';
    console.log(`\n── ${nome} (${stile}) · ${clientiPerFamiglia.get(nome) ?? 0} clienti ──`);

    const tabella: Record<string, string>[] = [];
    let riempibili = 0;
    let daGenerare = 0;

    for (const regime of REGIMI) {
      for (const objective of OBIETTIVI) {
        // Il «gruppo ricette» del generatore: nome + stile + regime + obiettivo, SENZA la struttura.
        const sorelle = righe.filter((d) => d.regime === regime && (d.objective ?? 'dimagrimento') === objective);
        const settimaneMax = Math.max(0, ...sorelle.map((d) => perDieta.get(d.id) ?? 0));
        const gruppoHaRicette = settimaneMax > 0;

        for (const struttura of STRUTTURE) {
          const esistente = sorelle.find((d) => strutturaDi(d) === struttura) ?? null;
          const sett = esistente ? (perDieta.get(esistente.id) ?? 0) : 0;
          let stato: string;
          if (esistente && sett >= 12 && esistente.status === 'approved') stato = '✅ completa';
          else if (esistente) stato = `${esistente.status} · ${sett}/12 settimane`;
          else if (gruppoHaRicette) { stato = `➕ manca — RIEMPIBILE (le sorelle hanno ${settimaneMax} sett.)`; riempibili++; }
          else { stato = '🤖 manca — serve l\'AI (nessuna ricetta per questo regime/obiettivo)'; daGenerare++; }

          tabella.push({ regime, obiettivo: objective, pasti: struttura, stato });
        }
      }
    }
    console.table(tabella);
    console.log(`   riempibili senza AI: ${riempibili} · da generare con l'AI: ${daGenerare}`);
    totRiempibili += riempibili;
    totDaGenerare += daGenerare;
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`TOTALE su ${famiglie.size} famiglie:`);
  console.log(`  ${String(totRiempibili).padStart(5)}  varianti riempibili SUBITO, senza una chiamata all'AI`);
  console.log(`  ${String(totDaGenerare).padStart(5)}  varianti che richiedono di generare ricette nuove`);
  console.log(
    '\nLe seconde costano: il generatore fa una settimana per volta, un pasto per volta. Prima di\n' +
    'spenderle vale la pena guardare la prima tabella — quante clienti stanno davvero su quel\n' +
    'regime e su quell\'obiettivo.',
  );
}

async function main(): Promise<void> {
  console.log('\n=== Metabole — digiuni serviti e griglia delle varianti (sola lettura) ===');

  const diete = (await prisma.diet.findMany({
    where: { status: { not: 'rejected' } } as never,
    select: {
      id: true, name: true, style: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true,
    },
    orderBy: [{ name: 'asc' }, { regime: 'asc' }],
  })) as unknown as DietaRiga[];

  await digiuni(diete);
  await varianti(diete);

  console.log('\nFine. Questo script non ha scritto niente.\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore:', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
