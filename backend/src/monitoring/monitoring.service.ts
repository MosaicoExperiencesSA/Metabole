import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export const RIENTRO_PLAN_NAME = 'Menu di rientro (8 giorni)';

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
 * Livello "Monitoraggio" (spec Antonio 17/07): paracadute di retention GRATUITO e a
 * tempo (max 1 mese) per chi finisce il percorso e non rinnova. Gaia non eroga menu:
 * sorveglia le misure e, se il peso sale oltre la soglia (+3 kg parametrizzabile),
 * propone gli 8 MENU DI RIENTRO (€29, sempre a pagamento) presi dallo storico
 * personale della cliente (i giorni che hanno fatto perdere di più). Se non paga
 * entro la finestra, il monitoraggio si CONGELA: lo storico resta salvato (nessun
 * purge) e al ritorno Gaia riparte da lì. Tono sempre supportivo, mai punitivo.
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

  private async rientroPlan(): Promise<{ id: string; name: string; priceCents: number } | null> {
    return (await this.prisma.plan.findFirst({
      where: { name: RIENTRO_PLAN_NAME, active: true },
      select: { id: true, name: true, priceCents: true },
    })) as { id: string; name: string; priceCents: number } | null;
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
    const hadSub = await this.prisma.subscription.findFirst({ where: { clientId }, select: { id: true } });
    const last = await this.lastWeight(clientId);
    const plan = await this.rientroPlan();
    const regainKg = await this.configParams.getNumber('monitoring_regain_kg', 3);

    const active = period?.status === 'active' ? period : null;
    return {
      eligible: !activeSub && !!hadSub && (!period || period.status !== 'active'),
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
      rientro: plan ? { planId: plan.id, planName: plan.name, priceCents: plan.priceCents } : null,
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
    const plan = await this.rientroPlan();
    const periods = (await this.prisma.monitoringPeriod.findMany({ where: { status: 'active' } })) as Period[];
    let expired = 0;
    let offered = 0;
    let frozen = 0;
    let asked = 0;

    for (const p of periods) {
      try {
        // 1) Offerta di rientro ignorata oltre la finestra → congela (storico salvo, tono supportivo).
        if (p.regainOfferedAt && now.getTime() - p.regainOfferedAt.getTime() > offerDays * 86_400_000) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { status: 'frozen', frozenAt: now, closedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_rifiutato_congelato', p.clientId);
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_frozen',
              title: 'Il tuo profilo resta al sicuro 💚',
              body: 'Metto in pausa il monitoraggio, ma non butto via niente: tutto quello che ho imparato su di te resta salvato. Il tuo kit di rientro è pronto quando ti serve — torna quando vuoi.',
            })
            .catch(() => undefined);
          frozen++;
          continue;
        }

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

        // 3) Trigger di rientro: peso oltre la soglia rispetto al riferimento → proponi il kit (€29).
        if (!p.regainOfferedAt && last && last.weightKg - p.referenceWeightKg >= regainKg) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { regainOfferedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_rientro_offerto', p.clientId, {
            deltaKg: Math.round((last.weightKg - p.referenceWeightKg) * 10) / 10,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_rientro_offer',
              title: 'Il tuo kit di rientro è pronto 🧰',
              body: `Capita a tutte (vacanze, periodi pieni…). Ho preparato i tuoi 8 menu di rientro: i giorni che su di te hanno funzionato meglio. Di solito bastano 4-6 giorni per recuperare. ${plan ? `Li sblocchi a €${(plan.priceCents / 100).toFixed(0)}.` : ''}`,
              payload: plan ? { planId: plan.id } : undefined,
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

  // ---------- Hook dal commercio ----------

  /**
   * Chiamato all'ATTIVAZIONE di un piano (pagamento approvato).
   * - Menu di rientro: eroga gli 8 menu migliori dallo storico + riparte un nuovo
   *   mese di monitoraggio gratuito (proposta Antonio: sì, crea il loop pulito).
   * - Altro piano a pagamento con monitoraggio in corso: conversione (dimagrimento
   *   o mantenimento), il monitoraggio si chiude.
   */
  async onPlanActivated(clientId: string, plan: { id: string; name: string; priceCents: number; period: string }): Promise<void> {
    try {
      const period = await this.activePeriod(clientId);
      if (plan.name === RIENTRO_PLAN_NAME) {
        const generated = await this.generateRientroMenus(clientId);
        await this.funnelEvent('monitoraggio_rientro_pagato', clientId, { menus: generated });
        // Un rientro pagato fa ripartire il mese di sorveglianza gratuito.
        const days = await this.configParams.getNumber('monitoring_duration_days', 30);
        const endsAt = new Date(Date.now() + days * 86_400_000);
        if (period) {
          await this.prisma.monitoringPeriod.update({
            where: { id: period.id },
            data: { endsAt, regainOfferedAt: null, lastMeasureAskAt: null } as never,
          });
        } else {
          const last = await this.lastWeight(clientId);
          if (last) {
            await this.prisma.monitoringPeriod.create({
              data: { clientId, status: 'active', endsAt, referenceWeightKg: last.weightKg } as never,
            });
          }
        }
        await this.notifications
          .notify({
            userId: clientId,
            type: 'monitoring_rientro_paid',
            title: 'Kit di rientro sbloccato 💪',
            body: `I tuoi ${generated} menu di rientro sono in app da domani: sono i giorni che hanno funzionato meglio su di te. E il monitoraggio riparte per un altro mese, gratis.`,
          })
          .catch(() => undefined);
        return;
      }
      // Conversione: qualsiasi altro piano a pagamento chiude il monitoraggio in corso.
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
