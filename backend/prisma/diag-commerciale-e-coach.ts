/**
 * ⛔ **«LA COACH È LA COMMERCIALE»: IL PERIMETRO CHE C'È GIÀ REGGE, O LE TOGLIE IL LAVORO?**
 *
 * Simone, 28/8, dopo che `diag:titolare-lead` ha detto che il titolare del lead è vuoto su tutte e
 * 86325 le schede CRM: *«è la coach la commerciale di riferimento, la coach ha un doppio ruolo»*.
 * Quindi il campo di assegnazione da inventare non serve: esiste, si chiama `assignedCoachId`, ed è
 * quello su cui il perimetro della coach lavora dall'11/8.
 *
 * ⛔ **Ma «prende il perimetro coach» non è una riga**, e questa diagnostica esiste per non farlo
 * credere a nessuno — me compreso, che l'avevo scritto:
 *
 *  1. **La strada ovvia darebbe la cosa sbagliata.** `coachTeamScope` risponde «solo le sue»
 *     (`[staff.id]`) **solo se il ruolo è letteralmente `coach`**; a chiunque altro passi di lì dà
 *     `reteSottoDiMe`, cioè **la rete sotto di lei**. ⚠️ E non è un caso di scuola: nei default il
 *     ruolo `sales` ha `assign_coach` con l'etichetta «Resp. Coach Team: assegna le coach». Se la
 *     sua scheda è il `managerId` delle coach, «le sue» sono **zero** e «la rete sotto» è **tutte**.
 *     Perciò qui sotto, per il commerciale, si stampano **tutti e due** i numeri.
 *  2. **I cancelli sono due, nello stesso file.** `perimetroClienti` decide quali schede si aprono;
 *     `RUOLI_CHE_VEDONO_TUTTE` — che nomina `sales` — decide **alert**, **analytics** e la
 *     **dashboard**. Toccarne uno solo chiude metà cancello.
 *
 * ⚠️ **E la casella «Clienti» non è la porta che sembra.** In tutto il backend **non esiste** un
 * `@RequirePage('clients')`: `admin/clients` è protetto dal solo elenco dei ruoli, e `sales` c'è
 * dentro. Quindi quella casella governa la **voce di menu**, non l'API: con la casella spenta la
 * scheda clinica resta leggibile e scrivibile via API. La colonna qui sotto va letta così.
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:commerciale-e-coach
 */
import { PrismaClient } from '@prisma/client';
import { reteSottoDiMe } from '../src/common/rete-staff';
import { DEFAULT_PERMISSIONS, PageKey } from '../src/permissions/pages';
import type { Role } from '../src/common/roles';

const prisma = new PrismaClient();

/** I ruoli che hanno (o dovrebbero avere) un perimetro sulle clienti. */
const RUOLI_IN_ESAME = ['sales', 'coach', 'coach_coordinator', 'nutritionist'] as const;

/** I due permessi che decidono se una commerciale arriva alla scheda e ci cambia la dieta. */
const CHIAVI = ['clients', 'change_diet_type'] as const;

/**
 * ⚠️ **Le clienti si contano come le conta il backoffice**, o i due numeri non si possono
 * confrontare — ma con una differenza che va detta invece che nascosta: `ClientsService` conta gli
 * **utenti** con ruolo `client` e non cancellati, mentre il perimetro filtra su `ClientProfile`.
 * Una cliente **senza scheda profilo** esiste (la crea l'onboarding, non la registrazione) e non
 * entra in **nessun** perimetro: sotto si stampano tutti e tre i numeri.
 */
const CLIENTE_VIVA = { user: { role: 'client', deletedAt: null } };

async function main(): Promise<void> {
  const conti = (await prisma.user.findMany({
    where: { role: { in: RUOLI_IN_ESAME as unknown as string[] }, deletedAt: null } as never,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, customRoleKey: true, status: true, linkedUserId: true,
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })) as {
    id: string; email: string; firstName: string | null; lastName: string | null;
    role: string; customRoleKey: string | null; status: string; linkedUserId: string | null;
  }[];

  const schede = (await prisma.staff.findMany({
    where: { userId: { in: conti.map((c) => c.id) } } as never,
    select: { id: true, userId: true, displayName: true, active: true },
  })) as { id: string; userId: string; displayName: string | null; active: boolean }[];

  /**
   * ⚠️ Due `groupBy` invece di un `count` per persona: le righe arrivano tutte in due query, e i
   * numeri della tabella e quelli del verdetto vengono dalla **stessa** lettura.
   */
  const perCoach = (await prisma.clientProfile.groupBy({
    by: ['assignedCoachId'], where: CLIENTE_VIVA, _count: { _all: true },
  } as never)) as unknown as { assignedCoachId: string | null; _count: { _all: number } }[];
  const perNutrizionista = (await prisma.clientProfile.groupBy({
    by: ['assignedNutritionistId'], where: CLIENTE_VIVA, _count: { _all: true },
  } as never)) as unknown as { assignedNutritionistId: string | null; _count: { _all: number } }[];

  const coachDi = new Map<string, number>();
  for (const r of perCoach) if (r.assignedCoachId) coachDi.set(r.assignedCoachId, r._count._all);
  const nutriDi = new Map<string, number>();
  for (const r of perNutrizionista) if (r.assignedNutritionistId) nutriDi.set(r.assignedNutritionistId, r._count._all);

  const somma = (m: Map<string, number>, ids: string[]): number =>
    ids.reduce((n, id) => n + (m.get(id) ?? 0), 0);

  const clientiUtenti = await prisma.user.count({ where: { role: 'client', deletedAt: null } as never });
  const clientiConScheda = await prisma.clientProfile.count({ where: CLIENTE_VIVA as never });
  const senzaCoach = perCoach.find((r) => r.assignedCoachId === null)?._count._all ?? 0;

  /**
   * ⛔ **Il permesso si LEGGE, e quando la riga non c'è vale il DEFAULT DEL CODICE** — è quello che
   * fanno sia il `PageGuard` sia `ruoloPuo`. Stampare «nessuna riga» e fermarsi lì direbbe «non ce
   * l'ha» a un ruolo che invece ce l'ha: `change_diet_type` è `manage` di default per la coach.
   *
   * ⚠️ E le righe sono **due**, non una: le guardie lato server cercano il **ruolo di sistema**,
   * mentre il menu del backoffice (`/me/permissions`) usa `customRoleKey` quando c'è. Un ruolo
   * personalizzato può avere il menu acceso e l'API no, o il contrario.
   */
  const righePermessi = (await prisma.rolePagePermission.findMany({
    where: { pageKey: { in: CHIAVI as unknown as string[] } } as never,
    select: { role: true, pageKey: true, canView: true, canManage: true },
  })) as { role: string; pageKey: string; canView: boolean; canManage: boolean }[];

  function permesso(chiaveRuolo: string, pagina: string, ruoloDiSistema: string): string {
    const r = righePermessi.find((p) => p.role === chiaveRuolo && p.pageKey === pagina);
    if (r) return r.canManage ? 'sì (gestisce)' : r.canView ? 'solo lettura' : 'NO';
    const def = DEFAULT_PERMISSIONS[ruoloDiSistema as Role]?.[pagina as PageKey];
    const vale = def?.manage ? 'sì (gestisce)' : def?.view ? 'solo lettura' : 'NO';
    return `${vale} — dal default`;
  }

  const tabella: Record<string, unknown>[] = [];
  for (const c of conti) {
    const scheda = schede.find((s) => s.userId === c.id);
    const rete = scheda && (c.role === 'coach_coordinator' || c.role === 'sales')
      ? await reteSottoDiMe(prisma as never, scheda.id)
      : scheda ? [scheda.id] : [];
    /** ⚠️ Ogni ruolo sul campo che il perimetro usa DAVVERO per lui: la nutrizionista non ha clienti «come coach». */
    const sue = !scheda ? 0
      : c.role === 'nutritionist' ? (nutriDi.get(scheda.id) ?? 0)
        : (coachDi.get(scheda.id) ?? 0);
    const conRete = !scheda || c.role === 'nutritionist' ? sue : somma(coachDi, rete);
    tabella.push({
      chi: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || scheda?.displayName || c.email,
      ruolo: c.role + (c.customRoleKey ? ` (${c.customRoleKey})` : ''),
      stato: c.status,
      'scheda Staff': !scheda ? '⛔ NO' : scheda.active ? 'sì' : '⚠️ disattivata',
      'sue (campo del suo ruolo)': sue,
      'con la rete sotto': conRete === sue ? '=' : conRete,
      'Clienti (menu)': permesso(c.customRoleKey ?? c.role, 'clients', c.role),
      'Clienti (API)': permesso(c.role, 'clients', c.role),
      'tipo dieta (API)': permesso(c.role, 'change_diet_type', c.role),
    });
  }

  console.log('\n«La coach è la commerciale» — chi c\'è, da quale porta entra, e su quante clienti');
  console.table(tabella);
  console.log(
    `\nClienti: ${clientiUtenti} utenti vivi, di cui ${clientiConScheda} con una scheda profilo.`
    + `\n⚠️ Le ${clientiUtenti - clientiConScheda} senza scheda non entrano in NESSUN perimetro, in nessun verso.`
    + `\nCon una scheda ma senza coach assegnata: ${senzaCoach}.`,
  );
  console.log(
    '⚠️ «Clienti (API)» è quello che il PageGuard leggerebbe — ma su `admin/clients` non c\'è nessun'
    + '\n   `@RequirePage`, quindi oggi non lo legge nessuno: la scheda è raggiungibile via API con la'
    + '\n   casella spenta. La colonna «(menu)» è quella che decide se la voce compare nel backoffice.',
  );

  /**
   * ⛔ **La stessa persona con due account non è la stessa persona per il codice.** Se il commerciale
   * e la coach sono due utenti diversi, `assignedCoachId` punta alla scheda della coach e l'account
   * commerciale resta a zero anche se «è la stessa signora». Il campo che risponde è
   * `User.linkedUserId` («utenza collegata, stessa persona»), non il nome.
   */
  const collegati = conti.filter((c) => c.linkedUserId);
  if (collegati.length) {
    const altri = (await prisma.user.findMany({
      where: { id: { in: collegati.map((c) => c.linkedUserId as string) } } as never,
      select: { id: true, email: true, role: true },
    })) as { id: string; email: string; role: string }[];
    console.log('\n✅ Account dichiarati «stessa persona» (`linkedUserId`):');
    console.table(collegati.map((c) => {
      const altro = altri.find((x) => x.id === c.linkedUserId);
      return {
        account: c.email,
        ruolo: c.role,
        'collegato a': altro ? `${altro.email} (${altro.role})` : '— (utenza non trovata)',
      };
    }));
  } else {
    console.log(
      '\n⚠️ Nessuno di questi account è collegato a un altro con `linkedUserId`. Se la stessa persona'
      + '\n   ha due utenze, il codice non lo sa — e il «doppio ruolo» resta vero fuori e invisibile dentro.',
    );
  }

  const commerciali = conti.filter((c) => c.role === 'sales');
  if (!commerciali.length) {
    console.log(
      '\n⚠️ NESSUN ACCOUNT COMMERCIALE. Il perimetro non toglierebbe niente a nessuno OGGI, ma non è'
      + '\n   «senza rischio»: finché `RUOLI_CHE_VEDONO_TUTTE` nomina `sales` e `perimetroClienti` no,'
      + '\n   le due funzioni dello stesso file rispondono cose diverse sullo stesso ruolo.',
    );
  }

  for (const c of commerciali) {
    const scheda = schede.find((s) => s.userId === c.id);
    console.log(`\n— ${`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email} (${c.email})`);
    if (!scheda) {
      console.log(
        '  ⛔ NON HA UNA SCHEDA Staff. Con un perimetro appoggiato ad `assignedCoachId` vedrebbe ZERO'
        + '\n     clienti, sempre: senza scheda il perimetro diventa un id impossibile, di proposito.'
        + '\n     Prima la scheda, poi il cancello.',
      );
      continue;
    }
    const rete = await reteSottoDiMe(prisma as never, scheda.id);
    const sue = coachDi.get(scheda.id) ?? 0;
    const conRete = somma(coachDi, rete);
    console.log(
      `  Solo le sue: ${sue}. Con la rete sotto di lei (${rete.length} schede): ${conRete}.`
      + ` Su ${clientiConScheda} schede cliente.`,
    );
    if (sue === 0 && conRete > 0) {
      console.log(
        '  ⛔ ZERO COME COACH, MA LA RETE SOTTO NE HA. È il caso peggiore: la strada ovvia'
        + '\n     (aggiungerla ai ruoli «coach-like») le darebbe la RETE, cioè quasi tutte — un cancello'
        + '\n     che invece di stringere allarga. Il perimetro va scritto sul suo id, non sulla rete.',
      );
    } else if (sue === 0) {
      console.log(
        `  ⛔ HA LA SCHEDA MA ZERO CLIENTI ASSEGNATE (su ${clientiConScheda}). Col perimetro non ne`
        + '\n     vedrebbe nessuna: non è limitarla, è toglierle il lavoro. Vuol dire che le clienti'
        + '\n     hanno come coach un ALTRO account — e allora la domanda è quale dei due deve entrare'
        + '\n     in scheda, non dove mettere il cancello.',
      );
    } else {
      console.log(
        `  ✅ Col perimetro sul suo id vedrebbe ${sue} clienti su ${clientiConScheda}.`
        + `\n     Restano fuori ${clientiConScheda - sue}, di cui ${senzaCoach} non hanno proprio una coach:`
        + '\n     quelle non le vedrebbe nessun commerciale, ed è la parte da guardare prima di accendere.',
      );
    }
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
