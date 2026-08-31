/**
 * ⛔ **«HO SALVATO E NON CAMBIA NIENTE»: LA RICHIESTA È MAI ARRIVATA?**
 *
 * Il 31/8, due volte in mezza giornata: Simone cambia la dieta di una cliente dalla scheda, poi la
 * nutrizionista prova a spostarla da «Mediterranea senza glutine» a Keto — e `diag:cliente`
 * continua a leggere la famiglia vecchia. Nessuno dei due sa dire se sia comparso un errore.
 *
 * ⚠️ **Il codice, letto riga per riga, dice che non può succedere in silenzio**: il campo è nel DTO,
 * è nella whitelist del servizio, è nel corpo che manda la pagina, e se il permesso manca la rotta
 * risponde **403 con un messaggio**. Quindi delle due l'una — e finché non si sa quale, qualunque
 * correzione è una scommessa.
 *
 * Questa diagnostica guarda il **registro**, che è l'unico posto dove la differenza si vede:
 *
 *  · **c'è una riga `client.update`** con dentro il campo → la scrittura è partita, e allora il
 *    valore è stato **disfatto dopo**: si guarda cosa gira dopo il salvataggio;
 *  · **c'è una riga, ma senza quel campo** → la richiesta è arrivata monca: il problema è nella
 *    pagina, non nel servizio;
 *  · **non c'è nessuna riga** → la richiesta non è mai arrivata al servizio: 403, 400, o non è
 *    proprio partita. Il messaggio l'ha visto solo chi stava davanti allo schermo.
 *
 * ⚠️ **Non prova niente sul perché**: dice **dove** guardare, che è la domanda che oggi ci è costata
 * mezza giornata. *Misurare prima di decidere.*
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:salvataggi-scheda -- cliente@esempio.it
 *   GIORNI=3 npm run diag:salvataggi-scheda -- cliente@esempio.it
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** I campi del «tipo di dieta»: gli stessi che il servizio protegge col permesso. */
const CAMPI_DIETA = ['regime', 'dietStyle', 'dietFamily', 'pathType', 'mealsPerDay'] as const;
/** La riga che il servizio scrive SOLO quando il tipo di dieta è cambiato davvero. */
const AZIONE_DIETA = 'client.diet_type.change';

const quando = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

async function main(): Promise<void> {
  const email = (process.argv.slice(2).join(' ') || '').trim().toLowerCase();
  if (!email) {
    console.log('Indica l\'email:  npm run diag:salvataggi-scheda -- nome@esempio.it');
    return;
  }
  const giorni = Number(process.env.GIORNI ?? 1) || 1;

  const user = (await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } } as never,
    select: { id: true, email: true, firstName: true, lastName: true },
  })) as { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  if (!user) {
    console.log(`Nessuna cliente con l'email «${email}».`);
    return;
  }

  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: Object.fromEntries(CAMPI_DIETA.map((k) => [k, true])) as never,
  })) as Record<string, unknown> | null;

  console.log(`\n=== ${`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email} ===`);
  console.log('Nel database ADESSO:');
  console.table([Object.fromEntries(CAMPI_DIETA.map((k) => [k, profilo?.[k] ?? '—']))]);

  const da = new Date(Date.now() - giorni * 86_400_000);
  const righe = (await prisma.auditLog.findMany({
    where: { entityId: user.id, createdAt: { gte: da } } as never,
    select: { action: true, actorId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })) as { action: string; actorId: string | null; metadata: unknown; createdAt: Date }[];

  if (!righe.length) {
    console.log(
      `\n⛔ NESSUNA riga di registro su questa cliente nelle ultime ${giorni * 24} ore.\n`
      + '   Se qualcuno ha salvato la scheda in questo periodo, la richiesta NON è arrivata al\n'
      + '   servizio: 403, 400, o non è proprio partita. Il messaggio l\'ha visto solo chi era\n'
      + '   davanti allo schermo — ed è quello il dato che manca.',
    );
    console.log('');
    return;
  }

  const attori = (await prisma.user.findMany({
    where: { id: { in: [...new Set(righe.map((r) => r.actorId).filter(Boolean))] as string[] } } as never,
    select: { id: true, email: true, role: true },
  })) as { id: string; email: string; role: string }[];
  const chi = (id: string | null) => {
    const a = attori.find((x) => x.id === id);
    return a ? `${a.email} (${a.role})` : id ?? '—';
  };

  console.log(`\nRegistro delle ultime ${giorni * 24} ore (${righe.length} righe):`);
  console.table(righe.map((r) => ({ quando: quando(r.createdAt), azione: r.action, chi: chi(r.actorId) })));

  /**
   * ⛔ **La domanda vera**: fra queste righe ce n'è una che ha toccato il tipo di dieta? Il servizio
   * scrive `before`/`after` nel `metadata`, quindi qui non si indovina: si legge cosa ha scritto lui.
   */
  /**
   * ⚠️ **La riga giusta si chiama per nome.** Il servizio, quando il tipo di dieta cambia davvero,
   * scrive una riga **dedicata** — `client.diet_type.change` — con dentro `before`/`after`. Cercare
   * i nomi dei campi dentro il metadata di `client.update` risponderebbe anche quando è cambiato
   * tutt'altro: quella riga elenca i campi toccati in un formato suo.
   */
  const dieta = righe.filter((r) => r.action === AZIONE_DIETA);
  const salvataggi = righe.filter((r) => r.action === 'client.update').length;

  if (!dieta.length) {
    console.log(
      `\n⛔ NESSUNA riga «${AZIONE_DIETA}», e di salvataggi della scheda ce ne sono ${salvataggi}.\n`
      + '   Il servizio scrive quella riga ogni volta che uno dei cinque campi cambia davvero.\n'
      + '   Quindi: o la scheda è stata salvata senza toccare il tipo di dieta, oppure il campo\n'
      + '   ⚠️ ARRIVA MONCO — parte dalla pagina e si perde prima del confronto. Il posto da\n'
      + '   guardare è il corpo che manda il browser, non il servizio.\n'
      + '   ⛔ E se i salvataggi sono ZERO mentre qualcuno stava salvando, la richiesta non è mai\n'
      + '   arrivata: 403 o 400, col messaggio visto solo da chi era davanti allo schermo.'
    );
  } else {
    console.log('\n✅ Il tipo di dieta È STATO scritto almeno una volta. Prima → dopo:');
    for (const r of dieta) {
      const m = (r.metadata ?? {}) as { prima?: Record<string, unknown>; before?: Record<string, unknown>; dopo?: Record<string, unknown>; after?: Record<string, unknown> };
      const prima = m.prima ?? m.before ?? {};
      const dopo = m.dopo ?? m.after ?? {};
      console.log(`\n· ${quando(r.createdAt)} — ${r.action} — ${chi(r.actorId)}`);
      console.table(
        CAMPI_DIETA.map((k) => ({ campo: k, prima: (prima as Record<string, unknown>)[k] ?? '—', dopo: (dopo as Record<string, unknown>)[k] ?? '—' })),
      );
    }
    console.log(
      '\n⚠️ Se il «dopo» dice il valore giusto ma il database adesso dice quello vecchio, la scrittura\n'
      + '   è partita ed è stata DISFATTA dopo: il posto da guardare è quello che gira dopo il\n'
      + '   salvataggio, non il salvataggio.',
    );
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
