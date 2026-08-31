/**
 * DIAGNOSTICA di UNA cliente: perché vede quel messaggio al posto del menu.
 *
 * Nasce da una domanda concreta (8/8): «questa cliente mi dice "riservato al nutrizionista",
 * mi spieghi perché?». Dal backoffice non si capisce, perché il messaggio che legge lei è la
 * traduzione gentile di uno stato calcolato al volo da `menu.service.ts → menuStatus()`, e le
 * cause possibili sono otto. Questo script le percorre nello stesso ordine del codice e dice
 * quale ha vinto, con dentro il perché.
 *
 * I due stati che nominano il nutrizionista sono diversi fra loro, e vanno distinti:
 *  - `awaiting_visit` → «il menu sarà pronto dopo la visita con il nutrizionista». È lo
 *    SCREENING: nel questionario ha dichiarato una condizione clinica o dei farmaci, quindi il
 *    percorso è supervisionato per scelta, non per un guasto. Si sblocca con la visita.
 *  - `blocked` → «la nutrizionista sta sistemando il tuo menu per rispettare le tue esclusioni».
 *    Qui invece qualcosa non torna: il motore non riesce a comporre un piano sicuro con le sue
 *    esclusioni e ha aperto una segnalazione.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:cliente -- cliente@esempio.it
 */
import { PrismaClient } from '@prisma/client';
import { FINESTRA_RIAPERTURA_DEFAULT } from '../src/escalations/apri-segnalazione';
import { attivoInCorso } from '../src/commerce/abbonamento-in-corso';
import { STATI_CON_UN_PIANO } from '../src/commerce/stati-abbonamento';
import { mancaMisuraDiPartenza } from '../src/menu/misura-di-partenza';
import { sospensioniDiUnaCliente } from '../src/clients/sospensioni-di-una-cliente';
import { statoSupervisione } from '../src/clients/via-libera-clinico';
import { giornoDiRientro, periodoLeggibile, rientroInArrivo } from '../src/pause/giorno-di-rientro';
import { mancaLaPesataDelRientro } from '../src/menu/pesata-del-rientro';

const prisma = new PrismaClient();

/**
 * ⛔ **UN PARAMETRO SI LEGGE COME LO LEGGE IL MOTORE.**
 *
 * Qui c'era `Number(riga?.value ?? 2) || 2`: su una casella **vuota** faceva 2 (per caso, via `||`),
 * ma su uno **zero scritto apposta** faceva ancora 2 — cioè rispondeva un numero diverso da quello
 * che usa `deliverIfEligible`. Erano quattro risposte diverse alla stessa domanda sparse nel
 * progetto; questa adesso è la stessa di `ConfigParamsService.getNumber`: vuoto o non numerico →
 * ripiego **e lo si dice**, zero scritto → zero.
 *
 * ⚠️ Non si riusa `ConfigParamsService` perché tirerebbe dentro Nest e l'audit per leggere una riga.
 * Ma la regola dev'essere la stessa, e `una-porta-per-i-cancelli.spec.ts` tiene fermo che lo sia.
 */
async function leggiNumero(chiave: string, ripiego: number): Promise<number> {
  const riga = (await prisma.configParam.findUnique({ where: { key: chiave } })) as { value: string } | null;
  const grezzo = riga?.value;
  if (typeof grezzo !== 'string' || grezzo.trim() === '') {
    console.log(`⚠️ Parametro ${chiave} ${riga ? 'VUOTO' : 'assente'} in Parametri: uso il ripiego ${ripiego}.`);
    return ripiego;
  }
  const n = Number(grezzo);
  if (Number.isNaN(n)) {
    console.log(`⚠️ Parametro ${chiave} non numerico ("${grezzo}"): uso il ripiego ${ripiego}.`);
    return ripiego;
  }
  return n;
}

function giorno(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

async function main(): Promise<void> {
  const email = (process.argv.slice(2).join(' ') || '').trim().toLowerCase();
  if (!email) {
    console.log('Indica l\'email:  npm run diag:cliente -- nome@esempio.it');
    return;
  }

  const user = (await prisma.user.findFirst({
    where: { email },
    select: {
      id: true, email: true, firstName: true, lastName: true, createdAt: true, deletedAt: true,
      emailVerifiedAt: true,
      clientProfile: {
        select: {
          name: true, planStartDate: true, screeningFlag: true, onboardingCompletedAt: true,
      /**
       * ⛔ **QUESTI DUE MANCAVANO, ed è tutto il difetto** (31/8). Senza, `statoSupervisione` qui
       * sotto riceve un profilo senza decisione e risponde SEMPRE «mai valutata»: il ramo «visita
       * scaduta» non poteva scattare mai, e il via libera era invisibile. Lo strumento nato per
       * spiegare il difetto del 23/8 lo rifaceva identico.
       */
      idoneita: true, idoneitaVisitaEntro: true,
          regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
          allergies: true, intolerances: true, dislikedFoods: true,
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true, user: { select: { email: true } } } },
        },
      },
    },
  })) as never as {
    id: string; email: string; firstName: string | null; lastName: string | null;
    createdAt: Date; deletedAt: Date | null; emailVerifiedAt: Date | null;
    clientProfile: {
      name: string | null; planStartDate: Date | null; screeningFlag: boolean;
      idoneita: string | null; idoneitaVisitaEntro: Date | null;
      onboardingCompletedAt: Date | null; regime: string | null; dietStyle: string | null;
      dietFamily: string | null; mealsPerDay: number | null;
      allergies: string[]; intolerances: string[]; dislikedFoods: string[];
      assignedCoach: { displayName: string } | null;
      assignedNutritionist: { displayName: string; user: { email: string } } | null;
    } | null;
  } | null;

  if (!user) { console.log(`Nessun utente con email ${email}.`); return; }
  const p = user.clientProfile;

  console.log('=== CHI È ===');
  console.log(`${p?.name ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '(senza nome)')} · ${user.email}`);
  console.log(`Registrata: ${giorno(user.createdAt)} · email verificata: ${giorno(user.emailVerifiedAt)}`);
  console.log(`Questionario: ${p?.onboardingCompletedAt ? `completato il ${giorno(p.onboardingCompletedAt)}` : 'NON completato'}`);
  console.log(`Coach: ${p?.assignedCoach?.displayName ?? '— nessuna —'} · Nutrizionista: ${p?.assignedNutritionist?.displayName ?? '— nessuna —'}`);
  console.log(`Dieta: ${p?.dietFamily ?? '(famiglia non fissata)'} · ${p?.dietStyle ?? '—'} · ${p?.regime ?? '—'} · ${p?.mealsPerDay ?? '—'} pasti`);
  console.log(`Inizio piano: ${giorno(p?.planStartDate)}`);
  console.log(`Allergie: ${(p?.allergies ?? []).join(', ') || '—'}`);
  console.log(`Intolleranze: ${(p?.intolerances ?? []).join(', ') || '—'}`);
  console.log(`Cibi esclusi (${(p?.dislikedFoods ?? []).length}): ${(p?.dislikedFoods ?? []).join(', ') || '—'}`);

  // --- Abbonamenti ---
  const subs = (await prisma.subscription.findMany({
    where: { clientId: user.id },
    select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { name: true, priceCents: true, period: true } } },
    orderBy: { createdAt: 'desc' },
  })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string; priceCents: number; period: string | null } | null }[];
  console.log('\n=== ABBONAMENTI ===');
  if (subs.length === 0) console.log('nessuno');
  else console.table(subs.map((s) => ({
    piano: s.plan?.name ?? '—',
    prezzo: s.plan ? `€${(s.plan.priceCents / 100).toFixed(2)}` : '—',
    stato: s.status, dal: giorno(s.startDate), al: giorno(s.endDate),
  })));

  /**
   * ⛔ **LE SOSPENSIONI — il buco che il 23/8 ha tenuto ferma una cliente per ore.**
   *
   * Questo script diceva «idonea» mentre il menu non arrivava, e il cancello era una **richiesta di
   * pausa 17→23/8 auto-approvata**: le pause non le mostrava, quindi la diagnostica rispondeva a una
   * domanda più stretta di quella che si sta facendo chi la lancia. Due ipotesi ragionate a tavolino
   * sono andate a vuoto prima che qualcuno andasse a guardare in tabella.
   *
   * ⚠️ Si stampa la **stessa** risposta della scheda in back office
   * (`sospensioniDiUnaCliente`), non una query riscritta qui: due letture della stessa cosa
   * divergono, e divergono proprio mentre le si confronta per capire perché una cliente non mangia.
   *
   * ⚠️ **«Riprende il» è il primo giorno di dieta**, non l'ultimo sospeso: se in tabella c'è scritto
   * «fino al 23», qui si legge «riprende il 24». È la convenzione della card, e la conversione la fa
   * `giornoDiRientro` una volta sola.
   */
  const sosp = await sospensioniDiUnaCliente(prisma as never, user.id);
  console.log('\n=== SOSPENSIONI ===');
  if (!sosp.periodi.length) {
    console.log('nessun periodo di sospensione (né passato né futuro)');
  } else {
    console.log('periodi VERI (sono questi che fermano i menu):');
    console.table(sosp.periodi.map((p) => ({
      stato: p.stato, dal: p.dal, 'riprende il': p.riprendeIl, giorni: p.giorni, origine: p.origine,
    })));
    const inCorso = sosp.periodi.filter((p) => p.stato === 'in_corso');
    for (const p of inCorso) {
      // ⚠️ Il verdetto in fondo distingue «ferma» da «finestra di rientro aperta»: qui si dice solo
      // il fatto, senza aggiungere una conseguenza che dal 23/8 non è più sempre vera.
      console.log(`⛔ SOSPENSIONE IN CORSO dal ${p.dal} (origine: ${p.origine}), riprende il ${p.riprendeIl} — vedi il verdetto in fondo.`);
    }
    const future = sosp.periodi.filter((p) => p.stato === 'futura');
    for (const p of future) console.log(`⚠️ sospensione FUTURA dal ${p.dal}: da quel giorno i menu si fermano.`);
  }
  if (sosp.richieste.length) {
    console.log('richieste di pausa (anche già decise):');
    console.table(sosp.richieste.map((r) => ({
      stato: r.stato, dal: r.dal, 'riprende il': r.riprendeIl, giorni: r.giorni,
      'decisa da': r.decisaDa ?? '—', 'decisa il': giorno(r.decisaIl),
      // ⚠️ `staffNote` è testo libero: intero allargherebbe la tabella oltre il terminale, e una
      // tabella che va a capo non la legge nessuno. Il testo intero sta in scheda.
      nota: (r.nota ?? '—').slice(0, 40),
    })));
  }
  if (sosp.adesso?.stato && sosp.adesso.stato !== 'none') {
    console.log(`modalità viaggio sul profilo adesso: ${sosp.adesso.stato} (dal ${sosp.adesso.dal ?? '—'}, riprende il ${sosp.adesso.riprendeIl ?? '—'})`);
  }
  if (sosp.viaggio.length) {
    /**
     * ⚠️ Lo storico della card «Modalità viaggio»: chi l'ha messa, quando, e con che date. Veniva
     * calcolato e buttato via — una query in più per niente, e l'unica delle quattro cose che il
     * brief chiedeva di mostrare e che non compariva.
     */
    console.log('storico modalità viaggio (dal registro):');
    console.table(sosp.viaggio.slice(0, 10).map((v) => ({
      quando: giorno(v.quando), stato: v.stato ?? '—', dal: v.dal ?? '—',
      'riprende il': v.riprendeIl ?? '—', giorni: v.giorni ?? '—', chi: v.chi ?? '—',
    })));
  }
  if (sosp.dichiarati.length) {
    console.log(`⚠️ periodi DICHIARATI nel questionario (non fermano niente, e non l'hanno mai fatto): ${sosp.dichiarati.map((d) => `${d.dal ?? '?'}→${d.al ?? '?'}`).join(', ')}`);
  }

  // --- Segnalazioni aperte ---
  const esc = (await prisma.escalation.findMany({
    where: { clientId: user.id, status: { in: ['open', 'in_progress'] as never } },
    select: { id: true, reason: true, source: true, category: true, status: true, createdAt: true, assignedToId: true },
    orderBy: { createdAt: 'desc' },
  })) as { id: string; reason: string; source: string; category: string; status: string; createdAt: Date; assignedToId: string | null }[];
  /**
   * ⚠️ **LE RISOLTE DI RECENTE, che questo strumento non guardava** (21/8).
   *
   * Chiudere una segnalazione apre una **tregua** (`escalation_reopen_days`, 14 giorni): dentro
   * quella finestra la stessa causa non si riapre da sola. Per «Piano bloccato» voleva dire che il
   * blocco restava e il cartello spariva — e qui sotto sarebbe uscito «idonea, ma le giornate non
   * sono ancora state erogate», che è la stessa risposta inutile del caso Giusy.
   *
   * Dal 21/8 quel blocco si riapre invece di tacere (`statoNonAvviso`), ma la riga risolta va
   * stampata lo stesso: è l'unico posto da cui si capisce che qualcuno l'aveva chiusa, e quando.
   */
  const risolteDiRecente = (await prisma.escalation.findMany({
    where: {
      clientId: user.id,
      status: 'resolved' as never,
      resolvedAt: { gte: new Date(Date.now() - FINESTRA_RIAPERTURA_DEFAULT * 86_400_000) },
    },
    select: { id: true, reason: true, category: true, resolvedAt: true },
    orderBy: { resolvedAt: 'desc' },
  })) as { id: string; reason: string; category: string; resolvedAt: Date | null }[];

  console.log('\n=== SEGNALAZIONI APERTE ===');
  if (esc.length === 0) console.log('nessuna');
  else for (const e of esc) {
    console.log(`· [${e.category}] ${giorno(e.createdAt)} — ${e.status}${e.assignedToId ? '' : '  ⚠ NON ASSEGNATA A NESSUNO'}`);
    console.log(`  ${e.reason}`);
  }

  if (risolteDiRecente.length) {
    console.log(`\n=== CHIUSE NEGLI ULTIMI ${FINESTRA_RIAPERTURA_DEFAULT} GIORNI (la tregua) ===`);
    for (const e of risolteDiRecente) {
      const giorniFa = e.resolvedAt ? Math.floor((Date.now() - e.resolvedAt.getTime()) / 86_400_000) : null;
      console.log(`· [${e.category}] chiusa il ${giorno(e.resolvedAt)}${giorniFa === null ? '' : ` (${giorniFa} giorni fa)`}`);
      console.log(`  ${e.reason}`);
    }
    console.log('  → Dentro la tregua la stessa causa non riapre una riga NUOVA. Per «Piano bloccato»');
    console.log('    dal 21/8 si riapre quella vecchia col motivo di adesso: se la vedi tornare aperta,');
    console.log('    non è un doppione — è il motore che ancora non compone.');
  }

  // --- Menu ---
  const oggi = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Europe/Rome' }).format(new Date()) + 'T00:00:00.000Z');
  const [totMenu, visibili, ultimo] = await Promise.all([
    prisma.menuDay.count({ where: { clientId: user.id } }),
    prisma.menuDay.count({ where: { clientId: user.id, visibleFrom: { lte: oggi }, date: { gte: oggi } } }),
    prisma.menuDay.findFirst({ where: { clientId: user.id }, orderBy: { date: 'desc' }, select: { date: true } }) as Promise<{ date: Date } | null>,
  ]);
  const misure = await prisma.measurement.count({ where: { clientId: user.id } });
  /**
   * LA PESATA DEL CICLO — il caso che questo script non sapeva riconoscere (13/8).
   *
   * Su Giusy la domanda era esattamente «perché non riceve il menu?», e qui sotto sarebbe uscito
   * «idonea, ma le giornate non sono ancora state erogate»: vero e inutile. La causa era il cancello
   * `cycleNeedsMeasure`, che trattiene i giorni nuovi finché non arriva una pesata **dentro il ciclo
   * corrente** — e che nessuno dei due strumenti (né l'app né questo script) nominava.
   *
   * Il ciclo corrente parte `giorniPerCiclo - 1` giorni prima dell'ultima giornata erogata: una
   * pesata precedente a quella data non conta, anche se è di ieri rispetto a oggi.
   */
  const ultimaPesata = (await prisma.measurement.findFirst({
    where: { clientId: user.id },
    orderBy: { date: 'desc' },
    select: { date: true },
  })) as { date: Date } | null;
  const giorniPerCiclo = await leggiNumero('menu_days_delivered', 2);
  /**
   * Lo stato del profilo che cambia le regole: sblocco misure, modalità viaggio, piano fermato.
   *
   * ⚠️ L'11/8 questo diag ha fatto perdere un'ora su Gioia proprio perché **non stampava la
   * modalità viaggio**: fino a quel giorno «in vacanza» spegneva il gate delle misure, quindi la
   * cliente riceveva otto giornate con una sola pesata e qui non compariva niente di anomalo.
   * Una diagnostica che non nomina lo stato che ha disattivato una regola manda a cercare il
   * difetto altrove — che è peggio del non averla.
   */
  const statoProfilo = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: {
      measuresUnlockedUntil: true,
      travelState: true, travelStart: true, travelEnd: true,
      planHeldAt: true, planHeldReason: true,
    },
  })) as {
    measuresUnlockedUntil: Date | null;
    travelState: string | null; travelStart: Date | null; travelEnd: Date | null;
    planHeldAt: Date | null; planHeldReason: string | null;
  } | null;
  const sbloccoFino = statoProfilo;
  let mancaPesataCiclo = false;
  let inizioCiclo: Date | null = null;
  if (ultimo && oggi.getTime() >= ultimo.date.getTime()) {
    inizioCiclo = new Date(ultimo.date.getTime() - (giorniPerCiclo - 1) * 86_400_000);
    mancaPesataCiclo = !ultimaPesata || ultimaPesata.date.getTime() < inizioCiclo.getTime();
  }
  console.log('\n=== MENU E MISURE ===');
  console.log(`Giornate erogate: ${totMenu} · visibili oggi: ${visibili} · ultima: ${giorno(ultimo?.date)}`);
  console.log(`Misure registrate: ${misure} · ultima pesata: ${giorno(ultimaPesata?.date)}`);
  console.log(
    `Ciclo corrente: ${inizioCiclo ? `dal ${giorno(inizioCiclo)}` : '—'} · pesata del ciclo: ${
      inizioCiclo ? (mancaPesataCiclo ? 'MANCA ⚠' : 'presente ✓') : 'non pertinente'
    }`,
  );
  if (statoProfilo?.travelState === 'in_vacanza' || statoProfilo?.travelState === 'in_partenza') {
    const fine = statoProfilo.travelEnd
      ? `fino al ${giorno(statoProfilo.travelEnd)}`
      : statoProfilo.travelStart
        ? `dal ${giorno(statoProfilo.travelStart)}, senza data di fine`
        : 'senza date';
    console.log(`Modalità viaggio: ${statoProfilo.travelState} (${fine}).`);
    console.log('  → NON esenta dalle misure (dall\'11/8): i menu arrivano solo con la pesata del ciclo,');
    console.log('    come per tutte. Cambia solo QUALI piatti sceglie l\'agente dieta.');
  }
  if (statoProfilo?.planHeldAt) {
    console.log(
      `⏸  PIANO FERMATO dal nutrizionista il ${giorno(statoProfilo.planHeldAt)}` +
        `${statoProfilo.planHeldReason ? ` — «${statoProfilo.planHeldReason}»` : ''}.`,
    );
    console.log('  → I giorni NUOVI non partono; quelli già ricevuti restano. Si riattiva dalla scheda cliente.');
  }
  if (sbloccoFino?.measuresUnlockedUntil) {
    const attivoSblocco = sbloccoFino.measuresUnlockedUntil.getTime() > Date.now();
    console.log(
      `Sblocco della coach: ${attivoSblocco ? 'ATTIVO' : 'scaduto'} fino al ${sbloccoFino.measuresUnlockedUntil.toISOString().slice(0, 16).replace('T', ' ')}` +
      (attivoSblocco ? '  (riapre l\'app, NON eroga il menu: la pesata serve comunque)' : ''),
    );
  }

  // --- Il verdetto, nello stesso ordine di menuStatus() ---
  /**
   * ⚠️ **`STATI_CON_UN_PIANO`, non `'active'`** (21/8). Qui c'era `s.status === 'active'`, e da
   * quando un piano che comincia più avanti nasce `queued` questo strumento diceva **«Nessun piano
   * attivo»** a chi aveva comprato e aspettava la partenza. È esattamente quello che ha stampato su
   * Sonia — piano «Conosciamoci» in coda dal 22/8 — mentre `menuStatus` diceva un'altra cosa.
   * Una diagnostica che risponde diversamente dal codice manda a cercare il difetto dove non c'è.
   */
  const attivo = subs.some(
    (s) => (STATI_CON_UN_PIANO as readonly string[]).includes(s.status) && (!s.endDate || s.endDate.getTime() >= oggi.getTime()),
  );
  const inAttesa = subs.some((s) => s.status === 'pending');
  const bloccata = esc.find((e) => e.source === 'engine' && e.reason.includes('Piano bloccato'));
  // Il piano che EROGA lo sceglie la stessa funzione dell'erogazione, non un `findFirst` a caso.
  const pianoDiAdesso = attivoInCorso(subs as never) as { startDate: Date | null; plan: { period: string | null } | null } | null;
  const inizioDelPiano = pianoDiAdesso?.startDate ?? p?.planStartDate ?? null;
  const paramFinestra = (await prisma.configParam.findUnique({ where: { key: 'menu_visible_days_before_start' } })) as { value: string } | null;
  const giorniPrima = Number(paramFinestra?.value ?? 2) || 2;
  const visibileDal = inizioDelPiano ? new Date(inizioDelPiano.getTime() - giorniPrima * 86_400_000) : null;
  /**
   * ⚠️ **LA MISURA DI QUESTO PIANO, non «una misura qualsiasi»** (21/8). Qui c'era `misure === 0`,
   * cioè la regola di prima dell'11/8: una cliente con pesate di tre settimane fa passava il
   * controllo mentre il codice la teneva ferma su «Inserisci le misure iniziali».
   */
  const mancaPuntoA = attivo && inizioDelPiano
    ? await mancaMisuraDiPartenza(prisma as never, user.id, inizioDelPiano, giorniPrima)
    : false;

  /**
   * ⚠️ I dati dei due rami nuovi si preparano qui, con le **stesse porte del motore**: la
   * sospensione in corso da `sospensioniDiUnaCliente`, la finestra da `rientroInArrivo`, la pesata
   * da `mancaLaPesataDelRientro`. Riscriverne una a mano vorrebbe dire una diagnostica che risponde
   * a una domanda leggermente diversa da quella del servizio — cioè la si crede e sbaglia.
   */
  const sospesaOra = sosp.periodi.find((x) => x.stato === 'in_corso') ?? null;
  const anticipoRientro = await leggiNumero('menu_visible_days_before_return', 1);
  const eventoInCorso = sospesaOra
    ? ((await prisma.event.findFirst({ where: { id: sospesaOra.id }, select: { startDate: true, endDate: true } })) as { startDate: Date; endDate: Date } | null)
    : null;
  const giornoRientro = eventoInCorso && periodoLeggibile(eventoInCorso) ? giornoDiRientro(eventoInCorso) : null;
  const rientroAperto = eventoInCorso && periodoLeggibile(eventoInCorso)
    ? rientroInArrivo(eventoInCorso, new Date(), anticipoRientro) !== null
    : false;
  const aperturaFinestra = giornoRientro
    ? new Date(giornoRientro.getTime() - Math.max(0, Math.floor(anticipoRientro)) * 86_400_000)
    : null;
  const mancaPesataRientro = rientroAperto && giornoRientro
    ? await mancaLaPesataDelRientro(prisma as never, user.id, giornoRientro, anticipoRientro)
    : false;
  const supervisione = statoSupervisione(p as never);

  /**
   * ⚠️ **La decisione clinica si STAMPA**, non solo si usa: chi legge deve poter vedere da sé
   * perché il verdetto dice quello che dice — e il 31/8 il difetto è stato invisibile proprio
   * perché questa riga non c'era.
   */
  if (p?.screeningFlag) {
    console.log(
      `Via libera clinico: ${supervisione.motivo}`
      + (supervisione.visitaEntro ? ` (visita entro il ${supervisione.visitaEntro})` : '')
      + ` → i menu ${supervisione.bloccata ? 'sono FERMI ⛔' : 'non sono fermi da qui ✓'}`,
    );
  }

  console.log('\n=== PERCHÉ VEDE QUEL MESSAGGIO ===');
  if (subs.length > 0 && !attivo && !inAttesa) {
    console.log('STATO: "Nessun piano attivo" — non ha un abbonamento attivo entro il periodo.');
  } else if (visibili > 0) {
    console.log('STATO: "menu disponibile" — nessun messaggio. Se lei ne vede uno, ricarica l\'app.');
  } else if (supervisione.bloccata) {
    /**
     * ⛔ **`supervisione.bloccata`, NON `screeningFlag`** — corretto il 31/8, e il difetto era di
     * questo file. Qui c'era `else if (p?.screeningFlag)`: il **fatto** che il questionario l'ha
     * segnalata, che resta vero per sempre. Quindi il verdetto diceva «Menu dopo la visita» anche a
     * chi aveva il via libera — ed essendo il primo ramo, la catena non arrivava nemmeno a guardare
     * la sospensione e la finestra di rientro, che erano il punto.
     *
     * ⚠️ Il costo, misurato: su Patrizia, il 31/8, questa riga ha mandato due persone a inseguire
     * per mezza mattinata una visita che non c'era da fare, mentre il menu era fermo per tutt'altro.
     * *Una ragione falsa è peggio di un ordine sbagliato.*
     */
    if (supervisione.motivo === 'visita_scaduta') {
      console.log(`STATO: "Menu dopo la visita" — la VISITA È SCADUTA (era entro il ${supervisione.visitaEntro}).`);
      console.log('  L\'erogazione è ferma da quel giorno. Si sblocca con una valutazione clinica nuova dalla scheda.');
    } else {
      console.log(
        'STATO: "Menu dopo la visita" — percorso SUPERVISIONATO e NON ANCORA VALUTATO.\n' +
        '  Nel questionario ha dichiarato una condizione clinica o dei farmaci, e nessuno ha ancora\n' +
        '  preso la decisione clinica. NON è un guasto: è la regola di sicurezza.\n' +
        '  Si sblocca dalla scheda, con «Può proseguire» oppure «Serve una visita» + la data.',
      );
    }
  } else if (sospesaOra) {
    /**
     * ⛔ **IL RAMO CHE MANCAVA — ed è il caso Lorena, 23/8.**
     *
     * La sezione SOSPENSIONI qui sopra c'era già in questa consegna, ma il **verdetto** — la riga che
     * una persona legge e su cui decide — non la guardava: si finiva nell'`else` finale, «idonea, ma
     * le giornate non sono ancora state erogate». Identico a prima della correzione. Aggiungere una
     * tabella duecento righe più su e non toccare la conclusione vuol dire lasciare il difetto dov'era
     * e crederlo chiuso: chi lancia lo script legge la conclusione.
     *
     * ⚠️ **E «in corso» non vuol dire «ferma»**: dal 23/8, nell'ultimo giorno sospeso la finestra di
     * rientro è aperta e il motore eroga **il menu del giorno di rientro**. Dire «l'erogazione è ferma»
     * proprio quel giorno — che è il giorno in cui serve di più — sarebbe il contrario di quello che
     * fa il motore, e i due strumenti si contraddirebbero.
     */
    if (rientroAperto) {
      console.log(`STATO: SOSPESA fino a oggi, ma la FINESTRA DI RIENTRO È APERTA: riprende il ${sospesaOra.riprendeIl}.`);
      console.log(`  Il motore deve erogare il menu del ${sospesaOra.riprendeIl}${mancaPesataRientro ? ', ma prima serve la PESATA DEL RIENTRO — ed è quella che manca ⛔' : ' ✓'}.`);
      if (!mancaPesataRientro) {
        console.log('  ⚠️ Pesata c\'è e finestra aperta: se il menu non è arrivato lo stesso, il cancello è più');
        console.log('     avanti — `npm run prova:erogazione -- <email>` lo stampa uno per uno.');
      }
    } else {
      console.log(`STATO: SOSPESA — sospensione in corso dal ${sospesaOra.dal} (origine: ${sospesaOra.origine}).`);
      console.log(`  L'erogazione è ferma di proposito e riprende il ${sospesaOra.riprendeIl}; la finestra di`);
      console.log(`  rientro si apre ${anticipoRientro} giorn${anticipoRientro === 1 ? 'o' : 'i'} prima, cioè il ${giorno(aperturaFinestra)}.`);
      console.log('  ⚠️ Questo è il cancello che il 23/8 è rimasto invisibile per ore: fino a oggi lo script');
      console.log('     le sospensioni non le mostrava, e il verdetto diceva «idonea».');
    }
  } else if (!p?.planStartDate) {
    console.log('STATO: "Menu in preparazione" — non ha ancora scelto la data di inizio piano.');
  } else if (pianoDiAdesso?.plan?.period === 'monitoring') {
    console.log('STATO: "Monitoraggio" — qui i menu non arrivano, ed è giusto così: il piano è');
    console.log('  il peso sotto controllo e la coach raggiungibile. I menu di rientro li eroga');
    console.log('  `monitoring.service.ts` per conto suo quando il peso risale.');
  } else if (visibileDal && oggi.getTime() < visibileDal.getTime()) {
    console.log(`STATO: "Il menu comparirà il ${giorno(visibileDal)}" — il piano parte il ${giorno(inizioDelPiano)}`);
    console.log(`  e il menu si sblocca ${giorniPrima} giorni prima, per dare tempo alla spesa. Non è un guasto.`);
  } else if (mancaPuntoA) {
    console.log('STATO: "Inserisci le misure iniziali" — manca la misura di partenza DI QUESTO PIANO.');
    console.log(`  ⚠️ Non basta una pesata qualsiasi: dev'essere dentro la finestra del piano che eroga`);
    console.log(`  (dal ${giorno(visibileDal)}). Misure registrate in tutto: ${misure}.`);
  } else if (statoProfilo?.planHeldAt) {
    console.log(`STATO: "Piano fermato" — l'ha fermato il nutrizionista il ${giorno(statoProfilo.planHeldAt)}.`);
    console.log('  ⚠️ Sta PRIMA di «piano bloccato» anche nel codice: se sono accesi tutti e due, quello');
    console.log('  che descrive la situazione vera è questo. Si riattiva dalla scheda cliente.');
  } else if (bloccata) {
    console.log(
      'STATO: "Stiamo personalizzando il tuo piano" — PIANO BLOCCATO.\n' +
      `  Segnalazione aperta il ${giorno(bloccata.createdAt)}:\n  ${bloccata.reason}\n` +
      '  Il motore non riesce a comporre un piano sicuro con le sue esclusioni: o mancano\n' +
      '  ricette compatibili, o un\'esclusione non ha sostituto sicuro.\n' +
      '  ⚠️ CHIUDERE la segnalazione NON basta e non è il rimedio: il blocco non è uno stato\n' +
      '  salvato, si ricalcola a ogni composizione del menu. Se il motore ancora non compone, la\n' +
      '  riga torna aperta col motivo di adesso (dal 21/8; prima restava muta per 14 giorni e la\n' +
      '  cliente leggeva «Menu in preparazione»). Il rimedio è togliere la causa scritta qui sopra:\n' +
      '  il piatto dal catalogo della sua dieta, o l\'esclusione se è troppo larga.',
    );
  } else if (mancaPesataCiclo) {
    console.log(
      'STATO: "Serve la tua pesata" — CANCELLO DELLE MISURE DEL CICLO.\n' +
      `  L'ultima giornata erogata è del ${giorno(ultimo?.date)}, quindi il ciclo corrente parte dal\n` +
      `  ${giorno(inizioCiclo)}. L'ultima pesata registrata è del ${giorno(ultimaPesata?.date)}: è PRIMA di quella data,\n` +
      '  quindi i giorni nuovi restano trattenuti. Non è un guasto: è la regola «nessun menu senza\n' +
      '  misura» (decisione Simone dell\'11/8).\n' +
      '  Si sblocca SOLO con una pesata nuova, inserita da lei dall\'app. Lo sblocco della coach\n' +
      '  riapre l\'app e toglie il popup, ma NON eroga il menu: se l\'hai sbloccata e non è arrivato\n' +
      '  niente, è questo.',
    );
  } else {
    console.log('STATO: "Menu in preparazione" — idonea, ma le giornate non sono ancora state erogate.');
  }

  console.log(
    '\n=== DOVE LO VEDE IL NUTRIZIONISTA ===\n' +
    '· Backoffice → Segnalazioni (e nella app staff, scheda della paziente).\n' +
    '· ⚠️ NON riceve nessuna notifica: le segnalazioni "Piano bloccato" vengono scritte\n' +
    '  direttamente a database da personal-base e menu, senza passare dal servizio che avvisa\n' +
    '  coach e nutrizionista. Il tipo di notifica "Dieta bloccata" esiste ed è nel catalogo,\n' +
    '  ma nessuno lo manda. Finché non si corregge, la segnalazione la vede solo chi va a\n' +
    '  guardare l\'elenco di sua iniziativa.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
