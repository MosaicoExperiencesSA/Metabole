import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { ONBOARDING_QUESTIONS } from './onboarding.questions';
import {
  computeScreeningFlag,
  validateObjective,
} from './objective-validator';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Prodotti (diete) mostrati allo schermo 16: le Diet con clientVisible=true,
   * una per stile. Data-driven: aggiungere/modificare un prodotto non richiede deploy.
   */
  async dietProducts() {
    const diets = await this.prisma.diet.findMany({
      where: { clientVisible: true } as never,
      orderBy: { createdAt: 'asc' },
    });
    const seen = new Set<string>();
    const products: {
      id: string; style: string; name: string; description: string | null;
      highlights: string[]; objective: string; seasonalTag: string | null;
    }[] = [];
    for (const d of diets as unknown as Array<Record<string, unknown>>) {
      const style = String(d.style);
      if (seen.has(style)) continue;
      seen.add(style);
      products.push({
        id: String(d.id),
        style,
        name: (d.clientName as string) ?? style,
        description: (d.clientDescription as string) ?? null,
        highlights: Array.isArray(d.highlights) ? (d.highlights as string[]) : [],
        objective: (d.objective as string) ?? 'dimagrimento',
        seasonalTag: (d.seasonalTag as string) ?? null,
      });
    }
    return products;
  }

  getQuestions() {
    return ONBOARDING_QUESTIONS;
  }

  async submitAnswers(userId: string, dto: SubmitAnswersDto, ip?: string) {
    if (!dto.healthDataConsent) {
      throw new BadRequestException(
        'Per creare il percorso serve il consenso al trattamento dei dati sanitari.',
      );
    }

    // 1. Validazione obiettivo con soglie da config_param.
    const [sustainable, ambitious, unrealAction] = await Promise.all([
      this.configParams.getNumber('sustainable_rate_max_kg_week', 0.7),
      this.configParams.getNumber('ambitious_rate_max_kg_week', 1.0),
      this.configParams.getString('unreal_objective_action', 'warn'),
    ]);
    const validation = validateObjective({
      weightToLoseKg: dto.objective.weightToLoseKg,
      weeks: dto.objective.weeks,
      sustainableRateMaxKgWeek: sustainable,
      ambitiousRateMaxKgWeek: ambitious,
      unrealAction,
    });

    const effectiveWeeks = validation.accepted
      ? dto.objective.weeks
      : (validation.suggestedWeeks ?? dto.objective.weeks);
    const targetDate = new Date(Date.now() + effectiveWeeks * 7 * 86_400_000);

    // 2. Screening sanitario.
    const screeningFlag = computeScreeningFlag(dto.health);

    // 3. Assegnazione team. Rispetta un'eventuale coach GIÀ assegnata (via ref code
    // in registrazione, o da un manager sul lead): NON la si riassegna. La
    // nutrizionista viene invece scelta tra gli staff attivi meno carichi.
    const record = await this.prisma.crmRecord.findUnique({
      where: { clientId: userId },
      select: { assignedCoachId: true },
    });
    const refCoachId = record?.assignedCoachId ?? null;
    const [pickedCoach, nutritionist] = await Promise.all([
      refCoachId ? Promise.resolve(null) : this.pickLeastLoadedStaff('coach'),
      this.pickLeastLoadedStaff('nutritionist'),
    ]);
    const coachId = refCoachId ?? pickedCoach?.id ?? null;

    // 4. Profilo (upsert: il questionario si può rifare, aggiorna il profilo).
    const intolerances = (dto.intolerances ?? []).filter((i) => i !== 'none');
    const profile = await this.prisma.clientProfile.upsert({
      where: { userId },
      create: {
        userId,
        name: dto.name,
        age: dto.age,
        sex: dto.sex,
        heightCm: dto.heightCm,
        startWeightKg: dto.startWeightKg,
        startWaistCm: dto.startWaistCm,
        startHipsCm: dto.startHipsCm,
        regime: dto.regime as never,
        dietStyle: dto.dietStyle as never,
        mealsPerDay: dto.mealsPerDay,
        pathType: dto.pathType as never,
        coachStyle: dto.coachStyle as never,
        character: dto.character as never,
        intolerances,
        dislikedFoods: dto.dislikedFoods ?? [],
        lifestyle: (dto.lifestyle ?? undefined) as never,
        themeColor: dto.themeColor,
        assignedCoachId: coachId,
        assignedNutritionistId: nutritionist?.id,
        consents: {
          ...(dto.consents ?? {}),
          healthDataConsent: { accepted: true, at: new Date().toISOString() },
        } as never,
        screeningFlag,
        onboardingAnswers: dto as never,
        onboardingCompletedAt: new Date(),
      },
      update: {
        name: dto.name,
        age: dto.age,
        sex: dto.sex,
        heightCm: dto.heightCm,
        startWeightKg: dto.startWeightKg,
        startWaistCm: dto.startWaistCm,
        startHipsCm: dto.startHipsCm,
        regime: dto.regime as never,
        dietStyle: dto.dietStyle as never,
        mealsPerDay: dto.mealsPerDay,
        pathType: dto.pathType as never,
        coachStyle: dto.coachStyle as never,
        character: dto.character as never,
        intolerances,
        dislikedFoods: dto.dislikedFoods ?? [],
        lifestyle: (dto.lifestyle ?? undefined) as never,
        themeColor: dto.themeColor,
        screeningFlag,
        onboardingAnswers: dto as never,
        onboardingCompletedAt: new Date(),
      },
    });

    // 5. Obiettivo (status proposed: verrà confermato da coach + nutrizionista).
    const targetWeightKg =
      Math.round((dto.startWeightKg - dto.objective.weightToLoseKg) * 10) / 10;
    const objective = await this.prisma.objective.create({
      data: {
        clientId: userId,
        targetWeightKg,
        targetWaistCm: dto.startWaistCm && dto.objective.waistToLoseCm
          ? dto.startWaistCm - dto.objective.waistToLoseCm
          : null,
        targetDate,
        status: 'proposed',
        history: [
          {
            at: new Date().toISOString(),
            event: 'created_from_onboarding',
            pace: validation.pace,
            ratePerWeek: validation.ratePerWeek,
            requestedWeeks: dto.objective.weeks,
            effectiveWeeks,
          },
        ] as never,
      },
    });

    // 6. Screening → presa in carico dal nutrizionista assegnato.
    if (screeningFlag) {
      await this.prisma.escalation.create({
        data: {
          clientId: userId,
          reason:
            'Screening onboarding: condizione clinica o farmaci dichiarati — percorso supervisionato.',
          source: 'screening',
          assignedToId: nutritionist?.id,
        },
      });
    }
    if (validation.requiresNutritionist) {
      await this.prisma.escalation.create({
        data: {
          clientId: userId,
          reason: `Obiettivo oltre il ritmo sostenibile (${validation.ratePerWeek} kg/sett.): richiede conferma del nutrizionista.`,
          source: 'screening',
          assignedToId: nutritionist?.id,
        },
      });
    }

    await this.audit.log({
      action: 'onboarding.completed',
      actorId: userId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { screeningFlag, pace: validation.pace },
      ipAddress: ip,
    });

    return this.buildResult(userId, { objectiveValidation: validation, objectiveId: objective.id });
  }

  async getResult(userId: string) {
    return this.buildResult(userId, {});
  }

  // ---------- Interni ----------

  private async buildResult(
    userId: string,
    extra: { objectiveValidation?: unknown; objectiveId?: string },
  ) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    if (!profile || !profile.onboardingCompletedAt) {
      throw new NotFoundException('Onboarding non ancora completato');
    }
    const objective = await this.prisma.objective.findFirst({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      path: this.describePath(profile),
      screeningFlag: profile.screeningFlag,
      supervisedPath: profile.screeningFlag,
      team: {
        coach: profile.assignedCoach,
        nutritionist: profile.assignedNutritionist,
      },
      firstVisit: {
        type: 'in_person',
        note: 'La prima visita è sempre in presenza; i controlli successivi possono essere in televisita.',
      },
      objective,
      ...(extra.objectiveValidation ? { objectiveValidation: extra.objectiveValidation } : {}),
      profileId: profile.id,
    };
  }

  /** Nome parlante del percorso consigliato (es. "Equilibrio Mediterraneo · 5 pasti"). */
  private describePath(profile: {
    dietStyle: string | null;
    mealsPerDay: number | null;
    pathType: string | null;
    regime: string | null;
  }): { name: string; tags: string[] } {
    const styleNames: Record<string, string> = {
      mediterranean: 'Equilibrio Mediterraneo',
      protein: 'Slancio Proteico',
      low_carb: 'Leggerezza Low-carb',
      flexible: 'Percorso Flessibile',
      keto: 'Percorso Keto',
    };
    const pathNames: Record<string, string> = {
      classic3: '3 pasti classico',
      five: '5 pasti',
      supplements: 'con integratori',
      intermittent_fasting: 'digiuno intermittente',
    };
    const regimeNames: Record<string, string> = {
      omnivore: 'onnivoro',
      vegetarian: 'vegetariano',
      vegan: 'vegano',
    };
    const tags = [
      profile.pathType ? pathNames[profile.pathType] : null,
      profile.regime ? regimeNames[profile.regime] : null,
      profile.mealsPerDay ? `${profile.mealsPerDay} pasti` : null,
    ].filter((t): t is string => Boolean(t));
    return {
      name: profile.dietStyle ? (styleNames[profile.dietStyle] ?? 'Percorso personalizzato') : 'Percorso personalizzato',
      tags,
    };
  }

  /** Staff attivo del ruolo indicato con meno clienti assegnate. */
  private async pickLeastLoadedStaff(role: 'coach' | 'nutritionist') {
    const candidates = await this.prisma.staff.findMany({
      where: { active: true, user: { role, status: 'active' } },
      select: {
        id: true,
        displayName: true,
        _count: {
          select:
            role === 'coach'
              ? { clientsAsCoach: true }
              : { clientsAsNutritionist: true },
        },
      },
    });
    if (candidates.length === 0) return null;
    candidates.sort((a: { _count: Record<string, number> }, b: { _count: Record<string, number> }) => {
      const countA = Object.values(a._count)[0] ?? 0;
      const countB = Object.values(b._count)[0] ?? 0;
      return countA - countB;
    });
    return candidates[0];
  }
}
