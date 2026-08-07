import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { DietMatchProfile, pickDietFor } from '../catalog/pick-diet';
import { statoViaggioAttivo } from '../common/stato-viaggio';
import { ConfigParamsService } from '../config-params/config-params.service';
import { AgentState, DietAgentService } from '../diet-agent/diet-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../common/date-only';
import { DayComboService, RecipeInfo } from './day-combo.service';
import { expandExclusion } from './exclusions';
import { KcalNeedService } from './kcal-need.service';
import { EsitoSpezia, classificaSpezia } from './spezie';

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
/**
 * Quanti giorni di menu tornano al client in una sola richiesta. È un tetto al peso della
 * risposta (ogni giorno porta con sé lo snapshot dei pasti), non un limite del percorso: la
 * finestra scorre e prende i giorni PIÙ RECENTI, così oggi e i giorni già erogati in avanti
 * ci sono sempre, quanto lungo sia il piano. Per lo storico completo servono `from`/`to`.
 */
const MENU_WINDOW_DAYS = 30;

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
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly dietAgent: DietAgentService,
    private readonly dayCombo: DayComboService,
    private readonly kcalNeed: KcalNeedService,
  ) {}

  /**
   * Menu visibile della cliente; prova a erogare i giorni successivi se ha diritto.
   *
   * FINESTRA: si restituiscono gli ULTIMI `MENU_WINDOW_DAYS` giorni visibili — cioè
   * oggi, i giorni già erogati in avanti e lo storico recente — non i primi.
   * Prima la query era `orderBy: date asc` con `take: 30` e nessun limite inferiore:
   * appena una cliente superava i 30 giorni erogati riceveva i 30 giorni PIÙ VECCHI e
   * il giorno di oggi restava fuori dalla pagina. La Home cerca esattamente la data di
   * oggi (`days.find(d => d.date === iso)`) e non trovandola mostrava "menu in
   * preparazione", la pagina Menu non aveva nessun giorno "in arrivo" da selezionare, e
   * `menuStatus` — che riceve `hasVisibleMenu` calcolato su questi stessi giorni —
   * confermava lo stato sbagliato. Da fuori sembrava che i menu non venissero generati:
   * erano in tabella, ma fuori finestra. Ordinando al contrario i giorni futuri sono
   * sempre dentro, perché sono i più recenti.
   */
  async getMenu(clientId: string, from?: string, to?: string) {
    const delivered = await this.deliverIfEligible(clientId);
    const today = toDateOnly();

    // Un solo oggetto `date`: con due spread separati il secondo sovrascriveva il primo
    // e passando sia `from` sia `to` il limite inferiore veniva perso senza errori.
    const dateRange = {
      ...(from ? { gte: toDateOnly(from) } : {}),
      ...(to ? { lte: toDateOnly(to) } : {}),
    };
    const menuDays = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        visibleFrom: { lte: today }, // rispetta visible_from
        ...(from || to ? { date: dateRange } : {}),
      },
      orderBy: { date: 'desc' }, // i più recenti: oggi e il futuro non escono mai dalla finestra
      take: MENU_WINDOW_DAYS,
    });
    menuDays.reverse(); // l'app si aspetta i giorni in ordine crescente
    const blocked = await this.dietBlock(clientId);
    const status = await this.menuStatus(clientId, menuDays.some((d) => d.date.getTime() >= today.getTime()));
    // NB: restituiamo sempre tutti i giorni della finestra (lo STORICO recente resta
    // leggibile anche a piano scaduto). Il "menu di oggi" in dashboard viene nascosto
    // lato app quando `status.state === 'expired'`, ma la cronologia resta consultabile.
    return { delivered, days: menuDays, blocked, status };
  }

  /**
   * Stato del menu per la dashboard cliente: serve a spiegare — quando il menu non è
   * ancora visibile — PERCHÉ e QUANDO arriverà, così la cliente non pensa che l'app sia
   * rotta. Non ha effetti collaterali (non eroga nulla).
   *
   * Stati:
   * - `expired`         → nessun abbonamento attivo (prova/piano scaduto o annullato):
   *                       "nessun piano attivo", il menu non si mostra;
   * - `available`       → ci sono giorni di menu visibili (nessun messaggio da mostrare);
   * - `awaiting_visit`  → percorso supervisionato (screening): il menu dipende dalla
   *                       visita col nutrizionista → messaggio dedicato;
   * - `scheduled`       → idoneo ma non ancora nella finestra: `availableFrom` = data in
   *                       cui il menu diventa visibile → "Il tuo menu arriverà il …";
   * - `awaiting_measures` → prova gratuita senza misure iniziali (punto A mancante);
   * - `paused`          → periodo senza dieta attivo;
   * - `blocked`         → piano in sistemazione col nutrizionista (esclusioni);
   * - `preparing`       → idoneo ora / data non ancora impostata: menu in preparazione.
   */
  async menuStatus(
    clientId: string,
    hasVisibleMenu?: boolean,
  ): Promise<{ state: string; availableFrom: string | null; planStartDate: string | null }> {
    const today = toDateOnly();
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true, screeningFlag: true },
    });
    const planStartDate = profile?.planStartDate ? profile.planStartDate.toISOString().slice(0, 10) : null;

    // 0) ACCESSO AL MENU: serve un abbonamento ATTIVO ED ENTRO IL PERIODO (status 'active' e
    // endDate non ancora passata). Se l'utente ha avuto un piano ma ora è scaduto/annullato —
    // nessuno attivo-entro-periodo né in attesa — e non è in pausa/viaggio, il menu NON si mostra:
    // stato `expired` ("nessun piano attivo"/percorso concluso).
    // Il controllo su `endDate` serve perché il cron di scadenza può girare in ritardo: un piano
    // con fine già passata deve risultare concluso anche se lo stato è ancora 'active'. Non è in
    // conflitto con i piani spostati in avanti (quelli hanno endDate FUTURA → restano attivi).
    const subs = (await this.prisma.subscription.findMany({
      where: { clientId },
      select: { status: true, endDate: true },
    })) as { status: string; endDate: Date | null }[];
    const hasActivePlan = subs.some(
      (s) => s.status === 'active' && (!s.endDate || s.endDate.getTime() >= today.getTime()),
    );
    const hasPendingPlan = subs.some((s) => s.status === 'pending');
    if (subs.length > 0 && !hasActivePlan && !hasPendingPlan) {
      const pauseNow = await this.events.activePausePeriod(clientId);
      if (!pauseNow) return { state: 'expired', availableFrom: null, planStartDate };
    }

    // 1) Menu già visibile (oggi o nei prossimi giorni): nessun messaggio.
    const visible =
      hasVisibleMenu ??
      Boolean(
        await this.prisma.menuDay.findFirst({
          where: { clientId, visibleFrom: { lte: today }, date: { gte: today } },
          select: { id: true },
        }),
      );
    if (visible) return { state: 'available', availableFrom: null, planStartDate };

    // 2) Percorso supervisionato: il menu dipende dalla visita col nutrizionista.
    if (profile?.screeningFlag) return { state: 'awaiting_visit', availableFrom: null, planStartDate };

    // 3) Senza data di inizio piano non c'è ancora una data da mostrare.
    if (!profile?.planStartDate) return { state: 'preparing', availableFrom: null, planStartDate: null };

    // 4) Periodo senza dieta (modalità viaggio) attivo.
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) return { state: 'paused', availableFrom: null, planStartDate };

    // 5) Idoneo ma troppo presto: mostro la data in cui il menu comparirà.
    const visibleDaysBefore = await this.configParams.getNumber('menu_visible_days_before_start', 2);
    const start = toDateOnly(profile.planStartDate.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    const availableFrom = visibleFrom.toISOString().slice(0, 10);
    if (today.getTime() < visibleFrom.getTime()) {
      return { state: 'scheduled', availableFrom, planStartDate };
    }

    // 6) MISURE INIZIALI (punto A): per QUALSIASI piano attivo, se non c'è ancora nessuna
    // misura il menu resta trattenuto e l'app mostra il popup misure (bloccante). Prima
    // valeva solo per la prova €0; ora vale sempre (le misure servono per ogni ciclo).
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      select: { id: true },
    });
    if (activeSubscription) {
      const hasMeasure = await this.prisma.measurement.count({ where: { clientId } });
      if (hasMeasure === 0) return { state: 'awaiting_measures', availableFrom: null, planStartDate };
    }

    // 7) Piano in sistemazione col nutrizionista (esclusioni non sostituibili).
    const block = await this.dietBlock(clientId);
    if (block.active) return { state: 'blocked', availableFrom: null, planStartDate };

    // 8) Idoneo ora ma nessun giorno ancora: si sta preparando, comparirà a breve.
    return { state: 'preparing', availableFrom: null, planStartDate };
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
    const activeSubscription = (await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      include: { plan: { select: { priceCents: true } } },
    })) as ({ endDate?: Date | null; plan: { priceCents: number } | null } & Record<string, unknown>) | null;
    if (!activeSubscription) return [];
    // Piano già CONCLUSO (fine passata) anche se lo stato è ancora 'active' (cron in ritardo):
    // niente erogazione. Coerente con menuStatus, così non compaiono menu di un percorso finito.
    if (activeSubscription.endDate && activeSubscription.endDate.getTime() < toDateOnly().getTime()) return [];

    // Periodo senza dieta attivo: erogazione sospesa (il monitoraggio continua).
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) return [];

    // MISURE INIZIALI (punto A) obbligatorie al giorno 0 per QUALSIASI piano: senza la prima
    // misura non esiste il report A→B e non si eroga il primo menu. Finché non arriva, il menu
    // resta trattenuto e il popup misure (bloccante) guida la cliente a inserirla. Le misure
    // servono poi per OGNI ciclo (vedi cycleNeedsMeasure più sotto).
    {
      const hasMeasure = await this.prisma.measurement.count({ where: { clientId } });
      if (hasMeasure === 0) return [];
    }

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
      // Buffer in avanti: se la cliente ha GIÀ un menu per un giorno FUTURO (oltre oggi)
      // non eroghiamo altro. Così teniamo al massimo il ciclo corrente + i prossimi
      // giorni e non generiamo cicli all'infinito.
      if (last.date.getTime() > today.getTime()) {
        return [];
      }
      // Siamo all'ULTIMO giorno del ciclo corrente (last.date === oggi) oppure la cliente
      // è rimasta indietro (last.date < oggi). Il ciclo successivo si sblocca con le MISURE
      // del ciclo: scelta prodotto (Simone) → l'invio delle misure deve far arrivare SUBITO
      // i prossimi giorni, senza attendere il check-in del giorno dopo.
      // Gate misure (Tracciamento_Dati §5): al 2° giorno di ogni ciclo le misure sono
      // obbligatorie; finché non arrivano il ciclo successivo resta "held" (l'avviso alla
      // coach lo genera l'Alert engine: missing_measurements).
      if (await this.cycleNeedsMeasure(clientId, last, daysPerDelivery)) {
        return [];
      }
      firstNewDate = nextDate.getTime() > today.getTime() ? nextDate : today;
    }

    const diet = await this.pickDiet(profile);
    if (!diet) return [];

    // La dieta scelta dalla cliente va APPLICATA (voce #5: «intanto me la devi applicare»).
    // `pickDiet` ha una catena di ripieghi che, se per lo stile richiesto non esiste una dieta
    // approvata, finisce per servirne una di un altro stile: meglio un menu che nessun menu, ma
    // finora succedeva in silenzio — la cliente sceglieva Keto e riceveva Mediterranea senza che
    // nessuno lo sapesse. Ora resta traccia, così il buco di catalogo si vede e si colma.
    const stileRichiesto = (profile as { dietStyle?: string | null }).dietStyle ?? null;
    const stileServito = (diet as { style?: string | null }).style ?? null;
    if (stileRichiesto && stileServito && stileRichiesto !== stileServito) {
      this.logger.warn(
        `Stile dieta non disponibile per ${clientId}: richiesto "${stileRichiesto}", servito "${stileServito}".`,
      );
      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            name: 'diet_style_fallback',
            userId: clientId,
            phase: 'app',
            data: { richiesto: stileRichiesto, servito: stileServito, dietId: diet.id } as never,
          } as never,
        })
        .catch(() => undefined);
    }

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
    const [kcalTolG, daycomboG, pMinG, pMaxG, kcalNeedG] = await Promise.all([
      this.configParams.getNumber('menu_kcal_balance_tolerance_pct', 15),
      this.configParams.getBool('menu_daycombo_enabled', false),
      this.configParams.getNumber('menu_daycombo_protein_min', 0.2),
      this.configParams.getNumber('menu_daycombo_protein_max', 0.45),
      // Menu "a necessità": il target kcal viene dal FABBISOGNO calcolato sul profilo
      // (Mifflin + attività − deficit dell'obiettivo, con soglie di sicurezza), non dai
      // livelli della dieta. Attivo di default; disattivabile globalmente o per dieta.
      this.configParams.getBool('menu_kcal_need_enabled', true),
    ]);
    // VARIETÀ (garanzia percepita dalla cliente): distanza minima, in giorni, prima che lo
    // stesso piatto possa tornare nello STESSO slot. Se esiste un'alternativa nel pool entro
    // la tolleranza kcal, si usa quella. 0 = guard disattivato.
    const varietyGapG = await this.configParams.getNumber('menu_variety_min_gap_days', 2);
    const varietyGap = pickNumOverride(overrides, 'menu_variety_min_gap_days', varietyGapG);
    const kcalTolPct = pickNumOverride(overrides, 'menu_kcal_balance_tolerance_pct', kcalTolG);
    const daycomboEnabled = pickBoolOverride(overrides, 'menu_daycombo_enabled', daycomboG);
    const kcalNeedEnabled = pickBoolOverride(overrides, 'menu_kcal_need_enabled', kcalNeedG);
    const pMin = pickNumOverride(overrides, 'menu_daycombo_protein_min', pMinG);
    const pMax = pickNumOverride(overrides, 'menu_daycombo_protein_max', pMaxG);
    // Selettore per-slot (comportamento base, sempre disponibile come fallback).
    const selector = this.selectorFromContext(ctx, kcalTolPct / 100);

    // TARGET KCAL DELLA GIORNATA. Se il "menu a necessità" è attivo e il fabbisogno è
    // calcolabile dal profilo, il target è il fabbisogno; altrimenti si usano le kcal del
    // livello dichiarate nella dieta (comportamento storico).
    const levelKcal = this.levelTargetKcal(diet.levels, level);
    let targetKcal = levelKcal;
    let targetSource: 'need' | 'level' = 'level';
    if (kcalNeedEnabled) {
      const need = await this.kcalNeed.computeTargetKcal(clientId);
      if (need && need > 0) { targetKcal = need; targetSource = 'need'; }
    }

    // DayCombo compone la giornata dal pool della dieta puntando al target kcal. Si attiva
    // se DayCombo è abilitato per la dieta OPPURE se il menu a necessità sta guidando il
    // target (in automatico). Se non trova una giornata nella banda → fallback al selettore.
    const useDayCombo = (daycomboEnabled || targetSource === 'need') && !!ctx && targetKcal > 0;

    // Fine piano: non si erogano MAI giorni oltre la data di fine dell'abbonamento. Il piano
    // include fino a `endDate` compresa; i giorni successivi (domani/dopodomani a piano finito)
    // non vanno consegnati (bug: la cliente vedeva menu oltre la fine del percorso).
    const planEnd = activeSubscription.endDate ? toDateOnly(activeSubscription.endDate.toISOString()) : null;
    if (planEnd && firstNewDate.getTime() > planEnd.getTime()) return [];

    // Storico recente per slot (giorni già erogati): serve al guard di varietà per non
    // riproporre lo stesso piatto a ridosso di quando è già stato servito.
    const slotHistory = varietyGap > 0 ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap) : new Map<string, string[]>();

    // Prepara gli snapshot dei giorni del ciclo.
    // Digiuno intermittente: gli slot che questa cliente ha scelto di saltare (voce #7).
    const slotSaltati = this.slotSaltatiPerDigiuno(
      (profile as { pathType?: string | null }).pathType,
      (profile as { fastingWindow?: string | null }).fastingWindow,
    );

    const daySnapshots: { date: Date; meals: MealSnapshot[] }[] = [];
    for (let i = 0; i < daysPerDelivery; i++) {
      const date = new Date(firstNewDate.getTime() + i * 86_400_000);
      if (planEnd && date.getTime() > planEnd.getTime()) break; // niente giorni oltre la fine piano
      const daysSinceStart = Math.round((date.getTime() - start.getTime()) / 86_400_000);
      const template = templates[((daysSinceStart % templates.length) + templates.length) % templates.length];
      let chosen: { slot: string; recipeId: string }[] | null = null;
      // I punteggi vanno ricalcolati AD OGNI GIORNO: i piatti scelti per il giorno precedente
      // sono nel frattempo diventati "serviti di recente" (bump) e vanno sfavoriti.
      const combo = useDayCombo && ctx ? this.dayComboPools(ctx, slotSaltati) : null;
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
      if (!chosen) {
        // Stesso filtro anche sul percorso di riserva: se DayCombo è spento o non trova una
        // giornata nella banda, il template va comunque ripulito dei pasti saltati.
        const pasti = (template.meals as { slot: string; recipeId: string }[]) ?? [];
        const pastiFiltrati = pasti.filter((m) => !slotSaltati.has(m.slot));
        chosen = selector(pastiFiltrati.length > 0 ? pastiFiltrati : pasti);
      }
      // VARIETÀ: niente stesso piatto nello stesso slot a meno di `varietyGap` giorni, se il
      // pool della dieta offre un'alternativa entro la tolleranza kcal (bilanciamento salvo).
      chosen = this.applyVarietyGuard(chosen, slotHistory, ctx, kcalTolPct / 100, varietyGap);
      this.pushSlotHistory(slotHistory, chosen, varietyGap);
      // I piatti di oggi contano come "serviti di recente" per i giorni successivi del ciclo.
      for (const m of chosen) ctx?.bump(m.recipeId);
      const meals = await this.snapshotMeals(chosen as never);
      daySnapshots.push({ date, meals });
    }
    if (daySnapshots.length === 0) return []; // tutti i giorni erano oltre la fine piano

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

    // PREFERENZA "RICETTE SEMPLICI" (scelta della cliente in app): se attiva, per ogni pasto
    // si preferisce — quando disponibile — un'alternativa marcata `difficulty="semplice"`
    // (cucina italiana), entro la tolleranza kcal e rispettando le esclusioni. La rotazione
    // per giorno fa alternare i piatti semplici tra loro e con quelli esistenti quando il pool
    // è limitato. La sicurezza resta garantita da evaluateMeals subito sotto.
    if ((profile as { prefersSimpleRecipes?: boolean }).prefersSimpleRecipes) {
      const slots = [...new Set(templates.flatMap((t) => ((t.meals as { slot: string }[]) ?? []).map((m) => m.slot)))];
      const excludeTerms = [
        ...(((profile as { allergies?: string[] }).allergies) ?? []),
        ...((profile.intolerances as string[]) ?? []),
        ...((profile.dislikedFoods as string[]) ?? []),
      ];
      const simpleBySlot = await this.buildSimpleSlotPool(profile.regime, slots, excludeTerms);
      if ([...simpleBySlot.values()].some((l) => l.length)) {
        // Questo passaggio RISCRIVE i pasti già composti: senza storico annullerebbe il guard
        // di varietà applicato sopra (il pool "semplice" è piccolo e la rotazione per giorno
        // degenera a piatto fisso quando in banda kcal ne resta uno solo). Lo storico riparte
        // dai giorni GIÀ erogati e si aggiorna man mano, come nel ciclo di composizione.
        const simpleHistory = varietyGap > 0
          ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap)
          : new Map<string, string[]>();
        for (const day of daySnapshots) {
          const dayIndex = Math.round((day.date.getTime() - start.getTime()) / 86_400_000);
          day.meals = this.applySimplePreference(day.meals, simpleBySlot, kcalTolPct / 100, dayIndex, simpleHistory);
          this.pushSlotHistory(simpleHistory, day.meals, varietyGap);
        }
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
    // Cibi NON graditi come ingrediente PRINCIPALE (nel nome del piatto): il piatto
    // si cambia già in erogazione con un'alternativa equivalente.
    const dislikedNow = ((profile.dislikedFoods ?? []) as string[]);
    if (dislikedNow.length) {
      // Lo storico riparte dai giorni GIÀ erogati e si aggiorna giorno per giorno, come nel
      // ciclo di composizione: senza, ogni giorno riceverebbe lo stesso identico sostituto.
      const swapHistory = varietyGap > 0
        ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap)
        : new Map<string, string[]>();
      for (const day of daySnapshots) {
        await this.swapDislikedDishes(clientId, day.meals, dislikedNow, ctx?.slotPool, swapHistory);
        this.pushSlotHistory(swapHistory, day.meals, varietyGap);
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
    /** 'none' · 'popup' (primo giorno, richiudibile) · 'locked' (dal giorno dopo: serve la coach). */
    level: 'none' | 'popup' | 'locked';
    /** Da quando la richiesta è aperta: serve a capire se siamo passati al giorno dopo. */
    since: string | null;
    lockedMessage: string | null;
  }> {
    // RECENSORI degli store: mai bloccati (voce #6f). Se Apple o Google si trovassero davanti a
    // un muro rifiuterebbero la pubblicazione, e non avremmo modo di spiegarglielo.
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { isStoreReviewer: true, measuresUnlockedUntil: true },
    })) as { isStoreReviewer: boolean | null; measuresUnlockedUntil: Date | null } | null;
    if (prof?.isStoreReviewer) {
      return { required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null };
    }
    // Sblocco concesso dalla coach dalla chat: finestra di grazia, non un interruttore per sempre.
    if (prof?.measuresUnlockedUntil && prof.measuresUnlockedUntil.getTime() > Date.now()) {
      return { required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null };
    }

    const daysPerDelivery = await this.configParams.getNumber('menu_days_delivered', 2);
    const last = await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) {
      // Nessun menu ancora erogato: se il piano è attivo, la finestra è iniziata e mancano le
      // MISURE INIZIALI (punto A), blocca comunque col popup — le misure sbloccano il 1° menu.
      const needsInitial = await this.needsInitialMeasures(clientId);
      return {
        required: needsInitial,
        blocking: needsInitial,
        cycleDate: null,
        level: needsInitial ? 'popup' : 'none',
        since: null,
        lockedMessage: null,
      };
    }
    const needs = await this.cycleNeedsMeasure(clientId, last, daysPerDelivery);
    if (!needs) {
      return { required: false, blocking: false, cycleDate: last.date.toISOString().slice(0, 10), level: 'none', since: null, lockedMessage: null };
    }
    // Da quando la misura è dovuta: il ciclo scade `daysPerDelivery` giorni dopo l'ultimo menu.
    const dovutaDa = new Date(last.date.getTime() + daysPerDelivery * 86_400_000);
    const oreDaAllora = (Date.now() - dovutaDa.getTime()) / 3_600_000;
    const oreDiGrazia = await this.configParams.getNumber('measures_lock_after_hours', 24);
    const locked = oreDaAllora >= oreDiGrazia;
    return {
      required: true,
      blocking: true,
      cycleDate: last.date.toISOString().slice(0, 10),
      level: locked ? 'locked' : 'popup',
      since: dovutaDa.toISOString(),
      lockedMessage: locked
        ? 'Contatta la tua coach per sbloccare la app.'
        : null,
    };
  }

  /**
   * Sblocco concesso dalla coach (voce #6e): riapre l'app per un numero di ore configurabile.
   * È una finestra e non un interruttore: uno sblocco senza scadenza equivarrebbe a spegnere la
   * regola per sempre, e nessuno si ricorderebbe di riaccenderla.
   */
  async unlockMeasures(clientId: string, staffUserId: string): Promise<{ until: string }> {
    const ore = await this.configParams.getNumber('measures_unlock_hours', 48);
    const until = new Date(Date.now() + ore * 3_600_000);
    await this.prisma.clientProfile.update({
      where: { userId: clientId },
      data: { measuresUnlockedUntil: until } as never,
    });
    await this.audit.log({
      action: 'measures.unlock',
      actorId: staffUserId,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: { until: until.toISOString(), hours: ore },
    });
    await this.prisma.notification
      .create({
        data: {
          userId: clientId,
          type: 'measures_unlocked',
          payload: {
            title: 'App sbloccata 💚',
            body: `La tua coach ha riaperto l'app. Quando puoi, inserisci le misure: servono per prepararti il menu giusto.`,
          } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      })
      .catch(() => undefined);
    return { until: until.toISOString() };
  }

  /**
   * True se il piano è attivo e idoneo a partire (finestra iniziata, non in pausa/vacanza,
   * non supervisionato) ma manca ancora QUALSIASI misura: allora il popup misure blocca
   * l'app finché non arriva il punto A (primo menu trattenuto in deliverIfEligible).
   */
  private async needsInitialMeasures(clientId: string): Promise<boolean> {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true, screeningFlag: true, travelState: true, travelStart: true, travelEnd: true },
    })) as {
      planStartDate: Date | null; screeningFlag: boolean | null;
      travelState: string | null; travelStart: Date | null; travelEnd: Date | null;
    } | null;
    if (!profile?.planStartDate) return false;
    if (profile.screeningFlag) return false; // percorso supervisionato: dipende dalla visita
    // In vacanza il popup misure non blocca — ma lo stato SCADE (vedi `stato-viaggio.ts`).
    // Prima si leggeva il campo grezzo: un «in vacanza» che nessuno azzerava al rientro
    // spegneva per sempre, in silenzio, la regola più severa che abbiamo.
    if (statoViaggioAttivo(profile) === 'in_vacanza') return false;
    const activeSub = await this.prisma.subscription.findFirst({ where: { clientId, status: 'active' }, select: { id: true } });
    if (!activeSub) return false;
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) return false;
    const visibleDaysBefore = await this.configParams.getNumber('menu_visible_days_before_start', 2);
    const today = toDateOnly();
    const start = toDateOnly(profile.planStartDate.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    if (today.getTime() < visibleFrom.getTime()) return false; // troppo presto
    const hasMeasure = await this.prisma.measurement.count({ where: { clientId } });
    return hasMeasure === 0;
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
    // Piani estate: in vacanza il popup misure NON blocca l'erogazione (finché la vacanza dura).
    const prof = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { travelState: true, travelStart: true, travelEnd: true },
    });
    if (statoViaggioAttivo(prof as { travelState: string | null; travelStart: Date | null; travelEnd: Date | null } | null) === 'in_vacanza') return false;
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
    bump: (id: string) => void;
  } | null> {
    if (!regime) return null;

    const [wEffBaseG, wGradBaseG, boostG, proteinBonusG, penaltyRepeatG, repeatWindowDaysG, maintWEffG, penaltyStagioneG] = await Promise.all([
      this.configParams.getNumber('menu_select_w_eff', 1),
      this.configParams.getNumber('menu_select_w_grad', 1),
      this.configParams.getNumber('menu_state_boost', 1.8),
      this.configParams.getNumber('menu_pre_event_protein_bonus', 0.6),
      // R11: penalità di ripetizione (varietà). ATTIVA di default: una ricetta servita di
      // recente viene sfavorita, così la rotazione tende al "meno servito di recente"
      // invece di riproporre sempre il piatto col punteggio più alto.
      this.configParams.getNumber('menu_penalty_repeat', 1),
      this.configParams.getNumber('menu_repeat_window_days', 14),
      // R12: peso efficacia in MANTENIMENTO (default 0 = efficacia neutra).
      this.configParams.getNumber('menu_maintenance_w_eff', 0),
      // Stagionalità (voce #11): quanto pesa proporre un piatto fuori stagione. Alto abbastanza
      // da spostare la scelta quando esiste un'alternativa, non tanto da svuotare il menu quando
      // non esiste. A 0 la regola è spenta.
      this.configParams.getNumber('menu_penalty_season', 0.5),
    ]);
    // Applica gli override PER DIETA (fallback al globale).
    const wEffBase = pickNumOverride(overrides, 'menu_select_w_eff', wEffBaseG);
    const wGradBase = pickNumOverride(overrides, 'menu_select_w_grad', wGradBaseG);
    const boost = pickNumOverride(overrides, 'menu_state_boost', boostG);
    const proteinBonus = pickNumOverride(overrides, 'menu_pre_event_protein_bonus', proteinBonusG);
    const penaltyRepeat = pickNumOverride(overrides, 'menu_penalty_repeat', penaltyRepeatG);
    const repeatWindowDays = pickNumOverride(overrides, 'menu_repeat_window_days', repeatWindowDaysG);
    const maintWEff = pickNumOverride(overrides, 'menu_maintenance_w_eff', maintWEffG);
    const penaltyStagione = pickNumOverride(overrides, 'menu_penalty_season', penaltyStagioneG);
    // Modulazione dei pesi in base allo stato dell'agente.
    let wEff = wEffBase;
    let wGrad = wGradBase;
    // `vacanza` si comporta come il conforto — menu più amati — ma per una ragione diversa:
    // non è umore basso, è che la cliente è via e mangerà quello che le va. Stato separato
    // perché nei log e nelle diagnosi «in vacanza» e «giornata storta» non vanno confusi.
    if (state === 'conforto' || state === 'vacanza') wGrad = wGradBase * boost; // menu più amati
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
      this.prisma.recipe.findMany({ where: { id: { in: [...poolIds] } }, select: { id: true, kcal: true, macros: true, seasons: true } }) as Promise<{ id: string; kcal: number; macros: unknown; seasons: string[] }[]>,
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

    // STAGIONALITÀ (voce #11): una cliente si è vista proporre lo spezzatino a luglio.
    // Regola MORBIDA per decisione di Simone: fuori stagione il piatto è PENALIZZATO, non escluso.
    // Con un catalogo ancora da classificare, escludere lascerebbe buchi nei menu — e un piatto
    // fuori stagione è meno grave di una cena mancante. Ricetta senza stagioni = buona sempre,
    // quindi finché nessuno classifica nulla il comportamento non cambia di una virgola.
    const stagioneOggi = stagioneCorrente();
    const fuoriStagione = new Set<string>();
    for (const r of recipes) {
      const st = r.seasons ?? [];
      if (st.length > 0 && !st.includes(stagioneOggi)) fuoriStagione.add(r.id);
    }

    const score = (id: string) =>
      wEff * (effOf.get(id) ?? 0) +
      wGrad * ((starOf.get(id) ?? 5) / 5) +
      (usePreEvent ? proteinBonus * (proteinOf.get(id) ?? 0) : 0) -
      penaltyRepeat * (recentCount.get(id) ?? 0) - // R11: scoraggia la ripetizione (varietà)
      (fuoriStagione.has(id) ? penaltyStagione : 0);

    // Conta come "servita di recente" anche una ricetta appena scelta in QUESTO ciclo: senza
    // questo, i 2 giorni erogati insieme venivano composti con lo stesso identico punteggio e
    // finivano per ripetere gli stessi piatti.
    const bump = (id: string) => recentCount.set(id, (recentCount.get(id) ?? 0) + 1);

    return { slotPool, kcalOf, proteinOf, score, bump };
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

  // ---------- Varietà: nessun piatto ripetuto a ridosso nello stesso slot ----------

  /**
   * Ultimi `gapDays` giorni già erogati, riletti per slot (dal più recente): serve a sapere
   * cosa la cliente ha appena mangiato a colazione/pranzo/cena prima di comporre i nuovi giorni.
   */
  private async recentSlotHistory(clientId: string, before: Date, gapDays: number): Promise<Map<string, string[]>> {
    const rows = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lt: before } },
      select: { meals: true },
      orderBy: { date: 'desc' },
      take: gapDays,
    })) as { meals: unknown }[];
    const hist = new Map<string, string[]>();
    for (const r of rows) {
      for (const m of ((r.meals as { slot?: string; recipeId?: string }[]) ?? [])) {
        if (!m?.slot || !m.recipeId) continue;
        const list = hist.get(m.slot) ?? [];
        if (list.length < gapDays) list.push(m.recipeId);
        hist.set(m.slot, list);
      }
    }
    return hist;
  }

  /** Aggiunge il giorno appena composto in testa allo storico (finestra `gapDays`). */
  private pushSlotHistory(history: Map<string, string[]>, meals: { slot: string; recipeId: string }[], gapDays: number): void {
    if (gapDays <= 0) return;
    for (const m of meals) {
      const list = history.get(m.slot) ?? [];
      list.unshift(m.recipeId);
      if (list.length > gapDays) list.length = gapDays;
      history.set(m.slot, list);
    }
  }

  /**
   * Guard di varietà: se il piatto scelto per uno slot è già stato servito in quello slot
   * negli ultimi `gapDays` giorni, lo sostituisce con la migliore alternativa DEL POOL della
   * dieta approvata, entro ±tol kcal (così il bilanciamento della giornata non cambia) e non
   * usata di recente. Se un'alternativa valida non esiste, il piatto resta com'è.
   */
  private applyVarietyGuard(
    chosen: { slot: string; recipeId: string }[],
    history: Map<string, string[]>,
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number } | null,
    tol: number,
    gapDays: number,
  ): { slot: string; recipeId: string }[] {
    if (!ctx || gapDays <= 0) return chosen;
    const usedToday = new Set<string>(); // nessun piatto due volte nella stessa giornata
    return chosen.map((m) => {
      const recent = history.get(m.slot) ?? [];
      const pool = ctx.slotPool.get(m.slot);
      const baseKcal = ctx.kcalOf.get(m.recipeId);
      const keep = () => { usedToday.add(m.recipeId); return m; };
      if (!recent.includes(m.recipeId) && !usedToday.has(m.recipeId)) return keep();
      if (!pool || baseKcal == null) return keep();
      const lo = baseKcal * (1 - tol);
      const hi = baseKcal * (1 + tol);
      let bestId: string | null = null;
      let bestScore = -Infinity;
      for (const cand of pool) {
        if (cand === m.recipeId || usedToday.has(cand) || recent.includes(cand)) continue;
        const ck = ctx.kcalOf.get(cand);
        if (ck == null || ck < lo || ck > hi) continue; // vincolo bilanciamento
        const s = ctx.score(cand);
        if (s > bestScore) { bestScore = s; bestId = cand; }
      }
      if (!bestId) return keep();
      usedToday.add(bestId);
      return { slot: m.slot, recipeId: bestId };
    });
  }

  /** kcal obiettivo del livello dalla configurazione `Diet.levels` ([{level,kcal}]). */
  private levelTargetKcal(levels: unknown, level: number): number {
    const arr = (levels as { level?: number; kcal?: number }[] | null) ?? [];
    const hit = Array.isArray(arr) ? arr.find((l) => l?.level === level) : undefined;
    return hit?.kcal ?? 0;
  }

  /**
   * Digiuno intermittente: quali slot NON vanno erogati, in base alla finestra scelta dalla
   * cliente (`clientProfile.fastingWindow`, voce #7 del 5/8).
   *
   * Prima la finestra la decideva solo il template della dieta: scegliere «digiuno intermittente»
   * selezionava le diete marcate `fasting` e basta. Ma saltare la colazione o saltare la cena sono
   * due vite diverse, e la cliente non aveva voce in capitolo.
   *
   * Lo spuntino del mattino segue sempre la colazione: se salti la colazione, uno spuntino alle
   * dieci riaprirebbe la finestra e il digiuno non sarebbe più tale.
   */
  private slotSaltatiPerDigiuno(pathType?: string | null, fastingWindow?: string | null): Set<string> {
    if (pathType !== 'intermittent_fasting' || !fastingWindow) return new Set();
    switch (fastingWindow) {
      case 'skip_breakfast':
        return new Set(['breakfast', 'morning_snack']);
      case 'skip_breakfast_lunch':
        return new Set(['breakfast', 'morning_snack', 'lunch']);
      case 'skip_dinner_breakfast':
        return new Set(['breakfast', 'morning_snack', 'dinner']);
      default:
        return new Set();
    }
  }

  /** Pool DayCombo (RecipeInfo per slot) dal contesto di scoring. */
  private dayComboPools(ctx: {
    slotPool: Map<string, Set<string>>;
    kcalOf: Map<string, number>;
    proteinOf: Map<string, number>;
    score: (id: string) => number;
  }, salta: Set<string> = new Set()): { slots: string[]; poolBySlot: Map<string, RecipeInfo[]> } {
    // Gli slot saltati escono PRIMA della composizione, non dopo: così il target kcal della
    // giornata viene ridistribuito sui pasti rimasti invece di lasciare un buco.
    const tutti = [...ctx.slotPool.keys()];
    const rimasti = tutti.filter((s) => !salta.has(s));
    // Rete di sicurezza: se la finestra svuotasse la giornata, si ignora il filtro. Meglio un
    // digiuno impreciso che una cliente senza niente da mangiare.
    const slots = rimasti.length > 0 ? rimasti : tutti;
    const poolBySlot = new Map<string, RecipeInfo[]>();
    for (const [slot, ids] of ctx.slotPool) {
      if (!slots.includes(slot)) continue;
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

  /**
   * Se un cibo NON gradito è l'ingrediente PRINCIPALE (compare nel NOME del piatto),
   * sostituire l'ingrediente non basta: si cambia PIATTO con un'alternativa equivalente
   * (stesso slot, stesso regime, kcal più vicine, senza cibi esclusi/intolleranze).
   * Muta i MealSnapshot passati e ritorna gli scambi fatti (from→to).
   */
  /**
   * Pool di ricette SEMPLICI (difficulty="semplice", attive) per gli slot richiesti, filtrate
   * sulle esclusioni della cliente (allergie + intolleranze + cibi non graditi, espanse per
   * categoria: es. "legumi" → ceci, lenticchie…). Usato quando la cliente ha attivato
   * "preferisco ricette semplici". Ritorna solo ricette dello stesso regime del piano.
   */
  private async buildSimpleSlotPool(
    regime: string | null,
    slots: string[],
    excludeTerms: string[],
  ): Promise<Map<string, { id: string; name: string; kcal: number }[]>> {
    const out = new Map<string, { id: string; name: string; kcal: number }[]>();
    if (!regime || slots.length === 0) return out;
    const excluded = new Set<string>();
    for (const t of excludeTerms) for (const kw of expandExclusion(t)) excluded.add(kw);
    const recipes = (await this.prisma.recipe.findMany({
      where: { regime, active: true, difficulty: 'semplice', mealSlot: { in: slots as never } },
      select: { id: true, name: true, kcal: true, mealSlot: true, ingredients: true },
    })) as { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown }[];
    for (const r of recipes) {
      const txt = (r.name + ' ' + (((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' '))).toLowerCase();
      let blocked = false;
      for (const k of excluded) { if (k && txt.includes(k)) { blocked = true; break; } }
      if (blocked) continue;
      if (!out.has(r.mealSlot)) out.set(r.mealSlot, []);
      out.get(r.mealSlot)!.push({ id: r.id, name: r.name, kcal: r.kcal });
    }
    // Ordine deterministico (per kcal, poi id) così la rotazione per giorno è stabile.
    for (const list of out.values()) list.sort((a, b) => a.kcal - b.kcal || a.id.localeCompare(b.id));
    return out;
  }

  /**
   * Applica la preferenza "ricette semplici": per ogni pasto, se esistono alternative semplici
   * entro ±tol kcal (bilanciamento), ne sceglie una ruotando per giorno (dayIndex) — così i
   * piatti semplici si alternano tra loro e, quando il pool è limitato, con quelli esistenti.
   *
   * VARIETÀ: la rotazione `dayIndex % fits.length` degenera a piatto FISSO quando in banda
   * kcal resta una sola ricetta semplice — ed è il caso più comune, perché il pool semplice è
   * piccolo. Con lo storico si preferisce sempre un'alternativa non servita di recente; se non
   * ce n'è, si tiene il piatto del piano (che il guard di varietà ha già reso diverso da ieri)
   * anziché ripetere. Solo se anche quello è recente si ricade sulla rotazione storica.
   */
  private applySimplePreference(
    meals: MealSnapshot[],
    simpleBySlot: Map<string, { id: string; name: string; kcal: number }[]>,
    tol: number,
    dayIndex: number,
    history?: Map<string, string[]>,
  ): MealSnapshot[] {
    const rotate = (list: { id: string; name: string; kcal: number }[]) =>
      list[((dayIndex % list.length) + list.length) % list.length];
    return meals.map((m) => {
      const pool = simpleBySlot.get(m.slot);
      if (!pool || pool.length === 0) return m;
      const lo = m.kcal * (1 - tol);
      const hi = m.kcal * (1 + tol);
      const fits = pool.filter((c) => c.id !== m.recipeId && c.kcal >= lo && c.kcal <= hi);
      if (fits.length === 0) return m;
      const recent = new Set(history?.get(m.slot) ?? []);
      const fresh = fits.filter((c) => !recent.has(c.id));
      // 1) un piatto semplice mai servito di recente: è la scelta migliore, soddisfa
      //    la preferenza della cliente senza ripetere.
      if (fresh.length) {
        const pick = rotate(fresh);
        return { slot: m.slot, recipeId: pick.id, name: pick.name, kcal: pick.kcal, substitutions: m.substitutions };
      }
      // 2) tutte le semplici sono già state servite di recente: se il piatto del piano non lo
      //    è, si tiene quello. La varietà percepita conta più della preferenza di stile.
      if (!recent.has(m.recipeId)) return m;
      // 3) anche il piatto del piano è recente: nessuna opzione fresca, rotazione storica.
      const pick = rotate(fits);
      return { slot: m.slot, recipeId: pick.id, name: pick.name, kcal: pick.kcal, substitutions: m.substitutions };
    });
  }

  /**
   * Sostituisce i piatti che contengono un cibo non gradito. È l'ULTIMO passaggio prima del
   * salvataggio, quindi riscrive quanto composto a monte: due accortezze lo rendono innocuo.
   *
   * `dietPool` (id delle ricette dei template, per pasto) fa cercare l'alternativa PRIMA
   * dentro la dieta: senza, si pescava dall'intero catalogo filtrato per `regime` della
   * cliente, e un piano di pesce registrato onnivoro finiva per servire carne.
   *
   * `history` (piatti già serviti in quel pasto negli ultimi `varietyGap` giorni) evita che
   * la scelta — deterministica, la più vicina in kcal — riproponga sempre lo stesso
   * sostituto, annullando la garanzia di varietà applicata in composizione.
   */
  private async swapDislikedDishes(
    clientId: string,
    meals: MealSnapshot[],
    dislikes: string[],
    dietPool?: Map<string, Set<string>>,
    history?: Map<string, string[]>,
  ): Promise<{ from: string; to: string }[]> {
    const dl = dislikes.map((s) => s.toLowerCase().trim()).filter((s) => s.length >= 2);
    if (!dl.length) return [];
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { regime: true, intolerances: true, dislikedFoods: true },
    });
    // Un piatto alternativo non deve contenere NIENTE di escluso (né il cibo indicato,
    // né gli altri non graditi, né le parole chiave delle intolleranze).
    const excluded = new Set<string>();
    for (const term of dl) for (const kw of expandExclusion(term)) excluded.add(kw);
    for (const intol of ((profile?.intolerances ?? []) as string[])) {
      for (const kw of expandExclusion(intol)) excluded.add(kw);
    }
    // Cibi non graditi: espansi per CATEGORIA (es. "frutta secca"/"legumi" → noci, ceci…).
    for (const d of ((profile?.dislikedFoods ?? []) as string[])) {
      for (const kw of expandExclusion(d)) excluded.add(kw);
    }

    // Trigger dello swap = SOLO i cibi non graditi (dl + dislikedFoods), espansi per categoria.
    // Le intolleranze NON triggerano lo swap qui: sono gestite (ed eventualmente bloccanti) da
    // evaluateMeals a monte. Il piatto va cambiato se il cibo compare nel NOME o tra gli INGREDIENTI.
    const triggerKeys = new Set<string>();
    for (const term of dl) for (const kw of expandExclusion(term)) triggerKeys.add(kw);
    for (const d of ((profile?.dislikedFoods ?? []) as string[])) for (const kw of expandExclusion(d)) triggerKeys.add(kw);
    const mealRecipeIds = [...new Set(meals.map((m) => m.recipeId))];
    const mealRecipes = mealRecipeIds.length
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: mealRecipeIds } }, select: { id: true, ingredients: true } })) as { id: string; ingredients: unknown }[])
      : [];
    const ingTextById = new Map<string, string>(
      mealRecipes.map((r) => [r.id, (((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' ')).toLowerCase()]),
    );

    type Cand = { id: string; name: string; kcal: number; ingredients: unknown };
    const acceptable = (c: Cand) => {
      const txt = (c.name + ' ' + (((c.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' '))).toLowerCase();
      for (const k of excluded) if (k && txt.includes(k)) return false;
      return true;
    };
    // Due livelli, interrogati solo quando servono: prima la dieta, poi il catalogo.
    const fromDietBySlot = new Map<string, Cand[]>();
    const fromCatalogBySlot = new Map<string, Cand[]>();
    const swapped: { from: string; to: string }[] = [];
    for (const m of meals) {
      const hay = ((m.name ?? '') + ' ' + (ingTextById.get(m.recipeId) ?? '')).toLowerCase();
      if (![...triggerKeys].some((k) => k && hay.includes(k))) continue;
      // 1) Alternativa DENTRO il pool della dieta. Niente filtro per regime: il pool è già
      //    la volontà del nutrizionista, e filtrarlo per il regime registrato sulla cliente
      //    è proprio ciò che escludeva i piatti di pesce da un piano di pesce.
      if (!fromDietBySlot.has(m.slot)) {
        const ids = [...(dietPool?.get(m.slot) ?? [])];
        const rows = ids.length
          ? ((await this.prisma.recipe.findMany({
              where: { id: { in: ids }, active: true },
              select: { id: true, name: true, kcal: true, ingredients: true },
              orderBy: { id: 'asc' },
            })) as Cand[])
          : [];
        fromDietBySlot.set(m.slot, rows.filter(acceptable));
      }
      let tier = (fromDietBySlot.get(m.slot) ?? []).filter((c) => c.id !== m.recipeId);
      // 2) Solo se la dieta non offre nulla di accettabile si allarga al catalogo per regime.
      if (!tier.length) {
        if (!fromCatalogBySlot.has(m.slot)) {
          const rows = (await this.prisma.recipe.findMany({
            where: { mealSlot: m.slot as never, active: true, ...(profile?.regime ? { regime: profile.regime } : {}) },
            select: { id: true, name: true, kcal: true, ingredients: true },
            orderBy: { id: 'asc' },
          })) as Cand[];
          fromCatalogBySlot.set(m.slot, rows.filter(acceptable));
        }
        tier = (fromCatalogBySlot.get(m.slot) ?? []).filter((c) => c.id !== m.recipeId);
      }
      if (!tier.length) continue;
      // 3) A parità di idoneità si scarta ciò che è già stato servito di recente in questo
      //    pasto; se è recente tutto quanto, si ripiega sull'intero livello.
      const recent = new Set(history?.get(m.slot) ?? []);
      const fresh = tier.filter((c) => !recent.has(c.id));
      const candidates = fresh.length ? fresh : tier;
      // Il tie-break sull'id serve: due candidati con le stesse kcal si alternavano a seconda
      // dell'ordine — non garantito — restituito dal database.
      candidates.sort((a, b) => Math.abs(a.kcal - m.kcal) - Math.abs(b.kcal - m.kcal) || a.id.localeCompare(b.id));
      const best = candidates[0];
      swapped.push({ from: m.name, to: best.name });
      m.substitutions = [...(m.substitutions ?? []), { from: m.name, to: best.name, reason: 'non gradito' }];
      m.recipeId = best.id;
      m.name = best.name;
      m.kcal = best.kcal;
    }
    return swapped;
  }

  /**
   * "Sostituisci un ingrediente": la cliente indica un cibo da togliere dai menu già
   * erogati, e sceglie PER QUANTO deve valere.
   *
   * La portata gliela chiediamo prima di applicare, non dopo, perché le tre situazioni
   * sono davvero diverse e solo lei le sa distinguere: «oggi non ce l'ho in casa» (`today`),
   * «in questi giorni non lo voglio» (`days`), «questo cibo non mi piace» (`forever`).
   * Solo l'ultima entra nei `dislikedFoods`, che restringono il pool di TUTTI i menu
   * futuri — ed è un effetto pesante: su una cliente reale 13 esclusioni accumulate
   * avevano ridotto a 1 su 5 i pranzi utilizzabili della sua dieta.
   *
   * I cibi non graditi non bloccano mai il piano: al massimo cambiano il piatto.
   *
   * Unica eccezione: le **spezie**. Vedi `spezie.ts` — una spezia esclusa cancella dal ricettario
   * ogni piatto che la contiene, ed è così che una cliente si è ritrovata lo stesso pranzo per
   * quattro giorni. La regola della nutrizionista è di non registrarle e di rispondere con un
   * pop-up. Il testo viaggia anche in `message`, così le app già installate — dove gli
   * aggiornamenti OTA sono spenti — lo mostrano lo stesso al posto della conferma.
   */
  async substituteDisliked(
    clientId: string,
    rawIngredient: string,
    scope: 'today' | 'days' | 'forever' = 'days',
  ): Promise<{
    applied: { day: string; from: string; to: string }[];
    disliked: string;
    scope: 'today' | 'days' | 'forever';
    forever: boolean;
    message: string;
    /** Falso quando la richiesta è stata fermata (per ora: solo le spezie). */
    applicato: boolean;
    /** Presente solo se c'è un pop-up da mostrare. */
    avvisoSpezia?: EsitoSpezia;
  }> {
    const ingredient = (rawIngredient ?? '').trim();
    if (ingredient.length < 2) throw new BadRequestException("Scrivi l'ingrediente che non gradisci.");
    const forever = scope === 'forever';

    // Il cancello delle spezie vale per TUTTE le portate, non solo per "per sempre": anche una
    // sostituzione di tre giorni farebbe scartare i piatti speziati, che è il danno da evitare.
    const spezia = classificaSpezia(ingredient);
    if (spezia.tipo !== 'nessuna') {
      try {
        await this.audit.log({
          action: 'menu.spezia.rifiutata',
          actorId: clientId,
          entityType: 'client_profile',
          entityId: clientId,
          metadata: { termine: ingredient, tipo: spezia.tipo, scope },
        });
      } catch {
        /* l'audit non deve impedire la risposta alla cliente */
      }
      return {
        applied: [],
        disliked: ingredient,
        scope,
        forever,
        message: spezia.testo,
        applicato: false,
        avvisoSpezia: spezia,
      };
    }

    // 1) Solo se la cliente ha CONFERMATO l'esclusione permanente → dislikedFoods.
    if (forever) {
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { dislikedFoods: true },
      });
      const current = ((profile?.dislikedFoods ?? []) as string[]);
      const already = current.some((s) => s.toLowerCase().trim() === ingredient.toLowerCase());
      if (!already) {
        await this.prisma.clientProfile.update({
          where: { userId: clientId },
          data: { dislikedFoods: [...current, ingredient] },
        });
      }
    }

    // 2) Correggi i menu GIÀ EROGATI, da oggi in avanti per quanto ha chiesto la cliente
    //    (anche i giorni non ancora visibili): l'ingrediente indicato conta anche se non
    //    è nei dislikedFoods.
    const today = toDateOnly();
    const daysAffected = scope === 'today' ? 1 : 3;
    const days = await this.prisma.menuDay.findMany({
      where: { clientId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: daysAffected,
    });
    const applied: { day: string; from: string; to: string }[] = [];
    for (const day of days) {
      const meals = ((day.meals as unknown as MealSnapshot[]) ?? []).map((m) => ({ ...m }));
      const dayKey = day.date.toISOString().slice(0, 10);
      // 1) Piatti che hanno il cibo nel NOME (ingrediente principale) → si cambia PIATTO.
      const swaps = await this.swapDislikedDishes(clientId, meals, [ingredient]);
      for (const s of swaps) applied.push({ day: dayKey, from: s.from, to: s.to });
      // 2) Piatti dove compare solo tra gli ingredienti → sostituzione sicura annotata.
      const { subsByRecipe } = await this.evaluateMeals(clientId, meals, [ingredient]);
      let touched = swaps.length > 0;
      const updated = meals.map((m) => {
        const subs = subsByRecipe[m.recipeId];
        if (subs && subs.length) {
          touched = true;
          for (const s of subs) applied.push({ day: dayKey, from: s.from, to: s.to });
          return { ...m, substitutions: [...(m.substitutions ?? []), ...subs] };
        }
        return m;
      });
      if (touched) {
        await this.prisma.menuDay.update({ where: { id: day.id }, data: { meals: updated as never } });
      }
    }
    // Il messaggio dice esattamente per quanto vale: una cliente che ha chiesto "solo oggi"
    // non deve leggere "nei prossimi menu" e restare col dubbio di aver escluso troppo.
    const uniquePairs = [...new Set(applied.map((s) => `«${s.from}» → «${s.to}»`))];
    const where = scope === 'today' ? 'nel menu di oggi' : 'nei menu di oggi e dei prossimi due giorni';
    let message: string;
    if (applied.length) {
      message = `Fatto, ${where}: ${uniquePairs.join(', ')}.`;
      if (forever) message += ` E d'ora in poi «${ingredient}» non comparirà più nei tuoi menu.`;
      else if (scope === 'today') message += ' Da domani torna disponibile.';
    } else if (forever) {
      message = `Preferenza salvata: «${ingredient}» non c'è ${where} e non comparirà nei menu successivi.`;
    } else {
      message = `${where.charAt(0).toUpperCase()}${where.slice(1)} quell'ingrediente non compare` +
        (scope === 'today' ? '.' : ' (se invece lo vedi ancora, scrivilo alla tua coach: sistemiamo noi).');
    }
    return { applied, disliked: ingredient, scope, forever, message, applicato: true };
  }

  /**
   * Cambio TIPO di dieta (regime/stile): i giorni già consumati restano com'erano,
   * i giorni FUTURI già erogati vengono cancellati e rierogati con la nuova dieta —
   * si eroga solo la differenza, il conteggio dei giorni già ricevuti non cambia.
   */
  async redeliverFutureDays(clientId: string): Promise<{ removed: number; delivered: string[] }> {
    const today = toDateOnly();
    const del = await this.prisma.menuDay.deleteMany({ where: { clientId, date: { gt: today } } });
    const delivered = await this.deliverIfEligible(clientId);
    return { removed: del.count, delivered };
  }

  /**
   * RIGENERA i menu da OGGI in poi (incluso oggi), senza toccare lo storico passato.
   * Serve a correggere i menu GIÀ EROGATI ma sbagliati da una vecchia generazione
   * (es. un giorno con la sola colazione): li cancella e li rieroga con la logica
   * attuale (corretta). Rispetta gate misure/finestre come l'erogazione normale
   * (quindi può restituire 0 giorni se la cliente non è idonea: es. misure mancanti).
   */
  async regenerateFromToday(clientId: string): Promise<{ removed: number; delivered: string[] }> {
    const today = toDateOnly();
    const del = await this.prisma.menuDay.deleteMany({ where: { clientId, date: { gte: today } } });
    const delivered = await this.deliverIfEligible(clientId);
    return { removed: del.count, delivered };
  }

  /**
   * Cambio DATA DI INIZIO piano: si cancellano TUTTI i menu erogati e si riparte
   * dalla nuova data impostata (il piano ricomincia da lì).
   */
  async restartFromPlanStart(clientId: string): Promise<{ removed: number; delivered: string[] }> {
    const del = await this.prisma.menuDay.deleteMany({ where: { clientId } });
    const delivered = await this.deliverIfEligible(clientId);
    return { removed: del.count, delivered };
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
    extraDisliked: string[] = [],
  ): Promise<{ violations: string[]; subsByRecipe: Record<string, Substitution[]> }> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { intolerances: true, dislikedFoods: true },
    });
    const intolerances = ((profile?.intolerances ?? []) as string[]).map((s) => s.toLowerCase().trim()).filter(Boolean);
    const dislikes = [...new Set([...((profile?.dislikedFoods ?? []) as string[]), ...extraDisliked].map((s) => s.toLowerCase().trim()).filter(Boolean))];
    if (!intolerances.length && !dislikes.length) return { violations: [], subsByRecipe: {} };

    // Termini esclusi con la loro "causa" e se sono di sicurezza (bloccanti).
    const excluded: { keyword: string; reason: string; blocking: boolean }[] = [];
    for (const intol of intolerances) {
      for (const kw of expandExclusion(intol)) excluded.push({ keyword: kw, reason: intol, blocking: true });
    }
    // Cibi non graditi: espansi per CATEGORIA (es. "frutta secca"/"legumi" → noci, ceci…),
    // così un'esclusione generica intercetta i singoli alimenti. Non bloccano mai (solo sostituzione).
    for (const d of dislikes) {
      for (const kw of expandExclusion(d)) excluded.push({ keyword: kw, reason: 'non gradito', blocking: false });
    }

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

  /**
   * Dieta approvata più adatta al profilo. La scala dei ripieghi vive in `pick-diet.ts`, una
   * sola volta: qui e in `personal-base.service.ts` era copiata identica riga per riga, e due
   * copie della stessa logica prima o poi divergono — il menu del giorno e la base
   * personalizzata sicura si costruirebbero su due diete diverse, in silenzio.
   */
  private async pickDiet(profile: DietMatchProfile) {
    return pickDietFor(
      (where) => this.prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' } }),
      profile,
    );
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

/**
 * Stagione METEOROLOGICA dell'emisfero nord, che è dove stanno le clienti.
 * Si usano i confini meteorologici (mar-mag, giu-ago, set-nov, dic-feb) e non quelli astronomici:
 * a fine giugno il calendario dice ancora primavera per qualche giorno, ma nessuno cucina lo
 * spezzatino — ed è proprio quel caso che ha fatto nascere questa regola.
 */
export function stagioneCorrente(d: Date = new Date()): string {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}
