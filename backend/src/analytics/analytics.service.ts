import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Meas { clientId: string; date: Date; weightKg: number; waistCm: number | null }

/**
 * Metriche per la pagina Grafici. Scope per ruolo:
 * - coach → solo le sue clienti; nutrizionista → solo le sue;
 * - admin / capo nutrizionista / resp. coach team → tutte.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async charts(user: AuthUser) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
    const scopeAll = MANAGER_ROLES.includes(user.role);

    const where: Record<string, unknown> = { role: 'client', deletedAt: null };
    if (!scopeAll) {
      if (user.role === 'coach' && staff) where.clientProfile = { assignedCoachId: staff.id };
      else if (user.role === 'nutritionist' && staff) where.clientProfile = { assignedNutritionistId: staff.id };
      else where.id = '__none__';
    }

    const clients = (await this.prisma.user.findMany({
      where: where as never,
      select: { id: true, createdAt: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } } } } },
    })) as unknown as { id: string; createdAt: Date; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null } | null }[];
    const ids = clients.map((c) => c.id);
    const nameOf = new Map(clients.map((c) => [c.id, c.clientProfile?.name ?? 'Cliente']));
    const coachOf = new Map(clients.map((c) => [c.id, c.clientProfile?.assignedCoach?.displayName ?? null]));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const base = {
      scope: scopeAll ? 'all' : 'own',
      clientsCount: ids.length,
      kgLostThisMonth: 0, cmWaistLostThisMonth: 0,
      top5ByLoss: [] as { name: string; lossKg: number }[],
      bottom5ByLoss: [] as { name: string; lossKg: number }[],
      topCoachByRevenue: null as { name: string; amountCents: number } | null,
      topSpender: null as { name: string; amountCents: number } | null,
      longestTenured: null as { name: string; since: Date } | null,
      newClientsThisMonth: 0, revenueThisMonthCents: 0, totalRevenueCents: 0, avgLossKg: 0,
      activeSubscriptions: 0,
    };
    if (ids.length === 0) return base;

    const [measurements, payments, activeSubs] = await Promise.all([
      this.prisma.measurement.findMany({
        where: { clientId: { in: ids } },
        orderBy: { date: 'asc' },
        select: { clientId: true, date: true, weightKg: true, waistCm: true },
      }),
      this.prisma.payment.findMany({
        where: { clientId: { in: ids }, status: 'approved' as never },
        select: { clientId: true, amountCents: true, createdAt: true },
      }),
      this.prisma.subscription.count({ where: { clientId: { in: ids }, status: 'active' as never } }),
    ]);

    // Misure per cliente (già ordinate per data crescente).
    const byClient = new Map<string, Meas[]>();
    for (const m of measurements as Meas[]) {
      const arr = byClient.get(m.clientId);
      if (arr) arr.push(m); else byClient.set(m.clientId, [m]);
    }

    let kgMonth = 0, cmMonth = 0;
    const lossByClient: { id: string; name: string; lossKg: number }[] = [];
    for (const [cid, arr] of byClient) {
      const monthArr = arr.filter((m) => m.date >= monthStart);
      if (monthArr.length >= 2) {
        kgMonth += monthArr[0].weightKg - monthArr[monthArr.length - 1].weightKg;
        const wStart = monthArr.find((m) => m.waistCm != null)?.waistCm;
        const wEnd = [...monthArr].reverse().find((m) => m.waistCm != null)?.waistCm;
        if (wStart != null && wEnd != null) cmMonth += wStart - wEnd;
      }
      if (arr.length >= 1) lossByClient.push({ id: cid, name: nameOf.get(cid) ?? 'Cliente', lossKg: arr[0].weightKg - arr[arr.length - 1].weightKg });
    }
    const sortedLoss = [...lossByClient].sort((a, b) => b.lossKg - a.lossKg);

    const spendByClient = new Map<string, number>();
    const revenueByCoach = new Map<string, number>();
    let revenueThisMonth = 0;
    for (const p of payments) {
      spendByClient.set(p.clientId, (spendByClient.get(p.clientId) ?? 0) + p.amountCents);
      if (p.createdAt >= monthStart) revenueThisMonth += p.amountCents;
      const coach = coachOf.get(p.clientId);
      if (coach) revenueByCoach.set(coach, (revenueByCoach.get(coach) ?? 0) + p.amountCents);
    }
    const topSpender = [...spendByClient.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCoach = [...revenueByCoach.entries()].sort((a, b) => b[1] - a[1])[0];
    const longest = [...clients].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    return {
      ...base,
      kgLostThisMonth: round1(kgMonth),
      cmWaistLostThisMonth: round1(cmMonth),
      top5ByLoss: sortedLoss.slice(0, 5).map((x) => ({ name: x.name, lossKg: round1(x.lossKg) })),
      bottom5ByLoss: sortedLoss.slice(-5).reverse().map((x) => ({ name: x.name, lossKg: round1(x.lossKg) })),
      topCoachByRevenue: topCoach ? { name: topCoach[0], amountCents: topCoach[1] } : null,
      topSpender: topSpender ? { name: nameOf.get(topSpender[0]) ?? 'Cliente', amountCents: topSpender[1] } : null,
      longestTenured: longest ? { name: nameOf.get(longest.id) ?? 'Cliente', since: longest.createdAt } : null,
      newClientsThisMonth: clients.filter((c) => c.createdAt >= monthStart).length,
      revenueThisMonthCents: revenueThisMonth,
      totalRevenueCents: payments.reduce((a: number, p: { amountCents: number }) => a + p.amountCents, 0),
      avgLossKg: lossByClient.length ? round1(lossByClient.reduce((a, c) => a + c.lossKg, 0) / lossByClient.length) : 0,
      activeSubscriptions: activeSubs,
    };
  }
}
