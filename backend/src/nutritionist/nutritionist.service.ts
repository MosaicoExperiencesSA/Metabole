import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineService } from '../engine/engine.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
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
        data: { status: 'resolved' as never },
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
        ids.length ? this.prisma.engineDecision.count({ where: { clientId: { in: ids }, flaggedForReview: true } }) : Promise.resolve(0),
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
    const filtroDecisioni = { flaggedForReview: true, reviewedAt: null, ...clientFilter };
    const [decisions, totaleDecisioni] = (await Promise.all([
      this.prisma.engineDecision.findMany({
        where: filtroDecisioni,
        orderBy: { date: 'desc' },
        take: TETTO_CODA,
        select: { id: true, clientId: true, date: true, flagReason: true, action: true, rule: { select: { id: true, name: true } } },
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
