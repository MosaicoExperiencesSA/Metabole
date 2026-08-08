/**
 * DIETE CHE EROGANO GIORNATE MONCHE — e le clienti che le stanno ricevendo.
 *
 * Nasce da una riga della compattazione del 9/8:
 *
 *     Vacanze in Serenità · omnivore · dimagrimento · 3 pasti → 'colaz. 5 · pranzo 0 · cena 0'
 *
 * Ventotto giornate erogate, **zero pranzi e zero cene**, e la dieta risulta «approved ·
 * visibile». Non è un problema di conteggio o di varietà: è una persona che apre l'app all'ora
 * di pranzo e non trova niente. E nessun controllo se n'era accorto, perché il gate di
 * pubblicazione guarda gli allergeni e i gruppi di equivalenza — cose serie — ma **non guarda
 * se nel menu c'è da mangiare**.
 *
 * Questo comando cerca tutte le diete nella stessa condizione e, per ognuna, chi la sta
 * ricevendo davvero: il legame non è il profilo della cliente (che dice solo che tipo di dieta
 * preferisce) ma le giornate già consegnate, `menu_day.diet_id`. Quelle sono le persone che
 * hanno il problema in mano adesso.
 *
 * USO (shell di Render, dentro la cartella del backend):
 *   npm run diag:menu-incompleti
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLOT_5 = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
const SLOT_3 = ['breakfast', 'lunch', 'dinner'];
const SLOT_FASTING = ['lunch', 'afternoon_snack', 'dinner'];

const NOME_PASTO: Record<string, string> = {
  breakfast: 'colazione', morning_snack: 'spuntino', lunch: 'pranzo',
  afternoon_snack: 'merenda', dinner: 'cena',
};

async function main(): Promise<void> {
  const diete = (await prisma.diet.findMany({
    where: { status: { not: 'rejected' } } as never,
    select: {
      id: true, name: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true, clientVisible: true,
    },
    orderBy: [{ name: 'asc' }],
  })) as {
    id: string; name: string; regime: string; objective: string | null;
    mealsPerDay: number; fasting: boolean | null; status: string; clientVisible: boolean;
  }[];

  const guaste: {
    d: (typeof diete)[number];
    mancanti: string[];
    giorni: number;
    giorniMonchi: number;
  }[] = [];

  for (const d of diete) {
    const slots = d.fasting ? SLOT_FASTING : d.mealsPerDay === 5 ? SLOT_5 : SLOT_3;
    const templates = (await prisma.dietDayTemplate.findMany({
      where: { dietId: d.id },
      select: { meals: true },
    })) as { meals: unknown }[];
    if (templates.length === 0) continue;

    // Un pasto è "mancante" se NESSUNA giornata lo prevede: è il caso grave, la dieta non ha
    // proprio quel pasto. `giorniMonchi` conta invece le singole giornate a cui manca qualcosa.
    const presenti = new Set<string>();
    let monchi = 0;
    for (const t of templates) {
      const suoi = new Set(
        (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])
          .filter((m) => m.slot && m.recipeId)
          .map((m) => m.slot as string),
      );
      for (const s of suoi) presenti.add(s);
      if (!slots.every((s) => suoi.has(s))) monchi += 1;
    }
    const mancanti = slots.filter((s) => !presenti.has(s));
    if (mancanti.length === 0 && monchi === 0) continue;
    guaste.push({ d, mancanti, giorni: templates.length, giorniMonchi: monchi });
  }

  if (guaste.length === 0) {
    console.log('Nessuna dieta con giornate monche ✓ Tutte hanno tutti i pasti previsti.');
    return;
  }

  console.log(`Diete con giornate incomplete: ${guaste.length}\n`);
  const tabella: Record<string, unknown>[] = [];

  for (const g of guaste) {
    // Chi la sta ricevendo: le giornate già consegnate sono la prova, non il profilo.
    const righe = (await prisma.menuDay.findMany({
      where: { dietId: g.d.id },
      select: { clientId: true, date: true },
      orderBy: { date: 'desc' },
      take: 2000,
    })) as { clientId: string; date: Date }[];
    const perCliente = new Map<string, Date>();
    for (const r of righe) if (!perCliente.has(r.clientId)) perCliente.set(r.clientId, r.date);

    const utenti = perCliente.size
      ? ((await prisma.user.findMany({
          where: { id: { in: [...perCliente.keys()] }, deletedAt: null } as never,
          select: { id: true, email: true, firstName: true, lastName: true },
        })) as { id: string; email: string; firstName: string | null; lastName: string | null }[])
      : [];

    tabella.push({
      dieta: `${g.d.name} · ${g.d.regime} · ${g.d.objective ?? '—'} · ${g.d.fasting ? 'digiuno' : `${g.d.mealsPerDay} pasti`}`,
      stato: g.d.status + (g.d.clientVisible ? ' · VISIBILE' : ' · nascosta'),
      giorni: g.giorni,
      'giornate monche': g.giorniMonchi,
      'pasti che non esistono': g.mancanti.map((s) => NOME_PASTO[s] ?? s).join(', ') || '—',
      clienti: utenti.length,
    });

    if (utenti.length) {
      console.log(`⚠️  ${g.d.name} · ${g.d.regime} · ${g.d.objective ?? '—'} · ${g.d.fasting ? 'digiuno' : `${g.d.mealsPerDay} pasti`}`);
      if (g.mancanti.length) {
        console.log(`    NON HA: ${g.mancanti.map((s) => NOME_PASTO[s] ?? s).join(', ')} — chi la riceve resta senza quei pasti.`);
      }
      for (const u of utenti) {
        const nome = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '(senza nome)';
        console.log(`    · ${nome} · ${u.email} · ultimo menu ${perCliente.get(u.id)?.toISOString().slice(0, 10)}`);
      }
      console.log('');
    }
  }

  console.table(tabella);
  console.log(
    'Che cosa fare, in ordine:\n' +
    '1. Le diete con CLIENTI e con pasti mancanti sono la prima cosa: o si generano i pasti che\n' +
    '   mancano (schermo 15, la variante giusta), o si sposta la cliente su una variante sana\n' +
    '   della stessa famiglia dalla sua scheda.\n' +
    '2. Le diete senza clienti si possono lasciare lì: da oggi il gate non le rende più visibili\n' +
    '   finché le giornate non sono complete, quindi non ne arriveranno altre in questo stato.\n' +
    '3. «giornate monche» senza «pasti che non esistono» = il pasto c\'è ma non in tutti i giorni:\n' +
    '   meno grave, si sistema completando la settimana.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
