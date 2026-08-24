import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { fasceDelDigiuno, type ProfiloDigiuno } from '../menu/vista-orologio';
import { SELECT_OROLOGIO, orologioAzzerato, restaQualcosaDellOrologio } from '../menu/uscita-dal-digiuno';
import { AuthService } from '../auth/auth.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import type { EsitoApertura } from '../coach-tasks/porta-delle-attivita';
import { PrenotazioniService } from '../agenda/prenotazioni.service';
import { TIPO_VISITA_DA_FISSARE, testoVisitaDaFissare } from './visita-da-fissare';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { statoPerGiornoDiInizio, STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { coachTeamScope, isCoachLike } from '../common/coach-team';
import { perimetroClienti, type PerimetroClienti } from '../common/perimetro-clienti';
import { subscriptionEnd, pickMainSubscription } from '../commerce/commerce.service';
import { campiCambiati } from '../common/diff-campi';
import { ruoloPuo } from '../permissions/permesso-di-ruolo';
import { assegnaSenzaGlutineEAvvisa, dichiaraSenzaGlutine } from '../menu/senza-glutine';
// La pulizia dei gusti scritti dalla scheda: spezza i tag e ferma le spezie (la stessa del
// questionario e del profilo in app), più i «non alimenti» delle intolleranze.
import { fraseAiutoEsclusioni, problemiEsclusioni } from '../common/esclusioni-scritte-bene';
import { filtraSpezie, type EsitoSpezia } from '../menu/spezie';
import { NON_ALIMENTI } from '../common/allergie';
import { NOME_PASTO } from '../catalog/giornate-complete';
import { pastiPromessiCheMancano } from '../catalog/struttura-per-digiuno';
import { dietaMostrataPer } from '../catalog/dieta-mostrata';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { scostamentoDieta } from './scostamento-dieta';
import { PauseService } from '../pause/pause.service';
import { giorniSospesi, giornoDiRientro, ultimoGiornoSospeso } from '../pause/giorno-di-rientro';
import { sospensioniDiUnaCliente } from './sospensioni-di-una-cliente';
import { type Idoneita, daValutare, testoNota, validaDecisione } from './idoneita';
import { giornoLocale, toDateOnly } from '../common/date-only';
import { finestraMenu, MENU_MAX_GIORNI, PeriodoNonValido } from './finestra-menu';
// Chi eroga oggi e chi è in coda: una funzione sola per tutto il prodotto (caso Polidoro).
import { eInCoda, staErogando } from '../commerce/abbonamento-in-corso';
// La matita dice cosa sta per rompere: i piani che lo spostamento farebbe sovrapporre (voce 259).
import { fraseSovrapposizione, pianiSovrapposti } from './sovrapposizione-piani';
import { UpdateClientDto } from './dto/update-client.dto';
import { aGiorno } from '../common/date-only';
import { etichettaUnitaAcqua, obiettivoNellaUnita, quantitaNellaUnita } from '../common/unita-acqua';

const USER_FIELDS = ['firstName', 'lastName', 'addressLine', 'postalCode', 'city', 'province', 'phone', 'codiceFiscale'] as const;
/**
 * ⛔ **`fastingWindow` NON È PIÙ IN QUESTO ELENCO** (Simone, 21/8: «non ha più senso scegliere i
 * pasti, sono campi che devono proprio sparire»).
 *
 * Questo elenco è la porta che decide cosa la scheda staff può scrivere sul profilo: il ciclo qui
 * sotto lo riempie **ciecamente**, quindi togliere il campo dal DTO non bastava — bastava un
 * chiamante che lo passasse lo stesso e la finestra finiva in database senza nessun controllo.
 *
 * Quali pasti riceve chi digiuna lo deriva l'orologio, e l'orologio lo imposta la cliente. ⚠️ Il
 * permesso «Cambia i pasti del digiuno» (`change_fasting_window`) resta nella tabella dei ruoli ma
 * da qui non lo guarda più nessuno: non si toglie in questa consegna perché toglierlo è un'altra
 * decisione — chi ce l'ha oggi va avvisato prima.
 */
const PROFILE_FIELDS = ['name', 'age', 'sex', 'heightCm', 'startWeightKg', 'startWaistCm', 'startHipsCm', 'regime', 'dietStyle', 'dietFamily', 'mealsPerDay', 'objective', 'pathType', 'coachStyle', 'character', 'allergies', 'intolerances', 'dislikedFoods', 'themeColor', 'activityLevel', 'isStoreReviewer'] as const;

/**
 * Scheda cliente per lo staff: aggrega anagrafica, questionario, obiettivo,
 * pesate (misure), acquisti e stato CRM in un'unica vista.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly menu: MenuService,
    // ⚠️ Servono a «serve una visita»: l'attività si apre dal punto unico che manda anche la push
    // (`apriAttivita`), e il credito visite lo conta chi già lo conta per l'app.
    private readonly coachTasks: CoachTasksService,
    private readonly prenotazioni: PrenotazioniService,
    /**
     * ⚠️ La sospensione da modalità viaggio passa dal **punto unico** che sospende già le pause
     * chieste dalle clienti: crea l'`event`, allunga la scadenza e sposta la coda. Una seconda
     * strada che scrive `pause_period` per conto suo sarebbe la stessa cosa che ha prodotto due
     * porte con due effetti economici diversi.
     */
    private readonly pause: PauseService,
  ) {}

  private readonly logger = new Logger(ClientsService.name);

  /**
   * Visibilità per ruolo: coach e nutrizionista vedono SOLO i clienti assegnati a loro
   * (ClientProfile.assignedCoachId / assignedNutritionistId); la manager delle coach
   * (sales), il capo nutrizionista e l'admin vedono tutti.
   * Ritorna il vincolo da applicare alle liste, o null se l'attore vede tutto.
   */
  private async clientScope(actorUserId: string): Promise<PerimetroClienti | null> {
    // La regola sta in `common/perimetro-clienti.ts` da quando la usa anche la tabella Acquisti
    // (11/8): due copie del perimetro divergono, e qui una divergenza vuol dire una coach che vede
    // le clienti di un'altra.
    return perimetroClienti(this.prisma, actorUserId);
  }

  /** Blocca l'accesso alla scheda di un cliente non assegnato all'attore. */
  private async assertClientAccess(actorUserId: string, clientUserId: string) {
    const scope = await this.clientScope(actorUserId);
    if (!scope) return;
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientUserId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    const assigned = prof?.[scope.field] ?? null;
    if (!assigned || !scope.staffIds.includes(assigned)) {
      throw new ForbiddenException('Questo cliente non è assegnato a te.');
    }
  }

  /** Elenco clienti per lo staff: coach/nutrizionista SOLO i propri; manager/capo/admin tutti. */
  async listClients(actorUserId: string) {
    const scope = await this.clientScope(actorUserId);
    const where = {
      role: 'client' as never,
      deletedAt: null,
      ...(scope ? { clientProfile: { [scope.field]: { in: scope.staffIds } } } : {}),
    };
    const LIMITE = 500;
    const [items, totale] = await Promise.all([
      this.prisma.user.findMany({
        where: where as never,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          // La coach assegnata (richiesta di Simone dell'8/8: colonna Coach nella tabella clienti)
          // e il nome del profilo — quello con cui la cliente vuole essere chiamata. Serve perché
          // su molte clienti `firstName`/`lastName` sono vuoti e in tabella comparivano dei «—»
          // pur avendo il nome nel profilo.
          /**
           * Lo stadio della PIPELINE, che è quello che l'elenco deve dire (richiesta di Simone
           * dell'11/8: «lo stato in pipeline, come quello che c'è in gestione lead»). Prima la
           * colonna «Stato» diceva `Attivo`/`Sospeso`, cioè lo stato dell'ACCOUNT: una cosa che
           * riguarda l'accesso, non il rapporto con la cliente — e che è «Attivo» anche per chi ha
           * smesso di pagare sei mesi fa.
           */
          crmRecord: { select: { stage: true } },
          clientProfile: {
            select: {
              name: true,
              assignedCoach: { select: { displayName: true } },
              // Serve per il segno «senza glutine» in tabella: dalla tendina «Stile» non si
              // distingue, perché la variante senza glutine ha lo STESSO stile (mediterranean)
              // della Mediterranea — la differenza sta nella famiglia. Chi guarda l'elenco vuole
              // vederlo a colpo d'occhio, non aprendo le schede una per una.
              dietFamily: true,
              allergies: true,
              intolerances: true,
              dislikedFoods: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITE,
      }),
      // Il conteggio VERO, separato dal `take`: prima `total` era `items.length`, cioè 500 con
      // 500 e con 900. Ora la tabella può dire quante ne sta mostrando davvero — e non è un
      // dettaglio da quando c'è un filtro sopra: filtrare 500 righe credendole tutte è il modo
      // di concludere che una cliente «non c'è».
      this.prisma.user.count({ where: where as never }),
    ]);
    const righe = (items as {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
      crmRecord: { stage: string } | null;
      clientProfile: {
        name: string | null;
        assignedCoach: { displayName: string } | null;
        dietFamily: string | null;
        allergies: string[];
        intolerances: string[];
        dislikedFoods: string[];
      } | null;
    }[]).map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      createdAt: u.createdAt,
      nickname: u.clientProfile?.name ?? null,
      /** `null` = non ha una scheda CRM: è diverso da «non ha ancora uno stadio». */
      stage: u.crmRecord?.stage ?? null,
      coach: u.clientProfile?.assignedCoach?.displayName ?? null,
      dietFamily: u.clientProfile?.dietFamily ?? null,
      // Vero se l'ha dichiarato, indipendentemente dal fatto che la variante sia già assegnata:
      // così in elenco si vede anche chi lo ha dichiarato e sta ancora aspettando la dieta.
      senzaGlutine: dichiaraSenzaGlutine([
        ...(u.clientProfile?.allergies ?? []),
        ...(u.clientProfile?.intolerances ?? []),
        ...(u.clientProfile?.dislikedFoods ?? []),
      ]),
    }));
    return { items: righe, total: totale, mostrati: righe.length, limite: LIMITE };
  }

  async getDetail(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, role: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true,
        firstName: true, lastName: true, addressLine: true, postalCode: true, city: true, province: true, phone: true, codiceFiscale: true, linkedUserId: true,
      },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') {
      throw new ForbiddenException('Questa scheda è disponibile solo per i clienti.');
    }

    const [profile, objective, measurements, checkins, waterLogs, stepLogs, subscriptions, payments, crm, notes, pending] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId },
        include: {
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
          // Chi ha fermato il piano: nella scheda serve il NOME, non l'id — «fermato da
          // staff-4f2a…» non dice a nessuno con chi deve parlare per riattivarlo.
          planHeldBy: { select: { displayName: true } },
          // Chi ha dato il via libera clinico, e la nota che lo spiega. Stesso motivo: nella scheda
          // serve il nome di chi ha deciso, non il suo id — e la nota va letta lì, non cercata.
          idoneitaDecisaDa: { select: { displayName: true } },
          idoneitaNota: { select: { id: true, body: true, createdAt: true } },
        },
      }),
      this.prisma.objective.findFirst({ where: { clientId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.measurement.findMany({ where: { clientId: userId }, orderBy: { date: 'desc' }, take: 60 }),
      this.prisma.dailyCheckin.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, mood: true, energy: true, hunger: true, stress: true },
      }),
      this.prisma.waterLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        // `unit` = come li contava lei quel giorno (bicchieri o bottiglie): la scheda lo scrive
        // sotto il numero. NULL sulle giornate prima del 24/8 — vedi `common/unita-acqua.ts`.
        select: { id: true, date: true, glasses: true, goal: true, unit: true },
      }),
      this.prisma.stepLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, steps: true, goal: true },
      }),
      // Ultimi abbonamenti: in scheda si mostra prima l'ATTIVO, poi l'in attesa e
      // solo in mancanza il più recente (prima vinceva sempre il più recente per data:
      // un checkout annullato copriva la prova gratuita attiva).
      this.prisma.subscription.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { plan: { select: { name: true, priceCents: true, period: true } } },
      }),
      this.prisma.payment.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, amountCents: true, description: true, method: true, status: true, createdAt: true, approvedAt: true },
      }),
      this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { stage: true, valueCents: true, ownerId: true } }),
      this.prisma.clientNote.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
      }),
      this.prisma.pendingCommission.findMany({
        where: { clientId: userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, role: true, amountCents: true, createdAt: true },
      }),
    ]);

    await this.audit.log({ action: 'client.detail.view', actorId, entityType: 'user', entityId: userId });

    // Abbonamento "principale" della scheda. Priorità: attivo > in attesa > scaduto >
    // (in ultimo) annullato. Così non si spaccia per "piano corrente" un abbonamento
    // ANNULLATO quando esiste, es., una prova scaduta più significativa. `subs` è già
    // ordinato per createdAt desc (query in alto).
    // ⚠️ Le DATE nel tipo, non solo lo stato: `pickMainSubscription` fra due righe `active` sceglie
    // per data (chi eroga oggi, non l'ultima creata — caso Lorena, 17/8). Questo cast le buttava
    // via, e con esse la scelta: la scheda mostrava il piano in coda come piano corrente.
    const subs = subscriptions as { status: string; startDate: Date | null; endDate: Date | null }[];
    // Il giorno di Roma, come `abbonamento-in-corso.ts`: questa è la scheda su cui si guarda se un
    // piano è in corso, e le due devono rispondere allo stesso modo.
    const today = aGiorno(new Date());
    const subscription = pickMainSubscription(subs);
    /**
     * Flag per la scheda: c'è un piano comprato ed entro il periodo? Il controllo su `endDate`
     * copre il caso in cui il cron di scadenza è in ritardo: un piano finito risulta comunque
     * «senza piano attivo».
     *
     * ⚠️ **`STATI_CON_UN_PIANO` e non `'active'`** (19/8, voce 258): nelle schermate dello staff un
     * piano in coda **conta come «ha un piano»** — è la decisione del 17/8 scritta in testa a
     * `stati-abbonamento.ts`. Con il confronto vecchio la scheda mostrava la pastiglia arancione
     * «Nessun piano attivo» su una cliente il cui piano parte lunedì: è la riga che fa richiamare
     * qualcuno per rivenderle quello che ha già comprato.
     */
    const hasActivePlan = (subscriptions as { status: string; endDate: Date | null }[]).some(
      (s) =>
        (STATI_CON_UN_PIANO as readonly string[]).includes(s.status) &&
        (!s.endDate || s.endDate.getTime() >= today.getTime()),
    );

    // Nome leggibile dello stato pipeline (es. "Prova" invece della chiave "trial") per il badge CRM.
    const stageLabel = crm
      ? ((await this.prisma.pipelineStage
          .findUnique({ where: { key: (crm as { stage: string }).stage }, select: { label: true } })
          .catch(() => null)) as { label: string } | null)?.label ?? null
      : null;

    // Minimizzazione GDPR (dato particolare): screening sanitario, questionario clinico e
    // consensi sono riservati allo staff CLINICO (nutrizioniste). Agli altri ruoli (coach,
    // responsabile/commerciale, admin, marketing) li togliamo dalla scheda. Allergie e
    // intolleranze restano: servono per i menu.
    const actor = (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } })) as { role: string } | null;
    const isClinical = actor?.role === 'nutritionist' || actor?.role === 'head_nutritionist';
    let safeProfile = profile;
    if (profile && !isClinical) {
      const p = { ...(profile as Record<string, unknown>) };
      delete p.screeningFlag;
      delete p.onboardingAnswers;
      delete p.consents;
      safeProfile = p as typeof profile;
    }

    /**
     * QUALE DIETA È COLLEGATA A QUESTA CLIENTE, con la sua descrizione per esteso.
     *
     * Chiesto da Simone il 10/8, davanti alla scheda: «di Mediterranea ne ho tre tipi, devo vedere
     * tutta la descrizione così scelgo nel modo giusto, o capisco se la cliente è in quella
     * corretta». In scheda c'era solo lo **stile** («Mediterranea»), che con tre diete che si
     * chiamano così non dice niente: «Mediterranea», «Mediterranea senza glutine» e la
     * Keto-Mediterranea hanno tutte `style = mediterranean`.
     *
     * Quello che disambigua è `dietFamily` (= `Diet.name`, vedi `pick-diet.ts`), che era scritto sul
     * profilo e non compariva da nessuna parte.
     *
     * Si mandano DUE diete, e la differenza è la cosa che serve sapere:
     *  - `dietaAssegnata`: quella decisa (dal questionario, dalla nutrizionista, o
     *    dall'assegnazione automatica del senza glutine);
     *  - `dietaMenuInCorso`: quella su cui sono costruite le giornate già erogate. Le due divergono
     *    fra il cambio e la rigenerazione dei menu — ed è esattamente il momento in cui una cliente
     *    celiaca ha «senza glutine» sul profilo e il pane nel menu di domani.
     */
    const dietFamilyAssegnata = (profile as { dietFamily?: string | null } | null)?.dietFamily ?? null;
    /**
     * ⚠️ LA RIGA CHE MENTIVA (corretta l'11/8, dal caso Cristina Urbani).
     *
     * Qui c'era `findFirst({ where: { name: dietFamily } })`: la dieta cercata **per nome e
     * basta**. Ma una famiglia ha fino a diciotto varianti che condividono il nome e si
     * distinguono per regime, stile, obiettivo e pasti al giorno — è il senso stesso delle
     * varianti. Quindi quella query pescava **la prima che capitava** e ne mostrava regime e
     * pasti come se fossero quelli della cliente: nella scheda di una cliente **onnivora, 5
     * pasti** compariva «Flessibile *vegan* · *3 pasti*», e chi la leggeva andava a cercare un
     * errore di assegnazione che non esisteva.
     *
     * È esattamente la trappola scritta in testa a `pick-diet.ts` — «la famiglia da sola potrebbe
     * agganciare l'omonima di un altro stile» — evitata nel motore e non qui. Una schermata che
     * mostra il dato sbagliato è peggio di una che non lo mostra: fa prendere decisioni cliniche
     * su una cliente guardando la dieta di un'altra.
     *
     * Ora si chiedono DUE cose diverse, e la differenza fra le due è l'informazione utile:
     *  - la **variante esatta** che il profilo descrive (nome + stile + regime + pasti);
     *  - la dieta che il motore **servirebbe davvero**, con la stessa `pickDietFor` che usa
     *    l'erogazione: se la variante esatta non esiste, il motore ripiega, e la scheda deve
     *    dirlo invece di far finta che la dieta ripiegata sia quella scelta.
     *
     * ⚠️ La ricerca vive in `catalog/dieta-mostrata.ts`, non più qui: la stessa correzione serviva
     * anche in `profile.service.nutrition`, dove la riga «solo il nome» era rimasta e la leggeva
     * **la cliente** (decisione di Simone del 12/8). Due copie della stessa domanda tornerebbero a
     * divergere.
     */
    const profiloMatch = {
      regime: (profile as { regime?: string | null } | null)?.regime ?? null,
      dietStyle: (profile as { dietStyle?: string | null } | null)?.dietStyle ?? null,
      dietFamily: dietFamilyAssegnata,
      mealsPerDay: (profile as { mealsPerDay?: number | null } | null)?.mealsPerDay ?? null,
      objective: (profile as { objective?: string | null } | null)?.objective ?? null,
      pathType: (profile as { pathType?: string | null } | null)?.pathType ?? null,
      // In digiuno il catalogo lo decide la FINESTRA (`struttura-per-digiuno.ts`): senza questa
      // riga la scheda mostrerebbe come «dieta servita» una variante che l'erogazione non serve.
      fastingWindow: (profile as { fastingWindow?: string | null } | null)?.fastingWindow ?? null,
    };
    const [esitoDieta, giorniInArrivo] = await Promise.all([
      dietaMostrataPer(this.prisma, profiloMatch),
      /**
       * ⚠️ Le giornate che la cliente deve ancora RICEVERE, non l'ultima che esiste.
       *
       * Qui c'era `orderBy: { date: 'desc' }` senza filtro sulla data: prendeva l'ultimo giorno
       * generato, anche se era di tre mesi fa. Su una cliente con un percorso finito, l'avviso
       * «il menu è ancora sulla dieta precedente» compariva su un menu che nessuno riceverà mai
       * più. Simone, 12/8: «se il menu è vecchio la segnalazione non ha senso, serve se i futuri
       * saranno sbagliati».
       *
       * `distinct` sulla dieta perché una rigenerazione parziale può lasciare giornate su due
       * diete diverse: basta che UNA delle prossime sia quella vecchia perché valga la pena dirlo.
       */
      this.prisma.menuDay.findMany({
        where: { clientId: userId, date: { gte: toDateOnly() } },
        orderBy: { date: 'asc' },
        distinct: ['dietId'],
        take: 5,
        select: { date: true, diet: { select: { name: true, clientName: true, status: true } } },
      }) as Promise<{ date: Date; diet: { name: string; clientName: string | null; status: string } | null }[]>,
    ]);
    const dieteInArrivo = (giorniInArrivo ?? [])
      .map((g) => (g.diet ? g.diet.clientName || g.diet.name : null))
      .filter((n): n is string => !!n);
    /**
     * Che cosa si mostra come «Dieta assegnata», e perché in quest'ordine.
     *
     * Si mostra **la dieta che la cliente riceve davvero** (`dietaServita`), non quella che il
     * profilo descrive: è l'unica che spiega i piatti che ha nel piatto. Se la variante esatta del
     * profilo esiste, le due coincidono e non c'è niente da dire; se non esiste, `scostamento`
     * dice **cosa è stato chiesto e cosa viene servito**, che è la riga che mancava.
     */
    const { varianteEsatta, dietaServita, dietaMostrata, nome: nomeAssegnata } = esitoDieta;
    // La prima delle prossime giornate che è costruita su una dieta DIVERSA da quella assegnata.
    // `null` = quello che riceverà è già la dieta giusta (o non riceverà più niente).
    const dietaVecchiaInArrivo = nomeAssegnata ? dieteInArrivo.find((n) => n !== nomeAssegnata) ?? null : null;
    // La regola sta in `scostamento-dieta.ts`, fuori di qui: così si verifica per tabella invece
    // che montando l'intera scheda cliente, e la frase che il nutrizionista legge è **una sola**
    // ovunque compaia.
    const scostamento = scostamentoDieta(
      {
        famiglia: dietFamilyAssegnata,
        regime: profiloMatch.regime,
        style: profiloMatch.dietStyle,
        mealsPerDay: profiloMatch.mealsPerDay,
        /**
         * ⛔ **QUALI pasti promessi il catalogo servito non sa comporre** — non quanti (21/8).
         *
         * `mealsPerDay` qui sopra dice `3` per tutte le clienti in digiuno, e non c'entra niente con
         * quello che l'orologio ha promesso a questa. Ma nemmeno un conteggio andava bene: la prima
         * stesura confrontava «pasti promessi» con la struttura servita e sbagliava su quattro
         * protocolli su cinque, perché sono due scale diverse. Vedi la nota in `scostamento-dieta.ts`.
         *
         * ⚠️ La risposta la dà `pastiPromessiCheMancano`, **la stessa funzione che il motore usa** per
         * scriverlo nei log al momento di comporre la giornata: se le due divergessero, la scheda e il
         * piatto direbbero due cose diverse — che è esattamente il difetto che questa riga esiste per
         * far vedere.
         *
         * ⚠️ Torna `[]` da sola per chi non digiuna e per chi la finestra non l'ha ancora impostata:
         * non serve nessuna guardia qui, e una guardia in più sarebbe una seconda regola da tenere
         * allineata.
         */
        pastiCheMancano: pastiPromessiCheMancano(
          profiloMatch.pathType,
          profiloMatch.fastingWindow,
          dietaServita ?? {},
        ).map((slot) => NOME_PASTO[slot] ?? slot),
      },
      dietaServita
        ? {
            regime: dietaServita.regime,
            style: dietaServita.style,
            mealsPerDay: dietaServita.mealsPerDay,
            // ⚠️ Il nome della dieta che le arriva davvero: senza, la scheda non poteva dire la cosa
            // più grossa che le succede — che sta mangiando la dieta di un'altra famiglia.
            famiglia: dietaServita.name,
          }
        : null,
      !!varianteEsatta,
    );

    return {
      user,
      profile: safeProfile, // dati clinici presenti solo per lo staff clinico
      dietaAssegnata: dietaMostrata
        ? {
            id: dietaMostrata.id,
            nome: nomeAssegnata,
            descrizione: dietaMostrata.clientDescription,
            style: dietaMostrata.style,
            status: dietaMostrata.status,
            regime: dietaMostrata.regime,
            mealsPerDay: dietaMostrata.mealsPerDay,
          }
        : dietFamilyAssegnata
          ? // Il nome è scritto sul profilo ma in catalogo non c'è nessuna dieta con quel nome:
            // succede se una dieta viene rinominata o cancellata. Va detto, non nascosto — il
            // motore cercherà quel nome e non lo troverà.
            { id: null, nome: dietFamilyAssegnata, descrizione: null, style: null, status: 'non_in_catalogo', regime: null, mealsPerDay: null }
          : null,
      /**
       * ⛔ **LE FASCE DEL DIGIUNO, in chiaro e in sola lettura** (Simone, 21/8: «nella scheda cliente
       * devo leggere le fasce»).
       *
       * Da quando la finestra la deriva l'orologio, `fastingWindow` da sola non dice più niente a
       * chi legge: `skip_breakfast` non è un orario, e la domanda vera della nutrizionista è **a che
       * ora mangia**. Qui arriva già composta — apertura, chiusura, protocollo, gli orari dei pasti
       * — dalla stessa funzione che disegna l'orologio nell'app (`menu/vista-orologio.ts`): se un
       * giorno le soglie cambiano, la scheda e il telefono cambiano insieme.
       *
       * ⚠️ **Sola lettura.** Non c'è nessun campo da scrivere qui: la finestra la imposta la cliente,
       * e quello che fa resta nel log delle modifiche della sua scheda.
       * ⚠️ `attuale` manca finché non ha scelto: non si inventa un orologio che nessuno ha impostato.
       */
      /**
       * ⚠️ **`profile` può essere null** — una cliente senza profilo esiste, ed è il caso normale
       * prima del questionario. La prima versione di questa riga aveva un `as never` addosso, e quel
       * cast ha zittito il compilatore che lo sapeva: la scheda di quelle clienti sarebbe esplosa
       * per intero, non solo in questo riquadro.
       *
       * ⛔ **`.attuale`, NON la vista intera** (trovato in revisione, 21/8 — non da un test: da un
       * revisore che ha guardato cosa arriva davvero). Qui c'era `vistaOrologio(profile)` e basta,
       * che restituisce `{ digiuna, daChiedere, motivo, protocolli, attuale?… }`: un oggetto
       * **sempre pieno**, quindi sempre `truthy`, dentro un campo che la scheda legge come «le fasce
       * oppure niente». Risultato: per **ogni** cliente in digiuno la scheda leggeva
       * `digiuno.pasti.length` su un `undefined` e finiva nell'`ErrorBoundary` — non un riquadro
       * sbagliato, tutto il backoffice a «Qualcosa è andato storto». E i due ripieghi (finestra
       * storica, mai chiesta) erano codice morto: quel `null` non arrivava mai.
       *
       * ⚠️ Il cast era la seconda metà della stessa storia. `as ProfiloDigiuno` ha zittito il
       * compilatore sul **tipo di ritorno** come `as never` l'aveva zittito sul null: due volte lo
       * stesso difetto, due volte lo stesso silenziatore. Adesso non c'è — `profile` è già
       * strutturalmente un `ProfiloDigiuno`, e il giorno che smette di esserlo si deve accendere
       * qui, non nel browser di una nutrizionista.
       */
      digiuno: fasceDelDigiuno(profile),
      /**
       * IL VIA LIBERA CLINICO, per la scheda. `profile` porta già i campi grezzi; qui si aggiunge la
       * sola cosa che non si può leggere da quelli: **se questa cliente è ancora da valutare**.
       *
       * ⚠️ `serve_visita` NON è «da valutare»: qualcuno l'ha guardata e ha deciso che la visita
       * serve. Sta in un altro elenco — quelle da visitare — non in quello di chi nessuno ha ancora
       * aperto. La regola sta in `idoneita.ts`, non qui, perché la stessa domanda la farà la coda
       * della nutrizionista.
       */
      idoneita: {
        esito: (profile as { idoneita?: string | null } | null)?.idoneita ?? null,
        decisaIl: (profile as { idoneitaDecisaIl?: Date | null } | null)?.idoneitaDecisaIl ?? null,
        // ⚠️ La scadenza della visita esce nella scheda: è l'unico campo di questa riga che ha una
        // conseguenza automatica (passato quel giorno i menu si fermano), e va letta senza cercarla.
        visitaEntro: (profile as { idoneitaVisitaEntro?: Date | null } | null)?.idoneitaVisitaEntro ?? null,
        daValutare: daValutare({
          allergies: (profile as { allergies?: string[] } | null)?.allergies ?? [],
          idoneita: (profile as { idoneita?: string | null } | null)?.idoneita ?? null,
          screeningFlag: (profile as { screeningFlag?: boolean } | null)?.screeningFlag ?? false,
        }),
      },
      scostamentoDieta: scostamento,
      dietaMenuInCorso: dietaVecchiaInArrivo,
      // L'avviso esiste per una domanda sola: «i piatti che riceverà sono quelli della dieta
      // giusta?». Senza giornate da ricevere non c'è nessuna domanda, e nessun avviso.
      menuAncoraSullaDietaPrecedente: !!dietaVecchiaInArrivo,
      objective,
      measurements,
      checkins,
      /**
       * L'acqua con l'unità di QUEL giorno già scritta a parole (richiesta di Simone, 24/8:
       * «nella riga va inserito se è un valore in bicchiere, bottiglia da 0,5, da 1 o da 1,5»).
       *
       * ⚠️ Le parole le mette il backend, non la pagina: l'elenco delle unità e la conversione
       * stanno in `common/unita-acqua.ts`, e sono già in due (app e backend). Una terza copia nel
       * back office sarebbe la copia che diverge — e divergerebbe proprio sulla riga che serve a
       * capire quanto ha bevuto una persona.
       */
      // ⚠️ Niente cast: il client Prisma conosce già `unit`, e un cast qui restringerebbe il tipo di
      // ritorno a quattro campi — il prossimo che «ripulisce» perderebbe `id`, `date` e `goal` senza
      // che nessun controllo se ne accorga (rilievo della revisione del 24/8).
      waterLogs: waterLogs.map((w) => ({
        ...w,
        /**
         * La riga si legge come la legge LEI (Simone, 24/8: «la vera unità la mettiamo in una
         * colonna, il titolo non è più bicchieri ma quantità, e anche l'obiettivo si deve aggiornare
         * con quello mostrato in app»). Quindi tre campi, e le regole sono le stesse dell'app:
         *  · `quantita` — il numero nell'unità di quel giorno (2,5 se la giornata è mista);
         *  · `unitaDetta` — come si chiama quell'unità, `null` se non registrata (prima del 24/8);
         *  · `obiettivoDetto` — l'obiettivo in bottiglie **intere**, come glielo mostra l'app.
         * ⚠️ `glasses` e `goal` restano nella risposta e restano in bicchieri: sono i due numeri
         * confrontabili fra giornate contate in modi diversi, ed è su quelli che il motore valuta
         * l'aderenza. Qui si aggiunge come si leggono, non si sostituisce cosa valgono.
         */
        quantita: quantitaNellaUnita(w.glasses, w.unit),
        unitaDetta: etichettaUnitaAcqua(w.unit),
        obiettivoDetto: obiettivoNellaUnita(w.goal, w.unit),
      })),
      stepLogs,
      subscription,
      // Storico dei piani, per aprire i menu di un piano anche finito da mesi: senza questo
      // elenco la scheda conosceva solo l'abbonamento "principale" e lo storico dei menu era
      // irraggiungibile (richiesta di Simone dell'8/8: «se il cliente ha più piani, premendo
      // sulla riga devo aprire i suoi vecchi menu»). Campi ridotti al minimo che serve al
      // pulsante: nome, stato e periodo. Il prezzo resta fuori, non serve qui.
      subscriptions: (subscriptions as {
        id: string;
        status: string;
        startDate: Date | null;
        endDate: Date | null;
        plan: { name: string } | null;
      }[]).map((s) => ({
        id: s.id,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        planName: s.plan?.name ?? null,
        /**
         * ⚠️ CHI EROGA OGGI E CHI È IN CODA LO DICE IL BACKEND, non la scheda.
         *
         * Due piani `active` producevano due pastiglie **identiche** («Piano · Attivo» più la data
         * d'inizio), e chi apriva la scheda non aveva modo di sapere quale dei due stia dando i menu
         * oggi: è il buco da cui è passato il caso Polidoro. Il giudizio esiste già in una funzione
         * sola (`commerce/abbonamento-in-corso.ts`) e la usano il motore, le pause e la coach —
         * riscriverlo in TypeScript dentro il browser sarebbe la quinta definizione della stessa
         * domanda, e ieri due definizioni sono divergite nello spazio di un'ora.
         */
        inCorso: staErogando(s),
        inCoda: eInCoda(s),
      })),
      hasActivePlan,
      /**
       * PIANO FERMATO DAL NUTRIZIONISTA (§15.2 punto 4). Va nel dettaglio perché la scheda è il
       * posto dove si scopre **perché** questa cliente non riceve menu, ed è l'unico da cui si può
       * riattivare. Un blocco che si mette da una schermata e si toglie solo da un'API è un blocco
       * che resta.
       */
      pianoFermato: (profile as { planHeldAt?: Date | null } | null)?.planHeldAt
        ? {
            dal: (profile as { planHeldAt?: Date | null }).planHeldAt,
            motivo: (profile as { planHeldReason?: string | null }).planHeldReason ?? null,
            daId: (profile as { planHeldById?: string | null }).planHeldById ?? null,
            da:
              (profile as { planHeldBy?: { displayName: string | null } | null }).planHeldBy?.displayName ?? null,
          }
        : null,
      payments,
      crm: crm ? { ...(crm as Record<string, unknown>), stageLabel } : null,
      notes: (notes as { id: string; body: string; createdAt: Date; author: { displayName: string } | null }[]).map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt,
        author: n.author?.displayName ?? null,
      })),
      pendingCommissions: (pending as { id: string; role: string; amountCents: number; createdAt: Date }[]).map((p) => ({
        id: p.id,
        role: p.role,
        amountCents: p.amountCents,
        createdAt: p.createdAt,
      })),
    };
  }

  /** Aggiunge una nota al log dello staff sul cliente. */
  async addNote(userId: string, actorId: string, body: string) {
    await this.assertClientAccess(actorId, userId);
    const text = body.trim();
    if (!text) throw new BadRequestException('La nota è vuota.');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') throw new ForbiddenException('La nota è disponibile solo per i clienti.');

    const staff = await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } });
    const created = await this.prisma.clientNote.create({
      data: { clientId: userId, body: text.slice(0, 5000), authorId: staff?.id },
      select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
    });
    await this.audit.log({ action: 'client.note.add', actorId, entityType: 'user', entityId: userId });
    return { id: created.id, body: created.body, createdAt: created.createdAt, author: created.author?.displayName ?? null };
  }

  /**
   * IL VIA LIBERA CLINICO: «questa cliente può proseguire?» (13/8).
   *
   * La regola sta in `idoneita.ts`, qui c'è quello che tocca la banca dati. Tre cose in una
   * transazione, perché sono una cosa sola:
   *
   *  1. la **nota**, obbligatoria, scritta nella lista note che esiste già — così la coach la trova
   *     dove cerca già le note, con autore e ora, invece che in un campo che solo la scheda clinica
   *     sa mostrare (richiesta di Simone);
   *  2. la **decisione** sul profilo: cosa, chi, quando, e il puntatore alla nota;
   *  3. le **segnalazioni cliniche aperte** su quella cliente, che si chiudono da sé.
   *
   * ⚠️ Il punto 3 non è una comodità. Se dovesse decidere qui e poi chiudere la segnalazione di là,
   * prima o poi ne farebbe una sola — e la coda tornerebbe a riempirsi di casi già visti, che è
   * esattamente il modo in cui una coda smette di voler dire qualcosa (vedi `riapertura.ts`).
   *
   * ⚠️ NESSUN BLOCCO: percorso e menu continuano comunque. Bloccare l'erogazione vorrebbe dire
   * sospendere piani attivi a clienti paganti per un campo introdotto oggi.
   */
  async decidiIdoneita(userId: string, actorId: string, esitoGrezzo: unknown, notaGrezza: unknown, visitaEntroGrezza?: unknown) {
    await this.assertClientAccess(actorId, userId);
    const attore = (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } })) as { role: string } | null;
    if (!(await this.roleCanManage(attore?.role ?? '', 'clinical_clearance'))) {
      throw new ForbiddenException(
        'Il via libera clinico richiede il permesso "Idoneità a proseguire": è una valutazione della nutrizionista.',
      );
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') throw new ForbiddenException('L\'idoneità si decide solo per i clienti.');

    let decisione: { esito: Idoneita; nota: string; visitaEntro: string | null };
    try {
      decisione = validaDecisione(esitoGrezzo, notaGrezza, visitaEntroGrezza);
    } catch (e) {
      // `NotaMancante` porta già la frase giusta per chi sta guardando la scheda: si traduce nel
      // 400 senza riscriverla, o si finirebbe con due versioni dello stesso messaggio.
      throw new BadRequestException(e instanceof Error ? e.message : 'Richiesta non valida.');
    }

    const staff = await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } });
    const nota = await this.prisma.clientNote.create({
      data: {
        clientId: userId,
        body: testoNota(decisione.esito, decisione.nota, decisione.visitaEntro).slice(0, 5000),
        authorId: staff?.id,
      },
      select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
    });

    await this.prisma.clientProfile.update({
      where: { userId },
      data: {
        idoneita: decisione.esito,
        idoneitaDecisaIl: new Date(),
        idoneitaDecisaDaId: staff?.id ?? null,
        idoneitaNotaId: nota.id,
        /**
         * ⚠️ **Si scrive SEMPRE, anche quando è `null`.** Su «Può proseguire» la scadenza va
         * cancellata: una cliente valutata «serve visita entro il 30» e poi rivalutata «può
         * proseguire» si porterebbe dietro una data che, il primo di ottobre, la bloccherebbe di
         * nuovo — con una decisione che dice il contrario scritta sulla stessa riga.
         */
        idoneitaVisitaEntro: decisione.visitaEntro ? new Date(`${decisione.visitaEntro}T00:00:00.000Z`) : null,
      } as never,
    });

    /**
     * Le segnalazioni cliniche aperte si chiudono qui. `resolvedAt` valorizzato perché è quello che
     * `riapertura.ts` guarda per non riaprirle: senza, la tregua non partirebbe e la stessa
     * segnalazione tornerebbe alla prima rivalutazione del motore.
     */
    const chiuse = await this.prisma.escalation.updateMany({
      where: { clientId: userId, category: 'clinical', status: { in: ['open', 'in_progress'] } as never },
      data: { status: 'resolved' as never, resolvedAt: new Date() },
    });

    /**
     * ⚠️ «SERVE UNA VISITA» VA DETTO A QUALCUNO CHE PUÒ FISSARLA. Prima di oggi la decisione
     * restava scritta sulla scheda e la visita non la fissava nessuno: l'unico modo perché
     * succedesse qualcosa era che qualcuno si ricordasse di riaprire quella scheda. Il perché
     * dell'attività — e non di un appuntamento creato da solo — sta in `visita-da-fissare.ts`.
     *
     * ⚠️ `refId` è l'**id della nota**, cioè di QUESTA decisione: una valutazione nuova è un fatto
     * nuovo e merita un'attività nuova, mentre due salvataggi della stessa non devono farne due.
     * ⚠️ Sotto `catch`: un'attività non aperta è un lavoro in più per qualcuno, un'eccezione qui
     * sarebbe una decisione clinica che non si salva. Ma l'errore si scrive.
     */
    let attivitaAperta = false;
    let attivitaGiaPresente = false;
    let attivitaSenzaCoach = false;
    if (decisione.esito === 'serve_visita') {
      try {
        const esito = await this.apriLaVisitaDaFissare(userId, decisione.visitaEntro);
        // ⚠️ «C'era già» è un successo, non un errore: l'attività c'è. Confonderli vuol dire dire a
        // chi ha appena deciso che non è partito niente (revisione della notte del 18/8).
        //
        // ⛔ **E «non riuscita» non è «c'era già»** (22/8): da quando `apriAttivitaCoach` non lancia
        // più, un guasto torna come terzo esito invece che come eccezione — e questo `try` non lo
        // vedrebbe. Senza questa riga la scheda direbbe «l'attività c'era già» a proposito di
        // un'attività che non esiste, e la visita non la fisserebbe nessuno.
        attivitaAperta = esito.esito !== 'non-riuscita';
        attivitaGiaPresente = esito.esito === 'gia-presente';
        attivitaSenzaCoach = esito.senzaCoach;
        if (esito.esito === 'non-riuscita') {
          this.logger.error(
            `Via libera clinico: decisione salvata per ${userId}, ma l'attività «fissa la visita» NON è ` +
              'stata aperta (la porta ha degradato) — la visita resta da fissare a mano.',
          );
        }
      } catch (e) {
        this.logger.error(
          `Via libera clinico: decisione salvata per ${userId}, ma l'attività «fissa la visita» non è ` +
            `stata aperta — la visita resta da fissare a mano. ${(e as Error).message}`,
        );
      }
    }

    await this.audit.log({
      action: 'client.idoneita.decisa',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { esito: decisione.esito, visitaEntro: decisione.visitaEntro, notaId: nota.id, segnalazioniChiuse: chiuse.count, attivitaAperta, attivitaGiaPresente, attivitaSenzaCoach },
    });

    return {
      idoneita: decisione.esito,
      decisaIl: new Date(),
      decisaDa: staff?.id ?? null,
      segnalazioniChiuse: chiuse.count,
      attivitaAperta,
      attivitaGiaPresente,
      attivitaSenzaCoach,
      nota: { id: nota.id, body: nota.body, createdAt: nota.createdAt, author: nota.author?.displayName ?? null },
    };
  }

  /** Elimina una nota dal log (solo admin, controllato dal controller). */
  /**
   * L'attività «fissa la visita», col numero che cambia la telefonata.
   *
   * ⚠️ Il credito visite si legge da `PrenotazioniService`, che è chi lo conta già per l'app: un
   * secondo conteggio qui direbbe alla coach un numero diverso da quello che la cliente vede sul
   * telefono. ⚠️ E se non si riesce a contarlo si passa `null`, non zero: il testo distingue «non ne
   * ha» da «non lo so», perché mandano la coach a dire due cose diverse.
   */
  private async apriLaVisitaDaFissare(
    clientId: string,
    visitaEntro: string | null,
  ): Promise<{ esito: EsitoApertura; senzaCoach: boolean }> {
    const cliente = (await this.prisma.user.findUnique({
      where: { id: clientId },
      // ⚠️ Solo il nome di battesimo: è la regola scritta oggi con la bonifica delle email — nei
      // testi si scrive il nome o l'id interno, mai di più del necessario.
      select: {
        firstName: true,
        clientProfile: {
          select: {
            assignedNutritionist: { select: { displayName: true } },
            // ⚠️ Serve a sapere se l'attività arriva a qualcuno: vedi `visita-da-fissare.ts`.
            assignedCoach: { select: { displayName: true } },
          },
        },
      },
    })) as {
      firstName: string | null;
      clientProfile: {
        assignedNutritionist: { displayName: string } | null;
        assignedCoach: { displayName: string } | null;
      } | null;
    } | null;

    let disponibili: number | null = null;
    try {
      disponibili = (await this.prenotazioni.credito(clientId)).disponibili;
    } catch (e) {
      this.logger.warn(`Credito visite non calcolabile per ${clientId}: l'attività lo dirà. ${(e as Error).message}`);
    }

    const coach = cliente?.clientProfile?.assignedCoach?.displayName ?? null;
    const { title, description } = testoVisitaDaFissare({
      nome: cliente?.firstName,
      nutrizionista: cliente?.clientProfile?.assignedNutritionist?.displayName,
      visiteDisponibili: disponibili,
      coach,
      visitaEntro,
    });
    /**
     * ⚠️ `refId` È IL GIORNO DELLA DECISIONE, non l'id della nota — corretto rileggendo, la sera
     * stessa. Con l'id della nota **non poteva collidere mai**: `decidiIdoneita` crea una nota nuova
     * a ogni salvataggio, quindi risalvare la stessa valutazione (una correzione, un doppio invio,
     * la rete lenta) apriva una seconda attività identica e mandava una seconda push — il contrario
     * di quello che il commento prometteva. Col giorno, due salvataggi dello stesso giorno sono la
     * stessa cosa; una valutazione nuova domani è un fatto nuovo e apre la sua.
     * ⚠️ Il giorno si legge nel fuso aziendale (`giornoLocale`), non in UTC: fra mezzanotte e le due
     * il giorno UTC è ancora ieri.
     */
    const esito = await this.coachTasks.apriAttivita({
      clientId,
      kind: TIPO_VISITA_DA_FISSARE,
      refId: `serve_visita:${giornoLocale(new Date())}`,
      title,
      description,
      /**
       * ⚠️ **La `dueDate` dell'attività resta «domani» (il default), NON la scadenza della visita** —
       * corretto in revisione. La prima stesura le metteva la scadenza clinica (fino a 180 giorni),
       * e sembrava elegante: una data sola dappertutto. Ma la `dueDate` è «entro quando la COACH deve
       * muoversi», e fissare una visita è una telefonata da fare domani, non fra sei mesi. Con la
       * scadenza lunga: l'escalation al manager (`dueDate < oggi`) sarebbe scattata **il giorno dopo
       * che i menu della cliente si erano già fermati** invece del giorno dopo l'inerzia della coach,
       * e l'ordinamento per scadenza (`list`) avrebbe seppellito l'attività in fondo all'elenco.
       * La scadenza della VISITA viaggia nel titolo, nella nota, in scheda e in calendario — che
       * legge il profilo, non questa attività.
       */
    });
    return { esito, senzaCoach: !coach };
  }

  async deleteNote(userId: string, noteId: string, actorId: string) {
    const note = await this.prisma.clientNote.findUnique({ where: { id: noteId }, select: { id: true, clientId: true } });
    if (!note || note.clientId !== userId) throw new NotFoundException('Nota non trovata.');
    await this.prisma.clientNote.delete({ where: { id: noteId } });
    await this.audit.log({ action: 'client.note.delete', actorId, entityType: 'user', entityId: userId, metadata: { noteId } });
    return { removed: noteId };
  }

  /**
   * Invia alla cliente l'email per reimpostare la password (nessuna password gestita dallo staff).
   *
   * Aperta alla COACH sulle proprie clienti (richiesta di Simone dell'8/8): il cancello non è più il
   * ruolo admin sulla rotta, sono i due controlli qui sotto, e servono entrambi.
   *  - `assertClientAccess` ferma la coach su una cliente che non è sua. Per manager/capo/admin
   *    passa liscio, perché loro non hanno scope: vedono tutte.
   *  - il controllo sul RUOLO ferma proprio quelli senza scope: senza, un manager avrebbe potuto
   *    far ripartire la password di un ADMIN passandone l'id. Prima non era un buco solo perché la
   *    rotta era riservata agli admin; togliendo quel guardrail questo diventa obbligatorio.
   */
  async sendPasswordReset(userId: string, actorId: string, ip?: string) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') {
      throw new ForbiddenException('Il reset password dalla scheda si fa solo per le clienti.');
    }
    await this.auth.requestPasswordReset(user.email, ip);
    await this.audit.log({ action: 'client.password_reset.trigger', actorId, entityType: 'user', entityId: userId });
    return { sent: true, email: user.email };
  }

  /** Imposta una password SCELTA per la cliente (da comunicarle): permesso "set_client_password". */
  async setClientPassword(userId: string, actorId: string, newPassword: string) {
    await this.assertClientAccess(actorId, userId);
    const pw = (newPassword ?? '').trim();
    if (pw.length < 8) throw new BadRequestException('La password deve avere almeno 8 caratteri.');
    await this.auth.adminSetClientPassword(userId, pw, actorId);
    return { ok: true };
  }

  /**
   * Eliminazione DEFINITIVA di un cliente/lead e di tutto ciò che gli è collegato.
   * Solo admin. Il lead (CrmRecord) è in SetNull, quindi va cancellato esplicitamente;
   * tutto il resto (profilo, misure, check-in, acquisti, ecc.) va a cascata via schema.
   */
  async hardDelete(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') {
      throw new BadRequestException('Si possono eliminare solo i clienti, non lo staff.');
    }
    // Audit PRIMA della cancellazione (dopo, l'utente non esiste più).
    await this.audit.log({
      action: 'client.hard_delete',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { email: user.email },
    });
    await this.prisma.$transaction([
      this.prisma.crmRecord.deleteMany({ where: { clientId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { deleted: true };
  }

  /**
   * Vero se il ruolo può GESTIRE la pagina/permesso indicato: stessa logica del
   * PageGuard (riga della matrice se esiste, altrimenti default; admin sempre sì).
   */
  private roleCanManage(role: string, pageKey: string): Promise<boolean> {
    // La logica sta in `permissions/permesso-di-ruolo.ts`: la stessa domanda se la fa anche
    // `ChatService` (verifica dei cambi in chat), e due copie che divergono vorrebbero dire un
    // permesso che in una schermata conta e nell'altra no.
    return ruoloPuo(this.prisma, role, pageKey, 'manage');
  }

  /** Aggiorna anagrafica (User) e questionario (ClientProfile) di un cliente. */
  async updateClient(userId: string, actorId: string, dto: UpdateClientDto) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException('Modificabile solo per i clienti.');

    const d = dto as Record<string, unknown>;
    const userData: Record<string, unknown> = {};
    for (const k of USER_FIELDS) if (d[k] !== undefined) userData[k] = d[k] === '' ? null : d[k];
    const profileData: Record<string, unknown> = {};
    for (const k of PROFILE_FIELDS) if (d[k] !== undefined) profileData[k] = d[k] === '' ? null : d[k];

    /**
     * ⚠️ I GUSTI SCRITTI DALLA SCHEDA PASSAVANO DIRITTI IN BANCA DATI — quarta volta per la stessa
     * riga (`latte` l'8/8, `frutta_a_guscio` il 12/8, `"Carne .ceci"` il 17/8).
     *
     * Il ciclo qui sopra riempie `profileData` **ciecamente** per tutte le `PROFILE_FIELDS`, e il
     * 17/8 la pulizia dei tag è stata messa sui due percorsi della CLIENTE (questionario e profilo in
     * app) — non su questo, che è quello della nutrizionista. La scheda manda una stringa spezzata
     * sulle sole virgole, quindi «Carne .ceci» arrivava intero: una voce che non escludeva niente, e
     * nessuno lo diceva.
     *
     * Due pulizie, diverse perché le due liste sono diverse:
     *
     * 1. `dislikedFoods` → `filtraSpezie`, che **spezza prima di classificare** (`spezzaTagAlimenti`)
     *    e ferma le spezie. ⚠️ Le spezie scartate **si dicono a chi ha premuto Salva**: una voce che
     *    sparisce in silenzio è il difetto che paghiamo da tre giorni, e qui chi scrive è una
     *    professionista che ha il diritto di sapere che la sua riga non è stata salvata — e perché
     *    (escludere il pepe svuota il pool invece di togliere un piatto).
     * 2. `intolerances` → via i **non-alimenti** (`altro`, `other`, `nessuna`, `none`…). Il
     *    questionario li toglie da sempre (`common/allergie.ts`), la scheda no: `'altro'` salvato
     *    come intolleranza diventa una parola che il motore va a cercare dentro i piatti.
     *    ⚠️ Qui i tag NON si spezzano: un'intolleranza è un codice o un termine clinico, e «frutta a
     *    guscio» non va spaccata in due. Sono due liste con due regole, e vanno tenute distinte.
     */
    let avvisiSpezie: EsitoSpezia[] = [];
    let aiutoEsclusioni: string | null = null;
    if (profileData.dislikedFoods !== undefined || profileData.intolerances !== undefined) {
      /**
       * ⚠️ SI PULISCE SOLO QUELLO CHE È STATO DAVVERO TOCCATO — trovato in revisione, 17/8 sera.
       *
       * Il form della scheda **rimanda tutti i campi a ogni salvataggio**: senza questo confronto,
       * una coach che corregge un numero di telefono riscriveva le intolleranze di una cliente (un
       * `'altro'` arrivato da un import) e i suoi cibi non graditi — e il log modifiche avrebbe
       * detto «Intolleranze: da [altro, lattosio] a [lattosio]» **a nome suo**, su un campo che non
       * ha nemmeno guardato. Cambiare cosa una persona riceve nel piatto come effetto collaterale
       * del salvataggio di un'anagrafica è peggio del difetto che si stava chiudendo.
       *
       * È la stessa regola che `allergies` applica qui sotto: **il permesso, e
       * la modifica, valgono sul cambiamento — non sul salvataggio**. Le liste già sporche in banca
       * dati le ripulisce `npm run pulisci:spezie`, che è il posto dove quel lavoro si vede.
       */
      const attualiGusti = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { dislikedFoods: true, intolerances: true },
      })) as { dislikedFoods: string[]; intolerances: string[] } | null;
      const stessaLista = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
        (a ?? []).join('|') === (b ?? []).join('|');

      // ⚠️ `null` non è un array, e la colonna è `String[]`: Prisma lo rifiuterebbe con un 500. Il
      // DTO lo lascia passare (`@IsOptional`), quindi il campo si toglie invece di fidarsi.
      for (const campo of ['dislikedFoods', 'intolerances'] as const) {
        if (profileData[campo] !== undefined && !Array.isArray(profileData[campo])) delete profileData[campo];
      }

      if (Array.isArray(profileData.dislikedFoods)) {
        if (stessaLista(profileData.dislikedFoods as string[], attualiGusti?.dislikedFoods)) {
          delete profileData.dislikedFoods; // non toccato: non si riscrive, e non si pulisce
        } else {
          /**
           * ⚠️ L'AIUTO A SCRIVERE L'ELENCO (Simone, 18/8), sulla lista **davvero cambiata** e prima
           * del filtro spezie. Vale anche qui e non solo in app: il campo lo compila anche la coach
           * ripetendo quello che la cliente le ha detto a voce, e una frase scritta lì fa lo stesso
           * danno. ⚠️ Non corregge niente: dice.
           */
          aiutoEsclusioni = fraseAiutoEsclusioni(problemiEsclusioni(profileData.dislikedFoods as string[]));
          const filtrati = filtraSpezie(profileData.dislikedFoods as string[]);
          // ⚠️ L'avviso resta anche se dopo la pulizia il risultato è identico a quello che c'era già
          // (ha scritto «pepe, ceci» dove c'era «ceci»): la sua riga non è passata, e va detto.
          avvisiSpezie = filtrati.avvisi;
          if (stessaLista(filtrati.tenuti, attualiGusti?.dislikedFoods)) delete profileData.dislikedFoods;
          else profileData.dislikedFoods = filtrati.tenuti;
        }
      }
      if (Array.isArray(profileData.intolerances)) {
        if (stessaLista(profileData.intolerances as string[], attualiGusti?.intolerances)) {
          delete profileData.intolerances;
        } else {
          const pulite = (profileData.intolerances as string[])
            .map((x) => String(x ?? '').trim())
            .filter((x) => x.length > 0 && !NON_ALIMENTI.has(x.toLowerCase()));
          if (stessaLista(pulite, attualiGusti?.intolerances)) delete profileData.intolerances;
          else profileData.intolerances = pulite;
        }
      }
    }

    // TIPO DI DIETA (regime + stile): cambiarlo richiede il permesso dedicato
    // "change_diet_type" (default: nutrizionisti e admin). Il resto della scheda
    // resta modificabile da chi ha accesso, come prima.
    // La FAMIGLIA è tipo di dieta quanto lo stile: sceglie il prodotto vero (Vegana o
    // Vegetariana, che condividono lo stile `flexible`). Cambiarla richiede lo stesso permesso.
    const DIET_TYPE_FIELDS = ['regime', 'dietStyle', 'dietFamily'] as const;
    let dietTypeChange: { before: Record<string, unknown>; after: Record<string, unknown> } | null = null;
    if (DIET_TYPE_FIELDS.some((k) => profileData[k] !== undefined)) {
      const current = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { regime: true, dietStyle: true, dietFamily: true },
      })) as { regime: string | null; dietStyle: string | null; dietFamily: string | null } | null;
      const changedKeys = DIET_TYPE_FIELDS.filter(
        (k) => profileData[k] !== undefined && (profileData[k] ?? null) !== (current?.[k] ?? null),
      );
      if (changedKeys.length > 0) {
        const actor = (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } })) as { role: string } | null;
        if (!(await this.roleCanManage(actor?.role ?? '', 'change_diet_type'))) {
          throw new ForbiddenException('Cambiare il tipo di dieta richiede il permesso "Cambia tipo di dieta" (nutrizionista o amministrazione).');
        }
        dietTypeChange = {
          before: { regime: current?.regime ?? null, dietStyle: current?.dietStyle ?? null, dietFamily: current?.dietFamily ?? null },
          after: {
            regime: profileData.regime ?? current?.regime ?? null,
            dietStyle: profileData.dietStyle ?? current?.dietStyle ?? null,
            dietFamily: profileData.dietFamily ?? current?.dietFamily ?? null,
          },
        };
      }
    }

    /**
     * LE ALLERGIE: permesso dedicato «Modifica allergie» (`change_allergies`, 13/8).
     *
     * Fino a oggi le scriveva **un solo punto in tutto il codice**, l'upsert del questionario: non
     * erano in questo DTO, non in `PROFILE_FIELDS`, in nessun DTO dello staff. Simone (13/8): «nella
     * scheda cliente e scheda lead il nutrizionista li deve leggere e poter modificare, magari
     * mettiamo l'impostazione nei permessi».
     *
     * ⚠️ Flag suo e non «Clienti: gestisci», che ce l'ha anche la coach: un'allergia è un blocco
     * duro, e chi la toglie decide che quella cliente da domani può trovarsi quell'alimento nel
     * piatto. Il permesso serve a dare la penna a chi può **codificare** un testo libero in codice
     * UE — le nutrizioniste.
     */
    if (profileData.allergies !== undefined) {
      /**
       * ⚠️ Il permesso si chiede solo se l'elenco è CAMBIATO DAVVERO, come per il tipo di dieta.
       *
       * Il form della scheda rimanda tutti i campi a ogni salvataggio: chiedere il permesso alla
       * sola presenza del campo vorrebbe dire che una coach non riesce più a salvare **niente**
       * della scheda — un 403 su una modifica al numero di telefono, per un campo che non ha
       * toccato. Il permesso protegge la modifica, non il salvataggio.
       */
      const attuali = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { allergies: true },
      })) as { allergies: string[] } | null;
      const nuove = (profileData.allergies as string[] | null) ?? [];
      const cambiate = (attuali?.allergies ?? []).join('|') !== nuove.join('|');
      if (!cambiate) {
        delete profileData.allergies;
      } else {
        const attore = (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } })) as { role: string } | null;
        if (!(await this.roleCanManage(attore?.role ?? '', 'change_allergies'))) {
          throw new ForbiddenException(
            'Modificare le allergie richiede il permesso "Modifica allergie": è la nutrizionista a codificarle.',
          );
        }
      /**
       * ⚠️ `allergiesOther` si RICALCOLA qui, e solo qui.
       *
       * Dedurre il testo libero per differenza dal catalogo UE è la cosa che `common/allergie.ts`
       * evita — ma lì si tratta di indovinare a posteriori su dati vecchi, che nessuno ha riletto.
       * Qui una nutrizionista ha davanti l'elenco e preme Salva: in quell'istante «quello che non è
       * un codice UE è testo libero» non è un'ipotesi, è quello che ha appena scritto lei. È
       * esattamente il ripopolamento «dalla nutrizionista» previsto quando la colonna è nata.
       */
        profileData.allergiesOther = nuove.filter((a) => !EU_ALLERGEN_CODES.includes(a));
      }
    }

    /**
     * ⛔ **USCIRE DAL DIGIUNO AZZERA L'OROLOGIO — e questo è tutto quello che resta di quel blocco.**
     *
     * Fino al 21/8 qui c'era anche la scrittura di `fastingWindow` dalla scheda, col suo permesso
     * dedicato («Cambia i pasti del digiuno») e col suo caso «svuotala, la decide la dieta». Non
     * esiste più niente di tutto questo: la tendina è sparita, il campo è uscito dal DTO e da
     * `PROFILE_FIELDS`, e la finestra la *deriva* l'orologio della cliente. Il permesso resta nella
     * tabella dei ruoli ma non protegge più nessuna porta — chi ce l'ha oggi va avvisato prima di
     * toglierglielo, non prima di smettere di usarlo.
     *
     * ⚠️ Il commento vecchio prometteva una guardia («permesso dedicato») che non c'è più: lasciarlo
     * in piedi avrebbe fatto credere al prossimo lettore che qualcosa qui sia ancora controllato.
     */
    let fastingAzzerata = false;
    if (profileData.pathType !== undefined) {
      const current = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        // ⚠️ `SELECT_OROLOGIO` e non sette righe a mano: è la stessa domanda di `restaQualcosaDell…`,
        // e sceglierne sei su sette vorrebbe dire rispondere «non c'è niente» a un profilo che ha
        // ancora una colonna scritta.
        select: { ...SELECT_OROLOGIO, pathType: true },
      })) as (Record<string, unknown> & { fastingWindow: string | null; pathType: string | null }) | null;
      const prima = current?.fastingWindow ?? null;
      /**
       * ⛔ **`!== undefined`, non `??`** (regressione trovata in revisione, 21/8). Scritto `??`, un
       * `pathType: null` esplicito — che il DTO accetta — collassava su «campo assente» e ripescava
       * il percorso di prima: la cliente restava «in digiuno» agli occhi di questa guardia, e
       * l'orologio non veniva azzerato. `null` e «non l'ho mandato» sono due cose diverse.
       */
      const percorsoFinale = (profileData.pathType !== undefined ? profileData.pathType : current?.pathType) ?? null;
      /**
       * ⛔ **«C'è ancora qualcosa dell'orologio», non «la finestra era piena»** (revisione 21/8).
       *
       * La condizione era `prima !== null`, cioè guardava **solo** `fastingWindow`. Ma esiste un
       * modo di arrivare qui con la finestra già vuota e l'orologio ancora tutto scritto: lo script
       * `prisma/sposta-percorso-cliente.ts` azzerava solo quella. In quello stato questa riparazione
       * non partiva, `fastingSceltoIl` sopravviveva — e al ritorno al digiuno la cliente non si
       * vedeva chiedere niente, con lo schermo che le mostrava «08:00 – 16:00» e il motore che le
       * mandava tutti i pasti. Schermo e piatto che dicono due cose diverse.
       *
       * ⚠️ Lo script è stato corretto insieme a questa riga. Ma una riparazione che funziona solo se
       * nessun altro ha sbagliato prima non è una riparazione: è la stessa fiducia che ha creato il
       * buco.
       */
      if (percorsoFinale !== 'intermittent_fasting' && restaQualcosaDellOrologio(current)) {
        /**
         * ⛔ **USCIRE DAL DIGIUNO PORTA VIA TUTTO L'OROLOGIO, non solo la finestra.**
         *
         * La finestra si azzerava già (era inerte, ma al ritorno al digiuno riprendeva un valore
         * vecchio in silenzio). Dal 21/8 vale lo stesso — e di più — per i campi dell'orologio: se
         * `fastingSceltoIl` sopravvivesse, il giorno in cui questa cliente tornasse al digiuno **non
         * le verrebbe chiesto niente**, e si ritroverebbe la finestra di sei mesi prima senza che
         * nessuno gliel'abbia chiesta. È il difetto da cui è nata tutta questa parte.
         *
         * ⚠️ È una **conseguenza**, non una scelta: non si chiede nessun permesso, altrimenti
         * cambiare il percorso — che è libero — sarebbe bloccato da un flag che parla di altro.
         * Resta l'audit.
         */
        // ⚠️ L'elenco sta in `menu/uscita-dal-digiuno.ts`: quattro porte lo scrivevano a mano, e tre
        // erano già divergenti. Se nasce un'ottava colonna, si aggiunge là e la seguono tutte.
        Object.assign(profileData, orologioAzzerato());
        fastingAzzerata = true;
      }
    }

    // Fase precedente: serve per accorgersi del passaggio dimagrimento → mantenimento.
    const prevObjective = profileData.objective !== undefined
      ? ((await this.prisma.clientProfile.findUnique({ where: { userId }, select: { objective: true } }))?.objective ?? null)
      : null;

    // Il PRIMA, per il log delle modifiche: si legge subito prima di scrivere, e solo se c'è
    // qualcosa da scrivere. Due letture intere invece di un `select` mirato perché le chiavi da
    // confrontare le decide la richiesta, non questo punto del codice.
    const [prevUser, prevProfile] = await Promise.all([
      Object.keys(userData).length
        ? (this.prisma.user.findUnique({ where: { id: userId } }) as Promise<Record<string, unknown> | null>)
        : Promise.resolve(null),
      Object.keys(profileData).length
        ? (this.prisma.clientProfile.findUnique({ where: { userId } }) as Promise<Record<string, unknown> | null>)
        : Promise.resolve(null),
    ]);

    /**
     * E la domanda sulle allergie risulta FATTA: una nutrizionista che scrive l'elenco è una
     * conferma più forte di una casella spuntata nel questionario. Senza, la cliente resterebbe
     * fra quelle da ricontattare anche dopo che qualcuno se n'è occupato davvero.
     *
     * ⚠️ Si timbra solo se l'elenco è **cambiato davvero**, o se non era mai stato timbrato. Il
     * form della scheda rimanda tutti i campi a ogni salvataggio: timbrare sempre riempirebbe il
     * log modifiche di righe «Allergie dichiarate il» a ogni Salva, e un log pieno di righe che non
     * dicono niente è un log che si smette di leggere.
     */
    if (profileData.allergies !== undefined && prevProfile) {
      const prima = ((prevProfile.allergies as string[] | undefined) ?? []).join('|');
      const dopo = ((profileData.allergies as string[] | null) ?? []).join('|');
      if (prima !== dopo || !prevProfile.allergieDichiarateIl) profileData.allergieDichiarateIl = new Date();
    }

    const ops: unknown[] = [];
    if (Object.keys(userData).length) ops.push(this.prisma.user.update({ where: { id: userId }, data: userData as never }));
    if (Object.keys(profileData).length) {
      ops.push(
        this.prisma.clientProfile.upsert({
          where: { userId },
          update: profileData as never,
          create: { userId, ...profileData } as never,
        }),
      );
    }
    /**
     * 🔴 QUESTA RIGA MANCAVA, E «MODIFICA SCHEDA» NON SALVAVA NIENTE.
     *
     * `ops` veniva riempito e **mai eseguito**. Le operazioni di Prisma sono pigre: costruirle non
     * le esegue: senza `$transaction` (o un `await` su ciascuna) restano intenzioni. Quindi ogni
     * salvataggio della scheda cliente — telefono, indirizzo, dieta, obiettivo, tutto — non
     * arrivava al database.
     *
     * E non se ne accorgeva nessuno perché **tutto il resto della funzione funzionava**: l'audit
     * scriveva «cambiato da X a Y» (lo calcola dai valori richiesti, non da quelli scritti), il
     * cambio del tipo di dieta faceva rigenerare i menu, e la risposta tornava senza errori. Il log
     * modifiche raccontava una modifica che non c'era, ed è la ragione per cui Simone ha spostato la
     * dieta di una cliente da «Pescetariana» a «Mediterranea» cinque volte vedendola tornare
     * indietro: non tornava indietro, non era mai partita.
     *
     * Trovato l'11/8 con la traccia su `dietFamily` (`prisma/traccia-diet-family.ts`, tolta il 19/8
     * a lavoro finito), che ha
     * mostrato UNA sola scrittura e nessuna riscrittura: a quel punto la domanda giusta non era più
     * «chi la sovrascrive» ma «questa scrittura viene eseguita?».
     */
    if (ops.length) await this.prisma.$transaction(ops as never);
    /**
     * COSA è cambiato, non solo CHE la scheda è stata salvata.
     *
     * Richiesta di Simone del 10/8: «nel log modifiche va specificato anche cosa ha modificato,
     * altrimenti non serve a nulla — e la stessa cosa vale per le modifiche fatte da admin, coach o
     * nutrizionista». Questa riga di audit non aveva **nessun** metadata: nel log si leggeva
     * «Modifica scheda · Da Mario (coach)» e nient'altro. La domanda vera è sempre «chi ha cambiato
     * quel numero di telefono, e quando».
     *
     * Si legge il PRIMA dai valori già caricati sopra (`prevUser`/`prevProfile`) e si confronta con
     * quello che stiamo scrivendo, con le regole di `campiCambiati`: solo i campi presenti nella
     * richiesta e solo quelli davvero diversi — il form della scheda rimanda tutti i campi a ogni
     * salvataggio, quindi senza quel filtro ogni salvataggio scriverebbe venti righe identiche.
     */
    const campi = [
      ...campiCambiati(prevUser as Record<string, unknown> | null, userData as Record<string, unknown>, Object.keys(userData)),
      ...campiCambiati(prevProfile as Record<string, unknown> | null, profileData as Record<string, unknown>, Object.keys(profileData)),
    ];
    await this.audit.log({
      action: 'client.update',
      actorId,
      entityType: 'user',
      entityId: userId,
      // Niente riga muta: se non è cambiato niente il metadata lo dice, invece di far sembrare che
      // il dettaglio sia andato perso.
      metadata: { campi, nessunCambio: campi.length === 0 },
    });
    // Cambio del tipo di dieta: voce di audit dedicata con prima/dopo (visibile nel Log modifiche).
    // I pasti del digiuno hanno un evento SUO nel log: «modifica scheda» non dice che da domani
    // quella cliente non riceve più la colazione, e nel log delle modifiche è la riga che serve
    // quando chiederà perché il menu è cambiato.
    if (fastingAzzerata) {
      await this.audit.log({
        action: 'client.fasting_window.azzerata',
        actorId,
        entityType: 'user',
        entityId: userId,
        metadata: { motivo: 'percorso diverso dal digiuno intermittente' } as never,
      });
    }
    /**
     * ⛔ Qui c'era `client.fasting_window.change`, la riga di audit di quando la scheda **scriveva**
     * la finestra. Non può più nascere: `fastingChange` resta `null` per costruzione, perché il
     * campo è uscito dal DTO e da `PROFILE_FIELDS`. Tolta, invece di lasciarla come ramo morto che
     * qualcuno un giorno prova a spiegarsi. ⚠️ Le righe **già scritte** restano nel log e restano
     * leggibili: la loro etichetta è ancora in `CHANGE_ACTION_LABEL` del backoffice.
     */
    if (dietTypeChange) {
      await this.audit.log({
        action: 'client.diet_type.change',
        actorId,
        entityType: 'user',
        entityId: userId,
        metadata: dietTypeChange as never,
      });
      // I menu cambiano DALLA PROSSIMA EROGAZIONE: i giorni già consumati restano,
      // i giorni futuri già erogati vengono rifatti con la nuova dieta (solo la differenza).
      // ⚠️ Salvo «lascia i giorni già preparati» (Vera, azione 3 — 14/8): col flag i giorni
      // erogati restano e la dieta nuova entra coi prossimi menu. L'audit lo dice comunque.
      if (d.dietChangeKeepDeliveredDays === true) {
        await this.audit.log({
          action: 'client.diet_type.menus_kept',
          actorId,
          entityType: 'user',
          entityId: userId,
          metadata: { keepDeliveredDays: true } as never,
        });
      } else {
        try {
          const r = await this.menu.redeliverFutureDays(userId);
          await this.audit.log({
            action: 'client.diet_type.menus_redelivered',
            actorId,
            entityType: 'user',
            entityId: userId,
            metadata: { removedFutureDays: r.removed, delivered: r.delivered } as never,
          });
        } catch {
          /* la rigenerazione non deve mai bloccare il salvataggio della scheda */
        }
      }
    }

    // Passaggio di fase dimagrimento → mantenimento: festeggia con la cliente
    // (in-app + push, best effort: non deve mai bloccare il salvataggio).
    if (profileData.objective === 'mantenimento' && prevObjective === 'dimagrimento') {
      await this.notifications
        .notify({
          userId,
          type: 'objective_reached',
          title: 'Hai raggiunto il tuo obiettivo! 🎉',
          body: 'Da oggi si passa alla fase di mantenimento: il piano cambia ritmo per aiutarti a consolidare i risultati. Complimenti!',
          payload: { from: 'dimagrimento', to: 'mantenimento' },
        })
        .catch(() => undefined);
    }
    // SENZA GLUTINE: se la coach ha appena aggiunto il glutine fra allergie o intolleranze, la
    // variante dedicata si assegna da sé e la cliente viene avvisata (richiesta di Simone del 9/8).
    // Idempotente: chi ce l'ha già non riceve un secondo messaggio. Best effort come sopra — il
    // salvataggio della scheda non deve dipendere da questo.
    try {
      await assegnaSenzaGlutineEAvvisa(this.prisma as never, userId);
    } catch {
      /* non bloccante: il glutine resta escluso dai menu dalle esclusioni del profilo */
    }
    /**
     * ⚠️ GLI AVVISI TORNANO A CHI HA PREMUTO SALVA, e non finiscono in un log che nessuno apre.
     *
     * `avvisiSpezie` esce dalla stessa `filtraSpezie` che usa il profilo in app, dove la frase la
     * legge la cliente (`profile.service` la rimanda insieme al profilo). Qui la legge la
     * nutrizionista: se ha scritto «pepe» fra i cibi non graditi, quella riga non è stata salvata e
     * deve saperlo — con il motivo, perché il motivo è la parte che le fa cambiare gesto.
     */
    return {
      updated: true,
      ...(avvisiSpezie.length ? { avvisiSpezie } : {}),
      // Solo quando c'è qualcosa da dire: un avviso che compare sempre non è un avviso.
      ...(aiutoEsclusioni ? { aiutoEsclusioni } : {}),
    };
  }

  /**
   * Menu del cliente per la revisione del nutrizionista: giorni di menu (ultime ~8
   * settimane + prossimi 7 giorni) con i piatti e le STELLINE date dal cliente.
   * Per ogni piatto: valutazione del giorno esatto se c'è, altrimenti l'ultima
   * valutazione data a quella ricetta (contrassegnata come "altro giorno").
   */
  /**
   * I menu erogati, per la scheda cliente.
   *
   * La finestra è **parametrica** da 8/8. Prima era fissa agli ultimi 56 giorni, e la conseguenza
   * l'ha trovata Simone: «se il cliente ha più piani, nella riga di acquisto premendo devo aprire i
   * suoi vecchi menu, altrimenti dove vedo lo storico?». Aveva ragione — i menu di un piano finito
   * tre mesi prima esistevano nel database e non erano raggiungibili da nessuna schermata.
   *
   * Il default resta quello di prima (ultimi 56 giorni + una settimana avanti), così chi apre la
   * scheda vede quello che ha sempre visto; passando `from`/`to` si guarda il periodo di un piano
   * preciso. Il tetto sui giorni e sul `take` c'è perché un intervallo aperto su una cliente di due
   * anni sarebbe una query da migliaia di righe per rispondere a un click.
   */
  async getMenus(userId: string, actorId: string, periodo?: { from?: string; to?: string }) {
    await this.assertClientAccess(actorId, userId);
    // Finestra dei menu: di default gli ultimi 56 giorni + 7 avanti; con `from`/`to` si aprono i
    // menu di un piano preciso, anche finito da mesi. Regole e limiti in `finestra-menu.ts`.
    let from: Date;
    let to: Date;
    try {
      ({ from, to } = finestraMenu(periodo));
    } catch (e) {
      throw new BadRequestException(e instanceof PeriodoNonValido ? e.message : 'Periodo non valido.');
    }

    const [days, ratings] = await Promise.all([
      this.prisma.menuDay.findMany({
        where: { clientId: userId, date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
        // Venti giorni in più del tetto della finestra: così il taglio non nasconde mai giorni
        // dentro il periodo chiesto (con `orderBy: date desc` sarebbero spariti i più vecchi,
        // cioè proprio l'inizio del piano che si sta guardando).
        take: MENU_MAX_GIORNI + 20,
        select: { id: true, date: true, level: true, status: true, meals: true, diet: { select: { id: true, name: true } } },
      }) as Promise<{ id: string; date: Date; level: number; status: string; meals: unknown; diet: { id: string; name: string } | null }[]>,
      this.prisma.recipeRating.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 800,
        select: { recipeId: true, date: true, stars: true, tags: true },
      }) as Promise<{ recipeId: string; date: Date; stars: number; tags: string[] }[]>,
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const exact = new Map<string, { stars: number; tags: string[] }>();
    const latest = new Map<string, { stars: number; tags: string[]; date: string }>();
    for (const r of ratings) {
      exact.set(`${r.recipeId}|${dayKey(r.date)}`, { stars: r.stars, tags: r.tags });
      if (!latest.has(r.recipeId)) latest.set(r.recipeId, { stars: r.stars, tags: r.tags, date: dayKey(r.date) }); // già ordinate per data desc
    }

    const out = days.map((d) => {
      const key = dayKey(d.date);
      const meals = (Array.isArray(d.meals) ? d.meals : []) as { slot?: string; recipeId?: string; name?: string; kcal?: number }[];
      return {
        id: d.id,
        date: key,
        level: d.level,
        status: d.status,
        dietName: d.diet?.name ?? null,
        meals: meals.map((m) => {
          const ex = m.recipeId ? exact.get(`${m.recipeId}|${key}`) : undefined;
          const la = !ex && m.recipeId ? latest.get(m.recipeId) : undefined;
          return {
            slot: m.slot ?? null,
            name: m.name ?? '—',
            kcal: m.kcal ?? null,
            /**
             * ⚠️ Il moltiplicatore di porzione (voce 255, 18/8). `kcal` è già scalato, quindi la
             * colonna è corretta da sola — ma senza questo campo la nutrizionista legge un pranzo
             * da 891 kcal e non sa perché, e l'unico modo di scoprirlo sarebbe leggere il codice.
             */
            porzione: (m as { porzione?: number }).porzione ?? null,
            kcalBase: (m as { kcalBase?: number }).kcalBase ?? null,
            stars: ex?.stars ?? la?.stars ?? null,
            ratingTags: ex?.tags ?? la?.tags ?? [],
            // true = valutato proprio quel giorno; false = ultima valutazione della stessa ricetta in un altro giorno.
            ratedSameDay: ex ? true : la ? false : null,
            ratedOn: ex ? key : la?.date ?? null,
          };
        }),
      };
    });
    await this.audit.log({ action: 'client.menus.view', actorId, entityType: 'user', entityId: userId });
    return { days: out };
  }

  /**
   * Correzione di una misura inserita male dal cliente (permesso dedicato
   * "fix_measures" nella matrice Permessi). Tutto tracciato in audit con prima/dopo.
   */
  async updateMeasurement(
    userId: string,
    actorId: string,
    measurementId: string,
    input: { weightKg?: number; waistCm?: number | null; hipsCm?: number | null; thighsCm?: number | null },
  ) {
    await this.assertClientAccess(actorId, userId);
    const m = (await this.prisma.measurement.findFirst({
      where: { id: measurementId, clientId: userId },
    })) as { id: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null; date: Date } | null;
    if (!m) throw new NotFoundException('Misura non trovata per questo cliente.');

    const data: Record<string, unknown> = {};
    if (input.weightKg !== undefined) {
      if (typeof input.weightKg !== 'number' || input.weightKg < 25 || input.weightKg > 400) throw new BadRequestException('Peso non plausibile (25–400 kg).');
      data.weightKg = Math.round(input.weightKg * 10) / 10;
    }
    for (const k of ['waistCm', 'hipsCm', 'thighsCm'] as const) {
      const v = input[k];
      if (v === undefined) continue;
      if (v === null) { data[k] = null; continue; }
      if (typeof v !== 'number' || v < 20 || v > 300) throw new BadRequestException('Circonferenza non plausibile (20–300 cm).');
      data[k] = Math.round(v * 10) / 10;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Nessuna modifica indicata.');

    const updated = await this.prisma.measurement.update({ where: { id: m.id }, data: data as never });
    await this.audit.log({
      action: 'client.measurement.fix',
      actorId,
      entityType: 'measurement',
      entityId: m.id,
      metadata: {
        clientId: userId,
        date: m.date.toISOString().slice(0, 10),
        before: { weightKg: m.weightKg, waistCm: m.waistCm, hipsCm: m.hipsCm, thighsCm: m.thighsCm },
        after: data,
      },
    });
    return updated;
  }

  /**
   * Cambio della DATA DI INIZIO del piano (permesso dedicato "change_plan_start"):
   * sposta l'inizio dell'abbonamento mostrato in scheda (attivo > in attesa > più
   * recente), ricalcola la FINE dalla durata del piano e allinea la base dei menu
   * (profile.planStartDate). Tutto in audit con prima/dopo.
   *
   * `conferma` esiste per un solo caso, ed è il caso che è già costato una mattinata: una data di
   * inizio talmente indietro che il piano, sommata la durata, risulta **già finito**. Il sistema
   * eseguiva l'ordine senza fiatare, il piano diventava scaduto, la cliente vedeva «Nessun piano
   * attivo» e in dashboard non compariva niente — e da fuori sembrava un difetto del software.
   * (Il 10/8 era un mese sbagliato per distrazione, e la conclusione era «errore mio»: ma un
   * comando che manda un piano nel passato in silenzio è comunque un difetto del software.)
   * Senza `conferma: true` l'operazione si ferma e restituisce 409 con la frase da mostrare: non è
   * un divieto — spostare all'indietro un piano finito davvero è legittimo — è una domanda.
   */
  async updatePlanStart(userId: string, actorId: string, dateIso: string, conferma = false) {
    await this.assertClientAccess(actorId, userId);
    const d = new Date(String(dateIso).slice(0, 10) + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida (formato AAAA-MM-GG).');
    const now = Date.now();
    if (Math.abs(d.getTime() - now) > 366 * 86_400_000) throw new BadRequestException('Data fuori intervallo (max un anno da oggi).');

    const subs = (await this.prisma.subscription.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { name: true, period: true } } },
    })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string; period: string } }[];
    // STESSA scelta della scheda (`pickMainSubscription`): l'abbonamento che l'operatore vede
    // scritto sopra il tasto è quello che la matita sposta. Prima qui la catena si fermava a
    // "attivo > in attesa > il più recente" e su una cliente con un checkout ANNULLATO creato
    // dopo la prova finiva per spostare le date dell'annullato: la scheda continuava a mostrare
    // la prova scaduta con la fine vecchia e il piano non tornava attivo, pur con il messaggio
    // di salvataggio riuscito.
    const sub = pickMainSubscription(subs);
    if (!sub) throw new NotFoundException('Nessun abbonamento su cui spostare la data.');

    const newEnd = subscriptionEnd(d, sub.plan.period);

    /**
     * GLI AVVISI DELLA MATITA — due, e si chiedono INSIEME.
     *
     * ⚠️ Trovato in revisione (17/8 sera): con due `if` separati sullo stesso `conferma`, chi
     * confermava il primo avviso («il piano risulta già finito») saltava anche il secondo — la
     * sovrapposizione non gliela mostrava nessuno. Rispondeva a una frase e ne accettava due.
     * Ora si raccolgono tutti e si chiede una volta sola, con tutte le conseguenze davanti.
     */
    const avvisi: string[] = [];
    const gg = (x: Date) => x.toISOString().slice(0, 10).split('-').reverse().join('/');

    // 1. Con questa data il piano nasce già finito.
    if (newEnd.getTime() <= now) {
      avvisi.push(
        `Con l'inizio al ${gg(d)} il piano «${sub.plan.name}» (${sub.plan.period}) risulta già finito il ` +
          `${gg(newEnd)}. La cliente vedrà «Nessun piano attivo», non riceverà menu e non comparirà in dashboard.`,
      );
    }

    /**
     * L'ALTRO AVVISO: con questa data il piano finisce **addosso a un altro** (voce 259).
     *
     * ⚠️ È il caso Lorena, e la matita è lo strumento con cui è successo: il 16/8, quarantotto
     * secondi dopo l'acquisto del secondo piano, questa data è stata spostata e i due piani si sono
     * sovrapposti. Chi l'ha fatto stava correggendo una data che la scheda mostrava sbagliata, e non
     * poteva sapere delle altre righe — nessuno gliene parlava.
     *
     * ⚠️ **Conferma e non divieto**, come l'avviso qui sopra: forzare a volte serve davvero, e un
     * divieto secco si aggira cambiando la riga a mano nel database, dove non lascia traccia.
     * ⚠️ Un solo `conferma` per due avvisi diversi è voluto: chi conferma risponde alla frase che ha
     * letto, e la frase la compone il server. Due flag vorrebbero dire che la pagina sa quale avviso
     * è arrivato — cioè conosce le regole, che è esattamente quello che si sta evitando.
     */
    const sovrapposti = pianiSovrapposti(
      subs.filter((s) => s.id !== sub.id).map((s) => ({ ...s, nome: s.plan?.name ?? null })),
      d,
      newEnd,
    );
    if (sovrapposti.length) avvisi.push(fraseSovrapposizione(sovrapposti, sub.plan.name, d, newEnd));

    if (!conferma && avvisi.length) {
      throw new ConflictException(
        avvisi.length === 1
          ? `Attenzione: ${avvisi[0]} Se è quello che vuoi, conferma.`
          : `Attenzione, due cose:\n\n· ${avvisi.join('\n\n· ')}\n\nSe è quello che vuoi, conferma.`,
      );
    }

    /**
     * RIATTIVAZIONE: spostare l'inizio nel futuro deve rendere il piano di nuovo attivo. Se la
     * nuova fine è nel futuro e l'abbonamento era già approvato, si riscrive lo stato. Non si
     * toccano `pending` (pagamento non approvato) né `cancelled` (stato terminale voluto): senza
     * questo, un abbonamento scaduto spostato in avanti restava `expired` → «Nessun piano attivo»
     * e niente menu pur avendo date future.
     *
     * ⚠️ **`queued` è fra gli stati che si riscrivono** (19/8, voce 258), e lo stato nuovo lo decide
     * `statoPerInizio` e non questa riga: una coda spostata a OGGI deve diventare attiva subito, e
     * un piano attivo spostato a lunedì deve tornare in coda. Senza, la matita salvava le date
     * nuove lasciando lo stato vecchio — la cliente vedeva la data giusta sulla scheda e i menu
     * arrivavano il giorno dopo, quando passava il lavoro notturno.
     */
    const daRiscrivere = newEnd.getTime() > now && ['active', 'queued', 'expired'].includes(sub.status);
    // ⚠️ `d` è un GIORNO (riga 1503: `…T00:00:00.000Z`), non un istante: vedi `statoPerGiornoDiInizio`.
    const statoNuovo = statoPerGiornoDiInizio(d, new Date(now));

    const prevProfile = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { planStartDate: true },
    })) as { planStartDate: Date | null } | null;

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { startDate: d, endDate: newEnd, ...(daRiscrivere ? { status: statoNuovo as never } : {}) },
      }),
      this.prisma.clientProfile.upsert({
        where: { userId },
        update: { planStartDate: d } as never,
        create: { userId, planStartDate: d } as never,
      }),
    ] as never);

    await this.audit.log({
      action: 'client.plan_start.change',
      actorId,
      entityType: 'subscription',
      entityId: sub.id,
      metadata: {
        clientId: userId,
        plan: sub.plan.name,
        before: {
          startDate: sub.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: sub.endDate?.toISOString().slice(0, 10) ?? null,
          planStartDate: prevProfile?.planStartDate?.toISOString().slice(0, 10) ?? null,
        },
        after: { startDate: d.toISOString().slice(0, 10), endDate: newEnd.toISOString().slice(0, 10), ...(daRiscrivere ? { status: statoNuovo, reactivated: statoNuovo === 'active' } : {}) },
        /**
         * ⚠️ CHI HA CONFERMATO LA SOVRAPPOSIZIONE, e su cosa (voce 259). L'`actorId` c'era già; qui
         * si scrive **che l'avviso c'era ed è stato superato**, coi piani coinvolti. Senza questa
         * riga, fra un mese la sovrapposizione di una cliente si legge come un difetto del software
         * invece che come una decisione presa — è la differenza fra il caso Lorena e il prossimo.
         */
        ...(sovrapposti.length
          ? {
              sovrapposizioneConfermata: sovrapposti.map((s) => ({
                id: s.id,
                piano: s.nome,
                quando: s.quando,
                inizio: s.inizio?.toISOString().slice(0, 10) ?? null,
                fine: s.fine?.toISOString().slice(0, 10) ?? null,
              })),
            }
          : {}),
      },
    });
    // Cambio data di inizio = il piano RIPARTE: si cancellano i menu già erogati e si
    // rieroga dalla nuova data (il motore rispetta finestre di visibilità e gate misure).
    try {
      const r = await this.menu.restartFromPlanStart(userId);
      await this.audit.log({
        action: 'client.plan_start.menus_restarted',
        actorId,
        entityType: 'user',
        entityId: userId,
        metadata: { removedDays: r.removed, delivered: r.delivered } as never,
      });
    } catch {
      /* mai bloccare lo spostamento della data per un errore di rigenerazione */
    }
    // Torniamo anche QUALE abbonamento è stato spostato e come è rimasto: se la cliente ha più
    // abbonamenti, l'operatore deve poter leggere dal messaggio se ha toccato quello giusto e se
    // il piano è tornato attivo, invece di doverlo dedurre guardando la scheda.
    return {
      startDate: d.toISOString().slice(0, 10),
      endDate: newEnd.toISOString().slice(0, 10),
      plan: sub.plan.name,
      status: daRiscrivere ? statoNuovo : sub.status,
      // ⚠️ «Riattivato» vuol dire che da adesso eroga: una coda spostata a lunedì è stata scritta,
      // ma non è ripartita. Dirlo lo stesso farebbe scrivere in scheda una cosa che non è successa.
      reactivated: daRiscrivere && statoNuovo === 'active',
    };
  }

  /**
   * Rigenera i menu della cliente da OGGI in poi: corregge i menu già erogati ma
   * sbagliati da una vecchia generazione (es. giorno con la sola colazione), senza
   * toccare lo storico passato. Non cambia la data di inizio piano.
   */
  async regenerateMenu(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const r = await this.menu.regenerateFromToday(userId);
    await this.audit.log({
      action: 'client.menu.regenerated',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { removedDays: r.removed, delivered: r.delivered } as never,
    });
    return r;
  }

  /**
   * ⛔ **MODALITÀ VIAGGIO — e da oggi ferma i menu davvero** (23/8).
   *
   * Fin qui questo metodo scriveva tre campi sul profilo e basta: nessun menu fermato, nessuna
   * scadenza spostata. Chi metteva «In vacanza» dal back office credeva di aver sospeso il
   * percorso, e i menu continuavano ad arrivare — mentre l'app, a chi è in un `pause_period` vero
   * (creato da tutt'altra porta), scrive «Sei in modalità viaggio». Due oggetti, lo stesso nome.
   * Il perché e la regola stanno in `pause.service.sospendiPerViaggio`.
   *
   * ⚠️ **Sospendono sia `in_partenza` sia `in_vacanza`**, non solo il secondo: la sospensione ha le
   * sue date e comincia da sé il giorno giusto. Legandola al solo «In vacanza» servirebbe qualcuno
   * che torna sulla scheda la mattina della partenza a cambiare la tendina — cioè non succederebbe.
   * È la stessa coppia di stati che `statoViaggioAttivo` considera viva.
   *
   * ⚠️ **`travelEnd` continua a contenere l'ULTIMO GIORNO DI VACANZA**, come prima: è quello che
   * `statoViaggioAttivo` confronta (`oggi <= travelEnd`). Quello che cambia è la casella che si
   * scrive — «Riprende il» — e la conversione la fa `ultimoGiornoSospeso`, una volta sola.
   */
  async setTravel(
    userId: string,
    actorId: string,
    input: { state?: string; start?: string; rientro?: string; end?: string; motivo?: string },
  ) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException('Solo per i clienti.');
    const toDate = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);

    const start = toDate(input.start);
    /**
     * ⚠️ Le due forme della seconda data, e la precedenza. `rientro` (primo giorno di dieta) è
     * quello che manda la card da oggi; `end` (ultimo giorno di vacanza) è la forma vecchia, che
     * arriva ancora da un backoffice con il bundle in cache. Leggere `end` come «rientro»
     * sposterebbe la vacanza di un giorno in silenzio — vedi `TravelDto`.
     */
    const rientroScritto = toDate(input.rientro);
    const ultimoGiorno = rientroScritto ? ultimoGiornoSospeso(rientroScritto) : toDate(input.end);

    /**
     * ⛔ **PRIMA SI SOSPENDE, POI SI SCRIVE IL PROFILO** (ordine corretto in revisione, 23/8).
     *
     * Era il contrario, e non c'è transazione: `sospendiPerViaggio` **lancia** in quattro casi
     * (rientro non dopo la partenza, oltre il tetto, sovrapposizione, vacanza già passata). Con
     * l'ordine vecchio l'operatrice leggeva «Salvataggio non riuscito» e in banca dati restavano
     * `travel_state = 'in_vacanza'` e le date, **senza nessuna sospensione**: cioè esattamente
     * l'equivoco che questa consegna esiste per chiudere — la card che sembra aver fermato i menu
     * mentre i menu continuano ad arrivare — rimesso in piedi sul percorso d'errore.
     *
     * Nell'ordine giusto un errore lascia tutto com'era, e la card lo dice.
     *
     * ⚠️ Senza date non si sospende niente, e non si inventa una durata: un periodo senza fine è il
     * difetto che `stato-viaggio.ts` racconta di aver dovuto tappare («un "in vacanza" di luglio
     * valeva ancora a novembre»).
     */
    /**
     * ⛔ **LO STATO NON SI SCEGLIE PIÙ: LO DICONO LE DATE** (Simone, 24/8: «va tolto il campo stato
     * che crea confusione»).
     *
     * La tendina aveva tre voci — «in partenza», «in vacanza», «rientrato/a» — e chiedeva a chi
     * salva una cosa che il calendario sa già. Peggio: le due metà potevano **contraddirsi**. Una
     * vacanza dal 30/7 al 7/8 salvata con lo stato «in partenza» a metà agosto scriveva sul profilo
     * uno stato falso; e uno stato senza date non fermava niente pur sembrando di sì — è il difetto
     * che questa card si porta dietro da mesi, e la tendina era l'ultimo posto da cui poteva
     * rientrare.
     *
     * Adesso **si sospende quando ci sono le due date**, e lo stato sul profilo si ricava da esse:
     * `in_partenza` se comincia domani o più in là, `in_vacanza` se è già cominciata. Svuotare le
     * date è il modo di togliere la sospensione — la card lo dice sotto le caselle.
     *
     * ⛔ **`input.state` si RIFIUTA, e la prima stesura lo ignorava — un difetto grave, trovato in
     * revisione.** Il back office è un sito a parte: una scheda aperta stamattina continua a mandare
     * `state`, e nella card vecchia scegliere «Rientrato/a» o «— nessuna —» **lasciando le due date
     * piene** era il modo documentato di chiudere una vacanza. Ignorando il campo, quella stessa
     * mossa faceva l'**opposto**: due date presenti = sospensione confermata, menu fermi, scadenza
     * del piano allungata. La cliente restava senza menu e nessuno sapeva perché.
     * Un Salva che si ferma e spiega è molto meno grave di un Salva che fa il contrario.
     *
     * ⚠️ E `rientrato` non lo scrive più nessuno da qui: lo mette il giro notturno il giorno del
     * rientro, per TUTTE le porte (vedi `PauseService.surveillanceTick`) — prima dipendeva dal fatto
     * che qualcuno si ricordasse di tornare sulla scheda a cambiare la tendina, e se non lo faceva
     * la campagna di rientro non partiva.
     */
    if (input.state !== undefined) {
      throw new BadRequestException(
        'Ricarica la pagina: il campo «Stato» non esiste più. Adesso comandano le due date — '
        + 'per togliere una sospensione svuotale e salva.',
      );
    }
    const sospende = !!(start && ultimoGiorno);
    const state: string | null = !sospende
      ? null
      : aGiorno(start as Date).getTime() > aGiorno(new Date()).getTime()
        ? 'in_partenza'
        : 'in_vacanza';

    /**
     * ⛔ **IL MOTIVO SI SCRIVE, E QUI SI PRETENDE** (Simone, 24/8).
     *
     * Fino a oggi una sospensione diceva da quando a quando e da quale porta era nata, e **non
     * perché**. Chi apre la scheda tre mesi dopo — o chi deve decidere se concedere la seconda
     * vacanza in un mese, che è la domanda della «tregua» — leggeva venti giorni di menu fermi
     * senza sapere se era un viaggio di lavoro, un ricovero o un esame.
     *
     * ⚠️ **Si chiede solo quando si sospende davvero**, non quando si registra il rientro o si
     * svuota lo stato: pretendere una motivazione per *togliere* una sospensione sarebbe un attrito
     * senza contenuto. E la soglia è di tre caratteri, che non è un controllo di qualità — è la
     * differenza fra un campo compilato e uno riempito con uno spazio per superare il modulo.
     */
    const motivo = (input.motivo ?? '').trim();
    if (start && ultimoGiorno && motivo.length < 3) {
      throw new BadRequestException(
        'Scrivi il motivo della sospensione: resta salvato sulla scheda e lo legge chi la aprirà fra tre mesi '
        + '(o chi dovrà decidere sulla prossima vacanza). Bastano poche parole — «viaggio di lavoro», «ricovero».',
      );
    }
    let sospensione: { giorni: number; giorniCongelati: number; nuovaScadenza: Date | null; avviso: string | null } | null = null;
    let avviso: string | null = null;
    if (start && ultimoGiorno) {
      sospensione = await this.pause.sospendiPerViaggio(userId, actorId, {
        start,
        rientro: new Date(ultimoGiorno.getTime() + 86_400_000),
        motivo,
      });
      avviso = sospensione.avviso;
    } else {
      /**
       * ⚠️ **Una casella svuotata TOGLIE la sospensione**, e l'avviso di `togliSospensioneDaViaggio`
       * è l'unica cosa che lo dice a chi ha appena salvato: i menu ripartono, magari in mezzo a una
       * vacanza. Prima qui si aggiungeva anche «senza le due date i menu non si fermano», che
       * accompagnava lo stato salvato da solo: con la tendina tolta quel caso non esiste più —
       * senza date non c'è niente da salvare se non la cancellazione.
       */
      const tolta = await this.pause.togliSospensioneDaViaggio(userId, actorId);
      if (tolta.tolta) avviso = tolta.avviso;
    }

    const data = { travelState: state, travelStart: start, travelEnd: ultimoGiorno };
    await this.prisma.clientProfile.upsert({
      where: { userId },
      update: data as never,
      create: { userId, ...data } as never,
    });

    /**
     * ⚠️ **Il `travel_return` non nasce più qui**: da questa porta lo stato `rientrato` non si può
     * più scrivere (la tendina è stata tolta il 24/8), e l'evento — quello che accende la campagna
     * di rientro del marketing e il tono di Gaia — lo emette il giro notturno il giorno del rientro,
     * per tutte le porte. Vedi `PauseService.surveillanceTick`.
     */
    /**
     * ⚠️ **Nel registro finiscono anche le DATE**, non il solo stato. Prima c'era `metadata: { state }`:
     * lo storico diceva «qualcuno ha messo "in vacanza"» e non da quando a quando — cioè non
     * rispondeva alla domanda per cui qualcuno va a leggerlo. Le voci più vecchie di oggi restano
     * senza date: non si inventano.
     */
    await this.audit.log({
      action: 'client.travel.update',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: {
        state,
        dal: start ? start.toISOString().slice(0, 10) : null,
        riprendeIl: ultimoGiorno ? new Date(ultimoGiorno.getTime() + 86_400_000).toISOString().slice(0, 10) : null,
        giorniSospesi: sospensione?.giorni ?? null,
        giorniCongelati: sospensione?.giorniCongelati ?? null,
        // ⚠️ Nel registro finisce anche il MOTIVO: è la riga che risponde a «perché» fra tre mesi.
        motivo: motivo || null,
      } as never,
    });
    return {
      state,
      giorniSospesi: sospensione?.giorni ?? null,
      giorniCongelati: sospensione?.giorniCongelati ?? null,
      nuovaScadenza: sospensione?.nuovaScadenza ? sospensione.nuovaScadenza.toISOString() : null,
      avviso: avviso || null,
    };
  }

  /**
   * ⛔ **LE DATE DELLE SOSPENSIONI E DELLA MODALITÀ VIAGGIO** — richiesta di Simone, 23/8:
   * *«io da back office dove vedo le date delle sospensioni e delle modalità viaggio?»*
   *
   * Risposta, prima di questa consegna: **da nessuna parte**. La card mostrava tre caselle da
   * riempire e nessuno storico; la card «Richieste di pausa» mostrava solo quelle **in attesa**; i
   * periodi veri — le righe `event` con `mode = pause_period`, quelle che fermano davvero i menu —
   * non comparivano in nessuna schermata del back office. Una coach che voleva sapere «perché a
   * questa cliente non arriva il menu?» non aveva un posto dove guardarlo.
   *
   * Qui si mettono insieme le quattro cose che rispondono a quella domanda, e restano **quattro**
   * invece di diventare un elenco unico perché non hanno lo stesso peso:
   *
   *  1. `periodi` — i periodi VERI. Sono questi che fermano l'erogazione; gli altri tre no.
   *  2. `richieste` — le richieste di pausa, **anche già decise**: dicono chi ha approvato e quando.
   *  3. `viaggio` — lo storico della card, dal registro. ⚠️ Le voci scritte **prima del 23/8**
   *     hanno solo lo stato e non le date: allora nel registro non ci finivano. Non si inventano.
   *  4. `dichiarati` — i periodi che la cliente ha scritto nel questionario. Non fermano niente e
   *     non l'hanno mai fatto: servono a capire se quello che sta succedendo era previsto.
   *
   * ⚠️ `riprendeIl` è ovunque il **primo giorno di dieta**, non l'ultimo di vacanza: è la
   * convenzione della card, e la conversione la fa `giornoDiRientro` una volta sola.
   */
  async sospensioni(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    /**
     * ⚠️ **La lettura sta in `sospensioni-di-una-cliente.ts`** (24/8), e qui resta solo il controllo
     * dei permessi. Il motivo è uno script: `diag:cliente` non mostrava le pause — è il buco che il
     * 23/8 ha nascosto per ore il vero cancello di una cliente ferma — e per mostrarle serviva questa
     * stessa risposta, senza il controllo dei permessi che una riga di comando non ha. Ricopiarla
     * sarebbe stata la seconda lettura della stessa cosa, e due letture della stessa cosa divergono
     * proprio mentre qualcuno le confronta per capire perché una cliente non mangia.
     */
    return sospensioniDiUnaCliente(this.prisma, userId);
  }

  /**
   * Cronologia delle modifiche al profilo del cliente (chi e quando):
   * anagrafica, assegnazioni coach/nutrizionista, cambio email, reset password.
   * Raccoglie le voci di audit collegate a userId, profilo e record CRM.
   */
  async changeLog(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    const [profile, crm] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { id: true } }),
    ]);
    const ids = [userId, profile?.id, crm?.id].filter((x): x is string => Boolean(x));
    const CHANGE_ACTIONS = [
      /**
       * ⚠️ `client.fasting_window.change` resta in elenco pur non nascendo più: le righe scritte
       * fino al 21/8 sono la storia, e la storia si legge.
       * ⛔ `client.fasting_window.azzerata` invece **mancava**, ed era il difetto: da oggi
       * quell'azzeramento porta via **tutto** l'orologio, non solo la finestra, ed era l'unica cosa
       * che poteva spiegare a una coach perché una cliente si è ritrovata senza fasce. Quello che
       * compariva al suo posto era la riga `client.update` con dentro sette campi tecnici.
       */
      'client.update', 'me.profile.update',
      'client.fasting_window.change', 'client.fasting_window.azzerata',
      // Le modifiche fatte dalla **scheda lead** (telefono, codice fiscale, tag, consenso): sono
      // sugli stessi dati della cliente e mancavano da questo elenco, quindi non comparivano né
      // qui né là. Ora i due log raccontano la stessa storia (richiesta di Simone dell'8/8).
      'crm.lead.update_info', 'crm.lead.advance',
      'admin.assignment.update', 'crm.nutritionist.assign',
      'crm.lead.assign', 'crm.lead.accept', 'crm.lead.reject',
      'auth.email_change_requested', 'auth.email_change_confirmed',
      'auth.email_primary_swapped', 'auth.email_secondary_removed',
      'client.password_reset.trigger',
      /**
       * ⛔ **L'OROLOGIO DEL DIGIUNO, quando lo muove la cliente** (Simone, 21/8: «storicizziamo nel
       * log quando il cliente le cambia»). Sono le sue due azioni: la prima scelta e ogni
       * spostamento successivo.
       *
       * ⚠️ `digiuno.passo_notturno` **non è qui**, ed è una scelta: quello lo fa il cron ogni notte
       * per eseguire il piano graduale che lei ha già confermato. Metterlo in questo elenco vorrebbe
       * dire annegare le sue decisioni sotto dodici righe automatiche che dicono tutte la stessa
       * cosa. Resta nell'audit, dove si va a cercarlo se serve capire una deriva.
       */
      'digiuno.prima_scelta', 'digiuno.finestra_spostata',
    ];
    const rows = await this.prisma.auditLog.findMany({
      where: { entityId: { in: ids }, action: { in: CHANGE_ACTIONS } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { actor: { select: { email: true, firstName: true, lastName: true, role: true } } },
    });
    type Row = {
      id: string; action: string; createdAt: Date; actorId: string | null; metadata: unknown;
      actor: { email: string; firstName: string | null; lastName: string | null; role: string } | null;
    };
    await this.audit.log({ action: 'client.changelog.view', actorId, entityType: 'user', entityId: userId });
    return (rows as Row[]).map((r) => ({
      id: r.id,
      action: r.action,
      at: r.createdAt,
      metadata: r.metadata ?? null,
      self: r.actorId === userId,
      actor: r.actor
        ? { name: [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ') || r.actor.email, email: r.actor.email, role: r.actor.role }
        : null,
    }));
  }
}
