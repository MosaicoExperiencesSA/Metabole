/**
 * LANCIA L'EROGAZIONE VERA PER UNA CLIENTE, E DICE COS'È USCITO.
 *
 * ## Perché serve (21/8, il caso Sonia)
 *
 * Dopo la correzione del pool la domanda era: «il motore adesso compone?». `diag:cliente` non può
 * rispondere, e nemmeno la segnalazione: `ensureDietBlockedEscalation` non tocca una riga già
 * aperta, quindi il motivo che si legge è quello scritto la **prima** volta. Guardarla e dire «non
 * ha funzionato» sarebbe leggere una fotografia vecchia.
 *
 * L'unico modo onesto di saperlo è **farla girare** e guardare cosa esce.
 *
 * ⚠️ **Questo script EROGA per davvero** — non è una prova a vuoto. Ma non forza niente e non
 * scavalca nessun controllo: chiama `deliverIfEligible`, esattamente la stessa funzione che parte
 * quando la cliente apre l'app o manda le misure. Se un cancello è chiuso (piano non ancora
 * partito, misura del ciclo mancante, piano fermato, pausa) non succede niente, e lo dice.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run prova:erogazione -- cliente@esempio.it
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { EventsService } from '../src/calendar/events.service';
import { ConfigParamsService } from '../src/config-params/config-params.service';
import { DietAgentService } from '../src/diet-agent/diet-agent.service';
import { DayComboService } from '../src/menu/day-combo.service';
import { KcalNeedService } from '../src/menu/kcal-need.service';
import { MenuService } from '../src/menu/menu.service';
import { PushService } from '../src/notifications/push.service';

const prisma = new PrismaClient();

function giorno(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

/** Le segnalazioni «Piano bloccato» aperte, con il motivo e quando è stato scritto. */
async function blocchi(clientId: string) {
  return (await prisma.escalation.findMany({
    where: {
      clientId,
      source: 'engine' as never,
      status: { in: ['open', 'in_progress'] as never },
      reason: { contains: 'Piano bloccato' },
    },
    select: { id: true, reason: true, createdAt: true, updatedAt: true },
  })) as { id: string; reason: string; createdAt: Date; updatedAt: Date }[];
}

async function main(): Promise<void> {
  const email = (process.argv.slice(2).join(' ') || '').trim().toLowerCase();
  if (!email) {
    console.log('Indica l\'email:  npm run prova:erogazione -- nome@esempio.it');
    return;
  }

  const user = (await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, clientProfile: { select: { name: true } } },
  })) as { id: string; email: string; clientProfile: { name: string | null } | null } | null;
  if (!user) { console.log(`Nessun utente con email ${email}.`); return; }

  const nome = user.clientProfile?.name ?? user.email;
  console.log(`=== ${nome} ===`);
  console.log('⚠️ Questo lancia l\'erogazione VERA, come se la cliente aprisse l\'app.');
  console.log('   Non forza niente: passa da tutti i cancelli di sempre.\n');

  const prima = await prisma.menuDay.count({ where: { clientId: user.id } });
  const bloccoPrima = await blocchi(user.id);
  console.log(`Giornate già erogate: ${prima}`);
  for (const b of bloccoPrima) {
    console.log(`Blocco aperto dal ${giorno(b.createdAt)} (motivo scritto il ${giorno(b.updatedAt)}):`);
    console.log(`  ${b.reason}`);
  }
  if (!bloccoPrima.length) console.log('Nessun blocco aperto.');

  // La catena di dipendenze, a mano: qui non c'è Nest, e far partire tutto il modulo in
  // produzione accenderebbe anche i cron. Sono sei servizi, tutti con un costruttore semplice.
  const audit = new AuditService(prisma as never);
  const configParams = new ConfigParamsService(prisma as never, audit as never);
  const menu = new MenuService(
    prisma as never,
    configParams,
    audit,
    // ⚠️ `configParams` è entrato nel costruttore il 23/8 (tregua fra due vacanze): senza,
    // `pausaAppenaFinita` e la creazione di eventi esploderebbero qui dentro.
    new EventsService(prisma as never, audit as never, configParams),
    new DietAgentService(prisma as never, configParams),
    new DayComboService(),
    new KcalNeedService(prisma as never, configParams),
    new PushService(prisma as never, new ConfigService()),
  );

  /**
   * ⛔ **I CANCELLI, UNO PER UNO, PRIMA DI SUONARE IL CAMPANELLO** (23/8, caso Lorena).
   *
   * Due volte questo script è uscito con «NESSUN giorno erogato … si è fermato PRIMA di comporre,
   * a un cancello» — e la caccia al cancello è durata un'ora, per esclusione, sui log che non
   * c'erano. `deliverIfEligible` ha (giustamente) uscite silenziose; questo script esiste proprio
   * per non dover dedurre, quindi le stesse domande le fa QUI, in sola lettura, e stampa ogni
   * verdetto. Se un giorno i cancelli del servizio cambiano, questa lista va aggiornata a mano —
   * è il prezzo, e vale il giorno in cui una cliente aspetta la spesa.
   */
  console.log('\n--- i cancelli, in ordine ---');
  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: { planStartDate: true, planHeldAt: true, regime: true, mealsPerDay: true, dietFamily: true, dietStyle: true, objective: true, pathType: true, fastingWindow: true },
  })) as { planStartDate: Date | null; planHeldAt: Date | null; regime: string | null; mealsPerDay: number | null; dietFamily: string | null; dietStyle: string | null; objective: string | null; pathType: string | null; fastingWindow: string | null } | null;
  console.log(`1. planStartDate sul profilo: ${giorno(profilo?.planStartDate)} ${profilo?.planStartDate ? '✓' : '⛔ SENZA data niente menu'}`);
  const { attivoInCorso } = await import('../src/commerce/abbonamento-in-corso');
  const { STATI_CON_UN_PIANO } = await import('../src/commerce/stati-abbonamento');
  const righeSub = (await prisma.subscription.findMany({
    where: { clientId: user.id, status: { in: STATI_CON_UN_PIANO as never } },
    include: { plan: { select: { name: true, period: true } } },
  })) as ({ id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string | null; period: string | null } | null })[];
  const pianoScelto = attivoInCorso(righeSub);
  console.log(`2. attivoInCorso: ${pianoScelto ? `"${pianoScelto.plan?.name}" (${pianoScelto.status}, ${giorno(pianoScelto.startDate)} → ${giorno(pianoScelto.endDate)}) ✓` : '⛔ NESSUNO: niente da erogare'}`);
  if (pianoScelto?.plan?.period === 'monitoring') console.log('   ⛔ È un Monitoraggio: i menu non passano di qui.');
  const pausaAttiva = await prisma.event.findFirst({ where: { clientId: user.id, mode: 'pause_period' as never, startDate: { lte: new Date() }, endDate: { gte: new Date() } } as never, select: { id: true, endDate: true } });
  console.log(`3. pausa attiva: ${pausaAttiva ? `⛔ SÌ (fino al ${giorno((pausaAttiva as { endDate: Date }).endDate)})` : 'no ✓'}`);
  console.log(`4. piano fermato (planHeldAt): ${profilo?.planHeldAt ? '⛔ SÌ' : 'no ✓'}`);
  const anteprima = await configParams.getNumber('menu_visible_days_before_start', 2);
  const inizioPiano = pianoScelto?.startDate ?? profilo?.planStartDate ?? null;
  if (inizioPiano) {
    const { toDateOnly } = await import('../src/common/date-only');
    const start = toDateOnly(inizioPiano.toISOString());
    const visibileDal = new Date(start.getTime() - anteprima * 86_400_000);
    const oggiG = toDateOnly();
    console.log(`5. finestra: inizio ${giorno(start)}, anteprima ${anteprima}g → visibile dal ${giorno(visibileDal)}, oggi ${giorno(oggiG)} ${oggiG.getTime() >= visibileDal.getTime() ? '✓' : '⛔ TROPPO PRESTO'}`);
    const { mancaMisuraDiPartenza } = await import('../src/menu/misura-di-partenza');
    const mancaMisura = await mancaMisuraDiPartenza(prisma as never, user.id, inizioPiano, anteprima);
    console.log(`6. misura di partenza nella finestra: ${mancaMisura ? '⛔ MANCA (il menu resta trattenuto e si chiede)' : 'c\'è ✓'}`);
  }
  console.log(`7. profilo per la scelta dieta: regime=${profilo?.regime ?? '⛔ NULL'} · pasti=${profilo?.mealsPerDay ?? '⛔ NULL'} · famiglia=${profilo?.dietFamily ?? '—'} · stile=${profilo?.dietStyle ?? '—'} · obiettivo=${profilo?.objective ?? '— (→ dimagrimento)'} · percorso=${profilo?.pathType ?? '—'} · finestra=${profilo?.fastingWindow ?? '—'}`);
  const { pickDietFor } = await import('../src/catalog/pick-diet');
  const dietaScelta = (await pickDietFor(
    (where) => prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' }, select: { id: true, name: true, style: true, regime: true, mealsPerDay: true, fasting: true } }) as never,
    profilo as never,
  )) as { id: string; name: string | null; style: string | null; mealsPerDay: number | null; fasting: boolean } | null;
  console.log(`8. pickDiet: ${dietaScelta ? `"${dietaScelta.name}" (${dietaScelta.style}, ${dietaScelta.fasting ? 'fasting' : `${dietaScelta.mealsPerDay} pasti`}, id ${dietaScelta.id}) ✓` : '⛔ NESSUNA DIETA TROVATA — è questo il cancello muto'}`);
  if (dietaScelta) {
    const perLivello = (await prisma.dietDayTemplate.groupBy({ by: ['level'], where: { dietId: dietaScelta.id }, _count: { _all: true } }).catch(() => null)) as { level: number; _count: { _all: number } }[] | null;
    if (perLivello) {
      const righe = perLivello.map((r) => `livello ${r.level}: ${r._count._all} giornate`).join(' · ') || '⛔ ZERO GIORNATE';
      console.log(`9. giornate della dieta scelta: ${righe}${perLivello.some((r) => r.level === 1 && r._count._all > 0) ? ' ✓' : ' ⛔ NIENTE AL LIVELLO 1: il motore esce muto qui'}`);
    } else {
      const n = await prisma.dietDayTemplate.count({ where: { dietId: dietaScelta.id, level: 1 } });
      console.log(`9. giornate della dieta scelta al livello 1: ${n} ${n > 0 ? '✓' : '⛔ ZERO: il motore esce muto qui'}`);
    }
  }

  console.log('\n--- erogazione ---');
  const creati = await menu.deliverIfEligible(user.id);
  console.log('--- fine ---\n');

  const dopo = await prisma.menuDay.count({ where: { clientId: user.id } });
  const bloccoDopo = await blocchi(user.id);

  if (creati.length) {
    console.log(`✅ EROGATI ${creati.length} giorni: ${creati.join(', ')}`);
    console.log(`   Giornate totali: ${prima} → ${dopo}.`);
    if (bloccoPrima.length && !bloccoDopo.length) {
      console.log('✅ E il blocco è rientrato: la segnalazione si è chiusa da sé.');
    }
  } else {
    console.log('⛔ NESSUN giorno erogato.');
    if (bloccoDopo.length) {
      for (const b of bloccoDopo) {
        const aggiornato = bloccoPrima.find((x) => x.id === b.id)?.reason !== b.reason;
        console.log(`Motivo${aggiornato ? ' (AGGIORNATO adesso)' : ' (invariato)'}:`);
        console.log(`  ${b.reason}`);
      }
      console.log('\n→ Il motore ha provato e si è fermato sui piatti qui sopra: quelli sono i');
      console.log('  piatti da togliere dal catalogo della sua dieta, o l\'esclusione da rivedere.');
    } else {
      console.log('→ E nessun blocco: allora si è fermato PRIMA di comporre, a un cancello.');
      console.log('  Quale, lo dice `npm run diag:cliente -- <email>`: piano non ancora partito,');
      console.log('  misura del ciclo mancante, piano fermato dal nutrizionista, pausa, fine piano.');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
