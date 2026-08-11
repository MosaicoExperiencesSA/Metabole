import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EU_ALLERGEN_CODES, suggestAllergens } from './allergens';
import { giornateComplete } from './giornate-complete';
import { settimaneDiTutte, utilizzoDelleRicette, type UsoInDieta } from './utilizzo-ricette';
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
    private readonly notifications: NotificationsService,
  ) {}

  private readonly logger = new Logger(CatalogService.name);

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
   * Ritorna le diete del CATALOGO (status=approved, validate dal nutrizionista),
   * una card per dieta, nel formato che il sito si aspetta: name (preferisce
   * clientName), description (+ alias `desc` usato dal carosello), highlights, tag.
   * Il contatore "percorsi gestiti" della home (publicStats.methods) conta queste.
   * Data-driven: aggiungere/approvare una dieta NON richiede deploy del sito.
   */
  async publicPaths() {
    const [diets, presets] = await Promise.all([
      this.prisma.diet.findMany({
        where: { status: 'approved', siteVisible: true } as never,
        orderBy: { createdAt: 'asc' },
      }),
      // Note cliniche per stile dai preset regole (adottati prima dei suggeriti).
      this.prisma.rulePreset.findMany({
        orderBy: [{ suggested: 'asc' }, { sortOrder: 'asc' }] as never,
        select: { style: true, clinicalNotes: true } as never,
      }),
    ]);
    const notesByStyle = new Map<string, string>();
    for (const p of presets as unknown as Array<Record<string, unknown>>) {
      const st = String(p.style);
      const notes = (p.clinicalNotes as string) ?? null;
      if (notes && !notesByStyle.has(st)) notesByStyle.set(st, notes);
    }
    type SitePath = {
      style: string; name: string; clientName: string | null;
      description: string | null; desc: string | null; clinicalNotes: string | null;
      highlights: string[]; objective: string; seasonalTag: string | null;
    };
    // UNA card per FAMIGLIA (stesso nome+stile): le varianti regime × obiettivo sono
    // dettagli interni del motore, sul sito il percorso è uno. Tra le varianti si
    // tengono i campi compilati migliori (clientName/descrizione/highlights).
    const byFamily = new Map<string, SitePath>();
    for (const d of diets as unknown as Array<Record<string, unknown>>) {
      const style = String(d.style);
      const famKey = `${String(d.name)}\u0000${style}`;
      const clientName = (d.clientName as string) ?? null;
      const description = (d.clientDescription as string) ?? null;
      const clinicalNotes = notesByStyle.get(style) ?? null;
      const highlights = Array.isArray(d.highlights) ? (d.highlights as string[]) : [];
      const existing = byFamily.get(famKey);
      if (!existing) {
        byFamily.set(famKey, {
          style,
          name: clientName ?? String(d.name),
          clientName,
          description,
          // alias letto dal carosello del sito: sotto il nome, in piccolo, mostra
          // la descrizione cliente se compilata, altrimenti le note cliniche del preset.
          desc: description ?? clinicalNotes,
          clinicalNotes,
          highlights,
          objective: (d.objective as string) ?? 'dimagrimento',
          seasonalTag: (d.seasonalTag as string) ?? null,
        });
      } else {
        // Completa i buchi con i dati delle altre varianti della stessa famiglia.
        if (!existing.clientName && clientName) { existing.clientName = clientName; existing.name = clientName; }
        if (!existing.description && description) { existing.description = description; existing.desc = description; }
        if (!existing.highlights.length && highlights.length) existing.highlights = highlights;
        if (!existing.seasonalTag && d.seasonalTag) existing.seasonalTag = d.seasonalTag as string;
      }
    }
    return [...byFamily.values()];
  }

  /**
   * Numeri per il SITO pubblico (data-stats-endpoint): { years, clients, reached, methods }.
   * I contatori partono dalla BASE STORICA di Mosaico Experiences SA (config_param, mai
   * hardcodata: `stats_clients_base`, `stats_reached_base`, modificabili dal backoffice)
   * e crescono con l'attività reale — +1 cliente per abbonamento attivato, +1 raggiunto
   * per lead nel CRM. Rif: Metabole_Handoff_Contatori_Stats.md.
   *  - years   → anni di attività (config `site_stats_years`; omesso se 0/non impostato)
   *  - clients → `stats_clients_base` + n° abbonamenti attivati (startDate valorizzata)
   *  - reached → `stats_reached_base` + n° lead nel CRM
   *  - methods → n° diete APPROVATE nel catalogo Diete, coerente con /public/paths
   */
  async publicStats() {
    // Persone RAGGIUNTE = tutte le schede CRM (lead + clienti + clienti storici).
    // Clienti SEGUITI = clienti (acquisto con Metabole → stage 'paid') + clienti storici
    //   (pagamento pregresso, historicalPaidCents > 0). L'OR deduplica in automatico.
    const [paths, realReached, realClients] = await Promise.all([
      this.publicPaths(),
      this.prisma.crmRecord.count(),
      this.prisma.crmRecord.count({
        where: { OR: [{ stage: 'paid' }, { historicalPaidCents: { gt: 0 } }] },
      }),
    ]);

    const [years, clientsBase, reachedBase] = await Promise.all([
      this.config.getNumber('site_stats_years', 0),
      this.config.getNumber('stats_clients_base', 0),
      this.config.getNumber('stats_reached_base', 0),
    ]);
    const stats: Record<string, number> = {
      clients: clientsBase + realClients,
      reached: reachedBase + realReached,
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
        fasting: dto.fasting ?? false,
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

  /** Elimina una dieta e i suoi giorni/regole. Bloccata se già usata in menu erogati. */
  async deleteDiet(userId: string, id: string) {
    const diet = await this.prisma.diet.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!diet) throw new NotFoundException('Dieta non trovata');
    const usedInMenus = await this.prisma.menuDay.count({ where: { dietId: id } });
    if (usedInMenus > 0) {
      throw new BadRequestException(`Impossibile eliminare "${diet.name}": è usata in ${usedInMenus} menu già erogati.`);
    }
    await this.prisma.$transaction([
      this.prisma.dietDayTemplate.deleteMany({ where: { dietId: id } }),
      this.prisma.productRule.deleteMany({ where: { dietId: id } }),
      this.prisma.diet.delete({ where: { id } }),
    ]);
    await this.audit.log({ action: 'catalog.diet.delete', actorId: userId, entityType: 'diet', entityId: id, metadata: { name: diet.name } });
    return { ok: true };
  }

  /** Rinomina la dieta (solo il nome). Consentito anche su diete approvate:
   *  non tocca i menu né lo stato, cambia solo l'etichetta. */
  async renameDiet(userId: string, id: string, name: string) {
    const clean = name.trim().slice(0, 120);
    if (clean.length < 2) throw new BadRequestException('Nome troppo corto.');
    await this.getDiet(id); // 404 se non esiste
    const updated = await this.prisma.diet.update({ where: { id }, data: { name: clean } });
    await this.audit.log({ action: 'catalog.diet.rename', actorId: userId, entityType: 'diet', entityId: id, metadata: { name: clean } });
    return updated;
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
    // Gate R8: si può rendere visibile ai clienti solo un prodotto "sicuro".
    if ((dto as { clientVisible?: boolean }).clientVisible === true) {
      await this.assertActivatable(id);
    }
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

  /**
   * Gate di sicurezza R8: un prodotto è attivabile ai clienti (clientVisible=true) solo se
   * TUTTE le ricette dei suoi menu hanno gli allergeni CONFERMATI dal nutrizionista e c'è
   * almeno un gruppo di equivalenza approvato (materia prima delle sostituzioni).
   */
  private async assertActivatable(dietId: string) {
    const templates = await this.prisma.dietDayTemplate.findMany({ where: { dietId } });
    const recipeIds = [
      ...new Set(
        templates.flatMap((t: { meals?: unknown }) =>
          Array.isArray(t.meals)
            ? (t.meals as Array<{ recipeId?: string }>).map((m) => m.recipeId).filter((x): x is string => !!x)
            : [],
        ),
      ),
    ];
    if (recipeIds.length > 0) {
      const notReviewed = await this.prisma.recipe.count({
        where: { id: { in: recipeIds }, allergensReviewed: false } as never,
      });
      if (notReviewed > 0) {
        throw new BadRequestException(
          `Prodotto non attivabile: ${notReviewed} ricette non hanno ancora gli allergeni confermati dal nutrizionista.`,
        );
      }
    }
    const approvedGroups = await this.prisma.equivalenceGroup.count({ where: { status: 'approved' } as never });
    if (approvedGroups === 0) {
      throw new BadRequestException('Prodotto non attivabile: nessun gruppo di equivalenza approvato.');
    }

    /**
     * NEL MENU CI DEV'ESSERE DA MANGIARE. Sembra ovvio e non lo era.
     *
     * Il gate controllava gli allergeni e i gruppi di equivalenza — cose serie — e non
     * controllava che le giornate avessero tutti i pasti. Il 9/8 è saltata fuori una dieta
     * pubblicata e **visibile alle clienti** con ventotto giornate, cinque colazioni, **zero
     * pranzi e zero cene**: una persona che apre l'app all'ora di pranzo e non trova niente.
     * Nessun errore da nessuna parte, perché nessuno guardava.
     */
    const diet = (await this.prisma.diet.findUnique({
      where: { id: dietId },
      select: { mealsPerDay: true, fasting: true },
    })) as { mealsPerDay: number; fasting: boolean | null } | null;
    if (diet) {
      // La regola sta in `giornate-complete.ts` (11/8), perché la usa anche l'EROGAZIONE — che
      // finora non se l'era mai chiesta. Qui si controlla una volta sola, quando qualcuno rende la
      // dieta visibile; ma una dieta può diventare incompleta DOPO, per mano del generatore o di
      // uno script, e un controllo che si fa una volta sola non se ne accorge per costruzione.
      const { monche } = giornateComplete(templates as { meals?: unknown }[], diet);
      if (monche > 0) {
        throw new BadRequestException(
          `Prodotto non attivabile: ${monche} giornate su ${templates.length} non hanno tutti i pasti previsti. ` +
          'Completa le settimane prima di renderla visibile alle clienti.',
        );
      }
    }
  }

  /**
   * Alla pubblicazione/approvazione rende la dieta visibile alle clienti (schermo 16),
   * ma SOLO se supera il gate di sicurezza R8. Non solleva: se il gate fallisce lascia
   * la dieta nascosta e restituisce il motivo, così l'approvazione non viene bloccata.
   */
  private async tryMakeClientVisible(id: string): Promise<{ clientVisible: boolean; visibilityWarning?: string }> {
    try {
      await this.assertActivatable(id);
    } catch (e) {
      return {
        clientVisible: false,
        visibilityWarning: e instanceof Error ? e.message : 'Dieta non ancora attivabile ai clienti.',
      };
    }
    await this.prisma.diet.update({ where: { id }, data: { clientVisible: true } as never });
    return { clientVisible: true };
  }

  /** Elimina una ricetta e le sue valutazioni/pesi appresi. */
  async deleteRecipe(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    await this.prisma.$transaction([
      this.prisma.recipeRating.deleteMany({ where: { recipeId: id } }),
      this.prisma.menuWeight.deleteMany({ where: { recipeId: id } }),
      this.prisma.recipe.delete({ where: { id } }),
    ]);
    await this.audit.log({ action: 'catalog.recipe.delete', actorId: userId, entityType: 'recipe', entityId: id, metadata: { name: recipe.name } });
    return { ok: true };
  }

  // ---------- Allergeni ricette (R8) ----------

  /** Pre-tag assistito: suggerisce gli allergeni dagli ingredienti + stato attuale. */
  async recipeAllergenSuggestions(id: string) {
    const recipe = await this.getRecipe(id);
    return {
      recipeId: recipe.id,
      name: recipe.name,
      current: (recipe as { allergens?: string[] }).allergens ?? [],
      reviewed: (recipe as { allergensReviewed?: boolean }).allergensReviewed ?? false,
      suggestions: suggestAllergens(recipe.ingredients),
    };
  }

  /** Il nutrizionista CONFERMA gli allergeni della ricetta (→ reviewed=true). */
  async setRecipeAllergens(userId: string, id: string, allergens: string[]) {
    await this.getRecipe(id);
    const clean = [...new Set(allergens)].filter((a) => EU_ALLERGEN_CODES.includes(a));
    const updated = await this.prisma.recipe.update({
      where: { id },
      data: { allergens: clean, allergensReviewed: true } as never,
    });
    await this.audit.log({
      action: 'catalog.recipe.allergens.set',
      actorId: userId,
      entityType: 'recipe',
      entityId: id,
      metadata: { count: clean.length },
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
    await this.notifyHeadOfReview(diet.authorId, updated.name);
    return updated;
  }

  /** Avvisa il capo nutrizionista che una dieta è in attesa di approvazione. */
  private async notifyHeadOfReview(authorStaffId: string | null, dietName: string): Promise<void> {
    let targets: string[] = [];
    if (authorStaffId) {
      const author = await this.prisma.staff.findUnique({
        where: { id: authorStaffId },
        select: { headNutritionist: { select: { userId: true } } },
      });
      if (author?.headNutritionist?.userId) targets = [author.headNutritionist.userId];
    }
    if (targets.length === 0) {
      // Nessun capo diretto impostato: avvisa tutti i capi nutrizionisti.
      const heads = await this.prisma.user.findMany({
        where: { role: 'head_nutritionist', deletedAt: null } as never,
        select: { id: true },
      });
      targets = heads.map((h: { id: string }) => h.id);
    }
    for (const uid of targets) {
      await this.notifications
        .notify({
          userId: uid,
          type: 'diet_review_requested',
          title: 'Dieta da approvare',
          body: `La dieta "${dietName}" è in attesa di approvazione.`,
          payload: {},
        })
        .catch(() => undefined);
    }
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
    await this.notifyDietApproved(diet.authorId, staff.id, updated.name);
    const vis = await this.tryMakeClientVisible(id);
    return { ...updated, clientVisible: vis.clientVisible, visibilityWarning: vis.visibilityWarning };
  }

  /**
   * Pubblicazione diretta del CAPO: quando è il responsabile stesso a generare e
   * validare la dieta non serve la revisione di un terzo → draft/rejected/in_review
   * → approved in un colpo solo. Consapevolmente SENZA il blocco "autore" di
   * approveDiet (per i coach sotto resta il flusso submit → approve del capo).
   */
  async publishDiet(userId: string, id: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (!['draft', 'rejected', 'in_review'].includes(diet.status)) {
      throw new BadRequestException(`La dieta è in stato ${diet.status}: non pubblicabile`);
    }
    if (diet.dayTemplates.length === 0) {
      throw new BadRequestException('Aggiungi almeno un template giornata prima di pubblicare');
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'approved', approvedById: staff.id, approvedAt: new Date() },
    });
    await this.audit.log({
      action: 'catalog.diet.publish',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    await this.notifyDietApproved(diet.authorId, staff.id, updated.name);
    const vis = await this.tryMakeClientVisible(id);
    return { ...updated, clientVisible: vis.clientVisible, visibilityWarning: vis.visibilityWarning };
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

  /**
   * Archivia una dieta del catalogo (anche approvata/pubblicata): la porta in stato
   * 'rejected' — usato qui come "archivio", così NON serve una migrazione — e ne azzera
   * la visibilità. Effetto: esce dai menu (pickDiet richiede 'approved'), dallo schermo 16
   * e dal sito. Serve ad ALLINEARE il catalogo quando si toglie un'opzione dal generatore
   * (es. le varianti 3/5 pasti create per errore sotto "Digiuno intermittente").
   */
  async archiveDiet(userId: string, id: string) {
    await this.staffOf(userId); // solo staff
    const diet = await this.getDiet(id);
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'rejected', clientVisible: false, siteVisible: false, approvedById: null, approvedAt: null },
    });
    await this.audit.log({
      action: 'catalog.diet.archive',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
      metadata: { from: diet.status },
    });
    return updated;
  }

  // ---------- Ricette ----------

  /**
   * Le ricette usate dalle giornate di una dieta. Il legame vive SOLO qui: `Recipe` non ha un
   * `dietId` — la stessa ricetta serve a più famiglie, ed è voluto — è la giornata a puntare
   * alla ricetta (`DietDayTemplate.meals` = `[{slot, recipeId}]`, un JSON che il database non sa
   * interrogare). Quindi si leggono le giornate e si estraggono gli id qui.
   */
  private async recipeIdsDiDieta(dietId: string): Promise<string[]> {
    return [...(await this.settimanePerRicetta(dietId)).keys()];
  }

  /**
   * IN QUALI SETTIMANE è usata ogni ricetta di questa dieta.
   *
   * Richiesta di Simone dell'11/8: «mettimi il filtro anche per settimana, perché forse ho capito dove
   * sta l'anomalia: il generatore le mette tutte nella prima settimana». L'osservazione nasceva dal tag
   * `sett:1` che compare su tutte le ricette di una dieta — e quel tag **non dice quello che sembra
   * dire**: viene scritto alla nascita della ricetta e registra in quale *generazione* è stata creata,
   * non in quale settimana del ciclo è finita. Se la settimana 2 riusa un piatto avanzato dalla
   * generazione della settimana 1 (cosa voluta: sono piatti già pagati e già riletti), quel piatto
   * porta `sett:1` per sempre pur stando nella settimana 2.
   *
   * Quindi la settimana vera si legge da un posto solo, quello che decide davvero: la **giornata** che
   * usa la ricetta. `dayIndex` 1-7 = settimana 1, 8-14 = settimana 2, e così via. Una ricetta può
   * comparire in più settimane, ed è un'informazione che conta — è il modo di vedere a occhio se il
   * ciclo si ripete invece di allungarsi.
   */
  private async settimanePerRicetta(dietId: string): Promise<Map<string, number[]>> {
    const giorni = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId },
      select: { dayIndex: true, meals: true },
      orderBy: { dayIndex: 'asc' },
    })) as { dayIndex: number; meals: unknown }[];
    const out = new Map<string, Set<number>>();
    for (const g of giorni) {
      const settimana = Math.max(1, Math.ceil((g.dayIndex ?? 1) / 7));
      const pasti = (Array.isArray(g.meals) ? g.meals : []) as { recipeId?: unknown }[];
      for (const m of pasti) {
        if (typeof m?.recipeId !== 'string' || !m.recipeId) continue;
        const viste = out.get(m.recipeId) ?? new Set<number>();
        viste.add(settimana);
        out.set(m.recipeId, viste);
      }
    }
    return new Map([...out].map(([id, viste]) => [id, [...viste].sort((a, b) => a - b)]));
  }

  /**
   * Elenco ricette per il backoffice. **I filtri girano sul DATABASE, non sulle righe caricate.**
   *
   * Prima la pagina scaricava le prime 1000 righe del regime e filtrava lì: con le sole ricette
   * vegetariane già oltre quel tetto (verificato il 6/8), filtrare voleva dire cercare dentro una
   * fetta arbitraria del catalogo — e una ricetta che c'è ma non compare è peggio di un errore,
   * perché chi cerca conclude che non esiste e la ricrea.
   *
   * Ritorna `{ items, total, troncato }`: `total` è il conteggio VERO di quante ricette
   * corrispondono ai filtri, anche quando `items` è tagliato dal tetto. Così la pagina può dire
   * "50 su 1.240" invece di far credere che il catalogo sia grande quanto quello che si vede.
   *
   * ⚠️ Due filtri restano fuori dal database: **dieta** e **settimana**. Non sono colonne di
   * `Recipe` — si calcolano dalle giornate — quindi li applica la pagina sulle righe ricevute, e
   * quando il risultato è troncato lo dice a chiare lettere. (Fino all'11/8 il filtro fuori dal
   * database era quello sui **tag**, che aveva lo stesso limite e in più cercava dentro etichette
   * che dicono dov'è *nata* la ricetta, non dov'è usata.)
   */
  async listRecipes(filter: {
    regime?: string; mealSlot?: string; q?: string; includeInactive?: boolean; dietId?: string;
    difficulty?: string; season?: string; stato?: string; kcalMin?: number; kcalMax?: number;
  }): Promise<{ items: unknown[]; total: number; troncato: boolean }> {
    // Con `dietId` l'elenco è quello della SINGOLA dieta: il tetto non lo tocca mai, perché una
    // dieta ha decine di ricette, non migliaia.
    // Con `dietId` si sa anche IN QUALI SETTIMANE ogni ricetta è usata: serve al filtro per settimana
    // (11/8), e si legge dalle giornate perché il tag `sett:N` dice un'altra cosa (vedi
    // `settimanePerRicetta`).
    const settimane = filter.dietId ? await this.settimanePerRicetta(filter.dietId) : null;
    const soloDieta = settimane ? [...settimane.keys()] : null;
    if (soloDieta && soloDieta.length === 0) return { items: [], total: 0, troncato: false };

    const kcal: Record<string, number> = {};
    if (Number.isFinite(filter.kcalMin as number)) kcal.gte = filter.kcalMin as number;
    if (Number.isFinite(filter.kcalMax as number)) kcal.lte = filter.kcalMax as number;

    // `stato` vince su `includeInactive`: è la scelta esplicita fatta nella colonna Stato.
    const attivo =
      filter.stato === 'active' ? { active: true }
      : filter.stato === 'archived' ? { active: false }
      : filter.includeInactive ? {}
      : { active: true };

    // Stagioni: 'none' = buona tutto l'anno (array vuoto), altrimenti deve contenere quella stagione.
    const stagione =
      filter.season === 'none' ? { seasons: { isEmpty: true } }
      : filter.season ? { seasons: { has: filter.season } }
      : {};

    const where = {
      ...(soloDieta ? { id: { in: soloDieta } } : {}),
      ...attivo,
      ...stagione,
      ...(filter.regime ? { regime: filter.regime as never } : {}),
      ...(filter.mealSlot ? { mealSlot: filter.mealSlot as never } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
      ...(Object.keys(kcal).length ? { kcal } : {}),
      ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
    };

    const TETTO = 1000;
    const [items, total] = await Promise.all([
      this.prisma.recipe.findMany({ where: where as never, orderBy: { name: 'asc' }, take: TETTO }),
      this.prisma.recipe.count({ where: where as never }),
    ]);
    /**
     * `utilizzo` e `settimane` sulla riga: dove quella ricetta è davvero usata, letto dalle giornate
     * (vedi `utilizzo-ricette.ts` per il perché non dai tag `dieta:`/`sett:`).
     *
     * Si chiede **solo per le righe che escono** — al massimo mille — invece di scandire il catalogo
     * intero: così la risposta è fresca a ogni ricerca e non serve tenerla in una cache, che su due
     * istanze non ritarderebbe ma oscillerebbe.
     *
     * Dentro una dieta `settimane` resta quello DI QUELLA dieta (`settimanePerRicetta`), perché lì la
     * domanda è «dov'è nel ciclo che sto guardando»; fuori è l'unione, perché la stessa ricetta serve
     * più famiglie e restringerla a una sarebbe una mezza verità.
     *
     * ⚠️ Se la lettura delle giornate fallisce, le due colonne valgono `null` — «non lo so» — e NON
     * un elenco vuoto: un elenco vuoto qui significa «ricetta orfana», cioè un'affermazione precisa
     * e falsa su lavoro pagato. Il resto dell'elenco ricette continua a funzionare.
     */
    let usi: Map<string, UsoInDieta[]> | null = null;
    try {
      usi = await utilizzoDelleRicette(this.prisma, (items as { id: string }[]).map((r) => r.id));
    } catch (e) {
      // ⚠️ L'errore si SCRIVE. La prima versione lo ingoiava, e il risultato è stato mezz'ora a
      // indovinare perché le colonne mostrassero «—»: un errore inghiottito trasforma un guasto
      // preciso in un mistero. La pagina continua a funzionare, ma nei log di Render c'è scritto
      // cosa è successo.
      this.logger.error(`Lettura utilizzo ricette non riuscita: ${e instanceof Error ? e.message : String(e)}`);
      usi = null;
    }
    const conUtilizzo = (items as { id: string }[]).map((r) => {
      const u = usi?.get(r.id) ?? (usi ? [] : null);
      return {
        ...r,
        utilizzo: u,
        settimane: settimane ? (settimane.get(r.id) ?? []) : (u ? settimaneDiTutte(u) : null),
      };
    });
    return { items: conUtilizzo, total, troncato: total > items.length };
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
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    // Stagionalità (voce #11): array vuoto = buona tutto l'anno.
    if (dto.seasons !== undefined) data.seasons = dto.seasons;
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
        difficulty: dto.difficulty ?? 'media',
        seasons: dto.seasons ?? [],
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

  // ---------- Tassonomia: regimi (configurabili) + stili (dalle diete) ----------

  private static readonly DEFAULT_REGIMES = [
    { code: 'omnivore', label: 'Onnivora' },
    { code: 'vegetarian', label: 'Vegetariana' },
    { code: 'vegan', label: 'Vegana' },
  ];
  private static readonly STYLE_LABELS: Record<string, string> = {
    mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile', keto: 'Keto', keto_mediterranean: 'Keto-Mediterranea', dash: 'DASH',
  };

  private titleCase(v: string): string {
    return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Regimi alimentari: lista configurabile (config_param diet_regimes), con fallback ai 3 di default. */
  async regimes(): Promise<{ code: string; label: string }[]> {
    const raw = await this.config.getString('diet_regimes', '');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { code?: unknown; label?: unknown }[];
        const list = (Array.isArray(parsed) ? parsed : [])
          .filter((r) => r && typeof r.code === 'string' && (r.code as string).trim())
          .map((r) => ({ code: String(r.code).trim(), label: String(r.label ?? r.code).trim() }));
        if (list.length) return list;
      } catch {
        /* valore non valido → default */
      }
    }
    return CatalogService.DEFAULT_REGIMES;
  }

  /** Stili disponibili: SOLO quelli di diete APPROVATE (uno stile senza dieta approvata non è
   *  assegnabile). L'etichetta è il NOME della dieta (nome cliente se impostato, altrimenti
   *  nome interno) così le tendine "Stile" combaciano con i nomi che si vedono in Diete —
   *  niente più codici grezzi tipo "Summer Holiday". */
  async styles(): Promise<{ code: string; label: string }[]> {
    const rows = (await this.prisma.diet.findMany({
      where: { status: 'approved' },
      select: { style: true, clientName: true, name: true },
      orderBy: { createdAt: 'asc' },
    })) as { style: string | null; clientName: string | null; name: string | null }[];
    const seen = new Set<string>();
    const out: { code: string; label: string }[] = [];
    for (const r of rows) {
      const code = r.style?.trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const label =
        r.clientName?.trim() ||
        r.name?.trim() ||
        CatalogService.STYLE_LABELS[code] ||
        this.titleCase(code);
      out.push({ code, label });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  async taxonomy() {
    const [regimes, styles] = await Promise.all([this.regimes(), this.styles()]);
    return { regimes, styles };
  }

  /** Salva la lista dei regimi (solo admin). Normalizza i codici (minuscolo, underscore). */
  async setRegimes(list: { code: string; label: string }[], actorId: string) {
    const clean = (list ?? [])
      .filter((r) => r && typeof r.code === 'string' && r.code.trim())
      .map((r) => ({ code: r.code.trim().toLowerCase().replace(/\s+/g, '_'), label: (r.label ?? r.code).trim() || r.code.trim() }));
    if (clean.length === 0) throw new BadRequestException('Serve almeno un regime.');
    const seen = new Set<string>();
    const dedup = clean.filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true)));
    const value = JSON.stringify(dedup);
    await this.prisma.configParam.upsert({
      where: { key: 'diet_regimes' },
      create: { key: 'diet_regimes', value, type: 'json' as never, description: 'Regimi alimentari (configurabili dalle impostazioni)', updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    await this.audit.log({ action: 'admin.config.update', actorId, entityType: 'config_param', entityId: 'diet_regimes', metadata: { count: dedup.length } });
    return dedup;
  }

  /** Avvisa l'autore della dieta quando qualcun altro la approva/pubblica. */
  private async notifyDietApproved(authorStaffId: string | null, approverStaffId: string, dietName: string): Promise<void> {
    if (!authorStaffId || authorStaffId === approverStaffId) return;
    const author = await this.prisma.staff.findUnique({
      where: { id: authorStaffId },
      select: { userId: true },
    });
    if (!author) return;
    await this.notifications
      .notify({
        userId: author.userId,
        type: 'diet_approved',
        title: 'Dieta approvata',
        body: `La dieta "${dietName}" è stata approvata e pubblicata.`,
        payload: {},
      })
      .catch(() => undefined);
  }
}
