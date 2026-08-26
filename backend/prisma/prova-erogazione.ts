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
import { GIORNATE_DAVANTI_CHE_BASTANO, MenuService } from '../src/menu/menu.service';
import { corsaDiGiornate, dateDaComporre } from '../src/menu/buchi-nel-calendario';
import { giornoDelDato } from '../src/common/date-only';
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
  /**
   * ⛔ **I DICIANNOVE MODI IN CUI L'EROGAZIONE ESCE A MANO VUOTA — uno per uno, con i numeri.**
   *
   * Il 23/8, sul caso Lorena, questo script è uscito con «NESSUN giorno erogato» e **nessun cancello
   * stampato lo spiegava**: la caccia è durata un'ora, per esclusione, sui log che non c'erano. Il
   * tabulato si fermava alla pausa attiva e non guardava oltre — proprio dove stava la risposta.
   *
   * ⛔ **La promessa di questa lista è una sola**: se l'erogazione esce vuota, il colpevole DEVE
   * essere una riga ⛔ qui sotto. Se un giorno esce vuota con tutte le righe ✓, allora è questa
   * lista a essere incompleta — e va estesa prima di cercare altrove.
   *
   * ⚠️ Le domande si fanno con le **stesse porte** del servizio (`activePausePeriod`,
   * `rientroInArrivo`, `mancaLaPesataDelRientro`, `pausaAppenaFinita`, `cycleNeedsMeasure`…), non
   * con query riscritte a mano: una diagnostica che risponde a una domanda leggermente diversa da
   * quella del motore è peggio di nessuna diagnostica, perché la si crede. Il cancello 3 era
   * esattamente così — confrontava `end_date` con **l'istante** invece che col giorno, quindi dalle
   * 00:00 in poi diceva «nessuna pausa» mentre il servizio ne vedeva una.
   *
   * ⚠️ `una-porta-per-i-cancelli.spec.ts` tiene il conto: se in `deliverIfEligible` nasce un
   * `return []` nuovo, quel test diventa rosso e questa lista va aggiornata.
   */
  console.log('\n--- i cancelli, in ordine ---');
  const { toDateOnly, aGiorno } = await import('../src/common/date-only');
  const { statoSupervisione } = await import('../src/clients/via-libera-clinico');
  const { rientroInArrivo, periodoLeggibile, giornoDiRientro } = await import('../src/pause/giorno-di-rientro');
  const { mancaLaPesataDelRientro, inizioFinestraRientro } = await import('../src/menu/pesata-del-rientro');
  const { mancaMisuraDiPartenza } = await import('../src/menu/misura-di-partenza');
  const { attivoInCorso } = await import('../src/commerce/abbonamento-in-corso');
  const { STATI_CON_UN_PIANO } = await import('../src/commerce/stati-abbonamento');

  const oggiG = toDateOnly();
  const eventi = new EventsService(prisma as never, audit as never, configParams);

  /** I due parametri che comandano tutto il resto: si stampa il valore GREZZO, non solo il numero. */
  const grezzo = async (chiave: string, ripiego: number) => {
    const riga = (await prisma.configParam.findUnique({ where: { key: chiave } })) as { value: string } | null;
    const letto = await configParams.getNumber(chiave, ripiego);
    const nota = !riga
      ? `⚠️ la riga NON esiste in Parametri → ripiego ${ripiego}`
      : riga.value.trim() === ''
        ? `⛔ la riga è VUOTA in Parametri → ripiego ${ripiego} (fino al 24/8 valeva ZERO, in silenzio)`
        : `riga = "${riga.value}"`;
    return { letto, nota };
  };
  const giorniCiclo = await grezzo('menu_days_delivered', 2);
  const anteprima = await grezzo('menu_visible_days_before_start', 2);
  const anticipoRientro = await grezzo('menu_visible_days_before_return', 1);
  console.log(`0. parametri: menu_days_delivered=${giorniCiclo.letto} (${giorniCiclo.nota}) · menu_visible_days_before_start=${anteprima.letto} (${anteprima.nota})`);
  console.log(`   menu_visible_days_before_return=${anticipoRientro.letto} (${anticipoRientro.nota})`);

  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: {
      planStartDate: true, planHeldAt: true, regime: true, mealsPerDay: true, dietFamily: true,
      dietStyle: true, objective: true, pathType: true, fastingWindow: true,
      screeningFlag: true, idoneita: true, idoneitaVisitaEntro: true,
    },
  })) as {
    planStartDate: Date | null; planHeldAt: Date | null; regime: string | null; mealsPerDay: number | null;
    dietFamily: string | null; dietStyle: string | null; objective: string | null; pathType: string | null;
    fastingWindow: string | null; screeningFlag: boolean | null; idoneita: string | null; idoneitaVisitaEntro: Date | null;
  } | null;

  console.log(`1. planStartDate sul profilo: ${giorno(profilo?.planStartDate)} ${profilo?.planStartDate ? '✓' : '⛔ SENZA data niente menu'}`);

  const supervisione = statoSupervisione(profilo as never);
  console.log(
    `2. via libera clinico: ${supervisione.motivo}${supervisione.visitaEntro ? ` (visita entro ${supervisione.visitaEntro})` : ''} `
      + `${supervisione.motivo === 'visita_scaduta' ? '⛔ VISITA SCADUTA: erogazione ferma' : '✓'}`,
  );

  const righeSub = (await prisma.subscription.findMany({
    where: { clientId: user.id, status: { in: STATI_CON_UN_PIANO as never } },
    include: { plan: { select: { name: true, period: true } } },
  })) as ({ id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string | null; period: string | null } | null })[];
  const pianoScelto = attivoInCorso(righeSub);
  console.log(`3. attivoInCorso fra ${righeSub.length} righe: ${pianoScelto ? `"${pianoScelto.plan?.name}" (${pianoScelto.status}, ${giorno(pianoScelto.startDate)} → ${giorno(pianoScelto.endDate)}) ✓` : '⛔ NESSUNO: niente da erogare'}`);
  for (const r of righeSub) {
    console.log(`   · ${r.status} "${r.plan?.name ?? '—'}" ${giorno(r.startDate)} → ${giorno(r.endDate)}${pianoScelto && r.id === pianoScelto.id ? '   ← è questo che eroga' : ''}`);
  }
  console.log(`4. tipo di piano: ${pianoScelto?.plan?.period ?? '—'} ${pianoScelto?.plan?.period === 'monitoring' ? '⛔ È un Monitoraggio: i menu non passano di qui' : '✓'}`);
  const finito = !!pianoScelto?.endDate && pianoScelto.endDate.getTime() < oggiG.getTime();
  console.log(`5. fine piano: ${giorno(pianoScelto?.endDate)} vs oggi ${giorno(oggiG)} ${finito ? '⛔ GIÀ FINITO' : '✓'}`);
  console.log(`6. piano fermato (planHeldAt): ${profilo?.planHeldAt ? `⛔ SÌ, dal ${giorno(profilo.planHeldAt)}` : 'no ✓'}`);

  /**
   * ⛔ **LA PAUSA E LA FINESTRA DI RIENTRO — le tre uscite che nel 23/8 nessuno poteva leggere.**
   *
   * `activePausePeriod` è la stessa porta del servizio: confronta il **giorno**, non l'istante.
   */
  const pausa = (await eventi.activePausePeriod(user.id)) as { id: string; startDate: Date; endDate: Date } | null;
  let rientro: Date | null = null;
  if (pausa) {
    const leggibile = periodoLeggibile(pausa);
    console.log(`7. sospensione ATTIVA: ${giorno(pausa.startDate)} → ultimo giorno sospeso ${giorno(pausa.endDate)}${leggibile ? '' : ' ⛔ DATE ILLEGGIBILI: erogazione tenuta ferma'}`);
    if (leggibile) {
      const giornoRientro = giornoDiRientro(pausa);
      rientro = rientroInArrivo(pausa, new Date(), anticipoRientro.letto);
      const siApre = new Date(giornoRientro.getTime() - Math.max(0, Math.floor(anticipoRientro.letto)) * 86_400_000);
      console.log(
        `8. finestra di rientro: riprende il ${giorno(giornoRientro)}, anticipo ${anticipoRientro.letto}g → si apre il ${giorno(siApre)}; `
          + `oggi (Roma) ${giorno(aGiorno(new Date()))} ${rientro ? '✓ APERTA' : '⛔ CHIUSA: sospensione piena, esce senza erogare e SENZA log'}`,
      );
      if (!rientro && anticipoRientro.letto <= 0) {
        console.log('   ⛔⛔ E l\'anticipo è ZERO: con questo valore la finestra non si apre MAI, nemmeno il giorno prima del rientro.');
      }
    }
  } else {
    console.log('7. sospensione attiva: nessuna ✓');
    const appenaFinita = (await eventi.pausaAppenaFinita(user.id, giorniCiclo.letto)) as { startDate: Date; endDate: Date } | null;
    if (appenaFinita && periodoLeggibile(appenaFinita)) {
      rientro = giornoDiRientro(appenaFinita);
      console.log(`8. pausa APPENA FINITA (${giorno(appenaFinita.startDate)} → ${giorno(appenaFinita.endDate)}): il cancello della pesata del rientro vale ancora, rientro ${giorno(rientro)}`);
    } else {
      console.log('8. pausa appena finita: nessuna ✓');
    }
  }

  if (rientro) {
    const manca = await mancaLaPesataDelRientro(prisma as never, user.id, rientro, anticipoRientro.letto);
    const da = inizioFinestraRientro(rientro, anticipoRientro.letto);
    const ultima = (await prisma.measurement.findFirst({
      where: { clientId: user.id }, orderBy: { date: 'desc' }, select: { date: true },
    })) as { date: Date } | null;
    console.log(
      `9. pesata del rientro: vale da ${giorno(da)} in poi; ultima misura ${giorno(ultima?.date)} `
        + `${manca ? '⛔ MANCA: menu trattenuto, parte la richiesta' : '✓'}`,
    );
  } else {
    console.log('9. pesata del rientro: non richiesta (nessun rientro in vista) ✓');
  }

  const inizioPiano = pianoScelto?.startDate ?? profilo?.planStartDate ?? null;
  if (inizioPiano) {
    const start = toDateOnly(inizioPiano.toISOString());
    const visibileDal = new Date(start.getTime() - anteprima.letto * 86_400_000);
    console.log(`10. finestra del piano: inizio ${giorno(start)}, anteprima ${anteprima.letto}g → visibile dal ${giorno(visibileDal)}, oggi ${giorno(oggiG)} ${oggiG.getTime() >= visibileDal.getTime() ? '✓' : '⛔ TROPPO PRESTO'}`);
    const mancaMisura = await mancaMisuraDiPartenza(prisma as never, user.id, inizioPiano, anteprima.letto);
    console.log(`11. misura di partenza di QUESTO piano: ${mancaMisura ? '⛔ MANCA (il menu resta trattenuto e si chiede)' : 'c\'è ✓'}`);
  } else {
    console.log('10. finestra del piano: ⛔ nessuna data di inizio');
  }

  /**
   * ⛔ **IL BUFFER E IL CANCELLO DEL CICLO** — due uscite mute, e la seconda è quella che dopo una
   * vacanza guarda un ciclo cominciato **prima** della partenza.
   */
  const ultimo = (await prisma.menuDay.findFirst({
    where: { clientId: user.id }, orderBy: { date: 'desc' }, select: { id: true, date: true },
  })) as { id: string; date: Date } | null;
  const inizioPiano2 = pianoScelto?.startDate ?? profilo?.planStartDate ?? null;
  const startG = inizioPiano2 ? toDateOnly(inizioPiano2.toISOString()) : oggiG;
  const daOggi = Math.max(oggiG.getTime(), startG.getTime());
  /** La stessa definizione del motore: un giorno in sospensione non è un buco. */
  const sospesoOggi = (t: number): boolean =>
    !!pausa && periodoLeggibile(pausa)
    && t >= giornoDelDato(pausa.startDate).getTime()
    && t <= giornoDelDato(pausa.endDate).getTime();
  const inCalendario = (
    (await prisma.menuDay.findMany({
      where: { clientId: user.id, date: { gte: new Date(daOggi) } },
      select: { date: true },
    })) as { date: Date }[]
  ).map((g) => g.date.getTime());

  if (!ultimo) {
    console.log('12. giornate di seguito da oggi: nessuna giornata in calendario → prima erogazione ✓');
  } else {
    /**
     * ⛔ **QUESTA RIGA RACCONTAVA LA REGOLA VECCHIA** — trovato il 26/8 sul caso Moreno, guardando
     * l'esito insieme a Simone.
     *
     * Diceva: «ultimo giorno in calendario X vs oggi Y ⛔ È OLTRE OGGI: non eroga altro finché non
     * passa». Era vero fino al 24/8; dal 25/8 il buffer conta le **giornate di seguito da oggi**
     * (`corsaDiGiornate`), perché guardare la data più alta lasciava i buchi aperti per sempre.
     * ⚠️ Sul caso Moreno l'esito coincideva — non erogava davvero — ma **per un'altra ragione**, e
     * questo tabulato esiste per una cosa sola: essere creduto quando qualcosa non torna. *Una
     * ragione falsa è peggio di un ordine sbagliato*, e stampata sullo strumento di misura è il
     * posto peggiore in cui metterla.
     *
     * ✅ Adesso chiama **le funzioni del motore**, non una copia: se la regola cambia di nuovo,
     * questa riga cambia con lei.
     */
    const corsa = corsaDiGiornate(inCalendario, daOggi, sospesoOggi);
    const bastano = corsa.quante >= GIORNATE_DAVANTI_CHE_BASTANO;
    console.log(
      `12. buffer in avanti: ${corsa.quante} giornate DI SEGUITO da oggi`
        + `${corsa.ultima ? ` (fino al ${giorno(new Date(corsa.ultima))})` : ''}`
        + ` · ne bastano ${GIORNATE_DAVANTI_CHE_BASTANO} `
        + `${bastano ? '⛔ NE HA ABBASTANZA: non eroga altro finché non ne resta meno di ' + GIORNATE_DAVANTI_CHE_BASTANO : '✓'}`,
    );
    /**
     * ⚠️ E si dice anche l'**ultima data in calendario**, che non è più il cancello ma resta il
     * numero che chi guarda ha in mente: se le due divergono, in mezzo c'è un buco.
     */
    if (corsa.ultima && ultimo.date.getTime() > corsa.ultima) {
      console.log(`    ⚠️ l'ultima giornata in calendario è il ${giorno(ultimo.date)}: fra le due c'è un BUCO, e le nuove ci vanno dentro.`);
    }
    /**
     * ⛔ **E il ciclo finisce dove finisce la corsa**, non all'ultima data: è la correzione del 25/8
     * (un buco apriva il cancello delle misure da solo). Qui si passa lo stesso ancoraggio del
     * motore, o questa riga direbbe «a posto» dove il motore chiede la pesata.
     */
    const fineDellaCorsa = new Date(corsa.ultima ?? daOggi - 86_400_000);
    const fineDelCiclo = ultimo.date.getTime() < fineDellaCorsa.getTime() ? ultimo : { date: fineDellaCorsa };
    /**
     * ⚠️ **Il cancello delle misure sta DENTRO il buffer, e questa riga deve stare dentro come lui**
     * (revisione del 26/8): con il buffer pieno il motore a `cycleNeedsMeasure` non ci arriva
     * nemmeno, e stampare un secondo ⛔ manderebbe a cercare una pesata che non ferma niente. Due
     * ⛔ in un tabulato che promette «il colpevole è la prima riga ⛔» sono un colpevole di troppo.
     */
    if (corsa.quante < GIORNATE_DAVANTI_CHE_BASTANO) {
      const serve = await (menu as never as { cycleNeedsMeasure(c: string, u: { date: Date }, n: number): Promise<boolean> })
        .cycleNeedsMeasure(user.id, fineDelCiclo, giorniCiclo.letto);
      console.log(`13. misure del ciclo (ciclo chiuso al ${giorno(fineDelCiclo.date)}): ${serve ? '⛔ MANCANO: il ciclo successivo resta trattenuto' : 'a posto ✓'}`);
    } else {
      console.log('13. misure del ciclo: non chiesto — con il buffer pieno il motore non ci arriva.');
    }
  }

  console.log(`14. profilo per la scelta dieta: regime=${profilo?.regime ?? '⛔ NULL'} · pasti=${profilo?.mealsPerDay ?? '⛔ NULL'} · famiglia=${profilo?.dietFamily ?? '—'} · stile=${profilo?.dietStyle ?? '—'} · obiettivo=${profilo?.objective ?? '— (→ dimagrimento)'} · percorso=${profilo?.pathType ?? '—'} · finestra=${profilo?.fastingWindow ?? '—'}`);
  const { pickDietFor } = await import('../src/catalog/pick-diet');
  const dietaScelta = (await pickDietFor(
    (where) => prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' }, select: { id: true, name: true, style: true, regime: true, mealsPerDay: true, fasting: true } }) as never,
    profilo as never,
  )) as { id: string; name: string | null; style: string | null; mealsPerDay: number | null; fasting: boolean } | null;
  console.log(`15. pickDiet: ${dietaScelta ? `"${dietaScelta.name}" (${dietaScelta.style}, ${dietaScelta.fasting ? 'fasting' : `${dietaScelta.mealsPerDay} pasti`}, id ${dietaScelta.id}) ✓` : '⛔ NESSUNA DIETA TROVATA — è questo il cancello muto'}`);
  if (dietaScelta) {
    const perLivello = (await prisma.dietDayTemplate.groupBy({ by: ['level'], where: { dietId: dietaScelta.id }, _count: { _all: true } }).catch(() => null)) as { level: number; _count: { _all: number } }[] | null;
    if (perLivello) {
      const righe = perLivello.map((r) => `livello ${r.level}: ${r._count._all} giornate`).join(' · ') || '⛔ ZERO GIORNATE';
      console.log(`16. giornate della dieta scelta: ${righe}${perLivello.some((r) => r.level === 1 && r._count._all > 0) ? ' ✓' : ' ⛔ NIENTE AL LIVELLO 1: il motore esce muto qui'}`);
    } else {
      const n = await prisma.dietDayTemplate.count({ where: { dietId: dietaScelta.id, level: 1 } });
      console.log(`16. giornate della dieta scelta al livello 1: ${n} ${n > 0 ? '✓' : '⛔ ZERO: il motore esce muto qui'}`);
    }
    /**
     * ⛔ **LA COMPLETEZZA SI CHIEDE ALLA PORTA DEL MOTORE** (`giornateComplete`/`pastiAttesi`).
     *
     * La prima stesura contava `meals.length < mealsPerDay`, che è **una domanda diversa** e sbaglia
     * in tutti e due i versi: su una dieta `fasting` con `mealsPerDay` nullo non trovava mai niente
     * (`length < 0`); su una da 4 pasti dava ⛔ su giornate che il motore serve (qui il 4 è trattato
     * come un 3, ed è dichiarato); un pasto con lo slot ma senza ricetta lo contava come pieno; due
     * pranzi e nessuna cena passavano per completi.
     *
     * ⚠️ **E il numero non è l'uscita**: il motore esce solo se **tutte** le giornate sono monche e
     * nessuna gemella della stessa famiglia ne ha di complete. Quindi qui si dice il numero e si dice
     * che la gemella esiste — non si finge un verdetto che questo script non può dare.
     */
    const { giornateComplete } = await import('../src/catalog/giornate-complete');
    const delLivello = (await prisma.dietDayTemplate.findMany({
      where: { dietId: dietaScelta.id, level: 1 }, select: { dayIndex: true, meals: true },
    })) as { dayIndex: number; meals: unknown }[];
    const esito = giornateComplete(delLivello, dietaScelta as never);
    console.log(
      `17. giornate complete (attesi: ${esito.attesi.join(', ')}): ${esito.complete.length} su ${delLivello.length}`
        + `${esito.complete.length ? ' ✓' : ' ⛔ TUTTE MONCHE: il motore cerca una gemella completa, e se non c\'è esce muto'}`
        + `${esito.monche && esito.complete.length ? ` (⚠️ ${esito.monche} monche, quelle sì vengono saltate)` : ''}`,
    );
  }

  /**
   * ⛔ **LE TRE USCITE DOPO LA COMPOSIZIONE** — quelle che il tabulato non aveva mai guardato,
   * perché arrivano dopo il punto in cui si smette di leggere.
   *
   * ⚠️ La terza (le violazioni) è l'unica che lascia una traccia: apre la segnalazione «Piano
   * bloccato», che questo script stampa in fondo. Le altre due escono in silenzio.
   */
  if (inizioPiano) {
    const start = toDateOnly(inizioPiano.toISOString());
    /**
     * ⚠️ L'override del rientro vale **anche** senza giornate in calendario: nel motore
     * `firstNewDate = start` e subito dopo `if (giornoDelRientro > today) firstNewDate = rientro`.
     * La prima stesura lo applicava solo al ramo con giornate — divergeva sul confronto col fine
     * piano qui sotto, in un caso raro ma vero (nessun menu + rientro in vista).
     */
    /**
     * ⛔ **LE DATE SI CHIEDONO AL MOTORE, non si rifanno qui** — 26/8, insieme alla riga 12.
     *
     * Questa riga ricostruiva «l'ultima data + 1», cioè la regola di prima del 25/8, e da allora il
     * motore compone **le date che mancano** (`dateDaComporre`). ⚠️ E c'era un'uscita che il
     * tabulato non censiva affatto: `if (daComporre.length === 0) return []`. Caso concreto:
     * ultimo giorno di piano, con il menu di oggi già in calendario — riga 12 ✓, riga 13 ✓, riga 5
     * ✓ (il confronto con la fine piano è stretto), e il motore esce a mano vuota **senza una sola
     * riga ⛔**. Il tabulato promette che il colpevole sia sempre qui dentro: adesso lo è.
     */
    const finePiano = pianoScelto?.endDate ? toDateOnly(pianoScelto.endDate.toISOString()) : null;
    const daPartire = rientro && rientro.getTime() > oggiG.getTime()
      ? Math.max(daOggi, rientro.getTime())
      : daOggi;
    const daComporre = dateDaComporre({
      presenti: inCalendario,
      da: daPartire,
      quante: giorniCiclo.letto,
      finePiano: finePiano ? finePiano.getTime() : null,
      sospeso: sospesoOggi,
    });
    console.log(
      daComporre.length
        ? `18. date da comporre: ${daComporre.map((t) => giorno(new Date(t))).join(', ')} (fine piano ${giorno(finePiano)}) ✓`
        : `18. date da comporre: ⛔ NESSUNA — o le giornate che servivano ci sono già tutte, o sono tutte oltre la fine del piano (${giorno(finePiano)}). Il motore esce a mano vuota.`,
    );
    /**
     * ⛔ **QUESTA USCITA È RAGGIUNGIBILE SOLO DA UN PARAMETRO A ZERO** — tracciata nel motore in
     * revisione. Dopo il cancello 18 la prima giornata del ciclo è `firstNewDate`, quindi il `break`
     * per fine piano non può scattare al primo giro e almeno una giornata entra sempre. L'unico modo
     * di uscire con `daySnapshots` vuoto è avere `menu_days_delivered` a **zero**: ciclo vuoto,
     * nessuna giornata composta, `return []` senza una riga da nessuna parte, **per tutte le
     * clienti**. È la forma esatta del difetto che questo tabulato esiste per non far più cercare.
     */
    console.log(
      `19. giornate del ciclo da comporre: ${giorniCiclo.letto} `
        + `${giorniCiclo.letto >= 1 ? '✓' : '⛔ ZERO: non si compone niente e non si scrive niente — è `menu_days_delivered` a zero'}`,
    );
  }
  /**
   * ⛔ **ANCHE LA VENTESIMA HA IL SUO VERDETTO** — corretto dalla revisione avversariale del 25/8.
   *
   * Questa riga era una **frase fissa**, senza ✓ e senza ⛔: l'unica delle venti. E il tabulato serve
   * a una cosa sola — *«se ricapita, la riga ⛔ dice quale»* — quindi un'uscita che non sa dire se è
   * scattata è un buco proprio nella promessa su cui la voce `giallo-finestra-di-rientro` fonda
   * l'attesa. ⚠️ Il verdetto qui si legge **dopo** l'erogazione, perché il blocco lo apre lei: si
   * stampa in fondo, dove il dato c'è, invece di indovinarlo prima.
   */
  console.log('20. esclusioni non sostituibili: apre «Piano bloccato» e non eroga — il verdetto è in fondo, dopo l\'erogazione.');

  console.log('\n--- erogazione ---');
  const creati = await menu.deliverIfEligible(user.id);
  console.log('--- fine ---\n');

  const dopo = await prisma.menuDay.count({ where: { clientId: user.id } });
  const bloccoDopo = await blocchi(user.id);

  /** Il verdetto dell'uscita 20, adesso che si può leggere: il blocco l'ha aperto questa erogazione? */
  const bloccoNuovo = bloccoDopo.filter((b) => !bloccoPrima.some((x) => x.id === b.id));
  console.log(
    bloccoNuovo.length
      ? `20. esclusioni non sostituibili: ⛔ SCATTATA — ha aperto ${bloccoNuovo.length} blocco/i adesso (motivo qui sotto)`
      : bloccoDopo.length
        ? '20. esclusioni non sostituibili: ⛔ un blocco c\'è, ma era GIÀ APERTO prima — non è questa erogazione ad averlo aperto'
        : '20. esclusioni non sostituibili: ✓ nessun blocco aperto',
  );

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
      console.log('→ E nessun blocco: si è fermato PRIMA di comporre, a un cancello.');
      console.log('  ⛔ Quale, lo dice il TABULATO qui sopra: cerca la prima riga con ⛔.');
      console.log('  Se sono tutte ✓, allora è il tabulato a essere incompleto — e va esteso prima di');
      console.log('  cercare altrove. (Fino al 24/8 mandava a `diag:cliente`, che le pause non le');
      console.log('  mostrava nemmeno: è così che il 23/8 se n\'è andata un\'ora.)');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
