import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

interface Period {
  id: string;
  clientId: string;
  status: string;
  startedAt: Date;
  endsAt: Date;
  referenceWeightKg: number;
  regainOfferedAt: Date | null;
  frozenAt: Date | null;
  closedAt: Date | null;
  convertedTo: string | null;
  lastMeasureAskAt: Date | null;
}

/**
 * Livello "Monitoraggio": sorveglianza a tempo, GRATUITA, per chi finisce il percorso e non
 * rinnova. Gaia non eroga menu di piano: guarda le misure e, se il peso sale oltre la soglia
 * (+3 kg parametrizzabile), eroga gli 8 MENU DI RIENTRO presi dallo storico personale della
 * cliente — i giorni che su di lei hanno fatto perdere di più.
 *
 * ⚠️ **I menu di rientro NON si vendono più** (decisione Simone 7/8). Erano un prodotto a €29
 * («Menu di rientro (8 giorni)»): la cliente riprendeva peso, e per riavere una mano doveva
 * pagare. Ora sono **inclusi** — nel monitoraggio gratuito perché ha già pagato il percorso, in
 * quello a €19/mese perché lo sta pagando. Con loro sparisce anche il CONGELAMENTO per mancato
 * acquisto: non c'è più niente da acquistare, quindi non c'è più niente da rifiutare.
 * Tono sempre supportivo, mai punitivo — e adesso lo è anche il modello, non solo il testo.
 */
@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  private async funnelEvent(name: string, clientId: string, data: Record<string, unknown> = {}): Promise<void> {
    await this.prisma.analyticsEvent
      .create({ data: { eventId: randomUUID(), name, userId: clientId, phase: 'funnel', data: data as never } as never })
      .catch(() => undefined);
  }

  private async activePeriod(clientId: string): Promise<Period | null> {
    return (await this.prisma.monitoringPeriod.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    })) as Period | null;
  }


  private async lastWeight(clientId: string): Promise<{ weightKg: number; date: Date } | null> {
    return (await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true, date: true },
    })) as { weightKg: number; date: Date } | null;
  }

  // ---------- Stato per l'app ----------

  /** Stato del monitoraggio per la cliente: periodo corrente + dati per la card in app. */
  async myStatus(clientId: string) {
    const period = (await this.prisma.monitoringPeriod.findFirst({
      where: { clientId },
      orderBy: { startedAt: 'desc' },
    })) as Period | null;

    // Idoneo ad attivarlo: nessun abbonamento attivo/in attesa e nessun monitoraggio attivo.
    const activeSub = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: ['active', 'pending'] } as never },
      select: { id: true },
    });
    // Idoneo al monitoraggio SOLO dopo un piano di MANTENIMENTO concluso (progressione:
    // percorso → mantenimento → monitoraggio). Prima bastava un qualsiasi abbonamento pregresso,
    // così il monitoraggio compariva subito a fine prova/piano: non è più così.
    // Solo abbonamenti GODUTI (`active` o `expired`): un mantenimento `pending` è un ordine non
    // ancora pagato e sbloccava il monitoraggio a chi aveva solo premuto "acquista". Stessa
    // condizione di `commerce.service.hasHadMaintenance`, che decide se mostrare il monitoraggio
    // a pagamento: le due devono restare uguali, altrimenti la cliente vede l'uno e non l'altro.
    const hadMaintenance = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: ['active', 'expired'] } as never, plan: { period: 'maintenance' } } as never,
      select: { id: true },
    });
    const last = await this.lastWeight(clientId);
    const regainKg = await this.configParams.getNumber('monitoring_regain_kg', 3);

    const active = period?.status === 'active' ? period : null;
    return {
      eligible: !activeSub && !!hadMaintenance && (!period || period.status !== 'active'),
      period: period
        ? {
            id: period.id,
            status: period.status,
            startedAt: period.startedAt.toISOString(),
            endsAt: period.endsAt.toISOString(),
            daysLeft: active ? Math.max(0, Math.ceil((period.endsAt.getTime() - Date.now()) / 86_400_000)) : 0,
            referenceWeightKg: period.referenceWeightKg,
            regainOffered: period.regainOfferedAt != null,
          }
        : null,
      lastWeightKg: last?.weightKg ?? null,
      deltaKg: active && last ? Math.round((last.weightKg - active.referenceWeightKg) * 10) / 10 : null,
      regainThresholdKg: regainKg,
      // I menu di rientro sono inclusi: qui si dice solo SE sono già stati erogati, non a
      // quanto si comprano. Il campo `rientro` con planId e prezzo non esiste più.
      rientroErogato: period?.regainOfferedAt != null,
    };
  }

  // ---------- Attivazione ----------

  /** Attiva il monitoraggio gratuito (cliente, a fine percorso). */
  async start(clientId: string): Promise<{ started: true; endsAt: string }> {
    const activeSub = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: ['active', 'pending'] } as never },
      select: { id: true },
    });
    if (activeSub) throw new BadRequestException('Hai già un piano attivo: il monitoraggio serve dopo la fine del percorso.');
    const existing = await this.activePeriod(clientId);
    if (existing) throw new BadRequestException('Il monitoraggio è già attivo.');
    const last = await this.lastWeight(clientId);
    if (!last) throw new BadRequestException('Serve almeno una pesata registrata per attivare il monitoraggio.');

    const days = await this.configParams.getNumber('monitoring_duration_days', 30);
    const endsAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.monitoringPeriod.create({
      data: { clientId, status: 'active', endsAt, referenceWeightKg: last.weightKg } as never,
    });
    await this.funnelEvent('monitoraggio_started', clientId, { referenceWeightKg: last.weightKg, days });
    await this.notifications
      .notify({
        userId: clientId,
        type: 'monitoring_started',
        title: 'Monitoraggio attivo 🛡️',
        body: `Per ${days} giorni resto in allerta con te: ti chiederò il peso ogni tanto. Il tuo storico resta al sicuro, e se ti serve una mano io sono qui.`,
      })
      .catch(() => undefined);
    return { started: true, endsAt: endsAt.toISOString() };
  }

  // ---------- Cron giornaliero ----------

  /**
   * Giro giornaliero sui monitoraggi attivi: scadenza del mese, proposta di
   * rientro al superamento della soglia, congelamento se l'offerta resta
   * ignorata, richiesta misure se la cliente non si pesa da qualche giorno.
   */
  async dailyTick(): Promise<{ expired: number; offered: number; frozen: number; asked: number }> {
    const now = new Date();
    const [regainKg, offerDays, askDays] = await Promise.all([
      this.configParams.getNumber('monitoring_regain_kg', 3),
      this.configParams.getNumber('monitoring_offer_days', 7),
      this.configParams.getNumber('monitoring_measure_ask_days', 3),
    ]);
    const periods = (await this.prisma.monitoringPeriod.findMany({ where: { status: 'active' } })) as Period[];
    let expired = 0;
    let offered = 0; // ora sono menu EROGATI, non offerte di acquisto
    const frozen = 0; // il congelamento per mancato acquisto non esiste più: non c'è più un acquisto
    let asked = 0;

    for (const p of periods) {
      try {
        // (Qui c'era il CONGELAMENTO di chi non comprava il kit di rientro entro la finestra.
        // Tolto il 7/8 insieme al prodotto: i menu ora sono inclusi, quindi non c'è più un
        // acquisto da rifiutare — e nessuno viene messo in pausa per non aver speso €29.)

        // 2) Scadenza del mese → chiuso, con le tre strade (percorso / mantenimento / nuovo monitoraggio).
        if (p.endsAt.getTime() <= now.getTime()) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { status: 'expired', closedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_scaduto', p.clientId);
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_expired',
              title: 'Il mese di monitoraggio è finito 🌱',
              body: 'Come vuoi proseguire? Puoi ripartire con un percorso di dimagrimento, tenere il peso col mantenimento a €29/mese, o riattivare un altro mese di monitoraggio. Ti aspetto in app.',
            })
            .catch(() => undefined);
          expired++;
          continue;
        }

        const last = await this.lastWeight(p.clientId);

        // 3) Trigger di rientro: peso oltre la soglia → si EROGANO gli 8 menu, senza chiedere
        //    niente. Prima qui partiva un'offerta a €29: la cliente riprendeva peso e, per
        //    avere una mano, doveva comprare. Dal 7/8 sono inclusi.
        if (!p.regainOfferedAt && last && last.weightKg - p.referenceWeightKg >= regainKg) {
          const generati = await this.generateRientroMenus(p.clientId);
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            // Il campo si chiama ancora `regainOfferedAt` (era "offerto"): ora vuol dire
            // "menu di rientro già erogati", e serve a non rierogarli ogni giorno.
            data: { regainOfferedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_rientro_erogato', p.clientId, {
            deltaKg: Math.round((last.weightKg - p.referenceWeightKg) * 10) / 10,
            menus: generati,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_rientro_ready',
              title: 'Ti ho preparato i menu di rientro 🧰',
              body: `Capita a tutte (vacanze, periodi pieni…). Trovi in app ${generati} giornate scelte sul tuo storico: quelle che su di te hanno funzionato meglio. Di solito bastano 4-6 giorni per rimettersi in riga.`,
            })
            .catch(() => undefined);
          offered++;
          continue;
        }

        // 4) Richiesta misure: niente pesata da `askDays` giorni (e non gliel'ho già chiesto da poco).
        const staleMeasure = !last || now.getTime() - last.date.getTime() >= askDays * 86_400_000;
        const askedRecently = p.lastMeasureAskAt && now.getTime() - p.lastMeasureAskAt.getTime() < askDays * 86_400_000;
        if (staleMeasure && !askedRecently) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { lastMeasureAskAt: now } as never,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_measure_ask',
              title: 'Ci pesiamo? ⚖️',
              body: 'Sono qui che veglio su di te: una pesata al volo e so che va tutto bene. Bastano 10 secondi in app.',
            })
            .catch(() => undefined);
          asked++;
        }
      } catch {
        /* un errore su una cliente non blocca il giro */
      }
    }
    return { expired, offered, frozen, asked };
  }

  /** Traccia in audit un giro forzato dall'admin (collaudo/sblocco manuale). */
  async auditTick(actorId: string, result: { expired: number; offered: number; frozen: number; asked: number }): Promise<void> {
    await this.audit.log({
      action: 'monitoring.tick.manual',
      actorId,
      entityType: 'monitoring_period',
      entityId: 'batch',
      metadata: result as never,
    });
  }

  // ---------- Hook dal commercio ----------

  /**
   * Chiamato all'ATTIVAZIONE di un piano (pagamento approvato): il monitoraggio gratuito in
   * corso si chiude, perché la cliente è passata a qualcosa di pagato — un percorso, il
   * mantenimento, o il monitoraggio in abbonamento.
   *
   * ⚠️ Qui c'era il ramo del «Menu di rientro (8 giorni)» a €29: pagato quel piano, si erogavano
   * gli 8 menu e ripartiva un mese gratuito. Il prodotto è stato eliminato il 7/8 — i menu di
   * rientro sono inclusi in entrambi i monitoraggi — quindi il ramo non ha più ragione di
   * esistere: i menu li eroga direttamente il giro giornaliero quando il peso risale.
   */
  async onPlanActivated(clientId: string, plan: { id: string; name: string; priceCents: number; period: string }): Promise<void> {
    try {
      const period = await this.activePeriod(clientId);
      // Conversione: qualsiasi piano a pagamento chiude il monitoraggio in corso.
      if (period && plan.priceCents > 0) {
        const dest = plan.period === 'maintenance' ? 'mantenimento' : 'dimagrimento';
        await this.prisma.monitoringPeriod.update({
          where: { id: period.id },
          data: { status: 'converted', convertedTo: plan.name, closedAt: new Date() } as never,
        });
        await this.funnelEvent('monitoraggio_converted', clientId, { to: dest, planId: plan.id });
      }
    } catch {
      /* il commercio non deve mai fallire per il monitoraggio */
    }
  }

  // ---------- Menu di rientro ----------

  /**
   * Sceglie gli 8 giorni di menu che su QUESTA cliente hanno fatto perdere di più
   * e li ricrea nei prossimi 8 giorni. Ordine di preferenza delle fonti:
   * 1) cicli con esito peggiore→migliore dal learning del motore (cycle_feedback);
   * 2) delta misure attorno a ogni giorno di menu; 3) i giorni più recenti.
   */
  async generateRientroMenus(clientId: string): Promise<number> {
    const history = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lte: new Date() } },
      orderBy: { date: 'desc' },
      take: 400,
      select: { date: true, dietId: true, level: true, meals: true },
    })) as { date: Date; dietId: string; level: number; meals: unknown }[];
    if (history.length === 0) return 0;
    const byKey = new Map<string, { date: Date; dietId: string; level: number; meals: unknown }>();
    for (const h of history) byKey.set(h.date.toISOString().slice(0, 10), h);

    const picked: { date: Date; dietId: string; level: number; meals: unknown }[] = [];
    const pickedKeys = new Set<string>();
    const push = (d: { date: Date; dietId: string; level: number; meals: unknown } | undefined) => {
      if (!d) return;
      const k = d.date.toISOString().slice(0, 10);
      if (pickedKeys.has(k) || picked.length >= 8) return;
      pickedKeys.add(k);
      picked.push(d);
    };

    // 1) Cicli ordinati per calo (deltaWeightKg più negativo prima): i loro giorni sono i migliori.
    const cycles = (await this.prisma.cycleFeedback.findMany({
      where: { clientId, deltaWeightKg: { lt: 0 } },
      orderBy: { deltaWeightKg: 'asc' },
      take: 20,
      select: { cycleStart: true, cycleEnd: true },
    })) as { cycleStart: Date; cycleEnd: Date }[];
    for (const c of cycles) {
      for (let t = this.dayKey(c.cycleStart); t <= this.dayKey(c.cycleEnd); t += 86_400_000) {
        push(byKey.get(new Date(t).toISOString().slice(0, 10)));
      }
      if (picked.length >= 8) break;
    }

    // 2) Delta misure attorno ai singoli giorni di menu.
    if (picked.length < 8) {
      const ms = (await this.prisma.measurement.findMany({
        where: { clientId },
        orderBy: { date: 'asc' },
        select: { date: true, weightKg: true },
      })) as { date: Date; weightKg: number }[];
      const scored = history
        .map((h) => {
          const d = this.dayKey(h.date);
          let before: number | null = null;
          let after: number | null = null;
          for (const m of ms) {
            const t = this.dayKey(m.date);
            if (t <= d) before = m.weightKg;
            else if (after == null && t <= d + 3 * 86_400_000) after = m.weightKg;
          }
          return { h, delta: before != null && after != null ? after - before : null };
        })
        .filter((x): x is { h: (typeof history)[number]; delta: number } => x.delta != null && x.delta < 0)
        .sort((x, y) => x.delta - y.delta);
      for (const s of scored) push(s.h);
    }

    // 3) Riempi con i giorni più recenti.
    for (const h of history) push(h);

    // Ricrea i giorni scelti nei prossimi 8 giorni (a partire da domani), saltando date già occupate.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let createdCount = 0;
    for (let i = 0; i < picked.length; i++) {
      const target = new Date(today.getTime() + (i + 1) * 86_400_000);
      const src = picked[i];
      try {
        await this.prisma.menuDay.upsert({
          where: { clientId_date: { clientId, date: target } } as never,
          create: {
            clientId,
            date: target,
            dietId: src.dietId,
            level: src.level,
            meals: src.meals as never,
            status: 'planned',
            visibleFrom: today,
          } as never,
          update: {
            dietId: src.dietId,
            level: src.level,
            meals: src.meals as never,
            status: 'planned',
            visibleFrom: today,
          } as never,
        });
        createdCount++;
      } catch {
        /* un giorno che fallisce non blocca gli altri */
      }
    }
    await this.audit.log({
      action: 'monitoring.rientro.menus',
      actorId: clientId,
      entityType: 'user',
      entityId: clientId,
      metadata: { menus: createdCount },
    });
    return createdCount;
  }

  private dayKey(d: Date): number {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }
}
