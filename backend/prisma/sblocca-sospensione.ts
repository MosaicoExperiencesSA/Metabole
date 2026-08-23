/**
 * ⛔ **CHIUDE UNA SOSPENSIONE IN CORSO E FA RIPARTIRE I MENU, SUBITO.**
 *
 * ## Perché esiste (23/8)
 *
 * Una cliente rientrata prima del previsto resta senza menu fino alla fine del periodo scritto, e
 * **in back office non c'è nessun pulsante che lo tolga**: le sospensioni si creano dall'app (la
 * richiesta di pausa, o «Periodo» nel suo Calendario) e nessuna schermata dello staff le sa
 * modificare. L'unica strada era chiedere alla cliente di cancellarsi l'evento da sola.
 *
 * ⚠️ **Non usare «Rigenera menu» al suo posto**: `regenerateFromToday` cancella i giorni da oggi in
 * poi e poi chiama l'erogazione, che con una sospensione attiva torna a mano vuota. Il risultato è
 * una schermata vuota invece di uno sblocco.
 *
 * ## Cosa fa, esattamente
 *
 * 1. **Tronca** il periodo a ieri — non lo cancella: lo storico di quella vacanza resta, e restano i
 *    giorni già aggiunti alla scadenza del piano (che NON si tolgono: vedi `pause.service`);
 * 2. lascia la riga nel registro (`pause.sbloccata_a_mano`) con chi e quando;
 * 3. chiama `deliverIfEligible`, cioè **la stessa** funzione che parte quando la cliente apre
 *    l'app: non forza e non scavalca nessun altro cancello. Se manca la pesata del ciclo lo dice, e
 *    il menu arriva appena lei si pesa.
 *
 * ⚠️ Non tocca `travel_state` sul profilo: quello lo sistema la card della scheda cliente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run sblocca:sospensione -- cliente@esempio.it
 *   npm run sblocca:sospensione -- cliente@esempio.it --prova     (dice cosa farebbe, non scrive)
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
import { aGiorno, giornoDelDato } from '../src/common/date-only';
import { giornoDiRientro } from '../src/pause/giorno-di-rientro';

const prisma = new PrismaClient();
const giorno = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const argomenti = process.argv.slice(2);
  const soloProva = argomenti.includes('--prova');
  const email = argomenti.filter((a) => !a.startsWith('--')).join(' ').trim().toLowerCase();
  if (!email) {
    console.error('Manca l\'email. Uso: npm run sblocca:sospensione -- cliente@esempio.it [--prova]');
    process.exit(1);
  }

  const user = (await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, role: true },
  })) as { id: string; email: string; role: string } | null;
  if (!user) {
    console.error(`Nessun utente con questa email.`);
    process.exit(1);
  }
  if (user.role !== 'client') {
    console.error(`Questo utente non è una cliente (ruolo: ${user.role}).`);
    process.exit(1);
  }

  const oggi = aGiorno(new Date());
  const attiva = (await prisma.event.findFirst({
    where: {
      clientId: user.id,
      mode: 'pause_period' as never,
      startDate: { lte: oggi },
      endDate: { gte: oggi },
    } as never,
    select: { id: true, startDate: true, endDate: true, label: true },
  })) as { id: string; startDate: Date; endDate: Date; label: string | null } | null;

  if (!attiva) {
    console.log('Nessuna sospensione ATTIVA oggi: il menu non è fermo per questo motivo.');
    console.log('Lancia `npm run diag:cliente -- <email>` per vedere qual è il cancello vero.');
    await prisma.$disconnect();
    return;
  }

  console.log('--- sospensione in corso ---');
  console.log(`  dal ${giorno(attiva.startDate)}  ·  riprende il ${giorno(giornoDiRientro(attiva))}`);
  console.log(`  origine: ${attiva.label ?? '—'}`);

  const nuovaFine = new Date(oggi.getTime() - 86_400_000);
  const nuovoInizio =
    giornoDelDato(attiva.startDate).getTime() > nuovaFine.getTime() ? nuovaFine : attiva.startDate;

  if (soloProva) {
    console.log(`\n[prova] la chiuderei al ${giorno(nuovaFine)}, e i menu ripartirebbero da oggi.`);
    console.log('[prova] non ho scritto niente.');
    await prisma.$disconnect();
    return;
  }

  await prisma.event.update({
    where: { id: attiva.id },
    data: { startDate: nuovoInizio, endDate: nuovaFine },
  });
  // ⚠️ Il registro dei giorni concessi NON si riscrive: le sue date sono la memoria che impedisce
  // di regalare due volte gli stessi giorni. Si chiude soltanto, così la sorveglianza si ferma.
  await prisma.pauseRequest.updateMany({
    where: { eventId: attiva.id } as never,
    data: { status: 'closed' } as never,
  });
  console.log(`\nSospensione chiusa al ${giorno(nuovaFine)}: da oggi i menu non sono più fermi.`);
  console.log('⚠️ I giorni già aggiunti alla scadenza del piano restano alla cliente.');

  const audit = new AuditService(prisma as never);
  await audit
    .log({
      action: 'pause.sbloccata_a_mano',
      entityType: 'event',
      entityId: attiva.id,
      metadata: {
        clientId: user.id,
        finiva: giorno(attiva.endDate),
        chiusaAl: giorno(nuovaFine),
        script: 'sblocca:sospensione',
      } as never,
    })
    .catch(() => undefined);

  // Stessa catena a mano di `prova:erogazione`: qui non c'è Nest, e far partire il modulo intero
  // in produzione accenderebbe anche i cron.
  const configParams = new ConfigParamsService(prisma as never, audit as never);
  const menu = new MenuService(
    prisma as never,
    configParams,
    audit,
    new EventsService(prisma as never, audit as never, configParams),
    new DietAgentService(prisma as never, configParams),
    new DayComboService(),
    new KcalNeedService(prisma as never, configParams),
    new PushService(prisma as never, new ConfigService()),
  );

  console.log('\n--- erogazione ---');
  const creati = await menu.deliverIfEligible(user.id);
  console.log('--- fine ---\n');
  if (creati.length) {
    console.log(`✅ Giornate erogate: ${creati.join(', ')}. Può fare la spesa.`);
  } else {
    console.log('⚠️ Nessuna giornata erogata: resta un cancello.');
    console.log('   Il più probabile è la PESATA DEL RIENTRO — chiudendo la sospensione, il primo menu');
    console.log('   riparte con una pesata fresca (gliela chiede una push): appena la inserisce in app,');
    console.log('   il menu arriva da solo. Gli altri li dice `npm run diag:cliente -- <email>`.');
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
