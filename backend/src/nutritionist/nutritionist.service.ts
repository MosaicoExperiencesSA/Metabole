import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
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
@Injectable()
export class NutritionistService {
  constructor(private readonly prisma: PrismaService) {}

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
}
