import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
import { suggestAllergens } from '../catalog/allergens';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_RULES, ENGINE_RULES, ENGINE_RULE_BY_CODE, RULE_CATEGORIES } from './engine-rules.catalog';

/**
 * Gestione delle regole del motore per il CAPO NUTRIZIONISTA:
 * - regole GLOBALI (config_param) — attive subito sul motore;
 * - regole SUGGERITE per tipo di nutrizione (rule_preset, flag `suggested`) — modificabili/aggiungibili;
 * - applicazione di un preset a una DIETA (→ ProductRule, override per prodotto);
 * - PROPOSTE di regole nuove (rule_proposal) che poi implementiamo noi.
 */
@Injectable()
export class EngineRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
  ) {}

  private coerce(code: string, raw: unknown): { value: number | boolean; asString: string } {
    const rule = ENGINE_RULE_BY_CODE.get(code);
    if (!rule) throw new BadRequestException(`Regola sconosciuta: ${code}`);
    if (rule.kind === 'boolean') {
      const value = raw === true || raw === 'true' || raw === 1 || raw === '1';
      return { value, asString: value ? 'true' : 'false' };
    }
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) throw new BadRequestException(`Valore non numerico per ${code}`);
    if (rule.min != null && n < rule.min) throw new BadRequestException(`${code}: minimo ${rule.min}`);
    if (rule.max != null && n > rule.max) throw new BadRequestException(`${code}: massimo ${rule.max}`);
    return { value: n, asString: String(n) };
  }

  /** Catalogo completo: metadati regole + valore globale attuale + categorie. */
  async catalog() {
    const params = (await this.prisma.configParam.findMany({
      where: { key: { in: ENGINE_RULES.map((r) => r.code) } },
      select: { key: true, value: true },
    })) as { key: string; value: string }[];
    const byKey = new Map(params.map((p) => [p.key, p.value]));
    const rules = ENGINE_RULES.map((r) => {
      const raw = byKey.get(r.code);
      let global: number | boolean = r.default;
      if (raw != null) global = r.kind === 'boolean' ? raw === 'true' : Number(raw);
      return { ...r, global, isSet: raw != null };
    });
    return { categories: RULE_CATEGORIES, rules, baseRules: BASE_RULES };
  }

  /** Imposta il valore GLOBALE di una regola (config_param). Attivo subito sul motore.
   *  Se il parametro non è ancora a DB (es. soglie agente coi soli default nel codice) lo crea. */
  async setGlobal(code: string, raw: unknown, actorId: string) {
    const rule = ENGINE_RULE_BY_CODE.get(code)!;
    const { value, asString } = this.coerce(code, raw);
    const exists = await this.prisma.configParam.findUnique({ where: { key: code }, select: { key: true } });
    if (exists) {
      await this.configParams.update(code, asString, actorId); // invalida anche la cache
    } else {
      await this.prisma.configParam.create({
        data: { key: code, value: asString, type: rule.kind === 'boolean' ? 'boolean' : 'number', description: rule.label, updatedById: actorId } as never,
      });
    }
    await this.audit.log({ action: 'engine_rule.global.set', actorId, entityType: 'engine_rule', entityId: code, metadata: { value } });
    return { code, value };
  }

  // ---------- Preset suggeriti per tipo di nutrizione ----------

  listPresets() {
    return this.prisma.rulePreset.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  }

  private cleanRules(rules: Record<string, unknown> | undefined): Record<string, number | boolean> {
    const out: Record<string, number | boolean> = {};
    for (const [code, v] of Object.entries(rules ?? {})) {
      if (!ENGINE_RULE_BY_CODE.has(code)) continue; // ignora codici non nel catalogo
      out[code] = this.coerce(code, v).value;
    }
    return out;
  }

  async createPreset(
    input: { style: string; label: string; description?: string; regime?: string | null; objective?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    if (!input.style?.trim() || !input.label?.trim()) throw new BadRequestException('Stile ed etichetta obbligatori.');
    const created = await this.prisma.rulePreset.create({
      data: {
        style: input.style.trim(),
        label: input.label.trim(),
        description: input.description ?? null,
        regime: input.regime ?? null,
        objective: input.objective ?? null,
        rules: this.cleanRules(input.rules) as never,
        clinicalNotes: input.clinicalNotes ?? null,
        source: input.source ?? null,
        suggested: input.suggested ?? false, // creata a mano = adottata, non "suggerita da noi"
      } as never,
    });
    await this.audit.log({ action: 'engine_rule.preset.create', actorId, entityType: 'rule_preset', entityId: created.id });
    return created;
  }

  async updatePreset(
    id: string,
    input: { label?: string; description?: string; regime?: string | null; objective?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    const updated = await this.prisma.rulePreset.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.regime !== undefined ? { regime: input.regime || null } : {}),
        ...(input.objective !== undefined ? { objective: input.objective || null } : {}),
        ...(input.rules !== undefined ? { rules: this.cleanRules(input.rules) as never } : {}),
        ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes || null } : {}),
        ...(input.source !== undefined ? { source: input.source || null } : {}),
        // modificare una suggerita la marca come adottata (non più "suggerita da noi")
        suggested: input.suggested ?? false,
      },
    });
    await this.audit.log({ action: 'engine_rule.preset.update', actorId, entityType: 'rule_preset', entityId: id });
    return updated;
  }

  async deletePreset(id: string, actorId: string) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    await this.prisma.rulePreset.delete({ where: { id } });
    await this.audit.log({ action: 'engine_rule.preset.delete', actorId, entityType: 'rule_preset', entityId: id });
    return { ok: true };
  }

  /** Applica un preset a una dieta: scrive gli override per prodotto (ProductRule). */
  async applyPresetToDiet(presetId: string, dietId: string, actorId: string) {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const diet = await this.prisma.diet.findUnique({ where: { id: dietId }, select: { id: true } });
    if (!diet) throw new NotFoundException('Dieta non trovata.');
    const rules = (preset.rules ?? {}) as Record<string, number | boolean>;
    let applied = 0;
    for (const [code, value] of Object.entries(rules)) {
      const rule = ENGINE_RULE_BY_CODE.get(code);
      if (!rule) continue;
      const enabled = rule.kind === 'boolean' ? Boolean(value) : true;
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId, ruleCode: code } },
        create: { dietId, ruleCode: code, enabled, params: { value } as never },
        update: { enabled, params: { value } as never },
      });
      applied++;
    }
    await this.audit.log({ action: 'engine_rule.preset.apply', actorId, entityType: 'diet', entityId: dietId, metadata: { presetId, applied } });
    return { applied };
  }

  /**
   * GENERA una BOZZA di catalogo dal preset con l'AI: ricette per pasto, giornate
   * bilanciate, gruppi di equivalenza (alternative) e pre-tag allergeni. Tutto in BOZZA,
   * non attivo: il nutrizionista rivede e approva (R7) e conferma gli allergeni (R8)
   * prima che il motore lo usi. Ritorna i conteggi e l'id della dieta generata.
   */
  async generateCatalogFromPreset(presetId: string, actorId: string, requestedDays = 28) {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } })) as { id: string } | null;
    if (!staff) throw new BadRequestException('Serve un profilo nutrizionista per generare il catalogo.');

    const rules = (preset.rules ?? {}) as Record<string, number | boolean>;
    const regime = ['omnivore', 'vegetarian', 'vegan'].includes(preset.regime ?? '') ? (preset.regime as string) : 'omnivore';
    const protMin = Math.round(Number(rules.menu_daycombo_protein_min ?? 0.2) * 100);
    const protMax = Math.round(Number(rules.menu_daycombo_protein_max ?? 0.35) * 100);
    const kcalTol = Number(rules.menu_kcal_balance_tolerance_pct ?? 15);
    const targetKcal = Math.max(600, Math.min(4000, Math.round(Number(rules.menu_daycombo_kcal_target ?? 1500)) || 1500));
    const slots = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    const perSlot = 6;
    const days = Math.max(1, Math.min(60, Math.round(requestedDays) || 28));
    const aiDays = Math.min(days, 10); // l'AI produce giornate campione bilanciate; il resto lo completa il codice

    const regimeRule = regime === 'vegan' ? 'nessun alimento di origine animale' : regime === 'vegetarian' ? 'niente carne né pesce (uova/latticini sì)' : 'onnivoro';
    const system = 'Sei un nutrizionista esperto che prepara BOZZE di catalogo per una piattaforma nutrizionale. Rispondi SOLO con JSON valido, senza testo attorno. Niente claim medici. kcal e macro realistici e coerenti (le kcal ~ 4·(prot+carbo)+9·grassi).';
    const user =
`Genera una bozza di catalogo per la dieta "${preset.label}" (stile ${preset.style}, regime ${regime}${preset.objective ? `, obiettivo ${preset.objective}` : ''}).
Vincoli: proteine ${protMin}-${protMax}% delle kcal; giornata ~${targetKcal} kcal (tolleranza ±${kcalTol}%). Regime: ${regimeRule}.${preset.clinicalNotes ? ` Regole cliniche da rispettare: ${preset.clinicalNotes}` : ''}
Per OGNI pasto tra [${slots.join(', ')}] genera ${perSlot} ricette. Ogni ricetta: {"ref":"slug-univoco","slot":"<pasto>","name":"nome piatto","kcal":<int>,"ingredients":[{"name":"ingrediente","qty":<numero o null>,"unit":"g|ml|pz|q.b."}],"macros":{"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>},"cookingMethods":[{"type":"veloce|forno|meal_prep","steps":["passo 1","passo 2"]}]}.
Poi ${aiDays} giornate bilanciate ~${targetKcal} kcal: {"level":1,"dayIndex":<1..${aiDays}>,"meals":[{"slot":"<pasto>","ref":"<ref di una ricetta di quel pasto>"}]}.
Infine gruppi di equivalenza (alimenti intercambiabili a struttura simile): [{"name":"es. Pesci bianchi","items":["branzino","orata","merluzzo"]}].
Rispondi con: {"recipes":[...],"days":[...],"equivalenceGroups":[...]}`;

    const gen = await this.ai.generateJson<{ recipes?: unknown[]; days?: unknown[]; equivalenceGroups?: unknown[] }>(system, user, 12000);
    if (!gen) throw new BadRequestException(`Generazione non riuscita: ${this.ai.lastError ?? 'assistente AI non disponibile'}.`);
    const recipes = Array.isArray(gen.recipes) ? (gen.recipes as Record<string, unknown>[]) : [];
    if (recipes.length === 0) throw new BadRequestException('L\'AI non ha prodotto ricette valide: riprova.');

    const validSlots = new Set(slots);
    const diet = await this.prisma.diet.create({
      data: {
        name: `${preset.label} — bozza generata`,
        regime, style: preset.style, mealsPerDay: 5,
        levels: [{ level: 1, kcal: targetKcal }], options: {},
        authorId: staff.id, status: 'draft',
        objective: preset.objective ?? 'dimagrimento', clientVisible: false,
      } as never,
    });

    const refToId = new Map<string, string>();
    const bySlot = new Map<string, string[]>();
    let recCount = 0;
    for (const r of recipes) {
      const slot = validSlots.has(String(r.slot)) ? String(r.slot) : 'lunch';
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
      const allergens = suggestAllergens(ingredients).map((s) => s.allergen);
      const created = await this.prisma.recipe.create({
        data: {
          name: String(r.name ?? 'Ricetta generata').slice(0, 120),
          regime, mealSlot: slot as never,
          kcal: Math.max(0, Math.round(Number(r.kcal) || 0)),
          ingredients: ingredients as never,
          cookingMethods: (Array.isArray(r.cookingMethods) ? r.cookingMethods : []) as never,
          macros: (r.macros ?? undefined) as never,
          tags: [`gen:${preset.style}`],
          active: false, // BOZZA: non entra nel motore finché non approvata
          allergens, allergensReviewed: false,
        } as never,
      });
      if (r.ref) refToId.set(String(r.ref), created.id);
      const arr = bySlot.get(slot) ?? [];
      arr.push(created.id);
      bySlot.set(slot, arr);
      recCount++;
    }

    let dayCount = 0;
    // Giornate bilanciate dall'AI (dayIndex sequenziale, per evitare collisioni).
    for (const d of (Array.isArray(gen.days) ? gen.days : []) as Record<string, unknown>[]) {
      if (dayCount >= days) break;
      const meals = (Array.isArray(d.meals) ? d.meals : [])
        .map((m) => ({ slot: (m as Record<string, unknown>).slot, recipeId: refToId.get(String((m as Record<string, unknown>).ref)) }))
        .filter((m) => m.recipeId);
      if (meals.length === 0) continue;
      await this.prisma.dietDayTemplate.create({
        data: { dietId: diet.id, level: 1, dayIndex: dayCount + 1, meals: meals as never },
      });
      dayCount++;
    }
    // Completa fino ai giorni richiesti ruotando il pool di ricette per slot (varietà).
    while (dayCount < days) {
      const meals = slots
        .map((sl, k) => {
          const pool = bySlot.get(sl) ?? [];
          return pool.length ? { slot: sl, recipeId: pool[(dayCount + k) % pool.length] } : null;
        })
        .filter((mm): mm is { slot: string; recipeId: string } => !!mm);
      if (meals.length === 0) break;
      await this.prisma.dietDayTemplate.create({
        data: { dietId: diet.id, level: 1, dayIndex: dayCount + 1, meals: meals as never },
      });
      dayCount++;
    }

    let grpCount = 0;
    for (const g of (Array.isArray(gen.equivalenceGroups) ? gen.equivalenceGroups : []) as Record<string, unknown>[]) {
      const items = Array.isArray(g.items) ? g.items.map((x) => String(x)) : [];
      if (!g.name || items.length < 2) continue;
      await this.prisma.equivalenceGroup.create({
        data: { name: String(g.name).slice(0, 120), productId: diet.id, members: { items } as never, status: 'draft', version: 1 } as never,
      });
      grpCount++;
    }

    // Applica al prodotto le regole del preset (override per dieta).
    for (const [code, value] of Object.entries(rules)) {
      const rule = ENGINE_RULE_BY_CODE.get(code);
      if (!rule) continue;
      const enabled = rule.kind === 'boolean' ? Boolean(value) : true;
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId: diet.id, ruleCode: code } },
        create: { dietId: diet.id, ruleCode: code, enabled, params: { value } as never },
        update: { enabled, params: { value } as never },
      });
    }

    await this.audit.log({ action: 'engine_rule.preset.generate_catalog', actorId, entityType: 'diet', entityId: diet.id, metadata: { presetId, recipes: recCount, days: dayCount, groups: grpCount } });
    return { dietId: diet.id, dietName: diet.name, recipes: recCount, days: dayCount, groups: grpCount };
  }

  // ---------- Creazione e validazione (wizard) ----------

  private slotsForMeals(n: number): string[] {
    return n <= 3
      ? ['breakfast', 'lunch', 'dinner']
      : n === 4
        ? ['breakfast', 'lunch', 'afternoon_snack', 'dinner']
        : ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  }

  private async dietRecipeIds(dietId: string): Promise<string[]> {
    const templates = (await this.prisma.dietDayTemplate.findMany({ where: { dietId }, select: { meals: true } })) as { meals: unknown }[];
    const ids = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    return [...ids];
  }

  /** Avanzamento automatico della validazione di una dieta bozza. */
  async dietReviewStatus(dietId: string) {
    const diet = (await this.prisma.diet.findUnique({ where: { id: dietId }, include: { dayTemplates: { select: { meals: true } } } })) as
      | { id: string; name: string; status: string; mealsPerDay: number; dayTemplates: { meals: unknown }[] }
      | null;
    if (!diet) throw new NotFoundException('Dieta non trovata.');
    const needed = this.slotsForMeals(diet.mealsPerDay);
    const ids = new Set<string>();
    for (const t of diet.dayTemplates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    const recipes = ids.size
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: [...ids] } }, select: { id: true, active: true, allergensReviewed: true } })) as { id: string; active: boolean; allergensReviewed: boolean }[])
      : [];
    const daysComplete = diet.dayTemplates.filter((t) => {
      const meals = (Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[];
      return needed.every((sl) => meals.some((m) => m.slot === sl && !!m.recipeId));
    }).length;
    const groups = (await this.prisma.equivalenceGroup.findMany({ where: { productId: dietId }, select: { status: true } })) as { status: string }[];
    return {
      dietId: diet.id,
      name: diet.name,
      status: diet.status,
      mealsPerDay: diet.mealsPerDay,
      recipes: { total: recipes.length, active: recipes.filter((r) => r.active).length, allergensReviewed: recipes.filter((r) => r.allergensReviewed).length },
      days: { total: diet.dayTemplates.length, complete: daysComplete },
      groups: { total: groups.length, approved: groups.filter((g) => g.status === 'approved').length },
    };
  }

  /** Anteprima delle giornate generate (per il passo di validazione). */
  async dietPreview(dietId: string) {
    const templates = (await this.prisma.dietDayTemplate.findMany({ where: { dietId }, orderBy: { dayIndex: 'asc' }, select: { dayIndex: true, meals: true } })) as { dayIndex: number; meals: unknown }[];
    const ids = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    const recipes = ids.size
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, kcal: true } })) as { id: string; name: string; kcal: number }[])
      : [];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return templates.map((t) => ({
      dayIndex: t.dayIndex,
      meals: ((Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[]).map((m) => {
        const r = m.recipeId ? byId.get(m.recipeId) : undefined;
        return { slot: m.slot ?? '', recipe: r?.name ?? '—', kcal: r?.kcal ?? 0 };
      }),
    }));
  }

  /** Attiva tutte le ricette della dieta (fine revisione ricette). */
  async activateDietRecipes(dietId: string, actorId: string) {
    const ids = await this.dietRecipeIds(dietId);
    if (ids.length) await this.prisma.recipe.updateMany({ where: { id: { in: ids } }, data: { active: true } });
    await this.audit.log({ action: 'engine_rule.review.activate_recipes', actorId, entityType: 'diet', entityId: dietId, metadata: { count: ids.length } });
    return this.dietReviewStatus(dietId);
  }

  /** Segna gli allergeni come verificati per tutte le ricette della dieta. */
  async reviewDietAllergens(dietId: string, actorId: string) {
    const ids = await this.dietRecipeIds(dietId);
    if (ids.length) await this.prisma.recipe.updateMany({ where: { id: { in: ids } }, data: { allergensReviewed: true } });
    await this.audit.log({ action: 'engine_rule.review.allergens', actorId, entityType: 'diet', entityId: dietId, metadata: { count: ids.length } });
    return this.dietReviewStatus(dietId);
  }

  /** Conferma (approva) i gruppi di equivalenza collegati alla dieta. */
  async approveDietGroups(dietId: string, actorId: string) {
    await this.prisma.equivalenceGroup.updateMany({ where: { productId: dietId }, data: { status: 'approved' } });
    await this.audit.log({ action: 'engine_rule.review.approve_groups', actorId, entityType: 'diet', entityId: dietId });
    return this.dietReviewStatus(dietId);
  }

  // ---------- Proposte di regole nuove ----------

  listProposals() {
    return this.prisma.ruleProposal.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createProposal(input: { title?: string; text: string; dietId?: string | null }, actorId: string) {
    if (!input.text?.trim()) throw new BadRequestException('Descrivi la regola che vuoi proporre.');
    const created = await this.prisma.ruleProposal.create({
      data: { title: input.title?.trim() || null, text: input.text.trim(), dietId: input.dietId ?? null, proposedBy: actorId, status: 'pending' } as never,
    });
    await this.audit.log({ action: 'engine_rule.proposal.create', actorId, entityType: 'rule_proposal', entityId: created.id });
    return created;
  }

  async setProposalStatus(id: string, status: 'pending' | 'approved' | 'rejected', actorId: string) {
    const existing = await this.prisma.ruleProposal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proposta non trovata.');
    const updated = await this.prisma.ruleProposal.update({ where: { id }, data: { status } });
    await this.audit.log({ action: 'engine_rule.proposal.status', actorId, entityType: 'rule_proposal', entityId: id, metadata: { status } });
    return updated;
  }
}
