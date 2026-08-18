/**
 * Diagnostica (SOLA LETTURA): perché correggere la data di inizio piano "non fa niente".
 *
 * Stampa TUTTI gli abbonamenti di una cliente nell'ordine in cui il backend li legge
 * (createdAt decrescente), segna quale è l'abbonamento "principale" — cioè quello che la
 * scheda mostra e che la matita "Inizio piano" sposta — e confronta le sue date con la data
 * d'inizio piano salvata sul profilo (quella che comanda i menu).
 *
 * Serve quando in scheda si legge una cosa e nel database ce n'è un'altra: tipicamente le date
 * sono finite su un abbonamento diverso da quello mostrato, oppure la data del profilo e quella
 * dell'abbonamento si sono disallineate.
 *
 *   npm run diag:abbonamenti -- --email=cliente@esempio.it
 *
 * Nessuna scrittura: si può lanciare in produzione senza rischi.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

/** Stessa priorità di `pickMainSubscription` nel backend. La lista deve essere createdAt desc. */
function principale<T extends { status: string }>(subs: T[]): T | null {
  return (
    subs.find((s) => s.status === 'active') ??
    subs.find((s) => s.status === 'pending') ??
    subs.find((s) => s.status !== 'cancelled' && s.status !== 'expired') ??
    subs.find((s) => s.status === 'expired') ??
    subs[0] ??
    null
  );
}

/** Stessa formula di `subscriptionEnd`: d=giorni, w=settimane, m=mesi, y=anni, fallback 3 mesi. */
function fineDa(start: Date, period: string): Date {
  const end = new Date(start);
  if (String(period ?? '').trim().toLowerCase() === 'maintenance') {
    end.setMonth(end.getMonth() + 1);
    return end;
  }
  const m = String(period ?? '').trim().toLowerCase().match(/^(\d+)\s*([dwmy]?)$/);
  const n = m ? parseInt(m[1], 10) : NaN;
  const unit = m ? m[2] : '';
  if (!m || !Number.isFinite(n) || n <= 0) {
    end.setMonth(end.getMonth() + 3);
    return end;
  }
  if (unit === 'd') end.setDate(end.getDate() + n);
  else if (unit === 'w') end.setDate(end.getDate() + n * 7);
  else if (unit === 'y') end.setFullYear(end.getFullYear() + n);
  else end.setMonth(end.getMonth() + n);
  return end;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--email='));
  const email = arg ? arg.slice('--email='.length).trim().toLowerCase() : '';
  if (!email) {
    console.log('Uso: npm run diag:abbonamenti -- --email=cliente@esempio.it');
    return;
  }

  const user = (await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, status: true },
  })) as { id: string; email: string; status: string } | null;
  if (!user) {
    console.log(`Nessun utente con email ${email}.`);
    return;
  }

  const profile = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: { planStartDate: true },
  })) as { planStartDate: Date | null } | null;

  const subs = (await prisma.subscription.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      plan: { select: { name: true, period: true } },
    },
  })) as {
    id: string;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    plan: { name: string; period: string } | null;
  }[];

  const oggi = new Date();
  oggi.setUTCHours(0, 0, 0, 0);

  console.log(`\nCliente: ${user.email} (${user.status})`);
  console.log(`Data inizio piano sul profilo (comanda i menu): ${ymd(profile?.planStartDate)}`);
  console.log(`\nAbbonamenti (${subs.length}), dal più recente:`);

  /**
   * ⚠️ LE PAUSE SPOSTANO LA FINE, e senza saperlo questo avviso grida al lupo — 17/8.
   *
   * Su Lorena l'avviso «fine incoerente col periodo» mi ha portato a costruire un'ipotesi
   * sbagliata sulla causa di due abbonamenti attivi: la fine era il 1/9 invece del 25/8 perché il
   * 17/8 le era stata approvata una **pausa di 7 giorni**, e `pause.service` fa esattamente quello
   * che dice di fare (`subscription.endDate += giorni`). Nessuna incoerenza: una pausa.
   *
   * Un avviso che si accende quando tutto è a posto costa più di un avviso che manca, perché manda
   * a cercare la causa nel posto sbagliato — e questa volta l'ho pagato io.
   */
  const pause = (await prisma.pauseRequest.findMany({
    where: { clientId: user.id, status: 'approved' } as never,
    select: { days: true },
  }).catch(() => [])) as { days: number }[];
  const giorniDiPausa = pause.reduce((n, p) => n + (p.days ?? 0), 0);

  const main = principale(subs);
  for (const s of subs) {
    const marca = main && s.id === main.id ? '►' : ' ';
    const attesa = s.startDate && s.plan ? fineDa(s.startDate, s.plan.period) : null;
    // La fine attesa CON le pause già approvate: è quella vera.
    const attesaConPause = attesa ? new Date(attesa.getTime() + giorniDiPausa * 86_400_000) : null;
    const fineCoerente = s.endDate
      ? [attesa, attesaConPause].some((d) => d && ymd(d) === ymd(s.endDate))
      : true;
    console.log(
      `${marca} ${s.status.padEnd(9)} ${(s.plan?.name ?? '?').padEnd(18)} periodo ${(s.plan?.period ?? '?').padEnd(12)} ` +
        `inizio ${ymd(s.startDate)}  fine ${ymd(s.endDate)}  creato ${ymd(s.createdAt)}` +
        (fineCoerente
          ? ''
          : `   ⚠ fine incoerente col periodo (attesa ${ymd(attesa)}` +
            `${giorniDiPausa ? `, o ${ymd(attesaConPause)} con i ${giorniDiPausa} giorni di pausa` : ''})`),
    );
  }
  console.log('\n► = abbonamento principale: quello che la scheda mostra e che la matita sposta.');

  if (!main) {
    console.log('\nNessun abbonamento: la correzione della data non ha su cosa agire.');
    return;
  }

  console.log('\nDiagnosi:');
  const ps = profile?.planStartDate ?? null;
  if (ps && main.startDate && ymd(ps) !== ymd(main.startDate)) {
    console.log(
      `  ✗ La data d'inizio del profilo (${ymd(ps)}) NON coincide con l'inizio dell'abbonamento ` +
        `principale (${ymd(main.startDate)}).`,
    );
    const altro = subs.find((s) => s.id !== main.id && s.startDate && ymd(s.startDate) === ymd(ps));
    if (altro) {
      console.log(
        `     Le date sono finite sull'abbonamento «${altro.plan?.name ?? '?'}» (${altro.status}, id ${altro.id}), ` +
          `non su quello mostrato in scheda. È il difetto corretto il 5 agosto 2026.`,
      );
    }
    console.log("     → Ri-salva la data di inizio dalla scheda dopo il deploy: ora agisce sull'abbonamento giusto.");
  } else if (ps && main.startDate) {
    console.log(`  ✓ Profilo e abbonamento principale partono dalla stessa data (${ymd(ps)}).`);
  } else if (!ps) {
    console.log("  ✗ Il profilo non ha una data d'inizio piano: senza quella non viene erogato nessun menu.");
  }

  if (main.startDate && main.plan) {
    const attesa = fineDa(main.startDate, main.plan.period);
    if (main.endDate && ymd(attesa) !== ymd(main.endDate)) {
      console.log(
        `  ✗ La fine (${ymd(main.endDate)}) non corrisponde alla durata del piano ` +
          `(${main.plan.period} da ${ymd(main.startDate)} → ${ymd(attesa)}).`,
      );
    } else {
      console.log(`  ✓ La fine è coerente con la durata del piano (${main.plan.period}).`);
    }
  }

  const scaduto = !!main.endDate && main.endDate.getTime() < oggi.getTime();
  if (main.status === 'active' && scaduto) {
    console.log('  ✗ Risulta ATTIVO ma la fine è già passata: la scheda dirà comunque "Nessun piano attivo".');
  } else if (main.status === 'expired' && !scaduto) {
    console.log(
      '  ✗ Risulta SCADUTO ma la fine è nel futuro: va riattivato ' +
        '(`npm run reactivate:future-expired -- --apply`, oppure ri-salvando la data dalla scheda).',
    );
  } else if (main.status === 'active') {
    console.log('  ✓ Abbonamento attivo ed entro il periodo.');
  } else {
    console.log(`  · Stato «${main.status}»: la scheda non lo conta come piano attivo.`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
