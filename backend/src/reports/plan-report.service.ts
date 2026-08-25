import { Injectable, NotFoundException } from '@nestjs/common';
import { aGiorno, giornoDelDato, meseDopo } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { prezzoEffettivo } from '../commerce/prezzo-piano';
import { ConfigParamsService } from '../config-params/config-params.service';
import { avanzamentoPeso } from '../signals/percentuale-obiettivo';
import { litriObiettivo } from '../common/obiettivo-acqua';

/**
 * Report di fine piano (handoff Prezzi/Prova, punto 4): generato in automatico a
 * OGNI fine piano, prova gratuita inclusa. Dati pescati da motore + CRM: misure
 * A→B, aderenza, "cosa ha imparato Gaia su di te", coach reale, obiettivo, offerta.
 * CONSEGNA IN APP (sono dati sanitari: mai come allegato email/WhatsApp — la
 * notifica contiene solo l'avviso). Nomi sempre dinamici dall'anagrafica.
 * Lo snapshot è congelato in `data`: resta leggibile anche dopo il purge.
 */

const round1 = (n: number) => Math.round(n * 10) / 10;

// Etichette leggibili per i codici più comuni (fallback: codice "titolato").
const REGIME_LABEL: Record<string, string> = { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' };
const STYLE_LABEL: Record<string, string> = {
  mediterranean: 'Mediterranea', keto: 'Keto', keto_mediterranean: 'Keto-Mediterranea', protein: 'Proteica', flexible: 'Flessibile',
  detox: 'Detossinante', lowcarb: 'Low carb',
};
const label = (map: Record<string, string>, code: string | null | undefined): string | null => {
  if (!code) return null;
  return map[code] ?? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
};

const EVENT_LABEL: Record<string, string> = {
  wedding: 'Matrimonio', baptism: 'Battesimo', dinner: 'Cena fuori',
  monthly_cheat: 'Sgarro del mese', vacation: 'Vacanza', other: 'Evento',
};
const MONTH_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export interface MeasurePoint { date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }

/** Tappa del "diario del percorso": prova gratuita o mese del piano. */
export interface JourneyStep {
  label: string; // "8 giorni" | "Mese 1" | ...
  from: string;
  to: string;
  deltaKg: number | null; // calo nel tratto (negativo = perso)
  endWeightKg: number | null;
  events: string[]; // eventi gestiti nel tratto (etichette leggibili)
  prefsLearned: number; // preferenze piatti aggiornate nel tratto
}

export interface PlanReportData {
  kind: 'trial' | 'plan' | 'monthly';
  planName: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  clientName: string;
  measures: {
    start: MeasurePoint | null;
    end: MeasurePoint | null;
    deltaWeightKg: number | null;
    deltaWaistCm: number | null;
    deltaHipsCm: number | null;
  };
  adherence: { days: number; checkins: number; pct: number | null; ratings: number };
  objective: { targetWeightKg: number | null; toGoKg: number | null };
  gaia: string[]; // "cosa ha imparato Gaia su di te" — solo fatti reali dal DB
  coach: { name: string; phone: string | null } | null;
  offer: {
    planId: string;
    planName: string;
    priceCents: number;
    listPriceCents: number | null;
    promoActive: boolean;
    promoEndsAt: string | null;
    period: string;
    code: string | null; // codice sconto personale (punto 5 dell'handoff)
    codeExpiresAt: string | null;
    // Opzione B: prezzo che il piano proposto assume COL codice (target esatto, es. €249).
    codePriceCents: number | null;
  } | null;
  // --- Diario del percorso (modello luglio 2026): campi opzionali, i report vecchi non li hanno. ---
  /** Timeline: 8 giorni di prova (se c'è stata) + un tratto per mese del piano. */
  journey?: JourneyStep[];
  /** Abitudini del periodo: acqua e passi (medie reali) con obiettivo personalizzato. */
  habits?: {
    waterAvgL: number | null;
    waterGoalL: number | null;
    stepsAvg: number | null;
    stepsGoal: number;
    /** Serie giornaliere del periodo per i mini-grafici (litri e passi per giorno). */
    waterSeries?: { date: string; liters: number }[];
    stepsSeries?: { date: string; steps: number }[];
  };
  /** Tappe del grafico "i tuoi passi verso l'obiettivo": inizio → oggi (+ obiettivo lato UI). */
  milestones?: { label: string; date: string; weightKg: number }[];
  /** Stima di arrivo all'obiettivo al ritmo attuale (es. "entro dicembre 2026"). */
  etaLabel?: string | null;
  /**
   * Piano mantenimento per il box «una pausa», se esiste a catalogo. Il prezzo è quello che il
   * checkout addebiterà (`prezzoEffettivo`, 12/8): prima era `priceCents` grezzo, e a promo scaduta
   * il report prometteva meno di quanto il carrello avrebbe chiesto. Qui una volta c'era scritto «a
   * €29/mese» — un commento con un prezzo dentro invecchia come il codice, ma nessuno lo verifica.
   */
  maintenance?: { planId: string; planName: string; priceCents: number; billing: string } | null;
  /** Prezzo dei menu di rientro del Monitoraggio (per il box "gratis · 1 mese"). */
  // I menu di rientro sono INCLUSI dal 7/8 (prima erano un prodotto a €29): qui non c'è più un
  // prezzo da mostrare, solo il fatto che il monitoraggio sia proponibile.
  monitoring?: { inclusiIMenuDiRientro: true } | null;
}

@Injectable()
export class PlanReportService {
  constructor(
    private readonly prisma: PrismaService,
    // ⚠️ `ConfigParamsService` (modulo @Global) per leggere gli stessi obiettivi della home: acqua e
    // passi erano scritti a mano qui dentro, e dicevano numeri diversi da quelli in app.
    private readonly configParams: ConfigParamsService,
  ) {}

  // ---------- Generazione ----------

  /**
   * ⚠️ **QUI C'ERANO DUE DOMANDE IN UNA FUNZIONE SOLA, ed è per questo che il difetto non si vedeva.**
   *
   * `day0` veniva chiamata sia su `new Date()` — «che giorno è oggi» — sia su `sub.startDate` e
   * `sub.endDate` — «di che giorno è questa data salvata». Sono due domande **diverse** con due
   * risposte diverse, e `setHours(0,0,0,0)` rispondeva a tutte e due nel fuso del processo: su
   * Render è UTC, quindi fra mezzanotte e le 02:00 in Italia «oggi» era **ieri**.
   *
   * È lo stesso miscuglio già trovato in `coach-tasks.day()` il 20/8, e la stessa correzione: due
   * funzioni con due nomi, così al punto di chiamata si vede quale domanda si sta facendo.
   */
  private oggiGiorno(): Date {
    return aGiorno(new Date());
  }

  /** Il giorno di una data SALVATA: resta in UTC — vedi il commento su `giornoDelDato`. */
  private day0(d: Date): Date {
    return giornoDelDato(d);
  }

  /** Prezzo effettivo del piano: promo attiva finché listino presente e scadenza non passata. */
  /**
   * ⚠️ Questa copia della regola DIVERGEVA da quella del commerce: con un `listPriceCents` non
   * maggiore di `priceCents` mostrava il numero più basso, mentre il carrello chiedeva l'altro —
   * un report che prometteva alla cliente meno di quanto avrebbe poi pagato. Ora la regola è una
   * sola (`common/prezzo-piano.ts`), ed è quella di chi incassa.
   */
  private pricing(p: { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }) {
    return prezzoEffettivo(p);
  }

  /**
   * Mese calendario dopo `d` (31/1 + 1 mese → 28/2, non 3/3), a partire dal **giorno** di `d`.
   *
   * ⚠️ **L'aritmetica non sta più qui** (25/8): sta in `common/date-only.ts` (`meseDopo`), perché
   * `commerce.service` rispondeva alla stessa domanda in un altro modo — `setMonth` secco, che sul
   * 31 gennaio dava il 3 marzo. Due definizioni di «un mese» sui soldi. Qui resta la parte che è di
   * questo file: che si parte dal **giorno** di una data salvata (`day0`), non dall'istante.
   *
   * ⚠️ E `day0`/`meseDopo` lavorano in UTC: `getDate` e `setMonth` leggono il fuso del **processo**,
   * quindi su Render (UTC) il conto tornava e su ogni portatile italiano no.
   */
  private addMonths(d: Date, n: number): Date {
    return meseDopo(this.day0(d), n);
  }

  /**
   * Genera (se non esiste già) il report FINALE per un abbonamento concluso.
   * Idempotente: unicità su (subscriptionId, periodKey). Crea la notifica in-app.
   */
  async generateForSubscription(subscriptionId: string): Promise<{ created: boolean; reportId: string | null }> {
    const sub = (await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    })) as { id: string; clientId: string; startDate: Date | null; endDate: Date | null; plan: { name: string; priceCents: number } } | null;
    if (!sub?.startDate || !sub.endDate) return { created: false, reportId: null };
    const kind: 'trial' | 'plan' = sub.plan.priceCents === 0 ? 'trial' : 'plan';
    return this.buildAndSave(sub.clientId, sub.id, sub.plan.name, this.day0(sub.startDate), this.day0(sub.endDate), kind, 'final');
  }

  /**
   * Costruisce lo snapshot del periodo [start, end] e lo salva (se non esiste già
   * per quel periodKey). Stesso impianto per finale e mensile: cambia solo la cadenza.
   */
  private async buildAndSave(
    clientId: string,
    subscriptionId: string,
    planName: string,
    start: Date,
    end: Date,
    kind: 'trial' | 'plan' | 'monthly',
    periodKey: string,
  ): Promise<{ created: boolean; reportId: string | null }> {
    const exists = (await this.prisma.clientReport.findFirst({
      where: { subscriptionId, periodKey } as never,
      select: { id: true },
    })) as { id: string } | null;
    if (exists) return { created: false, reportId: exists.id };

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        name: true, regime: true, dietStyle: true, mealsPerDay: true,
        allergies: true, intolerances: true, dislikedFoods: true,
        // ⚠️ Il peso di partenza serve alla media mobile: senza, `avanzamentoPeso` ripiega sulla
        // prima misura del campione, che qui è la prima del periodo e non l'inizio del percorso.
        startWeightKg: true,
        assignedCoach: { select: { displayName: true, user: { select: { phone: true } } } },
      },
    })) as {
      name: string | null; regime: string | null; dietStyle: string | null; mealsPerDay: number | null;
      allergies: string[]; intolerances: string[]; dislikedFoods: string[]; startWeightKg: number | null;
      assignedCoach: { displayName: string; user: { phone: string | null } } | null;
    } | null;

    // Misure A→B: A = ultima misura PRIMA dell'inizio (o la prima del periodo);
    // B = ultima misura entro fine periodo (+2 giorni di tolleranza).
    const endTol = new Date(end.getTime() + 2 * 86_400_000);
    const ms = (await this.prisma.measurement.findMany({
      where: { clientId, date: { lte: endTol } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true, waistCm: true, hipsCm: true },
    })) as { date: Date; weightKg: number; waistCm: number | null; hipsCm: number | null }[];
    const before = ms.filter((m) => m.date.getTime() <= start.getTime());
    const inPeriod = ms.filter((m) => m.date.getTime() > start.getTime());
    const a = before[before.length - 1] ?? inPeriod[0] ?? null;
    const bCandidates = ms.filter((m) => !a || m.date.getTime() > a.date.getTime());
    const b = bCandidates[bCandidates.length - 1] ?? null;
    const point = (m: typeof a): MeasurePoint | null => (m ? {
      date: m.date.toISOString().slice(0, 10), weightKg: m.weightKg, waistCm: m.waistCm, hipsCm: m.hipsCm,
    } : null);
    const delta = (x: number | null | undefined, y: number | null | undefined) =>
      x != null && y != null ? round1(y - x) : null;

    // Aderenza: check-in registrati sui giorni del piano.
    const [checkins, ratings] = await Promise.all([
      this.prisma.dailyCheckin.count({ where: { clientId, date: { gte: start, lte: end } } }),
      this.prisma.recipeRating.count({ where: { clientId, date: { gte: start, lte: end } } }),
    ]);
    const pct = days > 0 ? Math.min(100, Math.round((checkins / days) * 100)) : null;

    // Obiettivo (ultimo confermato o proposto).
    const objective = (await this.prisma.objective.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { targetWeightKg: true },
    })) as { targetWeightKg: number | null } | null;
    const targetWeightKg = objective?.targetWeightKg ?? null;

    /**
     * ⚠️ QUANTO MANCA SI DICE SULLA **TENDENZA**, NON SULLA PESATA DI STAMATTINA (19/8, decisione di
     * Simone).
     *
     * ⚠️ E questa schermata non è il PDF firmato. Il Report-documento resta sul peso **misurato** —
     * è un fatto verificabile che lei può portare dal medico, e lì la scelta è scritta e spiegata
     * (`reports.service`). Questo è il **Report dentro l'app** (`app/src/pages/Report.tsx`), che lei
     * apre a fine piano: scriveva «−4,2 kg da oggi» sull'ultima pesata mentre la pagina Obiettivo
     * della stessa app, due schermate più in là, ne diceva un altro sulla media mobile. Due numeri
     * diversi sulla stessa persona dentro la stessa app, e nessuno a dire perché.
     *
     * ⚠️ **Cambia anche la decisione che ci sta sotto**: `objectiveReached` qui sceglie se offrirle
     * il Mantenimento o un altro piano-obiettivo, ed è la stessa domanda di
     * `commerce.hasReachedObjective` — passata alla media mobile lo stesso giorno, perché proporre
     * il Mantenimento per una mattina fortunata vuol dire venderlo un attimo prima che il peso
     * risalga. Due punti che rispondono alla stessa domanda devono dare la stessa risposta.
     *
     * ⚠️ Restano **misurati** i confronti A→B del periodo e i traguardi: raccontano cosa è successo,
     * e la storia di una persona non si ridisegna con una media.
     */
    const finestraMedia = await this.configParams.getNumber('moving_average_window', 3).catch(() => 3);
    const avanzamento = avanzamentoPeso(
      ms.map((m) => m.weightKg),
      profile?.startWeightKg ?? null,
      targetWeightKg,
      finestraMedia,
    );
    /** Il peso «di adesso» per tutto ciò che guarda **avanti**: la tendenza, non l'ultimo numero. */
    const pesoDiAdesso = avanzamento.pesoDiAdesso ?? b?.weightKg ?? null;
    const toGoKg = targetWeightKg != null && pesoDiAdesso != null ? round1(pesoDiAdesso - targetWeightKg) : null;

    // "Cosa ha imparato Gaia su di te" — SOLO fatti reali presenti a DB.
    const gaia: string[] = [];
    const styleL = label(STYLE_LABEL, profile?.dietStyle);
    const regimeL = label(REGIME_LABEL, profile?.regime);
    if (styleL || regimeL) {
      gaia.push(`Metodo: ${[styleL, regimeL ? regimeL.toLowerCase() : null].filter(Boolean).join(' ')}${profile?.mealsPerDay ? ` · ${profile.mealsPerDay} pasti al giorno` : ''}, tarato sul tuo profilo`);
    }
    const prefs = await this.prisma.menuWeight.count({ where: { clientId } });
    if (prefs > 0) gaia.push(`Gusti: ${prefs} preferenze sui piatti imparate dai tuoi voti e usate nei menu`);
    const topRated = (await this.prisma.recipeRating.findMany({
      where: { clientId, stars: { gte: 4 }, date: { gte: start, lte: endTol } },
      orderBy: { stars: 'desc' },
      take: 2,
      select: { recipe: { select: { name: true } } },
    })) as { recipe: { name: string } | null }[];
    const topNames = topRated.map((r) => r.recipe?.name).filter(Boolean) as string[];
    if (topNames.length) gaia.push(`Piatti promossi da te: ${topNames.join(' e ')}`);
    const avoid = [...(profile?.allergies ?? []), ...(profile?.intolerances ?? [])].length;
    if (avoid > 0) gaia.push(`Sicurezza: ${avoid} tra allergie e intolleranze SEMPRE rispettate in ogni menu`);
    if ((profile?.dislikedFoods ?? []).length > 0) gaia.push(`Niente ${(profile?.dislikedFoods ?? []).slice(0, 3).join(', ')}: i tuoi no sono stati ascoltati`);
    const eventsHandled = await this.prisma.event.count({ where: { clientId, startDate: { gte: start, lte: end } } });
    if (eventsHandled > 0) gaia.push(`Eventi gestiti: ${eventsHandled} (cene, viaggi…) col piano riadattato, senza sensi di colpa`);
    const cycles = await this.prisma.clientCycle.count({ where: { clientId, cycleStart: { gte: start, lte: end } } });
    if (cycles > 0) gaia.push('Ritmi: ciclo bigiornaliero con 2 cotture, per non annoiarti e non farti cucinare ogni giorno');
    if (gaia.length === 0) gaia.push('Gaia ha iniziato a conoscerti: più la usi, più i menu diventano tuoi');

    // ---- Diario del percorso: timeline, abitudini, tappe, stima (modello Antonio lug 2026) ----

    // Abbonamento corrente (per l'arco completo del percorso) + eventuale prova gratuita precedente.
    const curSub = (await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { startDate: true, endDate: true, plan: { select: { priceCents: true, period: true } } },
    })) as { startDate: Date | null; endDate: Date | null; plan: { priceCents: number; period: string } } | null;
    const trialSub = curSub?.plan.priceCents === 0 ? null : ((await this.prisma.subscription.findFirst({
      where: { clientId, plan: { priceCents: 0 }, startDate: { not: null }, endDate: { not: null } } as never,
      orderBy: { createdAt: 'desc' },
      select: { startDate: true, endDate: true },
    })) as { startDate: Date; endDate: Date } | null);

    // Peso "a una data": ultima misura entro data+2 giorni.
    const weightAt = (d: Date): number | null => {
      const tol = d.getTime() + 2 * 86_400_000;
      let last: number | null = null;
      for (const m of ms) { if (m.date.getTime() <= tol) last = m.weightKg; else break; }
      return last;
    };

    // Tratti: prova (se c'è) + un tratto per mese del piano fino alla fine del periodo del report.
    const segments: { label: string; from: Date; to: Date }[] = [];
    if (trialSub?.startDate && trialSub.endDate && trialSub.endDate.getTime() <= end.getTime()) {
      segments.push({ label: '8 giorni', from: this.day0(trialSub.startDate), to: this.day0(trialSub.endDate) });
    }
    const planStart = curSub?.startDate ? this.day0(curSub.startDate) : start;
    if (kind !== 'trial') {
      for (let i = 1; i <= 24; i++) {
        const from = this.addMonths(planStart, i - 1);
        let to = this.addMonths(planStart, i);
        if (from.getTime() >= end.getTime()) break;
        if (to.getTime() > end.getTime()) to = end;
        segments.push({ label: `Mese ${i}`, from, to });
        if (to.getTime() >= end.getTime()) break;
      }
    }
    const journeyFrom = segments[0]?.from ?? start;
    const [allEvents, segRatings] = await Promise.all([
      this.prisma.event.findMany({
        where: { clientId, startDate: { gte: journeyFrom, lte: end } },
        select: { type: true, label: true, startDate: true },
        orderBy: { startDate: 'asc' },
      }) as Promise<{ type: string; label: string | null; startDate: Date }[]>,
      this.prisma.recipeRating.findMany({
        where: { clientId, date: { gte: journeyFrom, lte: end } },
        select: { date: true },
      }) as Promise<{ date: Date }[]>,
    ]);
    const journey: JourneyStep[] = segments.map((s) => {
      const wFrom = weightAt(s.from);
      const wTo = weightAt(s.to);
      return {
        label: s.label,
        from: s.from.toISOString().slice(0, 10),
        to: s.to.toISOString().slice(0, 10),
        deltaKg: wFrom != null && wTo != null ? round1(wTo - wFrom) : null,
        endWeightKg: wTo,
        events: allEvents
          .filter((e) => e.startDate.getTime() >= s.from.getTime() && e.startDate.getTime() < s.to.getTime())
          .map((e) => e.label?.trim() || EVENT_LABEL[e.type] || 'Evento')
          .slice(0, 3),
        prefsLearned: segRatings.filter((r) => r.date.getTime() >= s.from.getTime() && r.date.getTime() < s.to.getTime()).length,
      };
    });

    // Tappe del grafico: inizio + fine di ogni tratto (l'obiettivo lo aggiunge la UI).
    const milestones: { label: string; date: string; weightKg: number }[] = [];
    const w0 = weightAt(journeyFrom);
    if (w0 != null) milestones.push({ label: 'inizio', date: journeyFrom.toISOString().slice(0, 10), weightKg: w0 });
    for (const j of journey) {
      if (j.endWeightKg == null) continue;
      const isLast = j === journey[journey.length - 1];
      const n = j.label.startsWith('Mese ') ? j.label.slice(5) : null;
      const short = n ? `${n} ${n === '1' ? 'mese' : 'mesi'}` : j.label; // "8 giorni" resta così
      milestones.push({ label: isLast ? 'oggi' : short, date: j.to, weightKg: j.endWeightKg });
    }

    // Abitudini: medie reali di acqua e passi nel periodo del report.
    const [waterRows, stepRows] = await Promise.all([
      this.prisma.waterLog.findMany({ where: { clientId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' }, select: { date: true, glasses: true } }) as Promise<{ date: Date; glasses: number }[]>,
      this.prisma.stepLog.findMany({ where: { clientId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' }, select: { date: true, steps: true } }) as Promise<{ date: Date; steps: number }[]>,
    ]);
    const waterAvgL = waterRows.length ? round1((waterRows.reduce((acc, w) => acc + w.glasses, 0) / waterRows.length) * 0.25) : null;
    // Serie giornaliere per i mini-grafici (1 bicchiere = 250 ml); cap a 31 giorni.
    const waterSeries = waterRows.slice(-31).map((w) => ({ date: w.date.toISOString().slice(0, 10), liters: round1(w.glasses * 0.25) }));
    const stepsSeries = stepRows.slice(-31).map((s) => ({ date: s.date.toISOString().slice(0, 10), steps: s.steps }));
    // Obiettivo acqua ~30 ml/kg sul peso attuale (stessa regola dei segnali).
    /**
     * ⚠️ Stesso obiettivo della home, limiti compresi (12/8). Prima qui c'era `peso × 30 / 1000`:
     * una cliente di 70 kg leggeva 2,25 L in home e 2,1 L qui, e chi beveva 2,2 litri trovava
     * scritto «ci sei» nel report col cerchio incompleto nell'altra schermata.
     */
    const mlPerKg = await this.configParams.getNumber('water_ml_per_kg', 33).catch(() => 33);
    const waterGoalL = b ? litriObiettivo(b.weightKg, mlPerKg) : null;
    const stepsAvg = stepRows.length ? Math.round(stepRows.reduce((acc, s) => acc + s.steps, 0) / stepRows.length) : null;
    const stepsGoal = await this.configParams.getNumber('steps_goal', 8000).catch(() => 8000);

    // Stima "al ritmo attuale": kg/mese sull'arco del percorso → mese di arrivo all'obiettivo.
    // `monthsToGoal` (mesi stimati al traguardo) serve anche a scegliere il piano suggerito 1/3 mesi.
    let etaLabel: string | null = null;
    let monthsToGoal: number | null = null;
    // ⚠️ La stima parte dallo STESSO peso di adesso dei chili che mancano: due numeri accanto
    // calcolati da due pesi diversi si contraddicono («ti mancano 3 kg» e una data che ne presuppone 4).
    if (w0 != null && pesoDiAdesso != null && targetWeightKg != null && pesoDiAdesso > targetWeightKg) {
      const monthsElapsed = Math.max(1, (end.getTime() - journeyFrom.getTime()) / (30.4 * 86_400_000));
      const rate = (pesoDiAdesso - w0) / monthsElapsed; // negativo = perde
      if (rate < -0.05) {
        const monthsLeft = Math.ceil((pesoDiAdesso - targetWeightKg) / -rate);
        monthsToGoal = monthsLeft;
        if (monthsLeft <= 24) {
          const eta = this.addMonths(end, monthsLeft);
          // ⚠️ `getUTCMonth`, non `getMonth` (25/8): `addMonths` rende una mezzanotte **UTC**, e
          // rileggerla nel fuso del processo la sposta al giorno prima ovunque a ovest di Greenwich
          // — cioè scriverebbe il mese precedente accanto a una stima che non è cambiata.
          etaLabel = `entro ${MONTH_IT[eta.getUTCMonth()]} ${eta.getUTCFullYear()}`;
        }
      }
    }

    // Box offerte: il mantenimento a catalogo. (Il prezzo dei menu di rientro non si legge più:
    // il prodotto da €29 è stato eliminato il 7/8 e i menu sono inclusi.)
    // `billing` serve al pulsante del report: senza, il Checkout non mostrava la scelta fra
    // abbonamento e mese singolo e il mantenimento si vendeva SEMPRE come una tantum — cioè la
    // strada principale di conversione a fine percorso convertiva nel modo meno redditizio, e
    // in silenzio (dal Negozio la scelta c'era, quindi nessuno lo notava).
    /**
     * ⚠️ `listPriceCents` e `promoEndsAt` nel `select`, e il prezzo passa da `prezzoEffettivo`.
     *
     * Senza, questo box mostrava `priceCents` grezzo mentre il carrello — a promo scaduta —
     * addebita il listino pieno: la cliente leggeva una cifra nel report e ne pagava un'altra al
     * checkout. Nello stesso report il box dell'offerta lo faceva già giusto: due numeri con due
     * regole diverse, a due centimetri l'uno dall'altro.
     */
    const maintenancePlan = (await this.prisma.plan.findFirst({
      where: { active: true, period: 'maintenance' },
      select: { id: true, name: true, priceCents: true, listPriceCents: true, promoEndsAt: true, billing: true },
    })) as { id: string; name: string; priceCents: number; listPriceCents: number | null; promoEndsAt: Date | null; billing: string | null } | null;

    // Codice sconto personale ancora valido (inviato al giorno 6): compare nel report.
    const personal = (await this.prisma.discountCode.findFirst({
      where: { clientId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } as never,
      orderBy: { createdAt: 'desc' },
      select: { code: true, expiresAt: true, maxTotalUses: true, usedCount: true, planTargets: true } as never,
    })) as { code: string; expiresAt: Date | null; maxTotalUses: number | null; usedCount: number; planTargets?: unknown } | null;
    const personalOk = personal && (personal.maxTotalUses == null || personal.usedCount < personal.maxTotalUses) ? personal : null;

    // PROGRESSIONE del piano suggerito (regole Simone lug 2026):
    //  - obiettivo NON raggiunto → piano-obiettivo 1 o 3 mesi (1 mese se la stima al ritmo attuale
    //    è ≤ 1 mese, altrimenti 3 mesi);
    //  - obiettivo RAGGIUNTO (peso ≤ obiettivo) → MANTENIMENTO;
    //  - dopo un piano di MANTENIMENTO concluso → MONITORAGGIO.
    // Si mostra SOLO il passo pertinente (gli altri box del report restano vuoti).
    const plans = (await this.prisma.plan.findMany({
      where: { active: true, priceCents: { gt: 0 } },
      orderBy: { priceCents: 'desc' },
    })) as { id: string; name: string; priceCents: number; listPriceCents: number | null; promoEndsAt: Date | null; period: string }[];
    const objectiveReached = toGoKg != null && toGoKg <= 0; // peso ≤ obiettivo (scelta 2a)
    const endedIsMaintenance = curSub?.plan.period === 'maintenance';
    const preferOneMonth = monthsToGoal != null && monthsToGoal <= 1; // scelta 1b (stima tempo)
    const oneMonthPlan = plans.find((p) => p.period === '1m');
    const threeMonthPlan = plans.find((p) => p.period === '3m');
    // Piano-obiettivo: 1 o 3 mesi in base alla stima; fallback all'altro o al più caro.
    const courseOfferPlan = endedIsMaintenance || objectiveReached
      ? null
      : ((preferOneMonth ? (oneMonthPlan ?? threeMonthPlan) : (threeMonthPlan ?? oneMonthPlan)) ?? plans[0] ?? null);
    const offerPlan = courseOfferPlan;
    const offer = offerPlan ? (() => {
      const pr = this.pricing(offerPlan);
      return {
        planId: offerPlan.id,
        planName: offerPlan.name,
        priceCents: pr.effectivePriceCents,
        listPriceCents: pr.promoActive ? offerPlan.listPriceCents : null,
        promoActive: pr.promoActive,
        promoEndsAt: offerPlan.promoEndsAt ? offerPlan.promoEndsAt.toISOString() : null,
        period: offerPlan.period,
        code: personalOk?.code ?? null,
        codeExpiresAt: personalOk?.expiresAt ? personalOk.expiresAt.toISOString() : null,
        codePriceCents: (() => {
          const targets = (personalOk?.planTargets ?? null) as Record<string, number> | null;
          const t = targets?.[offerPlan.id];
          return t != null && t < pr.effectivePriceCents ? t : null;
        })(),
      };
    })() : null;

    const data: PlanReportData = {
      kind,
      planName,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      days,
      clientName: profile?.name ?? 'La tua settimana',
      measures: {
        start: point(a),
        end: point(b),
        deltaWeightKg: delta(a?.weightKg, b?.weightKg),
        deltaWaistCm: delta(a?.waistCm, b?.waistCm),
        deltaHipsCm: delta(a?.hipsCm, b?.hipsCm),
      },
      adherence: { days, checkins, pct, ratings },
      objective: { targetWeightKg, toGoKg },
      gaia,
      coach: profile?.assignedCoach
        ? { name: profile.assignedCoach.displayName, phone: profile.assignedCoach.user?.phone ?? null }
        : null,
      offer,
      journey,
      // `steps_goal` dai Parametri, come la home: il numero era scritto a mano qui e in
      // `reports.service`, e il giorno che qualcuno lo alza il report stamperebbe ancora il vecchio
      // — dentro un PDF che la cliente conserva.
      habits: { waterAvgL, waterGoalL, stepsAvg, stepsGoal, waterSeries, stepsSeries },
      milestones,
      etaLabel,
      // Mantenimento: solo a obiettivo RAGGIUNTO (e se il piano finito non era già il mantenimento).
      maintenance: objectiveReached && !endedIsMaintenance && maintenancePlan
        ? {
            planId: maintenancePlan.id,
            planName: maintenancePlan.name,
            // Quello che pagherà davvero, non quello che c'è scritto sulla riga.
            priceCents: prezzoEffettivo(maintenancePlan).effectivePriceCents,
            billing: maintenancePlan.billing ?? 'one_time',
          }
        : null,
      // Monitoraggio: solo DOPO un piano di mantenimento concluso.
      monitoring: endedIsMaintenance ? { inclusiIMenuDiRientro: true as const } : null,
    };

    const report = await this.prisma.clientReport.create({
      data: { clientId, subscriptionId, kind, periodKey, periodStart: start, periodEnd: end, data: data as never } as never,
    });

    // Avviso in app (MAI il contenuto: solo la notifica che il report è pronto).
    await this.prisma.notification.create({
      data: {
        userId: clientId,
        type: 'plan_report',
        payload: {
          title: kind === 'monthly' ? 'Il report del tuo mese è pronto 📊' : 'Il tuo report è pronto 📊',
          body: kind === 'trial'
            ? 'La tua settimana è finita: guarda cosa è cambiato e cosa ha imparato Gaia su di te.'
            : kind === 'monthly'
              ? 'Un altro mese di strada: guarda i progressi A→B e cosa ha imparato Gaia.'
              : 'Il tuo piano si è concluso: guarda i risultati A→B e i prossimi passi.',
          reportId: report.id,
        } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });

    return { created: true, reportId: report.id };
  }

  /**
   * Cron giornaliero: genera il report per ogni piano concluso di recente
   * (finestra 14 giorni) che non l'ha ancora. Idempotente.
   */
  async generateDaily(): Promise<{ created: number }> {
    const now = new Date();
    const from = new Date(now.getTime() - 14 * 86_400_000);
    const ended = (await this.prisma.subscription.findMany({
      where: {
        endDate: { lte: now, gte: from },
        startDate: { not: null },
        status: { in: ['active', 'expired'] as never },
      } as never,
      select: { id: true },
    })) as { id: string }[];
    let created = 0;
    for (const s of ended) {
      try {
        const r = await this.generateForSubscription(s.id);
        if (r.created) created++;
      } catch { /* un errore su un piano non blocca gli altri */ }
    }
    return { created };
  }

  /**
   * Report MENSILE in app (stesso impianto del finale): per ogni abbonamento a
   * pagamento ATTIVO più lungo di un mese, a ogni "mesiversario" dall'inizio si
   * genera lo snapshot del mese appena chiuso ('m1','m2',…). L'ultimo tratto è
   * coperto dal report finale (niente doppione a ridosso della scadenza).
   * Idempotente; sostituisce il vecchio report mensile via email (dati sanitari:
   * la notifica in app contiene solo l'avviso).
   */
  async generateMonthly(): Promise<{ created: number }> {
    const today = this.oggiGiorno();
    const subs = (await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        startDate: { not: null },
        endDate: { not: null },
        plan: { priceCents: { gt: 0 } },
      } as never,
      select: { id: true, clientId: true, startDate: true, endDate: true, plan: { select: { name: true } } },
    })) as { id: string; clientId: string; startDate: Date; endDate: Date; plan: { name: string } }[];
    let created = 0;
    for (const sub of subs) {
      try {
        const start = this.day0(sub.startDate);
        const end = this.day0(sub.endDate);
        for (let i = 1; i <= 24; i++) {
          const boundary = this.addMonths(start, i);
          if (boundary.getTime() > today.getTime()) break; // mese non ancora chiuso
          // Se il piano finisce entro pochi giorni dal mesiversario ci pensa il finale.
          if (boundary.getTime() >= end.getTime() - 3 * 86_400_000) break;
          const r = await this.buildAndSave(sub.clientId, sub.id, sub.plan.name, this.addMonths(start, i - 1), boundary, 'monthly', `m${i}`);
          if (r.created) created++;
        }
      } catch { /* un errore su un piano non blocca gli altri */ }
    }
    return { created };
  }

  // ---------- Lettura (cliente) ----------

  /** Elenco dei report della cliente (solo intestazioni, dal più recente). */
  async listMine(clientId: string) {
    const rows = (await this.prisma.clientReport.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, periodStart: true, periodEnd: true, readAt: true, createdAt: true, data: true },
    })) as { id: string; kind: string; periodStart: Date; periodEnd: Date; readAt: Date | null; createdAt: Date; data: unknown }[];
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      planName: (r.data as PlanReportData)?.planName ?? '',
      periodStart: r.periodStart.toISOString().slice(0, 10),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
      read: r.readAt != null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Report completo (solo il proprio); alla prima apertura viene segnato come letto. */
  async getMine(clientId: string, reportId: string) {
    const r = (await this.prisma.clientReport.findFirst({
      where: { id: reportId, clientId },
      select: { id: true, kind: true, readAt: true, createdAt: true, data: true },
    })) as { id: string; kind: string; readAt: Date | null; createdAt: Date; data: unknown } | null;
    if (!r) throw new NotFoundException('Report non trovato.');
    if (!r.readAt) {
      await this.prisma.clientReport.update({ where: { id: r.id }, data: { readAt: new Date() } });
    }
    return { ...(r.data as PlanReportData), id: r.id, kind: r.kind, createdAt: r.createdAt.toISOString() };
  }
}
