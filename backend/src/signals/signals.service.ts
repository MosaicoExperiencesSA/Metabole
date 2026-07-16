import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietLearningService } from '../diet-learning/diet-learning.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCheckinDto,
  CreateMeasurementDto,
  CreateStepsDto,
  CreateWaterDto,
} from './dto/signals.dto';
import { slopePerDay, weeklyLossRate } from './stats';
import { ProgressService } from './progress.service';
import { EscalationRoutingService } from '../escalations/escalation-routing.service';
import { toDateOnly } from '../common/date-only';

const MILESTONE_DEFS: { type: string; label: string; lostKg?: number }[] = [
  { type: 'lost_1kg', label: 'Primo chilo andato!', lostKg: 1 },
  { type: 'lost_3kg', label: '-3 kg: si vede!', lostKg: 3 },
  { type: 'lost_5kg', label: '-5 kg: che traguardo!', lostKg: 5 },
];

@Injectable()
export class SignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly dietLearning: DietLearningService,
    private readonly progress: ProgressService,
    private readonly routing: EscalationRoutingService,
  ) {}

  // ---------- Misure (segnale Corpo) ----------

  async listMeasurements(clientId: string, from?: string, to?: string) {
    return this.prisma.measurement.findMany({
      where: {
        clientId,
        ...(from || to
          ? { date: { ...(from ? { gte: toDateOnly(from) } : {}), ...(to ? { lte: toDateOnly(to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }

  async upsertMeasurement(clientId: string, dto: CreateMeasurementDto) {
    const date = toDateOnly(dto.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi inserire misure nel futuro');
    }
    const measurement = await this.prisma.measurement.upsert({
      where: { clientId_date: { clientId, date } },
      create: {
        clientId,
        date,
        weightKg: dto.weightKg,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        thighsCm: dto.thighsCm,
      },
      update: {
        weightKg: dto.weightKg,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        thighsCm: dto.thighsCm,
      },
    });

    // Nota: lo sblocco del gate misure (chiusura dell'alert coach "missing_measurements")
    // avviene ora nell'Alert engine: al prossimo recompute (lettura coda coach o cron)
    // la condizione non vale più e l'alert passa a "resolved".

    // Learning motore: la misura chiude un ciclo → calcola esito peso/cm e aggiorna i
    // pesi delle ricette. Non deve mai rompere il salvataggio della misura.
    try {
      await this.dietLearning.onCycleClose(clientId, {
        date: measurement.date,
        weightKg: measurement.weightKg,
        waistCm: measurement.waistCm,
        hipsCm: measurement.hipsCm,
      });
    } catch {
      /* learning best-effort */
    }

    const newMilestones = await this.evaluateMilestones(clientId);
    const alert = await this.checkRapidLossGuardrail(clientId);
    await this.checkNoProgress(clientId).catch(() => undefined);

    return { measurement, newMilestones, rapidLossAlert: alert };
  }

  /**
   * Guardrail (spec 7.4): se il ritmo di calo sulle ultime 2 settimane supera
   * max_weight_change_alert_kg_week, apre un'escalation verso il nutrizionista
   * assegnato (una sola aperta per volta).
   */
  private async checkRapidLossGuardrail(clientId: string): Promise<boolean> {
    const threshold = await this.configParams.getNumber('max_weight_change_alert_kg_week', 1.5);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);
    const recent = await this.prisma.measurement.findMany({
      where: { clientId, date: { gte: twoWeeksAgo } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
    });
    if (recent.length < 3) return false;

    const rate = weeklyLossRate(
      slopePerDay(recent.map((m: { date: Date; weightKg: number }) => ({ date: m.date, value: m.weightKg }))),
    );
    if (rate === null || rate <= threshold) return false;

    const alreadyOpen = await this.prisma.escalation.findFirst({
      where: { clientId, source: 'engine', status: 'open', reason: { contains: 'Calo rapido' } },
    });
    if (alreadyOpen) return true;

    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionistId: true },
    });
    await this.prisma.escalation.create({
      data: {
        clientId,
        reason: `Calo rapido: ${rate} kg/settimana sulle ultime rilevazioni (soglia ${threshold}). Verificare calorie ed energia.`,
        source: 'engine',
        // R12: calo rapido = sicurezza clinica → solo nutrizionista.
        category: 'clinical' as never,
        assignedToId: profile?.assignedNutritionistId,
      },
    });
    await this.audit.log({
      action: 'signals.rapid_loss_alert',
      actorId: clientId,
      entityType: 'escalation',
      metadata: { rate, threshold },
    });
    return true;
  }

  /** Traguardi automatici: prima misura, -1/-3/-5 kg, metà strada, obiettivo raggiunto. */
  /**
   * R12 — Nessun progresso: se abilitato (config `no_progress_escalation`) e la cliente
   * è in stallo (oltre `stall_days_before_coach_alert`), apre una segnalazione
   * "Nessun progresso" instradata al nutrizionista (coach informata). Idempotente.
   */
  private async checkNoProgress(clientId: string): Promise<void> {
    const enabled = await this.configParams.getBool('no_progress_escalation', false);
    if (!enabled) return;
    try {
      const p = (await this.progress.getProgress(clientId)) as { alerts?: { stalled?: boolean; stallDays?: number } };
      if (!p.alerts?.stalled) return;
      await this.routing.open({
        clientId,
        category: 'no_progress',
        reason: `Nessun progresso: peso fermo da ${p.alerts.stallDays ?? '?'} giorni. Rivedere piano e aderenza.`,
        source: 'engine',
        dedupe: true,
      });
    } catch {
      /* mai bloccare il salvataggio della misura */
    }
  }

  /**
   * R12 — Scarsa aderenza (cron giornaliero): per le clienti attive che avevano un
   * check-in ma non ne fanno da `low_adherence_days` giorni, apre una segnalazione
   * alla coach. Config 0 = spenta. Idempotente per (cliente, categoria).
   */
  async runAdherenceSweep(): Promise<{ opened: number; days: number }> {
    const days = await this.configParams.getNumber('low_adherence_days', 0);
    if (days <= 0) return { opened: 0, days: 0 };
    const since = new Date(Date.now() - days * 86_400_000);
    const clients = (await this.prisma.user.findMany({
      where: { role: 'client', status: 'active', deletedAt: null },
      select: { id: true },
    })) as { id: string }[];
    let opened = 0;
    for (const c of clients) {
      const last = (await this.prisma.dailyCheckin.findFirst({
        where: { clientId: c.id },
        orderBy: { date: 'desc' },
        select: { date: true },
      })) as { date: Date } | null;
      if (!last || last.date >= since) continue; // mai iniziato o check-in recente
      try {
        await this.routing.open({
          clientId: c.id,
          category: 'low_adherence',
          reason: `Scarsa aderenza: nessun check-in da almeno ${days} giorni.`,
          source: 'coach',
          dedupe: true,
        });
        opened++;
      } catch {
        /* prosegue con le altre clienti */
      }
    }
    return { opened, days };
  }

  private async evaluateMilestones(clientId: string): Promise<string[]> {
    const [profile, objective, count, latest] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { startWeightKg: true },
      }),
      this.prisma.objective.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { targetWeightKg: true },
      }),
      this.prisma.measurement.count({ where: { clientId } }),
      this.prisma.measurement.findFirst({
        where: { clientId },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      }),
    ]);

    const earned: { type: string; label: string }[] = [];
    if (count >= 1) earned.push({ type: 'first_measurement', label: 'Prima misura registrata: si parte!' });

    if (profile?.startWeightKg && latest) {
      const lost = profile.startWeightKg - latest.weightKg;
      for (const def of MILESTONE_DEFS) {
        if (def.lostKg && lost >= def.lostKg) earned.push({ type: def.type, label: def.label });
      }
      if (objective?.targetWeightKg) {
        const total = profile.startWeightKg - objective.targetWeightKg;
        if (total > 0 && lost >= total / 2) {
          earned.push({ type: 'halfway', label: 'Metà strada: continua così!' });
        }
        if (latest.weightKg <= objective.targetWeightKg) {
          earned.push({ type: 'goal_reached', label: 'Obiettivo raggiunto! 🎉' });
        }
      }
    }

    const created: string[] = [];
    for (const m of earned) {
      const result = await this.prisma.milestone.createMany({
        data: [{ clientId, type: m.type, label: m.label }],
        skipDuplicates: true,
      });
      if (result.count > 0) created.push(m.type);
    }
    return created;
  }

  async listMilestones(clientId: string) {
    return this.prisma.milestone.findMany({
      where: { clientId },
      orderBy: { achievedAt: 'desc' },
    });
  }

  // ---------- Check-in giornaliero (segnale Testa) ----------

  async listCheckins(clientId: string, from?: string, to?: string) {
    return this.prisma.dailyCheckin.findMany({
      where: {
        clientId,
        ...(from || to
          ? { date: { ...(from ? { gte: toDateOnly(from) } : {}), ...(to ? { lte: toDateOnly(to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 90,
    });
  }

  async upsertCheckin(clientId: string, dto: CreateCheckinDto) {
    const date = toDateOnly(dto.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi fare il check-in nel futuro');
    }
    return this.prisma.dailyCheckin.upsert({
      where: { clientId_date: { clientId, date } },
      create: {
        clientId,
        date,
        mood: dto.mood as never,
        energy: dto.energy,
        hunger: dto.hunger,
        stress: dto.stress,
      },
      update: {
        mood: dto.mood as never,
        energy: dto.energy,
        hunger: dto.hunger,
        stress: dto.stress,
      },
    });
  }

  /** Per il popup "una volta al giorno, alla prima apertura". */
  async todayStatus(clientId: string) {
    const today = toDateOnly();
    const [checkin, measurement, water, steps] = await Promise.all([
      this.prisma.dailyCheckin.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.measurement.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.waterLog.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.stepLog.findUnique({ where: { clientId_date: { clientId, date: today } } }),
    ]);
    const [waterGoal, stepsGoal] = await Promise.all([
      this.configParams.getNumber('water_goal_glasses', 8),
      this.configParams.getNumber('steps_goal', 8000),
    ]);
    return {
      date: today.toISOString().slice(0, 10),
      checkinDone: Boolean(checkin),
      checkin,
      measurementDone: Boolean(measurement),
      water: water ?? { glasses: 0, goal: waterGoal },
      steps: steps ?? { steps: 0, goal: stepsGoal },
    };
  }

  // ---------- Acqua e passi (segnale Vita) ----------

  async upsertWater(clientId: string, dto: CreateWaterDto) {
    const date = toDateOnly(dto.date);
    const goal = await this.configParams.getNumber('water_goal_glasses', 8);
    return this.prisma.waterLog.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date, glasses: dto.glasses, goal },
      update: { glasses: dto.glasses },
    });
  }

  async upsertSteps(clientId: string, dto: CreateStepsDto) {
    const date = toDateOnly(dto.date);
    const goal = await this.configParams.getNumber('steps_goal', 8000);
    return this.prisma.stepLog.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date, steps: dto.steps, goal, source: dto.source ?? 'manual' },
      update: { steps: dto.steps, ...(dto.source ? { source: dto.source } : {}) },
    });
  }

  /**
   * Dati per il WIDGET da home screen (nativo iOS/Android): stato mascotte in base
   * all'ora, saluto, frase del giorno, prossimo pasto, acqua/passi e progresso.
   * Endpoint di sola lettura, pensato per essere chiamato dal widget con il token cliente.
   */
  async widget(clientId: string) {
    const FRASI = [
      'Non è una dieta, è il tuo nuovo stile.',
      'Un passo alla volta è comunque un passo avanti.',
      'I piccoli gesti di oggi sono i risultati di domani.',
      'Bevi, respira, muoviti: il resto viene.',
      'Sii gentile con te: stai già facendo tanto.',
      'La costanza batte la perfezione.',
    ];
    const [profile, user, todayStatus] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: clientId }, select: { firstName: true } }),
      this.todayStatus(clientId),
    ]);
    const name = (profile?.name ?? user?.firstName ?? '').trim();
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(now));
    const day = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', day: '2-digit' }).format(now));

    const state = hour < 11 ? 'buongiorno' : hour < 14 ? 'inrotta' : hour < 17 ? 'acqua' : hour < 21 ? 'passi' : 'buonanotte';
    const greetings: Record<string, string> = {
      buongiorno: name ? `Buongiorno, ${name}!` : 'Buongiorno!',
      inrotta: name ? `Sei in rotta, ${name}!` : 'Sei in rotta!',
      acqua: name ? `Bevi un po', ${name}` : 'Bevi un po\'',
      passi: 'Muoviti un po\'!',
      buonanotte: name ? `Buonanotte, ${name}` : 'Buonanotte',
    };
    const phrase = FRASI[day % FRASI.length];

    // Prossimo pasto di oggi in base all'ora.
    const today = toDateOnly();
    const menuDay = await this.prisma.menuDay.findUnique({ where: { clientId_date: { clientId, date: today } } });
    const meals = (menuDay?.meals ?? []) as { slot: string; name: string; kcal: number }[];
    const SLOT_HOURS: [string, number][] = [['breakfast', 10], ['morning_snack', 11], ['lunch', 14], ['afternoon_snack', 17], ['dinner', 21]];
    let nextMeal: { slot: string; name: string; kcal: number } | null = null;
    for (const [slot, h] of SLOT_HOURS) {
      if (hour < h) {
        const m = meals.find((x) => x.slot === slot);
        if (m) { nextMeal = { slot, name: m.name, kcal: m.kcal }; break; }
      }
    }

    // Progresso verso l'obiettivo peso (se disponibile).
    const [measurements, objective] = await Promise.all([
      this.prisma.measurement.findMany({ where: { clientId }, orderBy: { date: 'asc' }, select: { weightKg: true } }),
      this.prisma.objective.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { targetWeightKg: true } }),
    ]);
    let weightLostKg: number | null = null;
    let progressPercent: number | null = null;
    if (measurements.length >= 1) {
      const start = measurements[0].weightKg;
      const current = measurements[measurements.length - 1].weightKg;
      weightLostKg = Math.round((start - current) * 10) / 10;
      const target = objective?.targetWeightKg ?? null;
      if (target != null && start - target !== 0) {
        progressPercent = Math.max(0, Math.min(100, Math.round(((start - current) / (start - target)) * 100)));
      }
    }

    // Streak: giorni consecutivi con check-in fino a oggi.
    const recent = await this.prisma.dailyCheckin.findMany({
      where: { clientId }, orderBy: { date: 'desc' }, take: 60, select: { date: true },
    });
    const done = new Set((recent as { date: Date }[]).map((c) => c.date.toISOString().slice(0, 10)));
    let streak = 0;
    let cur = new Date(today);
    while (done.has(cur.toISOString().slice(0, 10))) {
      streak++;
      cur = new Date(cur.getTime() - 86_400_000);
    }

    return {
      name,
      state,
      greeting: greetings[state],
      phrase,
      nextMeal,
      water: todayStatus.water,
      steps: todayStatus.steps,
      weightLostKg,
      progressPercent,
      streak,
      updatedAt: now.toISOString(),
    };
  }
}
