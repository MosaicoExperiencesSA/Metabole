import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { coachTeamScope, isCoachLike } from '../common/coach-team';
import { giornoLocale } from '../common/date-only';
import {
  confrontoAllaGiornata,
  finestraDelMese,
  giorniDelMese,
  leggiMese,
  meseAParole,
  meseDi,
  meseSpostato,
  serieDelMese,
} from './serie-giornaliera';

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

  /**
   * Il filtro delle clienti che questo utente può vedere. Estratto perché ora lo usano DUE metodi —
   * i grafici mensili e la serie giornaliera — e due copie di un controllo di portata divergono: il
   * giorno in cui una si allarga, l'altra mostra numeri di clienti che non sono di chi guarda.
   */
  private async filtroClienti(user: AuthUser): Promise<{ where: Record<string, unknown>; scopeAll: boolean }> {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
    const scopeAll = MANAGER_ROLES.includes(user.role);
    const where: Record<string, unknown> = { role: 'client', deletedAt: null };
    if (!scopeAll) {
      if (isCoachLike(user.role) && staff) where.clientProfile = { assignedCoachId: { in: (await coachTeamScope(this.prisma, user.sub)) ?? [] } };
      else if (user.role === 'nutritionist' && staff) where.clientProfile = { assignedNutritionistId: staff.id };
      else where.id = '__none__';
    }
    return { where, scopeAll };
  }

  async charts(user: AuthUser) {
    const { where, scopeAll } = await this.filtroClienti(user);

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
      /**
       * CLASSIFICHE PER PERDITA, PERIODO PER PERIODO (richiesta di Simone dell'11/8: «questi due dati
       * devono essere selezionabili… mi mostri il mese corrente, poi da una casellina a discesa posso
       * selezionare quale mese vedere oppure tutto»).
       *
       * Tutti i periodi arrivano in un colpo solo, calcolati sulle misure che sono già in memoria: la
       * tendina cambia vista senza una chiamata al server, che per una classifica di cinque righe
       * sarebbe un giro di rete per niente.
       */
      classificaPerdita: {
        /** In ordine: «tutto» e poi i mesi dal più recente. */
        periodi: [] as { chiave: string; etichetta: string }[],
        /** Da chiave di periodo a classifica. */
        perPeriodo: {} as Record<string, { top: { name: string; lossKg: number }[]; bottom: { name: string; lossKg: number }[] }>,
      },
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
    // ⚠️ `STATI_CON_UN_PIANO` e non `'active'` (19/8, voce 258): un piano che comincia lunedì è un
    // abbonamento comprato, e il numero qui dev'essere lo stesso della dashboard — che li conta già
    // così. Due conteggi della stessa cosa che non coincidono è peggio di un conteggio sbagliato:
    // nessuno sa più quale guardare.
    const activeSubs = subsList.filter((s) => (STATI_CON_UN_PIANO as readonly string[]).includes(s.status)).length;

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
    /**
     * La classifica di un periodo: prima misura contro ultima, DENTRO il periodo.
     *
     * ⚠️ Servono **almeno due misure** nel periodo. Con una sola la differenza è zero, e la classifica
     * «ultimi per perdita» si riempiva di righe a 0,0 kg che non dicono «non ha perso»: dicono «si è
     * pesata una volta sola». Sono due cose diverse e mescolate rendevano l'elenco inutile — era la
     * schermata che Simone ha mandato, con tre zeri su cinque.
     */
    const classificaFra = (da: Date | null, a: Date | null) => {
      const perdite: { name: string; lossKg: number }[] = [];
      for (const [cid, arr] of byClient) {
        const dentro = arr.filter((m) => (!da || m.date >= da) && (!a || m.date < a));
        if (dentro.length < 2) continue;
        perdite.push({
          name: nameOf.get(cid) ?? 'Cliente',
          lossKg: round1(dentro[0].weightKg - dentro[dentro.length - 1].weightKg),
        });
      }
      const ordinate = perdite.sort((x, y) => y.lossKg - x.lossKg);
      return { top: ordinate.slice(0, 5), bottom: ordinate.slice(-5).reverse() };
    };

    // «Tutto» più gli ultimi dodici mesi: oltre l'anno una classifica mensile non la guarda nessuno,
    // e i mesi vuoti compaiono comunque — meglio una classifica vuota che un mese che manca dalla
    // tendina e sembra un buco nei dati.
    const periodi: { chiave: string; etichetta: string }[] = [{ chiave: 'tutto', etichetta: 'Tutto il percorso' }];
    const perPeriodo: Record<string, { top: { name: string; lossKg: number }[]; bottom: { name: string; lossKg: number }[] }> = {
      tutto: classificaFra(null, null),
    };
    for (let i = 0; i < 12; i++) {
      const inizio = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fine = new Date(inizio.getFullYear(), inizio.getMonth() + 1, 1);
      const chiave = `${inizio.getFullYear()}-${String(inizio.getMonth() + 1).padStart(2, '0')}`;
      periodi.push({ chiave, etichetta: `${MONTH_LABELS[inizio.getMonth()]} ${inizio.getFullYear()}` });
      perPeriodo[chiave] = classificaFra(inizio, fine);
    }

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
      classificaPerdita: { periodi, perPeriodo },
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
  /**
   * FATTURATO CUMULATO E NUOVE CLIENTI **PER GIORNATA**, per un mese, col mese precedente
   * affiancato (richiesta di Simone dell'8/8).
   *
   * Un endpoint suo, e non un campo in più su `charts`: la serie giornaliera dipende da **quale
   * mese** si sta guardando — la pagina ha le frecce per scorrere lo storico — e infilarla nel
   * payload dei grafici vorrebbe dire ricalcolare tutto (misure comprese) a ogni freccia premuta.
   *
   * `mese` è `YYYY-MM`; se manca o non si legge, il mese corrente. Il mese si intende sempre nel
   * fuso dell'azienda: vedi `serie-giornaliera.ts`, dove sta la ragione.
   */
  async serieGiornaliera(user: AuthUser, mese?: string) {
    const oggiIso = giornoLocale(new Date());
    const meseCorrente = oggiIso.slice(0, 7);
    const scelto = leggiMese(mese) ? (mese as string) : meseCorrente;
    const precedente = meseSpostato(scelto, -1);

    const { where, scopeAll } = await this.filtroClienti(user);
    const clienti = (await this.prisma.user.findMany({
      where: where as never,
      select: { id: true, createdAt: true },
    })) as unknown as { id: string; createdAt: Date }[];
    const ids = clienti.map((c) => c.id);

    // Una finestra sola per i due mesi: due query per due mesi contigui sarebbero due viaggi per
    // gli stessi dati. Il filtro fine per mese lo fa `serieDelMese`, sul giorno locale.
    const daPrec = finestraDelMese(precedente).da;
    const aScelto = finestraDelMese(scelto).a;
    const pagamenti = ids.length
      ? ((await this.prisma.payment.findMany({
          where: {
            clientId: { in: ids },
            status: 'approved' as never,
            createdAt: { gte: daPrec, lt: aScelto },
          },
          select: { amountCents: true, createdAt: true },
        })) as { amountCents: number; createdAt: Date }[])
      : [];
    const iscrizioni = clienti.filter((c) => c.createdAt >= daPrec && c.createdAt < aScelto);

    const serie = serieDelMese(scelto, { pagamenti, clienti: iscrizioni });
    const seriePrecedente = serieDelMese(precedente, { pagamenti, clienti: iscrizioni });

    // Fin dove confrontare: se il mese è quello in corso, fino a OGGI — confrontare un mese a metà
    // con un mese intero è il modo di leggere un crollo che non c'è. Un mese chiuso, tutto.
    const eIlMeseInCorso = scelto === meseCorrente;
    const finoAlGiorno = eIlMeseInCorso ? Number(oggiIso.slice(8, 10)) : giorniDelMese(scelto);

    return {
      scope: scopeAll ? 'all' : 'own',
      mese: scelto,
      etichetta: meseAParole(scelto),
      precedente,
      etichettaPrecedente: meseAParole(precedente),
      // Il mese dopo esiste solo se non siamo già arrivati a quello in corso: una freccia «avanti»
      // che porta su un mese vuoto e futuro fa sembrare rotta la pagina.
      successivo: eIlMeseInCorso ? null : meseSpostato(scelto, 1),
      giorniNelMese: giorniDelMese(scelto),
      /** Il giorno di oggi, se stiamo guardando il mese in corso: serve alla riga «oggi». */
      oggi: eIlMeseInCorso ? Number(oggiIso.slice(8, 10)) : null,
      serie,
      seriePrecedente,
      confronto: confrontoAllaGiornata(serie, seriePrecedente, finoAlGiorno),
    };
  }

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
