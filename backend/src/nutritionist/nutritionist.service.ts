import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineService } from '../engine/engine.service';
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

@Injectable()
export class NutritionistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
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

  /** Elenco pazienti con riepilogo clinico per la lista. */
  async patients(user: AuthUser): Promise<{ patients: unknown[] }> {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { patients: [] };
    const profiles = await this.patientIds(staffId);
    const ids = profiles.map((p) => p.userId);
    if (!ids.length) return { patients: [] };
    const nameOf = new Map(profiles.map((p) => [p.userId, p.name]));
    const now = new Date();

    const [measures, escalations, documents, visits] = await Promise.all([
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
    ]);

    const measOf = new Map(measures.map((m) => [m.clientId, m.date]));
    const escCount = new Map<string, number>();
    for (const e of escalations) escCount.set(e.clientId, (escCount.get(e.clientId) ?? 0) + 1);
    const docCount = new Map<string, number>();
    for (const d of documents) docCount.set(d.clientId, (docCount.get(d.clientId) ?? 0) + 1);
    const nextVisitOf = new Map<string, VisitRow>();
    for (const v of visits) if (!nextVisitOf.has(v.clientId)) nextVisitOf.set(v.clientId, v);

    const patients = profiles.map((p) => {
      const meas = measOf.get(p.userId);
      const nv = nextVisitOf.get(p.userId);
      return {
        clientId: p.userId,
        name: nameOf.get(p.userId),
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
  }> {
    const supervisor = this.isSupervisor(user);
    const staffId = await this.staffId(user.sub);
    const empty = { engineDecisions: [], dietsInReview: [], protocolsPending: [], counts: { engineDecisions: 0, dietsInReview: 0, protocolsPending: 0 } };
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

    const decisions = (await this.prisma.engineDecision.findMany({
      where: { flaggedForReview: true, reviewedAt: null, ...clientFilter },
      orderBy: { date: 'desc' },
      take: 100,
      select: { id: true, clientId: true, date: true, flagReason: true, action: true, rule: { select: { id: true, name: true } } },
    })) as DecisionRow[];

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
    if (supervisor) {
      const diets = (await this.prisma.diet.findMany({
        where: { status: 'in_review' as never, ...(staffId ? { NOT: { authorId: staffId } } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: { id: true, name: true, regime: true, style: true, updatedAt: true },
      })) as { id: string; name: string; regime: string; style: string; updatedAt: Date }[];
      dietsInReview = diets.map((x) => ({ id: x.id, name: x.name, regime: x.regime, style: x.style, updatedAt: x.updatedAt.toISOString() }));
    }

    // Protocolli in attesa: nutrizionista/capo, mai i propri.
    const protocols = (await this.prisma.protocol.findMany({
      where: { status: 'pending' as never, ...(staffId ? { NOT: { authorId: staffId } } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, name: true, type: true, updatedAt: true },
    })) as { id: string; name: string; type: string; updatedAt: Date }[];
    const protocolsPending = protocols.map((p) => ({ id: p.id, name: p.name, type: p.type, updatedAt: p.updatedAt.toISOString() }));

    return {
      engineDecisions,
      dietsInReview,
      protocolsPending,
      counts: { engineDecisions: engineDecisions.length, dietsInReview: dietsInReview.length, protocolsPending: protocolsPending.length },
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
