import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { validateObjective } from '../onboarding/objective-validator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateObjectiveDto, UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Profilo non ancora creato: completa prima il questionario.');
    }
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId); // 404 se manca
    const { lifestyle, consents, planStartDate, ...rest } = dto;
    const profile = await this.prisma.clientProfile.update({
      where: { userId },
      data: {
        ...(rest as Record<string, unknown>),
        ...(lifestyle ? { lifestyle: lifestyle as never } : {}),
        ...(consents ? { consents: consents as never } : {}),
        ...(planStartDate ? { planStartDate: new Date(planStartDate) } : {}),
      } as never,
    });
    await this.audit.log({
      action: 'profile.update',
      actorId: userId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { fields: Object.keys(dto) },
    });
    return profile;
  }

  async updateTheme(userId: string, color: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new BadRequestException('Colore non valido: usa il formato #RRGGBB');
    }
    return this.prisma.clientProfile.update({
      where: { userId },
      data: { themeColor: color },
      select: { id: true, themeColor: true },
    });
  }

  async getObjective(userId: string) {
    const objective = await this.prisma.objective.findFirst({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!objective) throw new NotFoundException('Nessun obiettivo: completa prima il questionario.');
    return objective;
  }

  /**
   * Aggiorna l'obiettivo con la stessa validazione di ritmo dell'onboarding.
   * Ogni modifica riporta lo status a "proposed" (va riconfermato dal team)
   * e viene tracciata in history.
   */
  async updateObjective(userId: string, dto: UpdateObjectiveDto) {
    const current = await this.getObjective(userId);
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!profile?.startWeightKg) {
      throw new BadRequestException('Manca il peso di partenza: completa il questionario.');
    }

    const currentTargetKg = current.targetWeightKg ?? profile.startWeightKg;
    const weightToLoseKg =
      dto.weightToLoseKg ??
      Math.max(Math.round((profile.startWeightKg - currentTargetKg) * 10) / 10, 1);
    const weeks =
      dto.weeks ??
      Math.max(
        Math.ceil(
          ((current.targetDate?.getTime() ?? Date.now()) - Date.now()) / (7 * 86_400_000),
        ),
        3,
      );

    const [sustainable, ambitious, unrealAction] = await Promise.all([
      this.configParams.getNumber('sustainable_rate_max_kg_week', 0.7),
      this.configParams.getNumber('ambitious_rate_max_kg_week', 1.0),
      this.configParams.getString('unreal_objective_action', 'warn'),
    ]);
    const validation = validateObjective({
      weightToLoseKg,
      weeks,
      sustainableRateMaxKgWeek: sustainable,
      ambitiousRateMaxKgWeek: ambitious,
      unrealAction,
    });
    if (!validation.accepted) {
      throw new BadRequestException({
        message: validation.message,
        pace: validation.pace,
        suggestedWeeks: validation.suggestedWeeks,
      });
    }

    const history = Array.isArray(current.history) ? [...(current.history as unknown[])] : [];
    history.push({
      at: new Date().toISOString(),
      event: 'updated_by_client',
      pace: validation.pace,
      ratePerWeek: validation.ratePerWeek,
      weightToLoseKg,
      weeks,
    });

    const updated = await this.prisma.objective.update({
      where: { id: current.id },
      data: {
        targetWeightKg: Math.round((profile.startWeightKg - weightToLoseKg) * 10) / 10,
        targetWaistCm:
          profile.startWaistCm && dto.waistToLoseCm !== undefined
            ? profile.startWaistCm - dto.waistToLoseCm
            : current.targetWaistCm,
        targetDate: new Date(Date.now() + weeks * 7 * 86_400_000),
        status: 'proposed', // ogni modifica va riconfermata da coach + nutrizionista
        confirmedByCoachAt: null,
        confirmedByNutritionistAt: null,
        history: history as never,
      },
    });
    await this.audit.log({
      action: 'objective.update',
      actorId: userId,
      entityType: 'objective',
      entityId: updated.id,
      metadata: { pace: validation.pace, weightToLoseKg, weeks },
    });
    return { objective: updated, validation };
  }
}
