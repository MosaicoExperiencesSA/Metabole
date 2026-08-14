import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuditService } from '../audit/audit.service';
import { scadenzaDaGiorni } from '../menu/correzione-kcal';
import { EngineService } from '../engine/engine.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import {
  AZIONI,
  AzioneDecisione,
  DESCRIZIONE_AZIONE,
  ETICHETTA_CAUSA,
  azioneAmmessa,
  azioniPerCausa,
  isCausa,
} from '../engine/causa-decisione';
import { filtroClienteConPianoAttivo } from '../common/piano-attivo';
import { avvisaCapiNutrizionisti } from '../common/avvisa-nutrizionista';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { KcalNeedService } from '../menu/kcal-need.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
const COMMISSION_CATEGORIES = ['sales_commission', 'visit_compensation'];
const OPEN_ESC = ['open', 'in_progress'];

interface ProfileRow {
  userId: string;
  name: string | null;
}
interface MeasRow {
  clientId: string;
  date: Date;
}
interface VisitRow {
  clientId: string;
  datetime: Date;
  type: string;
}

/**
 * API dell'app Nutrizionista (parte clinica). Sempre limitata ai PAZIENTI assegnati
 * (assignedNutritionistId). Il dettaglio clinico (documenti, note, visite, agenda) è
 * già in health-area; qui c'è il "collante": elenco pazienti e dashboard.
 */
interface DecisionRow {
  id: string;
  clientId: string;
  date: Date;
  flagReason: string | null;
  action: unknown;
  reasonKey: string | null;
  rule: { id: string; name: string } | null;
}

/** Quante righe si mandano per ogni coda di validazione. I conteggi arrivano da `count()`, non da qui. */
const TETTO_CODA = 100;

@Injectable()
export class NutritionistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly personalBase: PersonalBaseService,
    private readonly audit: AuditService,
    // §15.5: il fabbisogno lo calcola chi lo calcola per il menu. Rifarlo qui vorrebbe dire avere
    // due formule che devono restare uguali per sempre — cioè, prima o poi, due numeri diversi.
    private readonly kcalNeed: KcalNeedService,
    private readonly menu: MenuService,
  ) {}

  private isSupervisor(user: AuthUser): boolean {
    return user.role === 'head_nutritionist' || user.role === 'admin';
  }

  private async staffId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    return staff?.id ?? null;
  }

  private async patientIds(staffId: string): Promise<ProfileRow[]> {
    return (await this.prisma.clientProfile.findMany({
      where: { assignedNutritionistId: staffId },
      select: { userId: true, name: true },
    })) as ProfileRow[];
  }

  /**
   * SEGNALAZIONI aperte sui suoi pazienti, con dentro il MOTIVO.
   *
   * Prima il numero c'era — `openEscalations` nella dashboard — ma serviva solo a gonfiare il
   * badge della campanella: il testo della segnalazione non compariva da nessuna parte nell'app
   * nutrizionista. Il risultato era che la cliente leggeva «la nutrizionista sta sistemando il
   * tuo menu» e la nutrizionista non sapeva di doverlo sistemare, né perché.
   *
   * Le segnalazioni "Piano bloccato" vengono in cima: sono le uniche in cui la cliente, nel
   * frattempo, **non riceve i menu**.
   */
  async segnalazioni(user: AuthUser): Promise<{ segnalazioni: unknown[] }> {
    const staffId = await this.staffId(user.sub);
    // Il capo e l'admin vedono tutto; una nutrizionista solo i suoi pazienti. Prima l'unico
    // endpoint disponibile (`GET /admin/escalations`) restituiva le segnalazioni di TUTTE le
    // clienti a chiunque avesse il ruolo, il che è anche un problema di riservatezza.
    const supervisore = this.isSupervisor(user);
    if (!staffId && !supervisore) return { segnalazioni: [] };
    const profiles = staffId ? await this.patientIds(staffId) : [];
    const ids = profiles.map((p) => p.userId);
    if (!supervisore && ids.length === 0) return { segnalazioni: [] };

    const righe = (await this.prisma.escalation.findMany({
      where: {
        status: { in: OPEN_ESC as never },
        ...(supervisore ? {} : { clientId: { in: ids } }),
      },
      select: {
        id: true, clientId: true, reason: true, category: true, status: true, createdAt: true,
        client: { select: { email: true, clientProfile: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as {
      id: string; clientId: string; reason: string; category: string; status: string; createdAt: Date;
      client: { email: string; clientProfile: { name: string | null } | null } | null;
    }[];

    const segnalazioni = righe.map((e) => ({
      id: e.id,
      clientId: e.clientId,
      paziente: e.client?.clientProfile?.name ?? e.client?.email ?? '(cliente)',
      email: e.client?.email ?? null,
      motivo: e.reason,
      categoria: e.category,
      stato: e.status,
      creata: e.createdAt,
      /** Se vero, la cliente NON sta ricevendo i menu: è la sola che blocca il servizio. */
      bloccoPiano: e.category === 'diet_blocked' || e.reason.includes('Piano bloccato'),
    }));
    // Prima i blocchi piano, poi le altre; dentro ogni gruppo, la più vecchia in cima —
    // quella che aspetta da più tempo è quella che sta facendo più danno.
    segnalazioni.sort((a, b) =>
      Number(b.bloccoPiano) - Number(a.bloccoPiano) || a.creata.getTime() - b.creata.getTime());
    return { segnalazioni };
  }

  /**
   * SBLOCCA il piano di una paziente: chiude la segnalazione e **riprova davvero** a costruire
   * la base personalizzata sicura.
   *
   * Il punto è tutto qui. Chiudere la segnalazione a mano — l'unica cosa che si poteva fare
   * prima, dal backoffice — è **cosmetico**: il blocco non è uno stato salvato, viene
   * ricalcolato a ogni composizione del menu. Chiusa la segnalazione, alla prima apertura
   * dell'app la stessa identica segnalazione si riapre, e nel frattempo la cliente ha visto
   * sparire il messaggio senza ricevere niente.
   *
   * Quindi qui si rilancia `buildPersonalBase`, che è la cosa che decide davvero: se riesce,
   * risolve i blocchi da sola e i menu ripartono; se non riesce, torna il motivo NUOVO —
   * aggiornato, non quello vecchio — e la segnalazione resta aperta con l'informazione giusta.
   */
  async sbloccaPiano(user: AuthUser, escalationId: string): Promise<{
    sbloccato: boolean;
    messaggio: string;
    motivi?: string[];
    ricettePerPasto?: Record<string, number>;
  }> {
    const esc = (await this.prisma.escalation.findUnique({
      where: { id: escalationId },
      select: { id: true, clientId: true, status: true },
    })) as { id: string; clientId: string; status: string } | null;
    if (!esc) throw new NotFoundException('Segnalazione non trovata.');

    if (!this.isSupervisor(user)) {
      const staffId = await this.staffId(user.sub);
      const mio = staffId
        ? await this.prisma.clientProfile.findFirst({
            where: { userId: esc.clientId, assignedNutritionistId: staffId },
            select: { userId: true },
          })
        : null;
      if (!mio) throw new ForbiddenException('Questa paziente non è assegnata a te.');
    }

    const esito = await this.personalBase.buildPersonalBase(esc.clientId);

    if (esito.status === 'ready') {
      // `buildPersonalBase` chiude da sé i blocchi quando riesce; questa è la rete per le
      // segnalazioni di altra origine che il nutrizionista sta chiudendo a mano da qui.
      await this.prisma.escalation.update({
        where: { id: esc.id },
        // `resolvedAt`: da qui parte la tregua in cui la segnalazione non si riapre da sola (11/8).
        data: { status: 'resolved' as never, resolvedAt: new Date() } as never,
      });
      return {
        sbloccato: true,
        messaggio:
          'Piano sbloccato: la base personalizzata è di nuovo certificata. ' +
          'I menu ripartono alla prossima apertura dell\'app da parte della paziente.',
        ricettePerPasto: esito.perSlot,
      };
    }

    return {
      sbloccato: false,
      messaggio:
        'Non è ancora sbloccabile: il motore non riesce a comporre un piano sicuro. ' +
        'Sistema le esclusioni della paziente o il catalogo della sua dieta, poi riprova.',
      motivi: esito.reasons ?? [],
      ricettePerPasto: esito.perSlot,
    };
  }

  /** Elenco pazienti con riepilogo clinico per la lista. */
  async patients(user: AuthUser): Promise<{ patients: unknown[] }> {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { patients: [] };
    const profiles = await this.patientIds(staffId);
    const ids = profiles.map((p) => p.userId);
    if (!ids.length) return { patients: [] };
    const nameOf = new Map(profiles.map((p) => [p.userId, p.name]));
    const now = new Date();

    const [measures, escalations, documents, visits, users] = await Promise.all([
      this.prisma.measurement.findMany({
        where: { clientId: { in: ids } },
        orderBy: { date: 'desc' },
        distinct: ['clientId'],
        select: { clientId: true, date: true },
      }) as Promise<MeasRow[]>,
      this.prisma.escalation.findMany({
        where: { clientId: { in: ids }, status: { in: OPEN_ESC as never } },
        select: { clientId: true },
      }) as Promise<{ clientId: string }[]>,
      this.prisma.document.findMany({
        where: { clientId: { in: ids }, status: 'pending' as never },
        select: { clientId: true },
      }) as Promise<{ clientId: string }[]>,
      this.prisma.visit.findMany({
        where: { clientId: { in: ids }, status: 'scheduled' as never, datetime: { gte: now } },
        orderBy: { datetime: 'asc' },
        select: { clientId: true, datetime: true, type: true },
      }) as Promise<VisitRow[]>,
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, phone: true },
      }) as Promise<{ id: string; email: string; phone: string | null }[]>,
    ]);

    const measOf = new Map(measures.map((m) => [m.clientId, m.date]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const escCount = new Map<string, number>();
    for (const e of escalations) escCount.set(e.clientId, (escCount.get(e.clientId) ?? 0) + 1);
    const docCount = new Map<string, number>();
    for (const d of documents) docCount.set(d.clientId, (docCount.get(d.clientId) ?? 0) + 1);
    const nextVisitOf = new Map<string, VisitRow>();
    for (const v of visits) if (!nextVisitOf.has(v.clientId)) nextVisitOf.set(v.clientId, v);

    const patients = profiles.map((p) => {
      const meas = measOf.get(p.userId);
      const nv = nextVisitOf.get(p.userId);
      const u = userById.get(p.userId);
      return {
        clientId: p.userId,
        name: nameOf.get(p.userId),
        phone: u?.phone ?? null,
        email: u?.email ?? null,
        lastMeasureDate: meas ? meas.toISOString().slice(0, 10) : null,
        openEscalations: escCount.get(p.userId) ?? 0,
        pendingDocuments: docCount.get(p.userId) ?? 0,
        nextVisit: nv ? { datetime: nv.datetime.toISOString(), type: nv.type } : null,
      };
    });
    // Prima i pazienti che richiedono attenzione (escalation + documenti da revisionare).
    patients.sort((a, b) => b.openEscalations + b.pendingDocuments - (a.openEscalations + a.pendingDocuments));
    return { patients };
  }

  /** Home del nutrizionista: pazienti, code cliniche, visite, guadagni. */
  async dashboard(user: AuthUser) {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { isNutritionist: false };
    const profiles = await this.patientIds(staffId);
    const ids = profiles.map((p) => p.userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingDocuments, openEscalations, protocolsToValidate, upcomingVisits, monthAgg, totalAgg] =
      await Promise.all([
        ids.length ? this.prisma.document.count({ where: { clientId: { in: ids }, status: 'pending' as never } }) : Promise.resolve(0),
        ids.length ? this.prisma.escalation.count({ where: { clientId: { in: ids }, status: { in: OPEN_ESC as never } } }) : Promise.resolve(0),
        // «Da validare» sul telefono della nutrizionista. Contava `flaggedForReview: true` e
        // basta: includeva le decisioni già revisionate e quelle dei clienti col piano concluso,
        // quindi il pulsante diceva 9 e la coda che apriva ne aveva 2. Un contatore che non
        // combacia con la lista che apre insegna a non fidarsi di nessuno dei due.
        // ⚠️ Resta una differenza nota per il capo/admin: qui si contano solo i pazienti
        // ASSEGNATI (`ids`), mentre `validationQueue` per un supervisore è globale. Un capo senza
        // pazienti suoi vede 0 e apre una coda piena. Non si chiude qui — va deciso se il badge
        // del capo debba essere globale, ed è una domanda di prodotto, non un difetto di questa
        // query.
        ids.length
          ? this.prisma.engineDecision.count({
              where: {
                clientId: { in: ids },
                flaggedForReview: true,
                reviewedAt: null,
                client: filtroClienteConPianoAttivo(),
              },
            })
          : Promise.resolve(0),
        this.prisma.visit.count({ where: { nutritionistId: staffId, status: 'scheduled' as never, datetime: { gte: now } } }),
        this.prisma.ledgerEntry.aggregate({
          _sum: { amountCents: true },
          where: { staffId, type: 'expense' as never, category: { in: COMMISSION_CATEGORIES }, date: { gte: monthStart } },
        }),
        this.prisma.ledgerEntry.aggregate({
          _sum: { amountCents: true },
          where: { staffId, type: 'expense' as never, category: { in: COMMISSION_CATEGORIES } },
        }),
      ]);

    return {
      isNutritionist: true,
      patientsCount: profiles.length,
      pendingDocuments,
      openEscalations,
      protocolsToValidate,
      upcomingVisits,
      earningsMonthCents: monthAgg._sum.amountCents ?? 0,
      earningsTotalCents: totalAgg._sum.amountCents ?? 0,
    };
  }

  /**
   * Coda di validazione (Fase 7). Raccoglie ciò che il nutrizionista deve validare:
   * - **decisioni del motore** marcate per revisione, PER-PAZIENTE (solo i pazienti
   *   assegnati; il capo/admin le vede tutte) → confermare/correggere;
   * - **diete in revisione** da approvare (solo il capo approva; mai le proprie);
   * - **protocolli** in attesa di validazione (mai i propri).
   * Le azioni riusano gli endpoint esistenti (motore `reviewDecision` scoped qui,
   * diete `catalog`, protocolli `protocols/:id/validate`).
   */
  async validationQueue(user: AuthUser): Promise<{
    engineDecisions: unknown[];
    dietsInReview: unknown[];
    protocolsPending: unknown[];
    counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
    /** Quante righe ci sono negli elenchi: `counts` dice quante esistono, questo quante se ne vedono. */
    mostrati: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
  }> {
    const supervisor = this.isSupervisor(user);
    const staffId = await this.staffId(user.sub);
    const zero = { engineDecisions: 0, dietsInReview: 0, protocolsPending: 0 };
    const empty = { engineDecisions: [], dietsInReview: [], protocolsPending: [], counts: zero, mostrati: zero };
    if (!staffId && !supervisor) return empty;

    // Filtro pazienti per le decisioni motore: il nutrizionista solo i suoi.
    let nameOf = new Map<string, string | null>();
    let clientFilter: Record<string, unknown>;
    if (supervisor) {
      clientFilter = {};
    } else {
      const profiles = await this.patientIds(staffId!);
      nameOf = new Map(profiles.map((p) => [p.userId, p.name]));
      const ids = profiles.map((p) => p.userId);
      // Nessun paziente assegnato → filtro impossibile (lista vuota, senza query globale).
      clientFilter = { clientId: { in: ids.length ? ids : ['__none__'] } };
    }

    /**
     * `take: 100` sull'elenco, ma il CONTEGGIO da `count()`.
     *
     * Prima i numeri fra parentesi nei titoli («Decisioni del motore (N)») erano la lunghezza
     * dell'array troncato: nel giorno in cui il motore segnala più di cento clienti — cioè
     * esattamente il giorno in cui quel numero serve — la coda diceva «100» qualunque fosse la
     * verità, e non c'era modo di accorgersene. Nella stessa classe la dashboard usava già `count()`
     * per gli stessi dati, quindi le due schermate potevano dire numeri diversi.
     */
    /**
     * `client: filtroClienteConPianoAttivo()` — la coda nomina solo chi ha un piano da cambiare.
     *
     * Filtrare `runBatch` non basta: le righe già scritte restano a database, e il giorno del
     * deploy la coda conterrebbe ancora le decisioni prese su percorsi conclusi. Sta qui e non
     * in una passata di pulizia perché le righe vecchie **non vanno cancellate**: sono lo storico
     * di quella cliente, e domani, se torna, tornano ad avere senso.
     */
    const filtroDecisioni = {
      flaggedForReview: true,
      reviewedAt: null,
      client: filtroClienteConPianoAttivo(),
      ...clientFilter,
    };
    const [decisions, totaleDecisioni] = (await Promise.all([
      this.prisma.engineDecision.findMany({
        where: filtroDecisioni,
        // `asc`, dalla più VECCHIA (13/8). Prima era `desc`, e aveva senso quando ogni notte
        // arrivava una riga nuova: si guardava l'ultima. Ora la riga che sopravvive per una causa
        // è la prima, quindi con `desc` più a lungo un problema resta aperto più affonda — e oltre
        // le cento righe sparisce dall'elenco pur restando nel conteggio. In una coda di cause
        // aperte, la più vecchia è quella che aspetta da più giorni.
        orderBy: { date: 'asc' },
        take: TETTO_CODA,
        select: { id: true, clientId: true, date: true, flagReason: true, action: true, reasonKey: true, rule: { select: { id: true, name: true } } },
      }),
      this.prisma.engineDecision.count({ where: filtroDecisioni }),
    ])) as [DecisionRow[], number];

    // Il capo/admin vede pazienti di più nutrizionisti: recupera i nomi mancanti.
    if (supervisor && decisions.length) {
      const cids = [...new Set(decisions.map((d) => d.clientId))];
      const profs = (await this.prisma.clientProfile.findMany({
        where: { userId: { in: cids } },
        select: { userId: true, name: true },
      })) as { userId: string; name: string | null }[];
      nameOf = new Map(profs.map((p) => [p.userId, p.name]));
    }

    const engineDecisions = decisions.map((d) => ({
      id: d.id,
      clientId: d.clientId,
      patientName: nameOf.get(d.clientId) ?? null,
      date: d.date.toISOString().slice(0, 10),
      flagReason: d.flagReason,
      // La causa esce dall'API da subito, anche se nessuna schermata la mostra ancora: è quella
      // che decide quali azioni ha senso offrire (§15.2 punto 2), e il pezzo che la userà si
      // costruisce sopra a questa. Null sulle righe scritte prima del 13/8.
      causa: isCausa(d.reasonKey) ? d.reasonKey : null,
      causaEtichetta: isCausa(d.reasonKey) ? ETICHETTA_CAUSA[d.reasonKey] : null,
      rule: d.rule ? { id: d.rule.id, name: d.rule.name } : null,
      action: d.action,
    }));

    // Diete in revisione: solo il capo le approva; escluse le proprie.
    let dietsInReview: unknown[] = [];
    let totaleDiete = 0;
    if (supervisor) {
      const filtroDiete = { status: 'in_review' as never, ...(staffId ? { NOT: { authorId: staffId } } : {}) };
      const [diets, conteggio] = (await Promise.all([
        this.prisma.diet.findMany({
          where: filtroDiete,
          orderBy: { updatedAt: 'desc' },
          take: TETTO_CODA,
          select: { id: true, name: true, regime: true, style: true, updatedAt: true },
        }),
        this.prisma.diet.count({ where: filtroDiete }),
      ])) as [{ id: string; name: string; regime: string; style: string; updatedAt: Date }[], number];
      dietsInReview = diets.map((x) => ({ id: x.id, name: x.name, regime: x.regime, style: x.style, updatedAt: x.updatedAt.toISOString() }));
      totaleDiete = conteggio;
    }

    // Protocolli in attesa: nutrizionista/capo, mai i propri.
    const filtroProtocolli = { status: 'pending' as never, ...(staffId ? { NOT: { authorId: staffId } } : {}) };
    const [protocols, totaleProtocolli] = (await Promise.all([
      this.prisma.protocol.findMany({
        where: filtroProtocolli,
        orderBy: { updatedAt: 'desc' },
        take: TETTO_CODA,
        select: { id: true, name: true, type: true, updatedAt: true },
      }),
      this.prisma.protocol.count({ where: filtroProtocolli }),
    ])) as [{ id: string; name: string; type: string; updatedAt: Date }[], number];
    const protocolsPending = protocols.map((p) => ({ id: p.id, name: p.name, type: p.type, updatedAt: p.updatedAt.toISOString() }));

    return {
      engineDecisions,
      dietsInReview,
      protocolsPending,
      // I conteggi vengono dal database; `mostrati` dice quante righe sono nell'elenco, così la
      // pagina può distinguere «ce ne sono 100» da «te ne mostro 100 di 240».
      counts: { engineDecisions: totaleDecisioni, dietsInReview: totaleDiete, protocolsPending: totaleProtocolli },
      mostrati: { engineDecisions: engineDecisions.length, dietsInReview: dietsInReview.length, protocolsPending: protocolsPending.length },
    };
  }

  /**
   * Revisione di una decisione del motore CON scoping per-paziente: un nutrizionista
   * può revisionare solo le decisioni dei propri pazienti (il capo/admin qualsiasi).
   * Delega poi la scrittura all'EngineService (idempotenza + audit già lì).
   */
  // ---------- «Correggi»: le azioni ammesse per la causa, e le due che il backend esegue ----------

  /**
   * Cosa si può fare su questa riga della coda. È quello che riempie la finestra di «Correggi»
   * (§15.2 punto 2): non un modulo generico, ma le azioni che hanno senso **per quella causa**.
   *
   * Restituisce anche `cosaFa` di ognuna, perché un pulsante che cambia il piano di una persona
   * deve dire cosa cambia **prima** di essere premuto — e la frase deve essere una sola, scritta
   * dove sta la regola, non riscritta da ogni schermata che la mostra.
   */
  async azioniDecisione(user: AuthUser, decisionId: string) {
    const decision = await this.decisionePermessa(user, decisionId);
    const causa = isCausa(decision.reasonKey) ? decision.reasonKey : null;
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: decision.clientId },
      select: { planHeldAt: true, rapidLossBaselineAt: true },
    })) as { planHeldAt: Date | null; rapidLossBaselineAt: Date | null } | null;

    return {
      decisionId: decision.id,
      clientId: decision.clientId,
      causa,
      causaEtichetta: causa ? ETICHETTA_CAUSA[causa] : null,
      flagReason: decision.flagReason,
      // Lo stato attuale: offrire «Blocca il piano» a un piano già bloccato è il modo più rapido
      // di far dubitare che il pulsante di prima abbia funzionato.
      pianoGiaFermo: !!profilo?.planHeldAt,
      calcoloGiaAzzeratoIl: profilo?.rapidLossBaselineAt ?? null,
      azioni: azioniPerCausa(causa).map((a) => ({
        azione: a,
        etichetta: DESCRIZIONE_AZIONE[a].etichetta,
        cosaFa: DESCRIZIONE_AZIONE[a].cosaFa,
        /** `false` = è un rimando (chat, scheda): lo esegue il frontend, non passa da qui. */
        eseguitaDalServer: a === AZIONI.AUTORIZZA_PROSEGUIRE || a === AZIONI.BLOCCA_PIANO,
      })),
    };
  }

  /**
   * Esegue una delle due azioni che toccano il piano, e chiude la riga in coda.
   *
   * L'azione viene **verificata contro la causa** (`azioneAmmessa`): la tabella delle azioni non è
   * un suggerimento per l'interfaccia, è la regola. Un client che chiedesse «blocca il piano» su una
   * riga di screening otterrebbe un rifiuto, perché altrimenti la tabella descriverebbe solo quello
   * che i pulsanti mostrano, e le regole che vivono solo nei pulsanti si aggirano con una POST.
   */
  async eseguiAzione(user: AuthUser, decisionId: string, azione: string, note?: string) {
    const decision = await this.decisionePermessa(user, decisionId);
    const causa = isCausa(decision.reasonKey) ? decision.reasonKey : null;
    if (!azioneAmmessa(causa, azione)) {
      throw new BadRequestException(
        `Azione «${azione}» non prevista per questa causa${causa ? ` (${ETICHETTA_CAUSA[causa]})` : ''}.`,
      );
    }
    /**
     * UNA DECISIONE SI LAVORA UNA VOLTA SOLA.
     *
     * Senza questo controllo la seconda pressione dello stesso pulsante — un doppio clic, una
     * schermata rimasta aperta in un'altra scheda — rifà l'azione: il baseline slitta in avanti di
     * altri quattro giorni di silenzio, e soprattutto `planHeldById` **cambia proprietario**, cioè
     * chi aveva fermato il piano perde il diritto di riattivarlo. Meglio un errore chiaro.
     */
    if (decision.reviewedAt) {
      throw new BadRequestException('Questa decisione è già stata lavorata: ricarica la coda.');
    }

    const staffId = await this.staffId(user.sub);
    // Il blocco registra CHI l'ha messo, quindi lì la scheda staff serve davvero. Per
    // l'autorizzazione no: un admin che non ha una scheda staff può comunque autorizzare, e
    // pretenderla qui sarebbe un 403 senza motivo su un'operazione che non usa quell'id.
    if (azione === AZIONI.BLOCCA_PIANO && !staffId) {
      throw new ForbiddenException('Per fermare un piano serve una scheda staff associata.');
    }

    // Il profilo deve esistere: `update` su un profilo assente lancia un errore Prisma grezzo, che
    // per chi preme il pulsante è una schermata rotta senza spiegazione.
    const profiloEsiste = await this.prisma.clientProfile.findUnique({
      where: { userId: decision.clientId },
      select: { userId: true },
    });
    if (!profiloEsiste) {
      throw new BadRequestException('Questa cliente non ha ancora un profilo: non c’è un piano su cui agire.');
    }

    const adesso = new Date();
    if (azione === AZIONI.AUTORIZZA_PROSEGUIRE) {
      await this.prisma.clientProfile.update({
        where: { userId: decision.clientId },
        // Si scrive SOLO il baseline: nessun altro campo, e soprattutto nessuna cancellazione di
        // misure. I progressi della cliente restano interi — vedi `signals/allarme-calo.ts`.
        data: { rapidLossBaselineAt: adesso },
      });
    } else if (azione === AZIONI.BLOCCA_PIANO) {
      await this.prisma.clientProfile.update({
        where: { userId: decision.clientId },
        data: {
          planHeldAt: adesso,
          planHeldReason: note?.trim() || null,
          planHeldById: staffId,
        },
      });
    }

    await this.audit.log({
      action: `nutritionist.decision.${azione}`,
      actorId: user.sub,
      entityType: 'engine_decision',
      entityId: decisionId,
      metadata: { clientId: decision.clientId, causa, note },
    });

    /**
     * La riga esce dalla coda: l'azione **è** la revisione. Senza, il nutrizionista farebbe la cosa
     * e dovrebbe anche ricordarsi di segnarla come vista — e le code in cui servono due gesti per
     * una decisione sola restano piene di righe già lavorate.
     *
     * L'errore **non si ingoia**: se la chiusura fallisce, l'azione sul piano è già stata fatta e
     * la riga è ancora lì. Chi ha premuto deve saperlo, o la ripremerà.
     */
    let codaChiusa = true;
    try {
      await this.engine.reviewDecision(user.sub, decisionId, 'corrected', note);
    } catch {
      codaChiusa = false;
    }

    return {
      ok: true,
      azione,
      eseguitaIl: adesso.toISOString(),
      codaChiusa,
      ...(codaChiusa
        ? {}
        : { avviso: 'Azione eseguita sul piano, ma la riga non è uscita dalla coda: ricarica e chiudila a mano.' }),
    };
  }

  /**
   * Riattiva un piano **fermato dal nutrizionista** (`planHeldAt`). Solo chi l'ha fermato, il capo
   * o l'admin — decisione di Simone dell'11/8.
   *
   * ⚠️ Da non confondere con `sbloccaPiano` qui sopra, che è un'altra cosa e si chiama così da
   * prima: quello risolve il «piano bloccato» dagli **allergeni**, rilanciando `buildPersonalBase`
   * — lì non c'è nessun campo da spegnere, il blocco viene ricalcolato a ogni composizione del
   * menu. Qui invece c'è un campo vero, messo da una persona, e riattivare vuol dire toglierlo.
   * Due meccanismi diversi con lo stesso nome sarebbero la ricetta per spegnere quello sbagliato.
   *
   * Non la coach: il blocco nasce da una decisione clinica, e chi non l'ha presa non può disfarla
   * senza parlare con chi l'ha presa. È la stessa lezione del pulsante «Sblocca app» diventato
   * «Riapri l'app»: un pulsante che promette più di quello che può fare viene usato aspettandosi
   * l'altra cosa.
   */
  async riattivaPianoFermato(user: AuthUser, clientId: string, note?: string) {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planHeldAt: true, planHeldById: true },
    })) as { planHeldAt: Date | null; planHeldById: string | null } | null;
    if (!profilo) throw new NotFoundException('Profilo non trovato');
    if (!profilo.planHeldAt) throw new BadRequestException('Il piano di questa cliente non è fermo.');

    if (!this.isSupervisor(user)) {
      const staffId = await this.staffId(user.sub);
      if (!staffId || profilo.planHeldById !== staffId) {
        throw new ForbiddenException(
          'Il piano è stato fermato da un altro professionista: può riattivarlo lui, il capo nutrizionista o un amministratore.',
        );
      }
    }

    await this.prisma.clientProfile.update({
      where: { userId: clientId },
      data: { planHeldAt: null, planHeldReason: null, planHeldById: null },
    });
    await this.audit.log({
      action: 'nutritionist.plan_hold.release',
      actorId: user.sub,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: { note },
    });
    // I giorni ripartono al primo giro di erogazione utile, con i cancelli di sempre (misure,
    // finestra, fine piano): sbloccare non salta nessun controllo, rimuove solo questo.
    return { ok: true };
  }

  // ---------- §15.5 — Le calorie scritte a mano dal nutrizionista ----------

  /**
   * Il paziente, se questo utente lo può toccare. Stessa regola di `decisionePermessa`, ma partendo
   * dalla cliente invece che dalla decisione: il capo e l'admin vedono tutti, la nutrizionista solo
   * i suoi. Estratta perché da qui in avanti le operazioni sulla cliente sono più d'una, e una
   * regola di accesso copiata due volte è una regola che prima o poi diverge.
   */
  private async clientePermesso(user: AuthUser, clientId: string): Promise<void> {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionistId: true },
    })) as { assignedNutritionistId: string | null } | null;
    if (!profilo) throw new NotFoundException('Profilo non trovato');
    if (this.isSupervisor(user)) return;
    const staffId = await this.staffId(user.sub);
    if (!staffId || profilo.assignedNutritionistId !== staffId) {
      throw new ForbiddenException('Paziente non assegnato: operazione non consentita');
    }
  }

  /**
   * Il quadro calorico di una cliente: com'è composto il numero di oggi, cosa c'è scritto a mano, e
   * tutte le volte che è stato cambiato.
   *
   * Lo storico esce insieme al valore corrente di proposito. Il valore da solo dice «−22%» e non
   * dice niente: la domanda vera, davanti a una cliente ferma da un mese, è **chi** l'ha messo,
   * **quando** e **cosa aveva visto**.
   */
  async kcalCliente(user: AuthUser, clientId: string) {
    await this.clientePermesso(user, clientId);
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { kcalDeficitOverride: true, kcalAdjustPct: true },
    })) as { kcalDeficitOverride: number | null; kcalAdjustPct: number | null } | null;

    // `null` quando mancano sesso, età, altezza o peso: senza quei quattro dati il fabbisogno non si
    // calcola, e mostrare uno zero al posto di un «non lo so» sarebbe peggio che non mostrarlo.
    const stima = await this.kcalNeed.estimate(clientId);
    const storico = (await this.prisma.kcalOverride.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { byStaff: { select: { displayName: true } } },
    })) as unknown[];

    return {
      valori: {
        deficitKcal: profilo?.kcalDeficitOverride ?? null,
        correzionePct: profilo?.kcalAdjustPct ?? null,
      },
      stima,
      storico,
    };
  }

  /**
   * Cosa succederebbe se scrivessi questi numeri — SENZA salvarli.
   *
   * Serve alla scheda mentre il nutrizionista digita. Senza, l'unico modo di sapere che «deficit
   * 900» porta la cliente a 1000 kcal sarebbe salvare e guardare: cioè scoprire di averla messa a
   * 1000 kcal dopo averla messa a 1000 kcal.
   */
  async simulaKcal(user: AuthUser, clientId: string, deficitKcal?: number | null, correzionePct?: number | null) {
    await this.clientePermesso(user, clientId);
    const prima = await this.kcalNeed.estimate(clientId);
    const dopo = await this.kcalNeed.estimate(clientId, {
      deficitImposto: deficitKcal ?? null,
      correzionePct: correzionePct ?? null,
    });
    return { prima, dopo };
  }

  /**
   * SCRIVE le calorie a mano, con il motivo, e ne tiene traccia.
   *
   * Le decisioni di Simone dell'11/8, tutte e tre nel codice:
   *
   * 1. **due leve**: il deficit imposto (kcal/giorno) e la correzione percentuale sul totale.
   *    Azzerarle entrambe = si torna al calcolo automatico, ed è una modifica come le altre: va nello
   *    storico anche il ritorno indietro, perché «chi gliele ha tolte» è una domanda che si fa;
   * 2. **il motivo è obbligatorio.** Un target calorico cambiato senza il suo perché è un numero che
   *    nessuno può contestare, e in clinica le cose che nessuno può contestare restano sbagliate più
   *    a lungo;
   * 3. **la soglia minima di sicurezza si può scavalcare, ma non per sbaglio.** Il primo tentativo
   *    che finisce sotto la soglia viene RIFIUTATO, con dentro il numero a cui si arriverebbe; serve
   *    un secondo invio con `confermaSottoSoglia`. Chi va sotto lo fa sapendo dove va. Quando
   *    succede resta scritto nello storico, si apre una segnalazione e i capi nutrizionisti ricevono
   *    la notizia — perché Simone ha detto che lo devono sapere, non che lo possono cercare.
   */
  async impostaKcal(
    user: AuthUser,
    clientId: string,
    input: {
      deficitKcal?: number | null;
      correzionePct?: number | null;
      motivo: string;
      confermaSottoSoglia?: boolean;
      /**
       * «Per quanti giorni» vale la correzione (Nocanty, 13/8: «del 10% per 7 giorni e poi riprendi
       * col normale ritmo»). Assente = vale finché non la tolgono, cioè come prima.
       */
      perGiorni?: number | null;
    },
  ) {
    await this.clientePermesso(user, clientId);
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { kcalDeficitOverride: true, kcalAdjustPct: true, kcalAdjustUntil: true, name: true },
    })) as {
      kcalDeficitOverride: number | null;
      kcalAdjustPct: number | null;
      kcalAdjustUntil: Date | null;
      name: string | null;
    } | null;
    if (!profilo) throw new NotFoundException('Profilo non trovato');

    // 0 e null vogliono dire la stessa cosa — «non impostato» — e tenerli entrambi sarebbe un modo
    // per farli divergere: si normalizza qui, una volta, invece che in ogni lettura.
    const deficitKcal = input.deficitKcal != null && input.deficitKcal > 0 ? Math.round(input.deficitKcal) : null;
    const correzionePct = input.correzionePct != null && input.correzionePct !== 0 ? input.correzionePct : null;

    /**
     * LA DURATA (14/8, Nocanty). ⚠️ La scadenza vive **solo** insieme alla correzione: togliendo la
     * percentuale si toglie anche la data, altrimenti resterebbe una scadenza appesa a niente —
     * pronta a spegnere la prossima correzione scritta, senza che nessuno capisca perché.
     */
    const scadenza = correzionePct !== null ? scadenzaDaGiorni(input.perGiorni ?? 0) : null;
    const scadenzaPrima = profilo.kcalAdjustUntil ? profilo.kcalAdjustUntil.toISOString().slice(0, 10) : null;
    const scadenzaDopo = scadenza ? scadenza.toISOString().slice(0, 10) : null;

    // ⚠️ Cambiare SOLO la durata è un cambiamento vero: «−10% per sempre» e «−10% per 7 giorni»
    // sono due prescrizioni diverse, e senza la data in questo confronto la seconda verrebbe
    // rifiutata come «non c'è niente da cambiare».
    if (
      deficitKcal === profilo.kcalDeficitOverride &&
      correzionePct === profilo.kcalAdjustPct &&
      scadenzaDopo === scadenzaPrima
    ) {
      throw new BadRequestException('I valori sono già questi: non c’è niente da cambiare.');
    }

    const prima = await this.kcalNeed.estimate(clientId);
    const dopo = await this.kcalNeed.estimate(clientId, { deficitImposto: deficitKcal, correzionePct });

    if (dopo?.sottoSoglia && !input.confermaSottoSoglia) {
      throw new BadRequestException(
        `Con questi valori il menu scenderebbe a ${dopo.target} kcal/giorno, sotto la soglia minima di ` +
          'sicurezza. Puoi farlo — il clinico sei tu — ma la conferma va data in modo esplicito: ' +
          'resterà scritto nello storico e i capi nutrizionisti ne saranno informati.',
      );
    }

    await this.prisma.clientProfile.update({
      where: { userId: clientId },
      data: {
        kcalDeficitOverride: deficitKcal,
        kcalAdjustPct: correzionePct,
        kcalAdjustUntil: scadenza,
      } as never,
    });

    const staffId = await this.staffId(user.sub);
    await this.prisma.kcalOverride.create({
      data: {
        clientId,
        deficitKcal,
        adjustPct: correzionePct,
        prevDeficitKcal: profilo.kcalDeficitOverride,
        prevAdjustPct: profilo.kcalAdjustPct,
        targetPrima: prima?.target ?? null,
        targetDopo: dopo?.target ?? null,
        sottoSoglia: !!dopo?.sottoSoglia,
        // ⚠️ La durata finisce nel MOTIVO e non in una colonna nuova: `kcal_override` è lo storico
        // che una persona rilegge, e «per 7 giorni, fino al 20/8» è esattamente quello che serve
        // sapere fra un mese. Una colonna in più su una tabella di storico si aggiunge quando
        // qualcuno la deve interrogare, non quando la si deve leggere.
        motivo: scadenzaDopo
          ? `${input.motivo} — per ${Math.floor(input.perGiorni as number)} giorni, fino al ${scadenzaDopo}`
          : input.motivo,
        byStaffId: staffId,
      } as never,
    });

    await this.audit.log({
      action: 'nutritionist.kcal.set',
      actorId: user.sub,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: {
        deficitKcal,
        correzionePct,
        motivo: input.motivo,
        targetPrima: prima?.target ?? null,
        targetDopo: dopo?.target ?? null,
        sottoSoglia: !!dopo?.sottoSoglia,
      },
    });

    if (dopo?.sottoSoglia) {
      const chi = profilo.name ?? clientId;
      await apriSegnalazione(this.prisma as never, {
        clientId,
        category: 'other',
        reason:
          `Calorie sotto la soglia di sicurezza: ${dopo.target} kcal/giorno, impostate a mano dal ` +
          `nutrizionista. Motivo: «${input.motivo}».`,
        source: 'engine',
        // NIENTE dedupe: ogni discesa sotto la soglia è una decisione nuova, con un motivo nuovo.
        // Accorparla alla precedente vorrebbe dire perdere proprio la riga che serve.
        dedupe: false,
      }).catch(() => undefined);
      await avvisaCapiNutrizionisti(
        this.prisma,
        null,
        {
          type: 'kcal_sotto_soglia',
          title: 'Calorie sotto la soglia di sicurezza',
          body: `${chi}: ${dopo.target} kcal/giorno. Motivo: «${input.motivo}».`,
          payload: { clientId, target: dopo.target },
        },
        // Se a scriverle è stato un capo, non gli si notifica quello che ha appena fatto lui.
        user.sub,
      );
    }

    // I giorni futuri già consegnati sono ancora sulle calorie vecchie: si rigenerano. Senza
    // rischiare di lasciarla a mani vuote, però — se la rierogazione non produce niente (misure
    // mancanti, fine piano) `redeliverFutureDays` rimette i giorni com'erano e lo dice in
    // `ripristinati`, così chi ha fatto la modifica sa che nel piatto non è ancora arrivata.
    const menu = await this.menu
      .redeliverFutureDays(clientId)
      .catch(() => ({ removed: 0, delivered: [] as string[], ripristinati: 0 }));

    return {
      ok: true,
      valori: { deficitKcal, correzionePct },
      targetPrima: prima?.target ?? null,
      targetDopo: dopo?.target ?? null,
      sottoSoglia: !!dopo?.sottoSoglia,
      spiegazione: dopo?.spiegazione ?? null,
      menu,
    };
  }

  /** La decisione, se questo utente può toccarla. Stessa regola di `reviewDecision`, in un posto solo. */
  private async decisionePermessa(user: AuthUser, decisionId: string) {
    const decision = (await this.prisma.engineDecision.findUnique({
      where: { id: decisionId },
      select: { id: true, clientId: true, reasonKey: true, flagReason: true, reviewedAt: true },
    })) as {
      id: string; clientId: string; reasonKey: string | null; flagReason: string | null; reviewedAt: Date | null;
    } | null;
    if (!decision) throw new NotFoundException('Decisione non trovata');
    if (!this.isSupervisor(user)) {
      const staffId = await this.staffId(user.sub);
      const profile = (await this.prisma.clientProfile.findUnique({
        where: { userId: decision.clientId },
        select: { assignedNutritionistId: true },
      })) as { assignedNutritionistId: string | null } | null;
      if (!staffId || profile?.assignedNutritionistId !== staffId) {
        throw new ForbiddenException('Paziente non assegnato: operazione non consentita');
      }
    }
    return decision;
  }

  async reviewDecision(user: AuthUser, decisionId: string, outcome: 'confirmed' | 'corrected', note?: string) {
    const decision = (await this.prisma.engineDecision.findUnique({
      where: { id: decisionId },
      select: { id: true, clientId: true },
    })) as { id: string; clientId: string } | null;
    if (!decision) throw new NotFoundException('Decisione non trovata');

    if (!this.isSupervisor(user)) {
      const staffId = await this.staffId(user.sub);
      const profile = (await this.prisma.clientProfile.findUnique({
        where: { userId: decision.clientId },
        select: { assignedNutritionistId: true },
      })) as { assignedNutritionistId: string | null } | null;
      if (!staffId || profile?.assignedNutritionistId !== staffId) {
        throw new ForbiddenException('Paziente non assegnato: revisione non consentita');
      }
    }
    return this.engine.reviewDecision(user.sub, decisionId, outcome, note);
  }
}
