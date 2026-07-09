import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCheckinDto,
  CreateMeasurementDto,
  CreateStepsDto,
  CreateWaterDto,
} from './dto/signals.dto';
import { slopePerDay, weeklyLossRate } from './stats';

/** Normalizza a mezzanotte UTC (colonna DATE). */
export function toDateOnly(input?: string): Date {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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

    const newMilestones = await this.evaluateMilestones(clientId);
    const alert = await this.checkRapidLossGuardrail(clientId);

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
}
