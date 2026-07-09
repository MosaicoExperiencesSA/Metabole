import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../signals/signals.service';

export interface CreateEventInput {
  type: string;
  label?: string;
  startDate: string;
  endDate?: string;
  mode: 'single_event' | 'pause_period';
}

/**
 * Calendario (segnale Agenda): eventi singoli e periodi senza dieta.
 * Filosofia della specifica: anticipare, non punire.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(clientId: string) {
    return this.prisma.event.findMany({
      where: { clientId, endDate: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { startDate: 'asc' },
    });
  }

  async create(clientId: string, input: CreateEventInput) {
    const startDate = toDateOnly(input.startDate);
    const endDate = toDateOnly(input.endDate ?? input.startDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('La fine non può precedere l\'inizio');
    }
    if (input.mode === 'single_event' && endDate.getTime() !== startDate.getTime()) {
      throw new BadRequestException('Un evento singolo dura un giorno: usa un periodo di pausa per più giorni');
    }
    const durationDays = (endDate.getTime() - startDate.getTime()) / 86_400_000 + 1;
    if (input.mode === 'pause_period' && durationDays > 30) {
      throw new BadRequestException('Un periodo di pausa può durare al massimo 30 giorni');
    }

    // Peso di riferimento per il mini-piano: ultima misura nota all'inizio pausa.
    let startWeightKg: number | null = null;
    if (input.mode === 'pause_period') {
      const lastMeasure = await this.prisma.measurement.findFirst({
        where: { clientId },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      });
      startWeightKg = lastMeasure?.weightKg ?? null;
    }

    const event = await this.prisma.event.create({
      data: {
        clientId,
        type: input.type as never,
        label: input.label,
        startDate,
        endDate,
        mode: input.mode as never,
        planPhaseState: 'before',
        startWeightKg,
      },
    });
    await this.audit.log({
      action: 'calendar.event.create',
      actorId: clientId,
      entityType: 'event',
      entityId: event.id,
      metadata: { mode: input.mode, type: input.type },
    });
    return event;
  }

  async remove(clientId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, clientId } });
    if (!event) throw new NotFoundException('Evento non trovato');
    await this.prisma.event.delete({ where: { id: eventId } });
    await this.audit.log({
      action: 'calendar.event.delete',
      actorId: clientId,
      entityType: 'event',
      entityId: eventId,
    });
    return { deleted: true };
  }

  /** Piano dell'evento: fasi prima/durante/dopo (spec: anticipare, non punire). */
  async plan(clientId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, clientId } });
    if (!event) throw new NotFoundException('Evento non trovato');
    const today = toDateOnly();
    const phase =
      today.getTime() < event.startDate.getTime()
        ? 'before'
        : today.getTime() > event.endDate.getTime()
          ? 'after'
          : 'during';

    const isPause = event.mode === 'pause_period';
    return {
      event,
      currentPhase: event.planPhaseState === 'mini_plan_active' ? 'mini_plan_active' : phase,
      phases: {
        before: isPause
          ? 'Nei giorni prima alleggeriamo un po\' il piano, così parti serena.'
          : 'Nei 2 giorni prima il menu si alleggerisce: arrivi all\'evento leggera.',
        during: isPause
          ? 'Niente dieta: goditi il periodo. Continua solo a pesarti ogni 2 giorni — se il peso sale oltre la soglia ti mando un mini-piano di equilibrio.'
          : 'Il giorno dell\'evento sei libera: nessun menu, nessun senso di colpa.',
        after: 'Al rientro si riparte con un piano di rientro morbido: nessuna punizione, solo ritmo.',
      },
    };
  }

  // ---------- Query usate da motore e menu ----------

  /** C'è un evento singolo nei prossimi `days` giorni? */
  async hasUpcomingEvent(clientId: string, days = 7): Promise<boolean> {
    const today = toDateOnly();
    const horizon = new Date(today.getTime() + days * 86_400_000);
    const count = await this.prisma.event.count({
      where: {
        clientId,
        mode: 'single_event',
        startDate: { gte: today, lte: horizon },
      },
    });
    return count > 0;
  }

  /** Periodo di pausa attivo oggi (se esiste). */
  async activePausePeriod(clientId: string) {
    const today = toDateOnly();
    return this.prisma.event.findFirst({
      where: {
        clientId,
        mode: 'pause_period',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
  }
}
