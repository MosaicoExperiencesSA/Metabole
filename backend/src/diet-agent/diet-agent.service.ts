import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

export type AgentState = 'normale' | 'conforto' | 'pre_evento' | 'post_evento' | 'plateau' | 'rientro';

const DAY = 86_400_000;
const dateOnly = (d: Date): Date => new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
const isLowMood = (m: string): boolean => m === 'hard' || m === 'stressed';

/**
 * Agente AI della dieta (Metabole_Agente_AI_Dieta): determina lo STATO del cliente,
 * che modula la selezione dei menu.
 * - pre_evento: evento in agenda entro N giorni → giorni più proteici;
 * - post_evento: evento concluso da poco (ultimi N giorni) → spinge sull'efficacia (recupero);
 * - plateau: nessun calo negli ultimi N cicli → spinge sull'efficacia;
 * - conforto: umore basso recente → menu più amati (per non farla mollare);
 * - rientro: guardrail dopo il conforto → si torna a spingere l'efficacia
 *   (o perché il conforto è durato troppi giorni di fila, o perché l'umore è risalito
 *   dopo un periodo difficile);
 * - normale: massimizza efficacia × gradimento.
 * La sicurezza (esclusioni) e il bilanciamento restano prioritari e li applica MenuService.
 * La "memoria" dello stato si ricava dallo storico dei check-in (nessuna tabella dedicata).
 */
@Injectable()
export class DietAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async stateFor(clientId: string): Promise<AgentState> {
    const [preDays, postDays, plateauCycles, comfortMax, reentryDays] = await Promise.all([
      this.configParams.getNumber('agent_pre_event_days', 3),
      this.configParams.getNumber('agent_post_event_days', 3),
      this.configParams.getNumber('agent_plateau_cycles', 2),
      this.configParams.getNumber('agent_comfort_max_days', 3),
      this.configParams.getNumber('agent_reentry_days', 3),
    ]);
    const today = dateOnly(new Date());

    // 1. Pre-evento: evento del cliente in arrivo entro N giorni.
    const horizon = new Date(today.getTime() + preDays * DAY);
    const upcoming = await this.prisma.event.findFirst({
      where: { clientId, startDate: { gte: today, lte: horizon } },
      select: { id: true },
    });
    if (upcoming) return 'pre_evento';

    // 2. Post-evento: evento concluso di recente (endDate negli ultimi N giorni) → recupero.
    const postFloor = new Date(today.getTime() - postDays * DAY);
    const recentEnded = await this.prisma.event.findFirst({
      where: { clientId, endDate: { gte: postFloor, lt: today } },
      select: { id: true },
    });
    if (recentEnded) return 'post_evento';

    // 3. Plateau: ultimi N cicli seguiti senza calo di peso.
    const cycles = (await this.prisma.cycleFeedback.findMany({
      where: { clientId, followed: true },
      orderBy: { cycleEnd: 'desc' },
      take: plateauCycles,
      select: { esitoPeso: true },
    })) as { esitoPeso: string }[];
    if (cycles.length >= plateauCycles && cycles.every((c) => c.esitoPeso === 'stabile' || c.esitoPeso === 'preso')) {
      return 'plateau';
    }

    // 4. Conforto / guardrail / rientro — dalla "memoria" dei check-in recenti.
    const lookback = Math.max(comfortMax, reentryDays) + 3;
    const checkins = (await this.prisma.dailyCheckin.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: lookback,
      select: { mood: true, date: true },
    })) as { mood: string; date: Date }[];

    if (checkins.length) {
      const latest = checkins[0];
      const latestDaysAgo = Math.floor((today.getTime() - dateOnly(latest.date).getTime()) / DAY);
      // Il segnale umore conta solo se il check-in più recente è di oggi/ieri.
      if (latestDaysAgo <= 1) {
        if (isLowMood(latest.mood)) {
          // Giorni "difficili" consecutivi (dai check-in più recenti).
          let streak = 0;
          for (const c of checkins) {
            if (isLowMood(c.mood)) streak++;
            else break;
          }
          // Guardrail: se il conforto dura troppi giorni di fila si RIENTRA (spinta efficacia),
          // per non lasciare la cliente ferma nei menu "amati"; sotto la soglia → conforto.
          return streak > comfortMax ? 'rientro' : 'conforto';
        }
        // Umore risalito: se c'è stato un periodo difficile nella finestra di rientro → rientro.
        const reentryFloor = new Date(today.getTime() - reentryDays * DAY);
        const recentLow = checkins.some(
          (c) => isLowMood(c.mood) && dateOnly(c.date).getTime() >= reentryFloor.getTime(),
        );
        if (recentLow) return 'rientro';
      }
    }

    return 'normale';
  }
}
