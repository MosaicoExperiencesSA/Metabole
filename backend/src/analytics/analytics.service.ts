import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const round1 = (n: number) => Math.round(n * 10) / 10;
const MONTH_LABELS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const DEMO_DOMAIN = '@demo.metabole.local';
const DEMO_NOTE = '__demo_analytics__';

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
      monthly: [] as {
        label: string; kgLost: number; cmWaistLost: number; avgLossKg: number;
        newClients: number; activeSubscriptions: number; revenueCents: number; cumulativeRevenueCents: number;
      }[],
    };
    if (ids.length === 0) return base;

    const [measurements, payments, subs] = await Promise.all([
      this.prisma.measurement.findMany({
        where: { clientId: { in: ids } },
        orderBy: { date: 'asc' },
        select: { clientId: true, date: true, weightKg: true, waistCm: true },
      }),
      this.prisma.payment.findMany({
        where: { clientId: { in: ids }, status: 'approved' as never },
        select: { clientId: true, amountCents: true, createdAt: true },
      }),
      this.prisma.subscription.findMany({
        where: { clientId: { in: ids } },
        select: { startDate: true, endDate: true, status: true },
      }),
    ]);
    const subsList = subs as { startDate: Date | null; endDate: Date | null; status: string }[];
    const activeSubs = subsList.filter((s) => s.status === 'active').length;

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

    // Serie mensile (ultimi 6 mesi) per i grafici con linea di tendenza.
    const months: { start: Date; end: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1), label: MONTH_LABELS[s.getMonth()] });
    }
    let cumRevenue = payments
      .filter((p: { createdAt: Date }) => p.createdAt < months[0].start)
      .reduce((a: number, p: { amountCents: number }) => a + p.amountCents, 0);
    const monthly = months.map((mo) => {
      let kg = 0, cm = 0, withLoss = 0, revenue = 0, newC = 0;
      for (const arr of byClient.values()) {
        const inMonth = arr.filter((m) => m.date >= mo.start && m.date < mo.end);
        if (inMonth.length >= 2) {
          kg += inMonth[0].weightKg - inMonth[inMonth.length - 1].weightKg;
          const ws = inMonth.find((m) => m.waistCm != null)?.waistCm;
          const we = [...inMonth].reverse().find((m) => m.waistCm != null)?.waistCm;
          if (ws != null && we != null) cm += ws - we;
          withLoss++;
        }
      }
      for (const p of payments) if (p.createdAt >= mo.start && p.createdAt < mo.end) revenue += p.amountCents;
      for (const c of clients) if (c.createdAt >= mo.start && c.createdAt < mo.end) newC++;
      const activeAtEnd = subsList.filter((s) => s.startDate != null && s.startDate < mo.end && (s.endDate == null || s.endDate >= mo.end)).length;
      cumRevenue += revenue;
      return {
        label: mo.label,
        kgLost: round1(kg),
        cmWaistLost: round1(cm),
        avgLossKg: withLoss ? round1(kg / withLoss) : 0,
        newClients: newC,
        activeSubscriptions: activeAtEnd,
        revenueCents: revenue,
        cumulativeRevenueCents: cumRevenue,
      };
    });

    return {
      ...base,
      monthly,
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

  // ---------- Dati demo (per vedere i grafici popolati) ----------

  /** Crea 6 clienti demo con 6 mesi di misure, pagamenti e provvigioni. Idempotente. */
  async seedDemo() {
    const coach = await this.prisma.staff.findFirst({ where: { user: { role: 'coach' } }, select: { id: true } });
    const nutri = await this.prisma.staff.findFirst({ where: { user: { role: 'nutritionist' } }, select: { id: true } });
    const now = new Date();
    const demos = [
      { name: 'Demo Anna', startW: 88, lossKg: 7.5, startWaist: 98, lossCm: 9, tenure: 9, spend: 79700 },
      { name: 'Demo Bruno', startW: 102, lossKg: 9.2, startWaist: 112, lossCm: 11, tenure: 7, spend: 49700 },
      { name: 'Demo Carla', startW: 76, lossKg: 4.1, startWaist: 88, lossCm: 5, tenure: 5, spend: 29700 },
      { name: 'Demo Dario', startW: 95, lossKg: 6.0, startWaist: 104, lossCm: 7, tenure: 11, spend: 79700 },
      { name: 'Demo Elena', startW: 82, lossKg: 2.3, startWaist: 92, lossCm: 3, tenure: 4, spend: 29700 },
      { name: 'Demo Franco', startW: 110, lossKg: 8.7, startWaist: 118, lossCm: 10, tenure: 6, spend: 49700 },
    ];
    let count = 0;
    for (let i = 0; i < demos.length; i++) {
      const d = demos[i];
      const email = `demo${i + 1}${DEMO_DOMAIN}`;
      const createdAt = new Date(now.getFullYear(), now.getMonth() - d.tenure, 5);
      const user = await this.prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, passwordHash: 'demo-disabled-account', role: 'client' as never, firstName: d.name.split(' ')[1], lastName: 'Demo', createdAt },
      });
      await this.prisma.clientProfile.upsert({
        where: { userId: user.id },
        update: { assignedCoachId: coach?.id ?? null, assignedNutritionistId: nutri?.id ?? null },
        create: { userId: user.id, name: d.name, assignedCoachId: coach?.id ?? null, assignedNutritionistId: nutri?.id ?? null },
      });
      // Misure ogni 10 giorni per 6 mesi (peso e vita in calo).
      const points = 18;
      for (let k = 0; k < points; k++) {
        const date = new Date(now);
        date.setDate(now.getDate() - (points - 1 - k) * 10);
        date.setHours(0, 0, 0, 0);
        const frac = k / (points - 1);
        await this.prisma.measurement.upsert({
          where: { clientId_date: { clientId: user.id, date } },
          update: { weightKg: +(d.startW - d.lossKg * frac).toFixed(1), waistCm: +(d.startWaist - d.lossCm * frac).toFixed(1) },
          create: { clientId: user.id, date, weightKg: +(d.startW - d.lossKg * frac).toFixed(1), waistCm: +(d.startWaist - d.lossCm * frac).toFixed(1) },
        });
      }
      // Pagamento approvato + provvigione coach, distribuiti su questo mese e mesi passati.
      const existingPay = await this.prisma.payment.findFirst({ where: { clientId: user.id, description: 'Abbonamento DEMO' } });
      if (!existingPay) {
        const payDate = new Date(now.getFullYear(), now.getMonth() - (i % 4), 3);
        await this.prisma.payment.create({
          data: { clientId: user.id, amountCents: d.spend, description: 'Abbonamento DEMO', method: 'card' as never, status: 'approved' as never, createdAt: payDate, approvedAt: payDate },
        });
        if (coach) {
          await this.prisma.ledgerEntry.create({
            data: { type: 'expense' as never, category: 'sales_commission', amountCents: Math.round(d.spend * 0.1), staffId: coach.id, clientId: user.id, date: payDate, note: DEMO_NOTE },
          });
        }
      }
      count++;
    }
    return { seeded: count };
  }

  /** Rimuove tutti i dati demo. */
  async clearDemo() {
    const users = (await this.prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { id: true } })) as { id: string }[];
    const ids = users.map((u) => u.id);
    await this.prisma.ledgerEntry.deleteMany({ where: { note: DEMO_NOTE } });
    // Lead CRM generati dai clienti demo: eliminarli PRIMA di cancellare gli utenti
    // (finché il legame clientId esiste), e ripulire anche i "fantasmi" già orfani
    // rimasti da pulizie precedenti (cliente demo cancellato → clientId a null,
    // senza email/nome/telefono, in stato "paid"): firma esclusiva dei residui demo.
    const leads = await this.prisma.crmRecord.deleteMany({
      where: {
        OR: [
          ...(ids.length ? [{ clientId: { in: ids } }] : []),
          { email: { endsWith: DEMO_DOMAIN } },
          { clientId: null, email: null, name: null, phone: null, stage: 'paid' },
        ],
      },
    });
    if (ids.length) await this.prisma.user.deleteMany({ where: { id: { in: ids } } });
    return { removed: ids.length, leadsRemoved: leads.count };
  }
}
