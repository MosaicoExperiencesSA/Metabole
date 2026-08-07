/**
 * ELENCO PER LA NUTRIZIONISTA: chi ha una famiglia di dieta che **nessuno ha scelto**.
 *
 * Fino al 7/8 la registrazione salvava solo lo STILE, e lo stile raggruppa famiglie diverse:
 * `mediterranean` tiene insieme Mediterranea, Mediterranea ipocalorica e Pescetariana;
 * `flexible` tiene insieme Vegana, Vegetariana, Flexitariana e Flessibile. Fra quelle, il motore
 * ne prendeva una sola — **la più recente ad essere approvata**, non la più adatta. Il primo
 * backfill (`fix:diet-family`) ha fissato quella, che è la cosa giusta da fare per non cambiare
 * la dieta a nessuna dall'oggi al domani, ma non la rende una scelta: la rende solo visibile.
 *
 * Il caso concreto che ha fatto scrivere questo script: cinque clienti che avevano chiesto
 * «mediterranea» stanno ricevendo **Pescetariana**, cioè menu senza carne. Nessuna di loro l'ha
 * chiesto e nessuno gliel'ha proposto.
 *
 * Qui si elencano SOLO i casi ambigui — quelli in cui, per quello stile, di famiglie approvate e
 * visibili ce n'è più di una — con le alternative accanto. Chi ha uno stile con una famiglia
 * sola (keto, proteica, keto-mediterranea…) non compare: non c'era niente da scegliere.
 *
 * Non tocca niente. La correzione si fa dalla **scheda cliente**, campo tipo di dieta
 * (permesso «Cambia tipo di dieta»): cambiare la famiglia lì fa ripartire l'abbinamento dal
 * prodotto giusto al prossimo ciclo di menu.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:famiglie
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Dieta = { name: string; style: string; clientName: string | null };

async function main(): Promise<void> {
  // Famiglie disponibili per stile: solo diete approvate e visibili al cliente, cioè quelle
  // fra cui il motore può davvero scegliere.
  const diete = (await prisma.diet.findMany({
    where: { status: 'approved', clientVisible: true } as never,
    select: { name: true, style: true, clientName: true },
  })) as Dieta[];

  const perStile = new Map<string, Set<string>>();
  const nomeCliente = new Map<string, string>();
  for (const d of diete) {
    if (!perStile.has(d.style)) perStile.set(d.style, new Set());
    perStile.get(d.style)!.add(d.name);
    if (d.clientName && !nomeCliente.has(d.name)) nomeCliente.set(d.name, d.clientName);
  }

  const profili = (await prisma.clientProfile.findMany({
    where: { dietFamily: { not: null } } as never,
    select: { userId: true, name: true, dietStyle: true, dietFamily: true },
  })) as { userId: string; name: string | null; dietStyle: string | null; dietFamily: string | null }[];

  if (profili.length === 0) {
    console.log('Nessun profilo con una famiglia impostata: lancia prima  npm run fix:diet-family');
    return;
  }

  const emails = (await prisma.user.findMany({
    where: { id: { in: profili.map((p) => p.userId) } },
    select: { id: true, email: true },
  })) as { id: string; email: string }[];
  const emailDi = new Map(emails.map((u) => [u.id, u.email]));

  const righe: { cliente: string; email: string; stile: string; 'riceve ora': string; alternative: string }[] = [];
  for (const p of profili) {
    const stile = p.dietStyle ?? '';
    const famiglie = perStile.get(stile);
    if (!famiglie || famiglie.size <= 1) continue; // niente da scegliere: non è un caso ambiguo
    const altre = [...famiglie].filter((f) => f !== p.dietFamily);
    if (altre.length === 0) continue;
    righe.push({
      cliente: p.name ?? '(senza nome)',
      email: emailDi.get(p.userId) ?? '—',
      stile,
      'riceve ora': nomeCliente.get(p.dietFamily ?? '') ?? p.dietFamily ?? '—',
      alternative: altre.map((f) => nomeCliente.get(f) ?? f).join(' · '),
    });
  }

  if (righe.length === 0) {
    console.log(`Esaminati ${profili.length} profili: nessuna famiglia ambigua ✓`);
    console.log('(Ogni cliente ha uno stile con una sola famiglia approvata: non c\'era niente da scegliere.)');
    return;
  }

  // Raggruppate per stile: si rivedono meglio a blocchi che a caso.
  righe.sort((a, b) => (a.stile + a['riceve ora']).localeCompare(b.stile + b['riceve ora']));
  console.log(`Esaminati ${profili.length} profili con una famiglia impostata.`);
  console.log(`\n--- DA RIVEDERE: ${righe.length} (lo stile aveva più famiglie, ne è stata fissata una) ---`);
  console.table(righe);
  console.log(
    '\nQueste famiglie non le ha scelte nessuno: fino al 7/8 il motore prendeva la dieta più\n' +
    'recente fra quelle dello stesso stile. Si correggono dalla scheda cliente, campo tipo di\n' +
    'dieta (permesso «Cambia tipo di dieta»): al ciclo di menu successivo riparte dal prodotto\n' +
    'giusto. Chi va bene così non va toccata — è comunque la dieta che sta già seguendo.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
