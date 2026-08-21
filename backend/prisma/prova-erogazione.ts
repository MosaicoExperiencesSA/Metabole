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
    new EventsService(prisma as never, audit as never),
    new DietAgentService(prisma as never, configParams),
    new DayComboService(),
    new KcalNeedService(prisma as never, configParams),
    new PushService(prisma as never, new ConfigService()),
  );

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
