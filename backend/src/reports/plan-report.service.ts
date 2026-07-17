import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Report di fine piano (handoff Prezzi/Prova, punto 4): generato in automatico a
 * OGNI fine piano, prova gratuita inclusa. Dati pescati da motore + CRM: misure
 * A→B, aderenza, "cosa ha imparato Gaia su di te", coach reale, obiettivo, offerta.
 * CONSEGNA IN APP (sono dati sanitari: mai come allegato email/WhatsApp — la
 * notifica contiene solo l'avviso). Nomi sempre dinamici dall'anagrafica.
 * Lo snapshot è congelato in `data`: resta leggibile anche dopo il purge.
 */

const round1 = (n: number) => Math.round(n * 10) / 10;

// Etichette leggibili per i codici più comuni (fallback: codice "titolato").
const REGIME_LABEL: Record<string, string> = { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' };
const STYLE_LABEL: Record<string, string> = {
  mediterranean: 'Mediterranea', keto: 'Keto', protein: 'Proteica', flexible: 'Flessibile',
  detox: 'Detossinante', lowcarb: 'Low carb',
};
const label = (map: Record<string, string>, code: string | null | undefined): string | null => {
  if (!code) return null;
  return map[code] ?? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
};

export interface MeasurePoint { date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }

export interface PlanReportData {
  kind: 'trial' | 'plan' | 'monthly';
  planName: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  clientName: string;
  measures: {
    start: MeasurePoint | null;
    end: MeasurePoint | null;
    deltaWeightKg: number | null;
    deltaWaistCm: number | null;
    deltaHipsCm: number | null;
  };
  adherence: { days: number; checkins: number; pct: number | null; ratings: number };
  objective: { targetWeightKg: number | null; toGoKg: number | null };
  gaia: string[]; // "cosa ha imparato Gaia su di te" — solo fatti reali dal DB
  coach: { name: string; phone: string | null } | null;
  offer: {
    planId: string;
    planName: string;
    priceCents: number;
    listPriceCents: number | null;
    promoActive: boolean;
    promoEndsAt: string | null;
    period: string;
    code: string | null; // codice sconto personale (punto 5 dell'handoff)
    codeExpiresAt: string | null;
    // Opzione B: prezzo che il piano proposto assume COL codice (target esatto, es. €249).
    codePriceCents: number | null;
  } | null;
}

@Injectable()
export class PlanReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Generazione ----------

  private day0(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** Prezzo effettivo del piano: promo attiva finché listino presente e scadenza non passata. */
  private pricing(p: { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }) {
    const promoActive = p.listPriceCents != null && p.listPriceCents > p.priceCents
      && (p.promoEndsAt == null || p.promoEndsAt.getTime() > Date.now());
    return { effectivePriceCents: promoActive ? p.priceCents : (p.listPriceCents ?? p.priceCents), promoActive };
  }

  /** Mese calendario dopo `d` (31/1 + 1 mese → 28/2, non 3/3). */
  private addMonths(d: Date, n: number): Date {
    const x = this.day0(d);
    const day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, lastDay));
    return x;
  }

  /**
   * Genera (se non esiste già) il report FINALE per un abbonamento concluso.
   * Idempotente: unicità su (subscriptionId, periodKey). Crea la notifica in-app.
   */
  async generateForSubscription(subscriptionId: string): Promise<{ created: boolean; reportId: string | null }> {
    const sub = (await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    })) as { id: string; clientId: string; startDate: Date | null; endDate: Date | null; plan: { name: string; priceCents: number } } | null;
    if (!sub?.startDate || !sub.endDate) return { created: false, reportId: null };
    const kind: 'trial' | 'plan' = sub.plan.priceCents === 0 ? 'trial' : 'plan';
    return this.buildAndSave(sub.clientId, sub.id, sub.plan.name, this.day0(sub.startDate), this.day0(sub.endDate), kind, 'final');
  }

  /**
   * Costruisce lo snapshot del periodo [start, end] e lo salva (se non esiste già
   * per quel periodKey). Stesso impianto per finale e mensile: cambia solo la cadenza.
   */
  private async buildAndSave(
    clientId: string,
    subscriptionId: string,
    planName: string,
    start: Date,
    end: Date,
    kind: 'trial' | 'plan' | 'monthly',
    periodKey: string,
  ): Promise<{ created: boolean; reportId: string | null }> {
    const exists = (await this.prisma.clientReport.findFirst({
      where: { subscriptionId, periodKey } as never,
      select: { id: true },
    })) as { id: string } | null;
    if (exists) return { created: false, reportId: exists.id };

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        name: true, regime: true, dietStyle: true, mealsPerDay: true,
        allergies: true, intolerances: true, dislikedFoods: true,
        assignedCoach: { select: { displayName: true, user: { select: { phone: true } } } },
      },
    })) as {
      name: string | null; regime: string | null; dietStyle: string | null; mealsPerDay: number | null;
      allergies: string[]; intolerances: string[]; dislikedFoods: string[];
      assignedCoach: { displayName: string; user: { phone: string | null } } | null;
    } | null;

    // Misure A→B: A = ultima misura PRIMA dell'inizio (o la prima del periodo);
    // B = ultima misura entro fine periodo (+2 giorni di tolleranza).
    const endTol = new Date(end.getTime() + 2 * 86_400_000);
    const ms = (await this.prisma.measurement.findMany({
      where: { clientId, date: { lte: endTol } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true, waistCm: true, hipsCm: true },
    })) as { date: Date; weightKg: number; waistCm: number | null; hipsCm: number | null }[];
    const before = ms.filter((m) => m.date.getTime() <= start.getTime());
    const inPeriod = ms.filter((m) => m.date.getTime() > start.getTime());
    const a = before[before.length - 1] ?? inPeriod[0] ?? null;
    const bCandidates = ms.filter((m) => !a || m.date.getTime() > a.date.getTime());
    const b = bCandidates[bCandidates.length - 1] ?? null;
    const point = (m: typeof a): MeasurePoint | null => (m ? {
      date: m.date.toISOString().slice(0, 10), weightKg: m.weightKg, waistCm: m.waistCm, hipsCm: m.hipsCm,
    } : null);
    const delta = (x: number | null | undefined, y: number | null | undefined) =>
      x != null && y != null ? round1(y - x) : null;

    // Aderenza: check-in registrati sui giorni del piano.
    const [checkins, ratings] = await Promise.all([
      this.prisma.dailyCheckin.count({ where: { clientId, date: { gte: start, lte: end } } }),
      this.prisma.recipeRating.count({ where: { clientId, date: { gte: start, lte: end } } }),
    ]);
    const pct = days > 0 ? Math.min(100, Math.round((checkins / days) * 100)) : null;

    // Obiettivo (ultimo confermato o proposto).
    const objective = (await this.prisma.objective.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { targetWeightKg: true },
    })) as { targetWeightKg: number | null } | null;
    const targetWeightKg = objective?.targetWeightKg ?? null;
    const toGoKg = targetWeightKg != null && b ? round1(b.weightKg - targetWeightKg) : null;

    // "Cosa ha imparato Gaia su di te" — SOLO fatti reali presenti a DB.
    const gaia: string[] = [];
    const styleL = label(STYLE_LABEL, profile?.dietStyle);
    const regimeL = label(REGIME_LABEL, profile?.regime);
    if (styleL || regimeL) {
      gaia.push(`Metodo: ${[styleL, regimeL ? regimeL.toLowerCase() : null].filter(Boolean).join(' ')}${profile?.mealsPerDay ? ` · ${profile.mealsPerDay} pasti al giorno` : ''}, tarato sul tuo profilo`);
    }
    const prefs = await this.prisma.menuWeight.count({ where: { clientId } });
    if (prefs > 0) gaia.push(`Gusti: ${prefs} preferenze sui piatti imparate dai tuoi voti e usate nei menu`);
    const topRated = (await this.prisma.recipeRating.findMany({
      where: { clientId, stars: { gte: 4 }, date: { gte: start, lte: endTol } },
      orderBy: { stars: 'desc' },
      take: 2,
      select: { recipe: { select: { name: true } } },
    })) as { recipe: { name: string } | null }[];
    const topNames = topRated.map((r) => r.recipe?.name).filter(Boolean) as string[];
    if (topNames.length) gaia.push(`Piatti promossi da te: ${topNames.join(' e ')}`);
    const avoid = [...(profile?.allergies ?? []), ...(profile?.intolerances ?? [])].length;
    if (avoid > 0) gaia.push(`Sicurezza: ${avoid} tra allergie e intolleranze SEMPRE rispettate in ogni menu`);
    if ((profile?.dislikedFoods ?? []).length > 0) gaia.push(`Niente ${(profile?.dislikedFoods ?? []).slice(0, 3).join(', ')}: i tuoi no sono stati ascoltati`);
    const eventsHandled = await this.prisma.event.count({ where: { clientId, startDate: { gte: start, lte: end } } });
    if (eventsHandled > 0) gaia.push(`Eventi gestiti: ${eventsHandled} (cene, viaggi…) col piano riadattato, senza sensi di colpa`);
    const cycles = await this.prisma.clientCycle.count({ where: { clientId, cycleStart: { gte: start, lte: end } } });
    if (cycles > 0) gaia.push('Ritmi: ciclo bigiornaliero con 2 cotture, per non annoiarti e non farti cucinare ogni giorno');
    if (gaia.length === 0) gaia.push('Gaia ha iniziato a conoscerti: più la usi, più i menu diventano tuoi');

    // Codice sconto personale ancora valido (inviato al giorno 6): compare nel report.
    const personal = (await this.prisma.discountCode.findFirst({
      where: { clientId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } as never,
      orderBy: { createdAt: 'desc' },
      select: { code: true, expiresAt: true, maxTotalUses: true, usedCount: true, planTargets: true } as never,
    })) as { code: string; expiresAt: Date | null; maxTotalUses: number | null; usedCount: number; planTargets?: unknown } | null;
    const personalOk = personal && (personal.maxTotalUses == null || personal.usedCount < personal.maxTotalUses) ? personal : null;

    // Offerta: il piano da proporre ora (una tantum col prezzo promo se attiva, altrimenti il più rilevante).
    const plans = (await this.prisma.plan.findMany({
      where: { active: true, priceCents: { gt: 0 } },
      orderBy: { priceCents: 'desc' },
    })) as { id: string; name: string; priceCents: number; listPriceCents: number | null; promoEndsAt: Date | null; period: string }[];
    // Preferenza: piano trimestrale (3m) → altrimenti il più caro attivo (di solito il percorso principale).
    const offerPlan = plans.find((p) => p.period === '3m') ?? plans[0] ?? null;
    const offer = offerPlan ? (() => {
      const pr = this.pricing(offerPlan);
      return {
        planId: offerPlan.id,
        planName: offerPlan.name,
        priceCents: pr.effectivePriceCents,
        listPriceCents: pr.promoActive ? offerPlan.listPriceCents : null,
        promoActive: pr.promoActive,
        promoEndsAt: offerPlan.promoEndsAt ? offerPlan.promoEndsAt.toISOString() : null,
        period: offerPlan.period,
        code: personalOk?.code ?? null,
        codeExpiresAt: personalOk?.expiresAt ? personalOk.expiresAt.toISOString() : null,
        codePriceCents: (() => {
          const targets = (personalOk?.planTargets ?? null) as Record<string, number> | null;
          const t = targets?.[offerPlan.id];
          return t != null && t < pr.effectivePriceCents ? t : null;
        })(),
      };
    })() : null;

    const data: PlanReportData = {
      kind,
      planName,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      days,
      clientName: profile?.name ?? 'La tua settimana',
      measures: {
        start: point(a),
        end: point(b),
        deltaWeightKg: delta(a?.weightKg, b?.weightKg),
        deltaWaistCm: delta(a?.waistCm, b?.waistCm),
        deltaHipsCm: delta(a?.hipsCm, b?.hipsCm),
      },
      adherence: { days, checkins, pct, ratings },
      objective: { targetWeightKg, toGoKg },
      gaia,
      coach: profile?.assignedCoach
        ? { name: profile.assignedCoach.displayName, phone: profile.assignedCoach.user?.phone ?? null }
        : null,
      offer,
    };

    const report = await this.prisma.clientReport.create({
      data: { clientId, subscriptionId, kind, periodKey, periodStart: start, periodEnd: end, data: data as never } as never,
    });

    // Avviso in app (MAI il contenuto: solo la notifica che il report è pronto).
    await this.prisma.notification.create({
      data: {
        userId: clientId,
        type: 'plan_report',
        payload: {
          title: kind === 'monthly' ? 'Il report del tuo mese è pronto 📊' : 'Il tuo report è pronto 📊',
          body: kind === 'trial'
            ? 'La tua settimana è finita: guarda cosa è cambiato e cosa ha imparato Gaia su di te.'
            : kind === 'monthly'
              ? 'Un altro mese di strada: guarda i progressi A→B e cosa ha imparato Gaia.'
              : 'Il tuo piano si è concluso: guarda i risultati A→B e i prossimi passi.',
          reportId: report.id,
        } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });

    return { created: true, reportId: report.id };
  }

  /**
   * Cron giornaliero: genera il report per ogni piano concluso di recente
   * (finestra 14 giorni) che non l'ha ancora. Idempotente.
   */
  async generateDaily(): Promise<{ created: number }> {
    const now = new Date();
    const from = new Date(now.getTime() - 14 * 86_400_000);
    const ended = (await this.prisma.subscription.findMany({
      where: {
        endDate: { lte: now, gte: from },
        startDate: { not: null },
        status: { in: ['active', 'expired'] as never },
      } as never,
      select: { id: true },
    })) as { id: string }[];
    let created = 0;
    for (const s of ended) {
      try {
        const r = await this.generateForSubscription(s.id);
        if (r.created) created++;
      } catch { /* un errore su un piano non blocca gli altri */ }
    }
    return { created };
  }

  /**
   * Report MENSILE in app (stesso impianto del finale): per ogni abbonamento a
   * pagamento ATTIVO più lungo di un mese, a ogni "mesiversario" dall'inizio si
   * genera lo snapshot del mese appena chiuso ('m1','m2',…). L'ultimo tratto è
   * coperto dal report finale (niente doppione a ridosso della scadenza).
   * Idempotente; sostituisce il vecchio report mensile via email (dati sanitari:
   * la notifica in app contiene solo l'avviso).
   */
  async generateMonthly(): Promise<{ created: number }> {
    const today = this.day0(new Date());
    const subs = (await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        startDate: { not: null },
        endDate: { not: null },
        plan: { priceCents: { gt: 0 } },
      } as never,
      select: { id: true, clientId: true, startDate: true, endDate: true, plan: { select: { name: true } } },
    })) as { id: string; clientId: string; startDate: Date; endDate: Date; plan: { name: string } }[];
    let created = 0;
    for (const sub of subs) {
      try {
        const start = this.day0(sub.startDate);
        const end = this.day0(sub.endDate);
        for (let i = 1; i <= 24; i++) {
          const boundary = this.addMonths(start, i);
          if (boundary.getTime() > today.getTime()) break; // mese non ancora chiuso
          // Se il piano finisce entro pochi giorni dal mesiversario ci pensa il finale.
          if (boundary.getTime() >= end.getTime() - 3 * 86_400_000) break;
          const r = await this.buildAndSave(sub.clientId, sub.id, sub.plan.name, this.addMonths(start, i - 1), boundary, 'monthly', `m${i}`);
          if (r.created) created++;
        }
      } catch { /* un errore su un piano non blocca gli altri */ }
    }
    return { created };
  }

  // ---------- Lettura (cliente) ----------

  /** Elenco dei report della cliente (solo intestazioni, dal più recente). */
  async listMine(clientId: string) {
    const rows = (await this.prisma.clientReport.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, periodStart: true, periodEnd: true, readAt: true, createdAt: true, data: true },
    })) as { id: string; kind: string; periodStart: Date; periodEnd: Date; readAt: Date | null; createdAt: Date; data: unknown }[];
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      planName: (r.data as PlanReportData)?.planName ?? '',
      periodStart: r.periodStart.toISOString().slice(0, 10),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
      read: r.readAt != null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Report completo (solo il proprio); alla prima apertura viene segnato come letto. */
  async getMine(clientId: string, reportId: string) {
    const r = (await this.prisma.clientReport.findFirst({
      where: { id: reportId, clientId },
      select: { id: true, kind: true, readAt: true, createdAt: true, data: true },
    })) as { id: string; kind: string; readAt: Date | null; createdAt: Date; data: unknown } | null;
    if (!r) throw new NotFoundException('Report non trovato.');
    if (!r.readAt) {
      await this.prisma.clientReport.update({ where: { id: r.id }, data: { readAt: new Date() } });
    }
    return { ...(r.data as PlanReportData), id: r.id, kind: r.kind, createdAt: r.createdAt.toISOString() };
  }
}
