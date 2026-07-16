import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { AgentState, DietAgentService } from '../diet-agent/diet-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../common/date-only';
import { DayComboService, RecipeInfo } from './day-combo.service';

interface Substitution {
  from: string;
  to: string;
  reason: string;
}
interface MealSnapshot {
  slot: string;
  recipeId: string;
  name: string;
  kcal: number;
  substitutions?: Substitution[];
}

// Mappa intolleranza/allergia → parole chiave negli ingredienti (v1; spostabile in config).
// Serve a riconoscere un ingrediente pericoloso anche quando il nome non coincide
// col termine dell'intolleranza (es. "lattosio" → "yogurt", "formaggio").
const INTOLERANCE_MAP: Record<string, string[]> = {
  lattosio: ['latte', 'yogurt', 'formaggio', 'burro', 'panna', 'mozzarella', 'ricotta', 'parmigiano'],
  glutine: ['pane', 'pasta', 'farro', 'orzo', 'couscous', 'grano', 'seitan', 'pizza', 'cracker'],
  'frutta secca': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'arachidi'],
  uova: ['uovo', 'uova', 'frittata', 'maionese'],
  pesce: ['pesce', 'tonno', 'salmone', 'branzino', 'orata', 'merluzzo', 'sgombro', 'acciughe'],
  crostacei: ['gambero', 'gamberi', 'scampi', 'aragosta', 'granchio', 'mazzancolle'],
  soia: ['soia', 'tofu', 'edamame'],
};

// Sostituzioni equivalenti sicure (v1; spostabile in config). Chiave = parola chiave
// nell'ingrediente → sostituto. Se un ingrediente escluso NON è qui e deriva da
// un'intolleranza, il piano si blocca (frutta secca/pesce/crostacei/uova: nessuna
// sostituzione sicura come cardine → blocco).
const SUBSTITUTION_MAP: Record<string, string> = {
  // lattosio
  latte: 'bevanda vegetale',
  yogurt: 'yogurt senza lattosio',
  formaggio: 'formaggio senza lattosio',
  mozzarella: 'mozzarella senza lattosio',
  ricotta: 'ricotta senza lattosio',
  burro: 'olio evo',
  panna: 'panna vegetale',
  parmigiano: 'parmigiano ben stagionato',
  // glutine
  pane: 'pane senza glutine',
  pasta: 'pasta senza glutine',
  farro: 'riso',
  orzo: 'riso',
  couscous: 'quinoa',
  cracker: 'gallette di riso',
  pizza: 'pizza senza glutine',
  // gusti non graditi comuni
  funghi: 'cavolfiore',
  cipolla: 'porro',
  peperoni: 'zucchine',
};

/**
 * Erogazione del menu (spec sez. 8):
 * - il menu diventa visibile menu_visible_days_before_start giorni prima dell'inizio piano;
 * - erogazione menu_days_delivered giorni alla volta;
 * - i giorni successivi si sbloccano DOPO il check-in del giorno.
 * La scelta dieta+livello qui è deterministica (match sul profilo);
 * dal M5 sarà il motore a decidere (source_rule_id).
 */
/** Override numerico per dieta: usa il valore per-dieta se numerico, altrimenti il globale. */
function pickNumOverride(overrides: Map<string, number | boolean>, code: string, global: number): number {
  const v = overrides.get(code);
  return typeof v === 'number' ? v : global;
}
/** Override booleano per dieta: usa il valore per-dieta se booleano, altrimenti il globale. */
function pickBoolOverride(overrides: Map<string, number | boolean>, code: string, global: boolean): boolean {
  const v = overrides.get(code);
  return typeof v === 'boolean' ? v : global;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly dietAgent: DietAgentService,
    private readonly dayCombo: DayComboService,
  ) {}

  /** Menu visibile della cliente; prova a erogare i giorni successivi se ha diritto. */
  async getMenu(clientId: string, from?: string, to?: string) {
    const delivered = await this.deliverIfEligible(clientId);
    const today = toDateOnly();

    const menuDays = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        visibleFrom: { lte: today }, // rispetta visible_from
        ...(from ? { date: { gte: toDateOnly(from) } } : {}),
        ...(to ? { date: { lte: toDateOnly(to) } } : {}),
      },
      orderBy: { date: 'asc' },
      take: 30,
    });
    const blocked = await this.dietBlock(clientId);
    return { delivered, days: menuDays, blocked };
  }

  /**
   * Eroga i prossimi N giorni se le condizioni sono soddisfatte.
   * Ritorna i giorni creati (vuoto se non c'era nulla da erogare).
   */
  async deliverIfEligible(clientId: string): Promise<string[]> {
    const [daysPerDelivery, visibleDaysBefore] = await Promise.all([
      this.configParams.getNumber('menu_days_delivered', 2),
      this.configParams.getNumber('menu_visible_days_before_start', 2),
    ]);
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId } });
    if (!profile?.planStartDate) return []; // senza data di inizio niente menu

    // Il piano alimentare si genera SOLO con abbonamento attivo (approvazione bonifico).
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
    });
    if (!activeSubscription) return [];

    // Periodo senza dieta attivo: erogazione sospesa (il monitoraggio continua).
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) return [];

    const today = toDateOnly();
    const start = toDateOnly(profile.planStartDate.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    if (today.getTime() < visibleFrom.getTime()) return []; // troppo presto

    const last = await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
    });

    let firstNewDate: Date;
    if (!last) {
      firstNewDate = start; // prima erogazione: dal giorno di inizio piano
    } else {
      const nextDate = new Date(last.date.getTime() + 86_400_000);
      // Ha già menu per oggi/futuro? Si sblocca solo col check-in di oggi.
      if (last.date.getTime() >= today.getTime()) {
        return [];
      }
      const checkinToday = await this.prisma.dailyCheckin.findUnique({
        where: { clientId_date: { clientId, date: today } },
      });
      if (!checkinToday) return []; // spec: sblocco dopo il check-in

      // Gate misure (Tracciamento_Dati §5): al 2° giorno di ogni ciclo le misure
      // sono obbligatorie. Finché non arrivano, il ciclo successivo resta "held".
      // L'avviso alla coach lo genera l'Alert engine (missing_measurements).
      if (await this.cycleNeedsMeasure(clientId, last, daysPerDelivery)) {
        return [];
      }
      firstNewDate = nextDate.getTime() > today.getTime() ? nextDate : today;
    }

    const diet = await this.pickDiet(profile);
    if (!diet) return [];

    // Il motore (M5) può aver deciso una variazione di livello per questa cliente.
    const decision = await this.prisma.engineDecision.findFirst({
      where: { clientId, flaggedForReview: false, date: { gte: new Date(today.getTime() - 2 * 86_400_000) } },
      orderBy: { createdAt: 'desc' },
    });
    const levelDelta = (decision?.action as { levelDelta?: number } | null)?.levelDelta ?? 0;
    const desiredLevel = Math.max(1, 1 + levelDelta);
    const sourceRuleId = decision?.ruleId ?? null;

    let templates = await this.prisma.dietDayTemplate.findMany({
      where: { dietId: diet.id, level: desiredLevel },
      orderBy: { dayIndex: 'asc' },
    });
    let level = desiredLevel;
    if (templates.length === 0 && desiredLevel !== 1) {
      // La dieta non ha quel livello: si resta sul livello base.
      templates = await this.prisma.dietDayTemplate.findMany({
        where: { dietId: diet.id, level: 1 },
        orderBy: { dayIndex: 'asc' },
      });
      level = 1;
    }
    if (templates.length === 0) return [];

    // Stato dell'agente (Metabole_Agente_AI_Dieta): modula la selezione (conforto →
    // gradimento, plateau → efficacia, pre-evento → proteine). Sicurezza e bilanciamento
    // restano prioritari.
    const agentState = await this.dietAgent.stateFor(clientId);
    // Override PER DIETA (ProductRule): il capo nutrizionista può sovrascrivere i valori
    // globali per una singola dieta dalla pagina "Regole motore". Caricati una volta e
    // applicati ai parametri del motore, con il globale come fallback.
    const overrides = await this.dietRuleOverrides(diet.id);
    // Contesto di scoring condiviso (pool ricette per slot + punteggio efficacia/gradimento).
    const ctx = await this.buildScoringContext(clientId, profile.regime, templates as never, agentState, diet.objective, overrides);
    const [kcalTolG, daycomboG, pMinG, pMaxG] = await Promise.all([
      this.configParams.getNumber('menu_kcal_balance_tolerance_pct', 15),
      this.configParams.getBool('menu_daycombo_enabled', false),
      this.configParams.getNumber('menu_daycombo_protein_min', 0.2),
      this.configParams.getNumber('menu_daycombo_protein_max', 0.45),
    ]);
    const kcalTolPct = pickNumOverride(overrides, 'menu_kcal_balance_tolerance_pct', kcalTolG);
    const daycomboEnabled = pickBoolOverride(overrides, 'menu_daycombo_enabled', daycomboG);
    const pMin = pickNumOverride(overrides, 'menu_daycombo_protein_min', pMinG);
    const pMax = pickNumOverride(overrides, 'menu_daycombo_protein_max', pMaxG);
    // Selettore per-slot (comportamento base, sempre disponibile come fallback).
    const selector = this.selectorFromContext(ctx, kcalTolPct / 100);

    // DayCombo (Fase 5 avanzata, opt-in): compone la giornata dal pool della dieta
    // approvata puntando alle kcal del livello. Attivo solo se `menu_daycombo_enabled`
    // e se il livello dichiara un target kcal in `Diet.levels`.
    const targetKcal = this.levelTargetKcal(diet.levels, level);
    const useDayCombo = daycomboEnabled && !!ctx && targetKcal > 0;
    const combo = useDayCombo && ctx ? this.dayComboPools(ctx) : null;

    // Prepara gli snapshot dei giorni del ciclo.
    const daySnapshots: { date: Date; meals: MealSnapshot[] }[] = [];
    for (let i = 0; i < daysPerDelivery; i++) {
      const date = new Date(firstNewDate.getTime() + i * 86_400_000);
      const daysSinceStart = Math.round((date.getTime() - start.getTime()) / 86_400_000);
      const template = templates[((daysSinceStart % templates.length) + templates.length) % templates.length];
      let chosen: { slot: string; recipeId: string }[] | null = null;
      if (combo) {
        chosen = this.dayCombo.compose({
          slots: combo.slots,
          poolBySlot: combo.poolBySlot,
          targetKcal,
          tolerancePct: kcalTolPct,
          dayIndex: daysSinceStart,
          proteinBand: { min: pMin, max: pMax },
        });
      }
      // Fallback: se DayCombo è spento o non trova una giornata nella banda, si usa
      // il template composto a mano con il selettore per-slot.
      if (!chosen) chosen = selector(template.meals as { slot: string; recipeId: string }[]);
      const meals = await this.snapshotMeals(chosen as never);
      daySnapshots.push({ date, meals });
    }

    // RIPETIZIONE BIGIORNALIERA (ProductRule `menu_repeat_two_days`, per dieta, off di
    // default). Se attiva per questa dieta: il giorno 2+ ripropone GLI STESSI ALIMENTI del
    // giorno 1 (stesso gruppo di equivalenza) ma con una ricetta/preparazione DIVERSA scelta
    // dal motore. Se per un pasto non c'è una gemella, resta il pasto già composto (nuovo).
    if (ctx && daySnapshots.length >= 2 && (await this.isRepeatTwoDaysActive(diet.id))) {
      const poolIds = new Set<string>();
      for (const set of ctx.slotPool.values()) for (const id of set) poolIds.add(id);
      const twinTolPct = await this.configParams.getNumber('repeat_twin_kcal_tolerance_pct', 15);
      const twin = await this.buildTwinFinder(diet.id, [...poolIds], ctx, twinTolPct / 100);
      const day0 = daySnapshots[0].meals;
      for (let i = 1; i < daySnapshots.length; i++) {
        const used = new Set<string>(); // niente due gemelle uguali nello stesso giorno
        const chosen = day0.map((m0) => {
          const t = twin(m0.recipeId, m0.slot, used);
          if (t) { used.add(t); return { slot: m0.slot, recipeId: t }; }
          // Fallback (decisione socio): pasto nuovo = quello già composto per questo slot.
          const orig = daySnapshots[i].meals.find((x) => x.slot === m0.slot);
          return { slot: m0.slot, recipeId: orig?.recipeId ?? m0.recipeId };
        });
        daySnapshots[i] = { date: daySnapshots[i].date, meals: await this.snapshotMeals(chosen as never) };
      }
    }

    // SICUREZZA + SOSTITUZIONE (motore §2/§7): controllo i piatti contro le esclusioni
    // della cliente. Se un ingrediente escluso ha una sostituzione sicura → la annoto sul
    // pasto (il piatto si eroga). Se un'INTOLLERANZA non è sostituibile → NON si eroga:
    // blocco + escalation al nutrizionista (la coach la vede via Alert engine).
    const { violations, subsByRecipe } = await this.evaluateMeals(clientId, daySnapshots.flatMap((d) => d.meals));
    if (violations.length) {
      await this.ensureDietBlockedEscalation(clientId, violations);
      return [];
    }
    for (const day of daySnapshots) {
      for (const m of day.meals) {
        const subs = subsByRecipe[m.recipeId];
        if (subs && subs.length) m.substitutions = subs;
      }
    }

    const created: string[] = [];
    for (const day of daySnapshots) {
      await this.prisma.menuDay.upsert({
        where: { clientId_date: { clientId, date: day.date } },
        create: {
          clientId,
          date: day.date,
          dietId: diet.id,
          level,
          meals: day.meals as never,
          visibleFrom: last ? today : visibleFrom,
          sourceRuleId,
        },
        update: {}, // mai sovrascrivere un giorno già erogato
      });
      created.push(day.date.toISOString().slice(0, 10));
    }
    await this.audit.log({
      action: 'menu.delivered',
      actorId: clientId,
      entityType: 'menu_day',
      metadata: { days: created, dietId: diet.id },
    });
    return created;
  }

  // ---------- Gate misure (misure obbligatorie al 2° giorno del ciclo) ----------

  /**
   * Stato del gate misure per l'app: se `blocking` è true, il client mostra il
   * popup bloccante finché non arriva la misura del ciclo corrente.
   */
  async measurementGate(clientId: string): Promise<{
    required: boolean;
    blocking: boolean;
    cycleDate: string | null;
  }> {
    const daysPerDelivery = await this.configParams.getNumber('menu_days_delivered', 2);
    const last = await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return { required: false, blocking: false, cycleDate: null };
    const needs = await this.cycleNeedsMeasure(clientId, last, daysPerDelivery);
    return { required: needs, blocking: needs, cycleDate: last.date.toISOString().slice(0, 10) };
  }

  /**
   * True se siamo al 2° giorno (o oltre) del ciclo corrente e manca ancora la
   * misura di quel ciclo. Il 2° giorno = la data più alta erogata (cycleEnd).
   */
  private async cycleNeedsMeasure(
    clientId: string,
    last: { date: Date },
    daysPerDelivery: number,
  ): Promise<boolean> {
    // Piani estate: in vacanza il popup misure NON blocca l'erogazione.
    const prof = await this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { travelState: true } });
    if ((prof as { travelState?: string | null } | null)?.travelState === 'in_vacanza') return false;
    const today = toDateOnly();
    const cycleEnd = toDateOnly(last.date.toISOString());
    if (today.getTime() < cycleEnd.getTime()) return false; // non ancora al 2° giorno
    const cycleStart = new Date(cycleEnd.getTime() - (daysPerDelivery - 1) * 86_400_000);
    const measure = await this.prisma.measurement.findFirst({
      where: { clientId, date: { gte: cycleStart } },
      select: { id: true },
    });
    return !measure;
  }

  // ---------- Selezione ricette per efficacia + gradimento ----------

  /**
   * Contesto di scoring condiviso: pool ricette per slot (dalla dieta approvata),
   * kcal/quota proteica per ricetta e la funzione punteggio
   * `w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)` modulata dallo stato
   * dell'agente. Usato sia dal selettore per-slot sia dalla composizione DayCombo.
   */
  /**
   * Override PER DIETA dalle ProductRule: mappa ruleCode → valore. Per le regole numeriche
   * il valore sta in `params.value`; per gli interruttori si usa `enabled`. Robusta anche
   * dove `findMany` non è disponibile (stub sandbox) → nessun override.
   */
  private async dietRuleOverrides(dietId: string): Promise<Map<string, number | boolean>> {
    const rows = (await this.prisma.productRule.findMany?.({
      where: { dietId },
      select: { ruleCode: true, enabled: true, params: true },
    })) ?? [];
    const m = new Map<string, number | boolean>();
    for (const r of rows as { ruleCode: string; enabled: boolean; params: unknown }[]) {
      const v = (r.params as { value?: unknown } | null)?.value;
      if (typeof v === 'number') m.set(r.ruleCode, v);
      else if (typeof v === 'boolean') m.set(r.ruleCode, v);
      else m.set(r.ruleCode, r.enabled);
    }
    return m;
  }

  /** True se la dieta ha la ProductRule `menu_repeat_two_days` attiva (o il default globale). */
  private async isRepeatTwoDaysActive(dietId: string): Promise<boolean> {
    const rule = (await this.prisma.productRule.findUnique({
      where: { dietId_ruleCode: { dietId, ruleCode: 'menu_repeat_two_days' } },
      select: { enabled: true },
    })) as { enabled: boolean } | null;
    if (rule) return rule.enabled;
    return this.configParams.getBool('menu_repeat_two_days_default', false);
  }

  /**
   * "Trova-gemella": data una ricetta del giorno 1, cerca nel pool dello slot una ricetta
   * DIVERSA il cui alimento principale è nello STESSO gruppo di equivalenza (approvato,
   * per questa dieta o globale) e con kcal in banda. Ritorna null se non c'è (→ fallback).
   */
  private async buildTwinFinder(
    dietId: string,
    poolIds: string[],
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number },
    tolerance: number,
  ): Promise<(recipeId: string, slot: string, exclude: Set<string>) => string | null> {
    // Alimento principale di ogni ricetta del pool (primo ingrediente).
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: poolIds } },
      select: { id: true, ingredients: true },
    })) as unknown as { id: string; ingredients: unknown }[];
    const primaryFood = new Map<string, string>();
    for (const r of recipes) {
      const items = Array.isArray(r.ingredients) ? (r.ingredients as { name?: string }[]) : [];
      const first = items.find((x) => x?.name)?.name;
      if (first) primaryFood.set(r.id, String(first).trim().toLowerCase());
    }
    // Gruppi di equivalenza APPROVATI (della dieta o globali). Finché il nutrizionista non
    // ne approva, il trova-gemella non trova nulla → la regola resta di fatto inerte (sicuro).
    const groups = (await this.prisma.equivalenceGroup.findMany({
      where: { status: 'approved', OR: [{ productId: dietId }, { productId: null }] } as never,
      select: { id: true, members: true },
    })) as unknown as { id: string; members: unknown }[];
    const foodGroup = (food: string): string | null => {
      for (const g of groups) {
        const items = (((g.members as { items?: string[] })?.items) ?? []).map((s) => String(s).trim().toLowerCase());
        if (items.some((it) => it === food || (it.length > 2 && (it.includes(food) || food.includes(it))))) return g.id;
      }
      return null;
    };
    const groupOfRecipe = (id: string): string | null => {
      const f = primaryFood.get(id);
      return f ? foodGroup(f) : null;
    };
    return (recipeId, slot, exclude) => {
      const g0 = groupOfRecipe(recipeId);
      if (!g0) return null;
      const k0 = ctx.kcalOf.get(recipeId) ?? 0;
      const lo = k0 * (1 - tolerance), hi = k0 * (1 + tolerance);
      const pool = ctx.slotPool.get(slot);
      if (!pool) return null;
      let best: string | null = null, bestScore = -Infinity;
      for (const cand of pool) {
        if (cand === recipeId || exclude.has(cand)) continue;
        if (groupOfRecipe(cand) !== g0) continue;
        const k = ctx.kcalOf.get(cand) ?? 0;
        if (k0 > 0 && (k < lo || k > hi)) continue;
        const s = ctx.score(cand);
        if (s > bestScore) { bestScore = s; best = cand; }
      }
      return best;
    };
  }

  private async buildScoringContext(
    clientId: string,
    regime: string | null,
    templates: { meals: { slot: string; recipeId: string }[] }[],
    state: AgentState = 'normale',
    objective: string = 'dimagrimento',
    overrides: Map<string, number | boolean> = new Map(),
  ): Promise<{
    slotPool: Map<string, Set<string>>;
    kcalOf: Map<string, number>;
    proteinOf: Map<string, number>;
    score: (id: string) => number;
  } | null> {
    if (!regime) return null;

    const [wEffBaseG, wGradBaseG, boostG, proteinBonusG, penaltyRepeatG, repeatWindowDaysG, maintWEffG] = await Promise.all([
      this.configParams.getNumber('menu_select_w_eff', 1),
      this.configParams.getNumber('menu_select_w_grad', 1),
      this.configParams.getNumber('menu_state_boost', 1.8),
      this.configParams.getNumber('menu_pre_event_protein_bonus', 0.6),
      // R11: penalità di ripetizione (varietà). Default 0 = disattivata (comportamento invariato).
      this.configParams.getNumber('menu_penalty_repeat', 0),
      this.configParams.getNumber('menu_repeat_window_days', 14),
      // R12: peso efficacia in MANTENIMENTO (default 0 = efficacia neutra).
      this.configParams.getNumber('menu_maintenance_w_eff', 0),
    ]);
    // Applica gli override PER DIETA (fallback al globale).
    const wEffBase = pickNumOverride(overrides, 'menu_select_w_eff', wEffBaseG);
    const wGradBase = pickNumOverride(overrides, 'menu_select_w_grad', wGradBaseG);
    const boost = pickNumOverride(overrides, 'menu_state_boost', boostG);
    const proteinBonus = pickNumOverride(overrides, 'menu_pre_event_protein_bonus', proteinBonusG);
    const penaltyRepeat = pickNumOverride(overrides, 'menu_penalty_repeat', penaltyRepeatG);
    const repeatWindowDays = pickNumOverride(overrides, 'menu_repeat_window_days', repeatWindowDaysG);
    const maintWEff = pickNumOverride(overrides, 'menu_maintenance_w_eff', maintWEffG);
    // Modulazione dei pesi in base allo stato dell'agente.
    let wEff = wEffBase;
    let wGrad = wGradBase;
    if (state === 'conforto') wGrad = wGradBase * boost; // menu più amati
    // plateau / post-evento / rientro → si spinge sull'efficacia (calo/recupero).
    else if (state === 'plateau' || state === 'post_evento' || state === 'rientro') wEff = wEffBase * boost;
    // R12 — modulazione da obiettivo della dieta: in MANTENIMENTO l'efficacia (appresa
    // sul calo peso) diventa neutra — niente spinta al deficit, nemmeno dagli stati che
    // la boosterebbero (plateau/post-evento/rientro); resta il gradimento (+ varietà).
    if (objective === 'mantenimento') wEff = maintWEff;
    const usePreEvent = state === 'pre_evento';

    // Pool candidati per slot (ricette usate dalla dieta per quello slot).
    const slotPool = new Map<string, Set<string>>();
    const poolIds = new Set<string>();
    for (const t of templates) {
      for (const m of (t.meals as { slot: string; recipeId: string }[]) ?? []) {
        if (!slotPool.has(m.slot)) slotPool.set(m.slot, new Set());
        slotPool.get(m.slot)!.add(m.recipeId);
        poolIds.add(m.recipeId);
      }
    }
    if (poolIds.size === 0) return null;

    const [recipes, weights, ratings] = await Promise.all([
      this.prisma.recipe.findMany({ where: { id: { in: [...poolIds] } }, select: { id: true, kcal: true, macros: true } }) as Promise<{ id: string; kcal: number; macros: unknown }[]>,
      this.prisma.menuWeight.findMany({ where: { clientId }, select: { recipeId: true, score: true, samples: true } }) as Promise<{ recipeId: string; score: number; samples: number }[]>,
      this.prisma.recipeRating.findMany({ where: { clientId }, select: { recipeId: true, stars: true } }) as Promise<{ recipeId: string; stars: number }[]>,
    ]);

    const kcalOf = new Map(recipes.map((r) => [r.id, r.kcal]));
    const effOf = new Map(weights.map((w) => [w.recipeId, w.samples > 0 ? w.score / w.samples : 0]));
    const starOf = new Map<string, number>();
    for (const r of ratings) starOf.set(r.recipeId, Math.max(starOf.get(r.recipeId) ?? 0, r.stars));

    // R11 — penalità di ripetizione: quante volte ogni ricetta è stata servita di recente
    // (finestra `menu_repeat_window_days`). Interroga solo se la penalità è attiva (>0).
    const recentCount = new Map<string, number>();
    if (penaltyRepeat > 0) {
      const since = new Date(Date.now() - repeatWindowDays * 86_400_000);
      const recentDays = (await this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: since } },
        select: { meals: true },
      })) as { meals: unknown }[];
      for (const d of recentDays) {
        for (const m of (d.meals as { recipeId?: string }[]) ?? []) {
          if (m?.recipeId) recentCount.set(m.recipeId, (recentCount.get(m.recipeId) ?? 0) + 1);
        }
      }
    }
    // Quota proteica (0..1) dai macro, per lo stato pre-evento e per DayCombo.
    const proteinOf = new Map<string, number>();
    for (const r of recipes) {
      const m = r.macros as { protein_g?: number; carbs_g?: number; fat_g?: number } | null;
      const tot = (m?.protein_g ?? 0) + (m?.carbs_g ?? 0) + (m?.fat_g ?? 0);
      proteinOf.set(r.id, tot > 0 ? (m?.protein_g ?? 0) / tot : 0);
    }

    const score = (id: string) =>
      wEff * (effOf.get(id) ?? 0) +
      wGrad * ((starOf.get(id) ?? 5) / 5) +
      (usePreEvent ? proteinBonus * (proteinOf.get(id) ?? 0) : 0) -
      penaltyRepeat * (recentCount.get(id) ?? 0); // R11: scoraggia la ripetizione (varietà)

    return { slotPool, kcalOf, proteinOf, score };
  }

  /**
   * Selettore per-slot: per ogni slot sceglie, TRA le ricette che la dieta approvata
   * usa per quello slot, quella col punteggio migliore, con vincolo kcal (±tol attorno
   * alla ricetta del template). A parità di punteggio resta la ricetta del template.
   */
  private selectorFromContext(
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number } | null,
    tol: number,
  ): (meals: { slot: string; recipeId: string }[]) => { slot: string; recipeId: string }[] {
    if (!ctx) return (meals) => meals;
    const { slotPool, kcalOf, score } = ctx;
    return (meals) =>
      meals.map((m) => {
        const pool = slotPool.get(m.slot);
        const baseKcal = kcalOf.get(m.recipeId);
        if (!pool || baseKcal == null) return m;
        const lo = baseKcal * (1 - tol);
        const hi = baseKcal * (1 + tol);
        let bestId = m.recipeId;
        let bestScore = score(m.recipeId);
        for (const cand of pool) {
          if (cand === m.recipeId) continue;
          const ck = kcalOf.get(cand);
          if (ck == null || ck < lo || ck > hi) continue; // vincolo bilanciamento
          const s = score(cand);
          if (s > bestScore + 1e-9) {
            bestScore = s;
            bestId = cand;
          }
        }
        return { slot: m.slot, recipeId: bestId };
      });
  }

  /** kcal obiettivo del livello dalla configurazione `Diet.levels` ([{level,kcal}]). */
  private levelTargetKcal(levels: unknown, level: number): number {
    const arr = (levels as { level?: number; kcal?: number }[] | null) ?? [];
    const hit = Array.isArray(arr) ? arr.find((l) => l?.level === level) : undefined;
    return hit?.kcal ?? 0;
  }

  /** Pool DayCombo (RecipeInfo per slot) dal contesto di scoring. */
  private dayComboPools(ctx: {
    slotPool: Map<string, Set<string>>;
    kcalOf: Map<string, number>;
    proteinOf: Map<string, number>;
    score: (id: string) => number;
  }): { slots: string[]; poolBySlot: Map<string, RecipeInfo[]> } {
    const slots = [...ctx.slotPool.keys()];
    const poolBySlot = new Map<string, RecipeInfo[]>();
    for (const [slot, ids] of ctx.slotPool) {
      poolBySlot.set(
        slot,
        [...ids].map((id) => ({
          id,
          kcal: ctx.kcalOf.get(id) ?? 0,
          proteinShare: ctx.proteinOf.get(id) ?? 0,
          score: ctx.score(id),
        })),
      );
    }
    return { slots, poolBySlot };
  }

  // ---------- Sicurezza: esclusioni (intolleranze/allergie) → blocco + escalation ----------

  /**
   * Valuta i piatti contro le esclusioni della cliente:
   * - `violations`: intolleranze NON sostituibili → il piano va bloccato;
   * - `subsByRecipe`: sostituzioni sicure da annotare sui pasti (per recipeId).
   * I cibi "non graditi" (dislikedFoods) si sostituiscono se possibile, ma non bloccano mai.
   */
  private async evaluateMeals(
    clientId: string,
    meals: MealSnapshot[],
  ): Promise<{ violations: string[]; subsByRecipe: Record<string, Substitution[]> }> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { intolerances: true, dislikedFoods: true },
    });
    const intolerances = ((profile?.intolerances ?? []) as string[]).map((s) => s.toLowerCase().trim()).filter(Boolean);
    const dislikes = ((profile?.dislikedFoods ?? []) as string[]).map((s) => s.toLowerCase().trim()).filter(Boolean);
    if (!intolerances.length && !dislikes.length) return { violations: [], subsByRecipe: {} };

    // Termini esclusi con la loro "causa" e se sono di sicurezza (bloccanti).
    const excluded: { keyword: string; reason: string; blocking: boolean }[] = [];
    for (const intol of intolerances) {
      for (const kw of INTOLERANCE_MAP[intol] ?? [intol]) excluded.push({ keyword: kw, reason: intol, blocking: true });
    }
    for (const d of dislikes) excluded.push({ keyword: d, reason: 'non gradito', blocking: false });

    const recipeIds = [...new Set(meals.map((m) => m.recipeId))];
    if (!recipeIds.length) return { violations: [], subsByRecipe: {} };
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: { id: true, name: true, ingredients: true },
    })) as { id: string; name: string; ingredients: unknown }[];

    const violations = new Set<string>();
    const subsByRecipe: Record<string, Substitution[]> = {};

    for (const r of recipes) {
      const ings = ((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').filter(Boolean);
      const subs: Substitution[] = [];
      for (const ing of ings) {
        const low = ing.toLowerCase();
        for (const ex of excluded) {
          if (!low.includes(ex.keyword)) continue;
          const repl = SUBSTITUTION_MAP[ex.keyword] ?? SUBSTITUTION_MAP[low];
          if (repl) {
            subs.push({ from: ing, to: repl, reason: ex.reason });
          } else if (ex.blocking) {
            violations.add(`${r.name}: incompatibile con "${ex.reason}"`);
          }
          break; // un solo match per ingrediente
        }
      }
      if (subs.length) subsByRecipe[r.id] = subs;
    }
    return { violations: [...violations], subsByRecipe };
  }

  /** Apre (una sola volta) un'escalation "piano bloccato" al nutrizionista. */
  private async ensureDietBlockedEscalation(clientId: string, reasons: string[]): Promise<void> {
    const already = await this.prisma.escalation.findFirst({
      where: { clientId, source: 'engine' as never, status: { in: ['open', 'in_progress'] as never }, reason: { contains: 'Piano bloccato' } },
      select: { id: true },
    });
    if (already) return;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionistId: true },
    });
    await this.prisma.escalation.create({
      data: {
        clientId,
        reason: `Piano bloccato: i menu contengono ingredienti incompatibili con le esclusioni della cliente (${reasons.slice(0, 4).join('; ')}). Serve una dieta personalizzata.`,
        source: 'engine' as never,
        category: 'diet_blocked' as never,
        assignedToId: profile?.assignedNutritionistId,
      },
    });
    await this.audit.log({
      action: 'menu.diet_blocked',
      actorId: clientId,
      entityType: 'escalation',
      metadata: { reasons },
    });
  }

  /** Stato "piano bloccato" per l'app cliente (messaggio rassicurante). */
  async dietBlock(clientId: string): Promise<{ active: boolean; reason: string | null }> {
    const esc = (await this.prisma.escalation.findFirst({
      where: { clientId, source: 'engine' as never, status: { in: ['open', 'in_progress'] as never }, reason: { contains: 'Piano bloccato' } },
      select: { reason: true },
    })) as { reason: string } | null;
    return {
      active: !!esc,
      reason: esc ? 'Stiamo sistemando il tuo piano con la nutrizionista.' : null,
    };
  }

  /** Dieta approvata più adatta al profilo (regime+pasti; stile se possibile). */
  private async pickDiet(profile: {
    regime: string | null;
    dietStyle: string | null;
    mealsPerDay: number | null;
  }) {
    if (!profile.regime || !profile.mealsPerDay) return null;
    const base = { status: 'approved' as never, regime: profile.regime as never, mealsPerDay: profile.mealsPerDay };
    const exact = await this.prisma.diet.findFirst({
      where: { ...base, ...(profile.dietStyle ? { style: profile.dietStyle as never } : {}) },
      orderBy: { approvedAt: 'desc' },
    });
    if (exact) return exact;
    return this.prisma.diet.findFirst({ where: base, orderBy: { approvedAt: 'desc' } });
  }

  private async snapshotMeals(
    templateMeals: { slot: string; recipeId: string }[],
  ): Promise<MealSnapshot[]> {
    const ids = templateMeals.map((m) => m.recipeId);
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, kcal: true },
    });
    const byId = new Map<string, { id: string; name: string; kcal: number }>(
      recipes.map((r: { id: string; name: string; kcal: number }) => [r.id, r]),
    );
    return templateMeals.map((m) => {
      const r = byId.get(m.recipeId);
      return { slot: m.slot, recipeId: m.recipeId, name: r?.name ?? '?', kcal: r?.kcal ?? 0 };
    });
  }

  // ---------- Valutazioni (segnale Gusto) ----------

  async rateRecipe(
    clientId: string,
    input: { recipeId: string; stars: number; tags?: string[]; date?: string },
  ) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id: input.recipeId } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    const date = toDateOnly(input.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi valutare un pasto futuro');
    }
    return this.prisma.recipeRating.upsert({
      where: { clientId_recipeId_date: { clientId, recipeId: input.recipeId, date } },
      create: { clientId, recipeId: input.recipeId, date, stars: input.stars, tags: input.tags ?? [] },
      update: { stars: input.stars, tags: input.tags ?? [] },
    });
  }

  /**
   * Pasti consumati (giorni di menu fino a oggi) non ancora valutati:
   * la spec chiede di riproporre la valutazione all'apertura dell'app.
   */
  async pendingRatings(clientId: string) {
    const today = toDateOnly();
    const since = new Date(today.getTime() - 3 * 86_400_000); // ultimi 3 giorni
    const [days, ratings] = await Promise.all([
      this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: since, lte: today } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.recipeRating.findMany({
        where: { clientId, date: { gte: since, lte: today } },
        select: { recipeId: true, date: true },
      }),
    ]);
    const rated = new Set(
      ratings.map((r: { recipeId: string; date: Date }) => `${r.recipeId}:${r.date.toISOString().slice(0, 10)}`),
    );
    const pending: { date: string; slot: string; recipeId: string; name: string }[] = [];
    for (const day of days) {
      const dateStr = day.date.toISOString().slice(0, 10);
      for (const meal of day.meals as unknown as MealSnapshot[]) {
        if (!rated.has(`${meal.recipeId}:${dateStr}`)) {
          pending.push({ date: dateStr, slot: meal.slot, recipeId: meal.recipeId, name: meal.name });
        }
      }
    }
    return pending;
  }

  // ---------- Lista spesa ----------

  /** Lista spesa aggregata dei giorni erogati nell'intervallo (default: da oggi in avanti). */
  async shoppingList(clientId: string, from?: string, to?: string) {
    const today = toDateOnly();
    const days = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        visibleFrom: { lte: today },
        date: { gte: from ? toDateOnly(from) : today, ...(to ? { lte: toDateOnly(to) } : {}) },
      },
      orderBy: { date: 'asc' },
      take: 7,
    });
    if (days.length === 0) {
      return { dateFrom: null, dateTo: null, items: [] };
    }
    const dateFrom = days[0].date;
    const dateTo = days[days.length - 1].date;

    const existing = await this.prisma.shoppingList.findUnique({
      where: { clientId_dateFrom_dateTo: { clientId, dateFrom, dateTo } },
    });
    if (existing) return existing;

    // Aggrega gli ingredienti delle ricette dei giorni.
    const recipeIds = [
      ...new Set(days.flatMap((d: { meals: unknown }) => (d.meals as MealSnapshot[]).map((m) => m.recipeId))),
    ];
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds as string[] } },
      select: { id: true, ingredients: true },
    });
    const byId = new Map(recipes.map((r: { id: string; ingredients: unknown }) => [r.id, r.ingredients]));
    const aggregate = new Map<string, { name: string; qty: number | null; unit: string | null; checked: boolean }>();
    for (const day of days) {
      for (const meal of day.meals as unknown as MealSnapshot[]) {
        const ingredients = (byId.get(meal.recipeId) ?? []) as { name: string; qty?: number; unit?: string }[];
        for (const ing of ingredients) {
          const key = `${ing.name.toLowerCase()}|${ing.unit ?? ''}`;
          const current = aggregate.get(key);
          if (current) {
            if (current.qty !== null && ing.qty) current.qty += ing.qty;
          } else {
            aggregate.set(key, {
              name: ing.name,
              qty: ing.qty ?? null,
              unit: ing.unit ?? null,
              checked: false,
            });
          }
        }
      }
    }
    return this.prisma.shoppingList.create({
      data: {
        clientId,
        dateFrom,
        dateTo,
        items: [...aggregate.values()] as never,
      },
    });
  }

  /** Spunta/despunta un elemento della lista. */
  async checkItem(clientId: string, listId: string, itemName: string, checked: boolean) {
    const list = await this.prisma.shoppingList.findFirst({ where: { id: listId, clientId } });
    if (!list) throw new NotFoundException('Lista spesa non trovata');
    const items = (list.items as { name: string; checked: boolean }[]).map((item) =>
      item.name.toLowerCase() === itemName.toLowerCase() ? { ...item, checked } : item,
    );
    return this.prisma.shoppingList.update({ where: { id: listId }, data: { items: items as never } });
  }
}
