/**
 * Diagnostica (SOLA LETTURA): perché "Rigenera menu" non produce giorni.
 *
 * Il tasto in backoffice fa due cose, in quest'ordine:
 *   1. cancella i MenuDay da OGGI in poi;
 *   2. chiama `deliverIfEligible`, che eroga il ciclo successivo SOLO se passano
 *      tutti i controlli.
 *
 * Se un controllo non passa, il passo 2 non crea niente e il messaggio in backoffice dice
 * "Nessun giorno rigenerato" senza spiegare quale. Peggio: il passo 1 è già avvenuto, quindi
 * la cliente resta SENZA menu da oggi in poi finché il blocco non viene rimosso.
 *
 * Questo script ripercorre gli stessi controlli, nello stesso ordine, e dice qual è il primo
 * che si mette di traverso — simulando la cancellazione (ignora i menu da oggi in poi) senza
 * cancellare niente davvero. Nessuna scrittura.
 *
 *   npm run diag:rigenera -- --email=cliente@esempio.it
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ymd = (d: Date) => d.toISOString().slice(0, 10);
function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

let blocco: string | null = null;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
function stop(msg: string, comeSiSblocca: string) {
  if (!blocco) blocco = `${msg}\n     → ${comeSiSblocca}`;
  console.log(`  ✗ ${msg}`);
}

// ConfigParam.value è una stringa: stessa lettura del ConfigParamsService, col default se manca.
async function numero(key: string, fallback: number): Promise<number> {
  const row = (await prisma.configParam.findUnique({ where: { key } }).catch(() => null)) as
    | { value: string }
    | null;
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--email='));
  if (!arg) {
    console.error('Uso: npm run diag:rigenera -- --email=cliente@esempio.it');
    process.exit(1);
  }
  const email = arg.slice('--email='.length).trim().toLowerCase();
  const today = dateOnly(new Date());
  console.log(`\nDiagnostica "Rigenera menu" — ${email} — oggi ${ymd(today)}\n`);

  const user = (await prisma.user.findFirst({
    where: { email },
    select: { id: true, role: true, firstName: true, lastName: true },
  })) as { id: string; role: string; firstName: string | null; lastName: string | null } | null;
  if (!user) {
    console.log('  ✗ Nessun utente con questa email.');
    console.log('     → Controlla l\'indirizzo: il cambio email lascia la vecchia come secondaria.\n');
    return;
  }
  if (user.role !== 'client') {
    console.log(`  ✗ L'utente esiste ma ha ruolo "${user.role}", non "client".\n`);
    return;
  }
  const clientId = user.id;
  console.log(`  Cliente: ${[user.firstName, user.lastName].filter(Boolean).join(' ') || email}\n`);

  const daysPerDelivery = await numero('menu_days_delivered', 2);
  const visibleDaysBefore = await numero('menu_visible_days_before_start', 2);

  // ---- 1) Profilo e data di inizio piano ---------------------------------------------
  const profile = (await prisma.clientProfile.findUnique({ where: { userId: clientId } })) as
    | (Record<string, unknown> & {
        planStartDate: Date | null;
        regime: string | null;
        dietStyle: string | null;
        mealsPerDay: number | null;
        objective: string | null;
        pathType: string | null;
        travelState: string | null;
        intolerances: string[] | null;
        dislikedFoods: string[] | null;
      })
    | null;
  if (!profile) {
    stop('Nessun profilo cliente.', 'Il profilo si crea con l\'onboarding: senza, non c\'è niente da generare.');
  } else if (!profile.planStartDate) {
    stop(
      'Manca la DATA DI INIZIO PIANO sul profilo.',
      'Backoffice → scheda cliente → imposta la data di inizio. È il primo requisito: senza, deliverIfEligible esce subito.',
    );
  } else {
    ok(`Data di inizio piano: ${ymd(profile.planStartDate)}`);
  }

  // ---- 2) Abbonamento attivo ---------------------------------------------------------
  const sub = (await prisma.subscription.findFirst({
    where: { clientId, status: 'active' },
    include: { plan: { select: { name: true } } },
  })) as ({ endDate: Date | null; startDate: Date | null; plan: { name: string } | null } & Record<string, unknown>) | null;
  if (!sub) {
    const altri = (await prisma.subscription.findMany({
      where: { clientId },
      select: { status: true, endDate: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })) as { status: string; endDate: Date | null }[];
    stop(
      `Nessun abbonamento ATTIVO${altri.length ? ` (trovati: ${altri.map((s) => `${s.status}${s.endDate ? ` fino a ${ymd(s.endDate)}` : ''}`).join(', ')})` : ' (nessun abbonamento)'}.`,
      'Il piano si genera solo con abbonamento attivo (es. bonifico approvato). Backoffice → Abbonamenti.',
    );
  } else if (sub.endDate && dateOnly(sub.endDate).getTime() < today.getTime()) {
    stop(
      `Abbonamento ancora marcato "active" ma CONCLUSO il ${ymd(sub.endDate)}.`,
      'Percorso finito: non si erogano giorni oltre la fine. Va rinnovato o va spostata la data di fine.',
    );
  } else {
    ok(`Abbonamento attivo${sub.plan ? ` (${sub.plan.name})` : ''}${sub.endDate ? `, fine ${ymd(sub.endDate)}` : ''}`);
  }

  // ---- 3) Periodo senza dieta (viaggio/estate) ---------------------------------------
  const pausa = (await prisma.event.findFirst({
    where: { clientId, mode: 'pause_period', startDate: { lte: today }, endDate: { gte: today } },
    select: { startDate: true, endDate: true },
  })) as { startDate: Date; endDate: Date } | null;
  if (pausa) {
    stop(
      `Periodo senza dieta ATTIVO dal ${ymd(pausa.startDate)} al ${ymd(pausa.endDate)}.`,
      'In pausa l\'erogazione è sospesa di proposito. Chiudi il periodo o aspetta la fine.',
    );
  } else {
    ok('Nessun periodo senza dieta in corso');
  }

  // ---- 4) Misure iniziali ------------------------------------------------------------
  const misure = await prisma.measurement.count({ where: { clientId } });
  if (misure === 0) {
    stop(
      'NESSUNA MISURA inserita.',
      'Con un piano attivo il primo menu resta trattenuto finché non arriva la prima misura (popup bloccante in app). È la causa più frequente.',
    );
  } else {
    ok(`${misure} misura/e registrate`);
  }

  // ---- 5) Troppo presto rispetto all'inizio piano ------------------------------------
  if (profile?.planStartDate) {
    const start = dateOnly(profile.planStartDate);
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    if (today.getTime() < visibleFrom.getTime()) {
      stop(
        `Troppo presto: i menu compaiono dal ${ymd(visibleFrom)} (${visibleDaysBefore} giorni prima dell'inizio).`,
        'Non è un guasto: aspetta quella data, oppure anticipa la data di inizio piano.',
      );
    } else {
      ok(`Finestra aperta (dal ${ymd(visibleFrom)})`);
    }
  }

  // ---- 6) Gate misure del CICLO (post-cancellazione) ---------------------------------
  // La rigenerazione cancella i giorni da oggi in poi: l'ultimo giorno che resta è quello
  // di ieri o prima. È su quello che si valuta il gate del ciclo.
  const ultimo = (await prisma.menuDay.findFirst({
    where: { clientId, date: { lt: today } },
    orderBy: { date: 'desc' },
    select: { date: true, dietId: true },
  })) as { date: Date; dietId: string } | null;
  const daOggi = await prisma.menuDay.count({ where: { clientId, date: { gte: today } } });
  console.log(`  · Menu presenti da oggi in poi: ${daOggi} (verrebbero cancellati e ricreati)`);

  if (ultimo) {
    ok(`Ultimo giorno erogato prima di oggi: ${ymd(ultimo.date)}`);
    if (profile?.travelState === 'in_vacanza') {
      ok('In vacanza: il gate misure del ciclo non blocca');
    } else {
      const cycleEnd = dateOnly(ultimo.date);
      if (today.getTime() >= cycleEnd.getTime()) {
        const cycleStart = new Date(cycleEnd.getTime() - (daysPerDelivery - 1) * 86_400_000);
        const misuraCiclo = await prisma.measurement.findFirst({
          where: { clientId, date: { gte: cycleStart } },
          select: { date: true },
        });
        if (!misuraCiclo) {
          stop(
            `Gate misure del ciclo: nessuna misura dal ${ymd(cycleStart)} in poi.`,
            'Il ciclo successivo si sblocca con le misure del ciclo. Chiedi alla cliente di inserire il peso, oppure inseriscilo dal backoffice.',
          );
        } else {
          ok(`Misura del ciclo presente (${ymd(misuraCiclo.date)})`);
        }
      }
    }
  } else {
    ok('Nessun giorno erogato prima di oggi: si riparte dalla data di inizio piano');
  }

  // ---- 7) Dieta abbinabile al profilo ------------------------------------------------
  if (profile) {
    console.log(
      `  · Profilo: regime=${profile.regime ?? '—'} stile=${profile.dietStyle ?? '—'} pasti=${profile.mealsPerDay ?? '—'} obiettivo=${profile.objective ?? 'dimagrimento'} percorso=${profile.pathType ?? '—'}`,
    );
    if (!profile.regime || !profile.mealsPerDay) {
      stop(
        'Profilo incompleto: manca il REGIME o il NUMERO DI PASTI.',
        'Senza questi due campi nessuna dieta è abbinabile. Completa la scheda cliente.',
      );
    } else {
      const wantsFasting = profile.pathType === 'intermittent_fasting';
      const base: Record<string, unknown> = wantsFasting
        ? { status: 'approved', regime: profile.regime, fasting: true }
        : { status: 'approved', regime: profile.regime, mealsPerDay: profile.mealsPerDay, fasting: false };
      let diet = (await prisma.diet.findFirst({ where: base as never, orderBy: { approvedAt: 'desc' } })) as
        | { id: string; name: string; style: string; objective: string }
        | null;
      let allentata = false;
      if (!diet) {
        diet = (await prisma.diet.findFirst({
          where: { status: 'approved', regime: profile.regime } as never,
          orderBy: { approvedAt: 'desc' },
        })) as { id: string; name: string; style: string; objective: string } | null;
        allentata = !!diet;
      }
      if (!diet) {
        const perRegime = await prisma.diet.count({ where: { regime: profile.regime } as never });
        stop(
          `Nessuna dieta APPROVATA per il regime "${profile.regime}" (diete con quel regime, in qualsiasi stato: ${perRegime}).`,
          perRegime > 0
            ? 'Le diete esistono ma non sono approvate: Backoffice → Diete → approva la variante giusta.'
            : 'Non esiste nessuna dieta per questo regime: o si crea, o si corregge il regime sul profilo della cliente.',
        );
      } else {
        ok(
          `Dieta abbinata: "${diet.name}" (${diet.style}, ${diet.objective})${allentata ? ' — via fallback allentato, il numero di pasti richiesto non esiste' : ''}`,
        );
        const templates = await prisma.dietDayTemplate.count({ where: { dietId: diet.id, level: 1 } });
        if (templates === 0) {
          stop(
            `La dieta "${diet.name}" non ha giornate tipo (DietDayTemplate) al livello 1.`,
            'È una dieta vuota: va compilata in backoffice, altrimenti non c\'è niente da comporre.',
          );
        } else {
          ok(`${templates} giornate tipo al livello 1`);
        }
      }
    }
  }

  // ---- 8) Piano bloccato per esclusioni non sostituibili -----------------------------
  const blocco2 = (await prisma.escalation.findFirst({
    where: {
      clientId,
      source: 'engine' as never,
      status: { in: ['open', 'in_progress'] as never },
      reason: { contains: 'Piano bloccato' },
    },
    select: { reason: true, createdAt: true },
  })) as { reason: string; createdAt: Date } | null;
  if (blocco2) {
    stop(
      `PIANO BLOCCATO da un'escalation aperta del ${ymd(blocco2.createdAt)}: ${blocco2.reason}`,
      'Un\'intolleranza non ha sostituzione sicura. Va risolta dalla nutrizionista (chiudi l\'escalation dopo aver sistemato dieta o esclusioni), altrimenti ogni rigenerazione si ferma qui.',
    );
  } else {
    ok('Nessun blocco per esclusioni');
    const intol = (profile?.intolerances ?? []) as string[];
    const nonGraditi = (profile?.dislikedFoods ?? []) as string[];
    if (intol.length || nonGraditi.length) {
      console.log(
        `  · Esclusioni sul profilo: intolleranze [${intol.join(', ') || '—'}] · non graditi [${nonGraditi.join(', ') || '—'}]`,
      );
      console.log('    (se sono molte, la generazione può bloccarsi al controllo sicurezza e aprire un\'escalation)');
    }
  }

  // ---- Verdetto ----------------------------------------------------------------------
  console.log('\n' + '─'.repeat(78));
  if (blocco) {
    console.log(`PRIMO BLOCCO:\n  ${blocco}`);
    if (daOggi > 0) {
      console.log(
        `\n  ATTENZIONE: la cliente ha ${daOggi} giorno/i di menu da oggi in poi. Premendo\n` +
          '  "Rigenera menu" ADESSO verrebbero cancellati e NON ricreati: resterebbe senza menu.\n' +
          '  Rimuovi prima il blocco qui sopra.',
      );
    }
  } else {
    console.log('NESSUN BLOCCO: la rigenerazione dovrebbe produrre giorni.');
    console.log('  Se il backoffice dice comunque "Nessun giorno rigenerato", il punto è più a valle');
    console.log('  (composizione della giornata: tolleranza kcal, pool ricette, guard di varietà).');
    console.log('  In quel caso servono i log del backend durante la chiamata.');
  }
  console.log('─'.repeat(78) + '\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
