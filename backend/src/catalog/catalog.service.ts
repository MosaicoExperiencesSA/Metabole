import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDietDto,
  CreateRecipeDto,
  SetDayTemplatesDto,
  UpdateDietDto,
  UpdateDietProductDto,
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
    private readonly config: ConfigParamsService,
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

  /**
   * Percorsi per il SITO pubblico (data-paths-endpoint). Nessuna autenticazione.
   * Ritorna le diete clientVisible=true, una per stile, nel formato che il sito
   * si aspetta: name (preferisce clientName), description, highlights, tag.
   * Data-driven: aggiungere/modificare un prodotto NON richiede deploy del sito.
   */
  async publicPaths() {
    const diets = await this.prisma.diet.findMany({
      where: { clientVisible: true } as never,
      orderBy: { createdAt: 'asc' },
    });
    const seen = new Set<string>();
    const paths: {
      style: string; name: string; clientName: string | null;
      description: string | null; highlights: string[];
      objective: string; seasonalTag: string | null;
    }[] = [];
    for (const d of diets as unknown as Array<Record<string, unknown>>) {
      const style = String(d.style);
      if (seen.has(style)) continue;
      seen.add(style);
      const clientName = (d.clientName as string) ?? null;
      paths.push({
        style,
        name: clientName ?? String(d.name),
        clientName,
        description: (d.clientDescription as string) ?? null,
        highlights: Array.isArray(d.highlights) ? (d.highlights as string[]) : [],
        objective: (d.objective as string) ?? 'dimagrimento',
        seasonalTag: (d.seasonalTag as string) ?? null,
      });
    }
    return paths;
  }

  /**
   * Numeri per il SITO pubblico (data-stats-endpoint): { years, clients, reached, methods }.
   * Ogni campo legge da `config_param` (`site_stats_*`) con **fallback ai conteggi reali** del DB.
   * Così la scelta "numeri reali vs base marketing (es. 20.000/80.000)" è un semplice toggle
   * dal backoffice, senza redeploy: se il parametro non è impostato si mostra il dato vero.
   *  - years   → anni di attività (config `site_stats_years`; omesso se 0/non impostato)
   *  - clients → clienti (config `site_stats_clients`, fallback: n° schede cliente reali)
   *  - reached → persone raggiunte (config `site_stats_reached`, fallback: n° lead nel CRM)
   *  - methods → n° percorsi visibili (uno per stile), coerente con /public/paths
   */
  async publicStats() {
    const [paths, realClients, realReached] = await Promise.all([
      this.publicPaths(),
      this.prisma.clientProfile.count(),
      this.prisma.crmRecord.count(),
    ]);
    const [years, clients, reached] = await Promise.all([
      this.config.getNumber('site_stats_years', 0),
      this.config.getNumber('site_stats_clients', realClients),
      this.config.getNumber('site_stats_reached', realReached),
    ]);
    const stats: Record<string, number> = {
      clients,
      reached,
      methods: paths.length,
    };
    if (years > 0) stats.years = years; // mostrato solo se configurato
    return stats;
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

  // ---------- Regole del prodotto (Fase F) ----------

  async getRules(dietId: string) {
    await this.getDiet(dietId);
    return this.prisma.productRule.findMany({ where: { dietId }, orderBy: { ruleCode: 'asc' } });
  }

  /** Attiva/parametrizza le regole opzionali del prodotto (upsert per ruleCode). */
  async setRules(userId: string, dietId: string, rules: { ruleCode: string; enabled?: boolean; params?: Record<string, unknown> }[]) {
    await this.getDiet(dietId);
    for (const r of rules) {
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId, ruleCode: r.ruleCode } },
        create: { dietId, ruleCode: r.ruleCode, enabled: r.enabled ?? true, params: (r.params ?? {}) as never },
        update: { enabled: r.enabled ?? true, params: (r.params ?? {}) as never },
      });
    }
    await this.audit.log({ action: 'catalog.diet.rules.set', actorId: userId, entityType: 'diet', entityId: dietId, metadata: { count: rules.length } });
    return this.getRules(dietId);
  }

  /** Coda "c'è un'altra regola?": proposta di una regola nuova. */
  async proposeRule(userId: string, dietId: string, text: string) {
    await this.getDiet(dietId);
    const proposal = await this.prisma.ruleProposal.create({
      data: { dietId, text, proposedBy: userId, status: 'pending' },
    });
    await this.audit.log({ action: 'catalog.diet.rule_proposal', actorId: userId, entityType: 'diet', entityId: dietId });
    return proposal;
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
