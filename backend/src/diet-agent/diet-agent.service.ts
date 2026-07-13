import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

export type AgentState = 'normale' | 'conforto' | 'pre_evento' | 'plateau';

const DAY = 86_400_000;
const dateOnly = (d: Date): Date => new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');

/**
 * Agente AI della dieta (Metabole_Agente_AI_Dieta): determina lo STATO del cliente,
 * che modula la selezione dei menu.
 * - pre_evento: evento in agenda entro N giorni → giorni più proteici;
 * - plateau: nessun calo negli ultimi N cicli → spinge sull'efficacia;
 * - conforto: umore basso recente → menu più amati (per non farla mollare);
 * - normale: massimizza efficacia × gradimento.
 * La sicurezza (esclusioni) e il bilanciamento restano prioritari e li applica MenuService.
 */
@Injectable()
export class DietAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async stateFor(clientId: string): Promise<AgentState> {
    const [preDays, plateauCycles] = await Promise.all([
      this.configParams.getNumber('agent_pre_event_days', 3),
      this.configParams.getNumber('agent_plateau_cycles', 2),
    ]);
    const today = dateOnly(new Date());
    const horizon = new Date(today.getTime() + preDays * DAY);

    // 1. Pre-evento: evento del cliente in arrivo entro N giorni.
    const upcoming = await this.prisma.event.findFirst({
      where: { clientId, startDate: { gte: today, lte: horizon } },
      select: { id: true },
    });
    if (upcoming) return 'pre_evento';

    // 2. Plateau: ultimi N cicli seguiti senza calo di peso.
    const cycles = (await this.prisma.cycleFeedback.findMany({
      where: { clientId, followed: true },
      orderBy: { cycleEnd: 'desc' },
      take: plateauCycles,
      select: { esitoPeso: true },
    })) as { esitoPeso: string }[];
    if (cycles.length >= plateauCycles && cycles.every((c) => c.esitoPeso === 'stabile' || c.esitoPeso === 'preso')) {
      return 'plateau';
    }

    // 3. Conforto: umore basso nell'ultimo check-in recente (oggi/ieri).
    const checkin = (await this.prisma.dailyCheckin.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { mood: true, date: true },
    })) as { mood: string; date: Date } | null;
    if (checkin) {
      const daysAgo = Math.floor((today.getTime() - dateOnly(checkin.date).getTime()) / DAY);
      if (daysAgo <= 1 && (checkin.mood === 'hard' || checkin.mood === 'stressed')) return 'conforto';
    }

    return 'normale';
  }
}
