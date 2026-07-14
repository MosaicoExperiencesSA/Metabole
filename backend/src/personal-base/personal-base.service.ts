import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Slot principali su cui garantiamo la soglia minima di ricette sicure.
const MAIN_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
const SLOT_LABEL: Record<string, string> = {
  breakfast: 'colazione',
  lunch: 'pranzo',
  dinner: 'cena',
  morning_snack: 'spuntino',
  afternoon_snack: 'merenda',
};

// Compatibilità regime: cosa può mangiare un cliente di un dato regime (nesting standard).
const REGIME_OK: Record<string, string[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'vegetarian'],
  omnivore: ['vegan', 'vegetarian', 'omnivore'],
};

// Messaggio mostrato al cliente quando la base non è pronta (testo fornito dal socio).
const BLOCK_MESSAGE =
  'Stiamo perfezionando il tuo menu insieme al tuo nutrizionista per renderlo sicuro e su misura per te. Ti avvisiamo appena è pronto.';

export interface PersonalBaseResult {
  status: 'ready' | 'blocked';
  version?: number;
  dietId?: string;
  totalSafe?: number;
  perSlot?: Record<string, number>;
  reasons?: string[];
  message: string;
}

/**
 * R8 — Agente esclusioni: costruisce la BASE PERSONALIZZATA del cliente, cioè una copia
 * del pool di ricette del prodotto scelto, filtrata in sicurezza sugli allergeni CODIFICATI
 * del cliente (i 14 codici UE, gli stessi taggati sulle ricette).
 *
 * La base è certificabile in automatico solo se, per ogni pasto principale, restano almeno
 * `personal_base_min_recipes_per_slot` ricette sicure (attive + allergeni confermati dal
 * nutrizionista + regime compatibile + senza allergeni del cliente). Se una qualsiasi
 * condizione manca — o se il cliente ha dichiarato un'allergia FUORI dai 14 codici (testo
 * libero, che il motore non può abbinare ai tag) — la base NON è sicura in automatico: si
 * apre una segnalazione "Piano bloccato" al nutrizionista e la app mostra il messaggio di
 * attesa. La sicurezza viene prima della continuità del servizio.
 */
@Injectable()
export class PersonalBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  /** Stato della base personalizzata (per la app cliente). */
  async getStatus(clientId: string): Promise<PersonalBaseResult> {
    const blocked = await this.openBlock(clientId);
    const pool = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
    })) as unknown as { version: number; dietId: string; recipeIds: string[] } | null;

    if (blocked) {
      return {
        status: 'blocked',
        message: BLOCK_MESSAGE,
        ...(pool ? { version: pool.version, dietId: pool.dietId } : {}),
      };
    }
    if (!pool) return { status: 'blocked', message: BLOCK_MESSAGE };
    return {
      status: 'ready',
      version: pool.version,
      dietId: pool.dietId,
      totalSafe: pool.recipeIds.length,
      message: 'La tua base personalizzata è pronta.',
    };
  }

  /** Costruisce/aggiorna la base personalizzata del cliente. Idempotente (crea una nuova versione). */
  async buildPersonalBase(clientId: string): Promise<PersonalBaseResult> {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        regime: true,
        dietStyle: true,
        mealsPerDay: true,
        allergies: true,
        assignedNutritionistId: true,
      },
    })) as unknown as {
      regime: string | null;
      dietStyle: string | null;
      mealsPerDay: number | null;
      allergies: string[];
      assignedNutritionistId: string | null;
    } | null;
    if (!profile) throw new NotFoundException('Profilo non trovato: completa prima il questionario.');

    const minPerSlot = await this.configParams.getNumber('personal_base_min_recipes_per_slot', 3);
    const reasons: string[] = [];

    // 1. Allergie: separa i 14 codici UE dal testo libero (che va codificato a mano).
    const allergies = profile.allergies ?? [];
    const coded = allergies.filter((a) => EU_ALLERGEN_CODES.includes(a));
    const uncoded = allergies.filter((a) => !EU_ALLERGEN_CODES.includes(a));
    if (uncoded.length) reasons.push(`allergie da codificare a mano: ${uncoded.join(', ')}`);

    // 2. Prodotto (dieta) del cliente.
    const diet = await this.pickDiet(profile);
    if (!diet) {
      reasons.push('nessun prodotto attivo compatibile con regime/stile scelti');
      return this.block(clientId, profile.assignedNutritionistId, reasons);
    }

    // 3. Pool ricette della dieta (dai template) → filtro di sicurezza.
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId: diet.id },
      select: { meals: true },
    })) as unknown as { meals: { slot: string; recipeId: string }[] }[];
    const poolIds = new Set<string>();
    for (const t of templates) for (const m of t.meals ?? []) poolIds.add(m.recipeId);

    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: [...poolIds] }, active: true },
      select: { id: true, mealSlot: true, regime: true, allergens: true, allergensReviewed: true },
    })) as unknown as {
      id: string;
      mealSlot: string;
      regime: string;
      allergens: string[];
      allergensReviewed: boolean;
    }[];

    const regimeOk = REGIME_OK[profile.regime ?? 'omnivore'] ?? ['omnivore'];
    const codedSet = new Set(coded);
    const safe: { id: string; mealSlot: string }[] = [];
    let unreviewed = 0;
    for (const r of recipes) {
      if (!r.allergensReviewed) {
        unreviewed++; // ricetta non certificata → non è considerata sicura
        continue;
      }
      if (!regimeOk.includes(r.regime)) continue; // incompatibile col regime del cliente
      if ((r.allergens ?? []).some((a) => codedSet.has(a))) continue; // contiene un allergene del cliente
      safe.push({ id: r.id, mealSlot: r.mealSlot });
    }

    // 4. Conteggio per pasto principale + soglia minima.
    const perSlot: Record<string, number> = {};
    for (const slot of MAIN_SLOTS) perSlot[slot] = safe.filter((r) => r.mealSlot === slot).length;
    const shortSlots = MAIN_SLOTS.filter((s) => perSlot[s] < minPerSlot);
    if (shortSlots.length) {
      reasons.push(
        `pasti senza abbastanza ricette sicure (min ${minPerSlot}): ` +
          shortSlots.map((s) => `${SLOT_LABEL[s]} ${perSlot[s]}`).join(', '),
      );
    }

    // 5. Blocco o certificazione.
    if (reasons.length) return this.block(clientId, profile.assignedNutritionistId, reasons);

    const last = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId, dietId: diet.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })) as unknown as { version: number } | null;
    const version = (last?.version ?? 0) + 1;
    const recipeIds = safe.map((r) => r.id);
    await this.prisma.clientMenuPool.create({
      data: {
        clientId,
        dietId: diet.id,
        version,
        recipeIds,
        excluded: { codedAllergies: coded, unreviewedSkipped: unreviewed, perSlot } as never,
      },
    });
    await this.resolveBlocks(clientId);
    await this.audit.log({
      action: 'personal_base.built',
      actorId: clientId,
      entityType: 'client_menu_pool',
      metadata: { dietId: diet.id, version, total: recipeIds.length, perSlot },
    });
    return {
      status: 'ready',
      version,
      dietId: diet.id,
      totalSafe: recipeIds.length,
      perSlot,
      message: 'La tua base personalizzata è pronta.',
    };
  }

  // ---------- interni ----------

  /** Dieta del cliente: match esatto regime+pasti+stile tra i prodotti approvati, con fallback. */
  private async pickDiet(profile: {
    regime: string | null;
    dietStyle: string | null;
    mealsPerDay: number | null;
  }) {
    if (!profile.regime || !profile.mealsPerDay) return null;
    const base = {
      status: 'approved' as never,
      regime: profile.regime as never,
      mealsPerDay: profile.mealsPerDay,
    };
    const exact = await this.prisma.diet.findFirst({
      where: { ...base, ...(profile.dietStyle ? { style: profile.dietStyle as never } : {}) },
      orderBy: { approvedAt: 'desc' },
    });
    if (exact) return exact;
    return this.prisma.diet.findFirst({ where: base, orderBy: { approvedAt: 'desc' } });
  }

  private async openBlock(clientId: string): Promise<{ id: string } | null> {
    return (await this.prisma.escalation.findFirst({
      where: {
        clientId,
        source: 'engine' as never,
        status: { in: ['open', 'in_progress'] as never },
        reason: { contains: 'Piano bloccato' },
      },
      select: { id: true },
    })) as unknown as { id: string } | null;
  }

  private async block(
    clientId: string,
    nutritionistId: string | null | undefined,
    reasons: string[],
  ): Promise<PersonalBaseResult> {
    const already = await this.openBlock(clientId);
    if (!already) {
      await this.prisma.escalation.create({
        data: {
          clientId,
          reason: `Piano bloccato: base personalizzata non certificabile in automatico (${reasons
            .slice(0, 4)
            .join('; ')}). Serve la revisione del nutrizionista.`,
          source: 'engine' as never,
          assignedToId: nutritionistId ?? undefined,
        },
      });
      await this.audit.log({
        action: 'personal_base.blocked',
        actorId: clientId,
        entityType: 'escalation',
        metadata: { reasons },
      });
    }
    return { status: 'blocked', reasons, message: BLOCK_MESSAGE };
  }

  private async resolveBlocks(clientId: string): Promise<void> {
    await this.prisma.escalation.updateMany({
      where: {
        clientId,
        source: 'engine' as never,
        status: { in: ['open', 'in_progress'] as never },
        reason: { contains: 'Piano bloccato' },
      },
      data: { status: 'resolved' as never },
    });
  }
}
