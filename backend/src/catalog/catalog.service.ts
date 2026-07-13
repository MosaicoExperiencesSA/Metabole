import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDietDto,
  CreateRecipeDto,
  SetDayTemplatesDto,
  UpdateDietDto,
  UpdateRecipeDto,
} from './dto/catalog.dto';

/**
 * Catalogo diete e ricette (spec sez. 4/5/6):
 * - il nutrizionista propone (draft → in_review);
 * - SOLO il capo approva o rifiuta, e MAI una dieta di cui è autore;
 * - il motore eroga solo diete approved.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Scheda Staff dell'utente corrente (richiesta per operare sul catalogo). */
  async staffOf(userId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff associata all\'utente');
    return staff;
  }

  // ---------- Diete ----------

  async listDiets(filter: { status?: string }) {
    return this.prisma.diet.findMany({
      where: filter.status ? { status: filter.status as never } : {},
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        _count: { select: { dayTemplates: true } },
      },
    });
  }

  /** Catalogo pubblicato: solo diete approvate. */
  async catalog() {
    return this.listDiets({ status: 'approved' });
  }

  async getDiet(id: string) {
    const diet = await this.prisma.diet.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        dayTemplates: { orderBy: [{ level: 'asc' }, { dayIndex: 'asc' }] },
      },
    });
    if (!diet) throw new NotFoundException('Dieta non trovata');
    return diet;
  }

  async createDiet(userId: string, dto: CreateDietDto) {
    const staff = await this.staffOf(userId);
    const diet = await this.prisma.diet.create({
      data: {
        name: dto.name,
        regime: dto.regime as never,
        style: dto.style as never,
        mealsPerDay: dto.mealsPerDay,
        levels: (dto.levels ?? [{ level: 1 }]) as never,
        options: (dto.options ?? {}) as never,
        authorId: staff.id,
        status: 'draft',
        clientName: dto.clientName ?? null,
        clientDescription: dto.clientDescription ?? null,
        highlights: (dto.highlights ?? []) as never,
        seasonalTag: dto.seasonalTag ?? null,
        objective: dto.objective ?? 'dimagrimento',
        clientVisible: dto.clientVisible ?? false,
      } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.create',
      actorId: userId,
      entityType: 'diet',
      entityId: diet.id,
    });
    return diet;
  }

  async updateDiet(userId: string, id: string, dto: UpdateDietDto) {
    const diet = await this.getDiet(id);
    if (diet.status === 'approved') {
      throw new BadRequestException(
        'Una dieta approvata non si modifica: crea una nuova versione (bozza).',
      );
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: {
        ...(dto as Record<string, unknown>),
        status: 'draft', // ogni modifica riporta in bozza
        approvedById: null,
        approvedAt: null,
      } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.update',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    return updated;
  }

  /** Aggiorna SOLO la scheda cliente (schermo 16). Consentito anche su diete approvate:
   *  non tocca i menu, solo come il prodotto viene mostrato/scelto dalla cliente. */
  async updateDietProduct(userId: string, id: string, dto: UpdateDietProductDto) {
    await this.getDiet(id); // 404 se non esiste
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { ...(dto as Record<string, unknown>) } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.product.update',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    return updated;
  }

  /** Sostituisce i template giornata (dieta+livello+giorno). Verifica che le ricette esistano. */
  async setDayTemplates(userId: string, dietId: string, dto: SetDayTemplatesDto) {
    const diet = await this.getDiet(dietId);
    if (diet.status === 'approved') {
      throw new BadRequestException('Una dieta approvata non si modifica.');
    }
    const recipeIds = [...new Set(dto.days.flatMap((d) => d.meals.map((m) => m.recipeId)))];
    const found = await this.prisma.recipe.count({ where: { id: { in: recipeIds }, active: true } });
    if (found !== recipeIds.length) {
      throw new BadRequestException('Una o più ricette non esistono o non sono attive');
    }

    await this.prisma.$transaction([
      this.prisma.dietDayTemplate.deleteMany({ where: { dietId } }),
      this.prisma.dietDayTemplate.createMany({
        data: dto.days.map((d) => ({
          dietId,
          level: d.level,
          dayIndex: d.dayIndex,
          meals: d.meals as never,
        })),
      }),
      this.prisma.diet.update({
        where: { id: dietId },
        data: { status: 'draft', approvedById: null, approvedAt: null },
      }),
    ]);
    await this.audit.log({
      action: 'catalog.diet.templates_set',
      actorId: userId,
      entityType: 'diet',
      entityId: dietId,
      metadata: { days: dto.days.length },
    });
    return this.getDiet(dietId);
  }

  async submitForReview(userId: string, id: string) {
    const diet = await this.getDiet(id);
    if (diet.status !== 'draft' && diet.status !== 'rejected') {
      throw new BadRequestException(`La dieta è in stato ${diet.status}: non inviabile in revisione`);
    }
    if (diet.dayTemplates.length === 0) {
      throw new BadRequestException('Aggiungi almeno un template giornata prima della revisione');
    }
    const updated = await this.prisma.diet.update({ where: { id }, data: { status: 'in_review' } });
    await this.audit.log({
      action: 'catalog.diet.submit',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    return updated;
  }

  /** Approvazione: solo capo (guard sul controller) e MAI la propria dieta. */
  async approveDiet(userId: string, id: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (diet.status !== 'in_review') {
      throw new BadRequestException('Si approvano solo diete in revisione');
    }
    if (diet.authorId === staff.id) {
      throw new ForbiddenException('Non puoi approvare una dieta di cui sei autore');
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'approved', approvedById: staff.id, approvedAt: new Date() },
    });
    await this.audit.log({
      action: 'catalog.diet.approve',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    return updated;
  }

  async rejectDiet(userId: string, id: string, reason?: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (diet.status !== 'in_review') {
      throw new BadRequestException('Si rifiutano solo diete in revisione');
    }
    if (diet.authorId === staff.id) {
      throw new ForbiddenException('Non puoi giudicare una dieta di cui sei autore');
    }
    const updated = await this.prisma.diet.update({ where: { id }, data: { status: 'rejected' } });
    await this.audit.log({
      action: 'catalog.diet.reject',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
      metadata: { reason },
    });
    return updated;
  }

  // ---------- Ricette ----------

  async listRecipes(filter: { regime?: string; mealSlot?: string; q?: string; includeInactive?: boolean }) {
    return this.prisma.recipe.findMany({
      where: {
        ...(filter.includeInactive ? {} : { active: true }),
        ...(filter.regime ? { regime: filter.regime as never } : {}),
        ...(filter.mealSlot ? { mealSlot: filter.mealSlot as never } : {}),
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  /** Modifica ricetta (nutrizionista). Aggiorna solo i campi inviati. */
  async updateRecipe(userId: string, id: string, dto: UpdateRecipeDto) {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ricetta non trovata');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.regime !== undefined) data.regime = dto.regime as never;
    if (dto.mealSlot !== undefined) data.mealSlot = dto.mealSlot as never;
    if (dto.kcal !== undefined) data.kcal = dto.kcal;
    if (dto.ingredients !== undefined) data.ingredients = dto.ingredients as never;
    if (dto.cookingMethods !== undefined) data.cookingMethods = dto.cookingMethods as never;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.macros !== undefined) data.macros = dto.macros as never;
    if (dto.active !== undefined) data.active = dto.active;
    const recipe = await this.prisma.recipe.update({ where: { id }, data });
    await this.audit.log({
      action: 'catalog.recipe.update',
      actorId: userId,
      entityType: 'recipe',
      entityId: id,
    });
    return recipe;
  }

  async getRecipe(id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe || !recipe.active) throw new NotFoundException('Ricetta non trovata');
    return recipe;
  }

  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        name: dto.name,
        regime: dto.regime as never,
        mealSlot: dto.mealSlot as never,
        kcal: dto.kcal,
        ingredients: dto.ingredients as never,
        cookingMethods: (dto.cookingMethods ?? []) as never,
        tags: dto.tags ?? [],
        macros: (dto.macros ?? undefined) as never,
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      action: 'catalog.recipe.create',
      actorId: userId,
      entityType: 'recipe',
      entityId: recipe.id,
    });
    return recipe;
  }
}
