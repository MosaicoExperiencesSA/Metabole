import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import {
  fraseDellaTregua,
  fraseTreguaInAvanti,
  giorniDiTregua,
  treguaFraVacanze,
  treguaVersoLaProssima,
} from '../pause/tregua-fra-vacanze';
import { giornoDiRientro } from '../pause/giorno-di-rientro';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno, giornoDelDato, toDateOnly } from '../common/date-only';
import {
  fraseNonSiSovrappone,
  primoGiornoUtile,
  sovrapposti,
  type PeriodoOccupato,
} from '../pause/primo-giorno-utile';

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
    // ⚠️ Solo per leggere `pause_min_gap_days`: `ConfigParamsModule` è una foglia, nessun anello.
    private readonly configParams: ConfigParamsService,
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

    /**
     * ⛔ **LA TREGUA FRA DUE VACANZE VALE ANCHE DA QUI** (23/8).
     *
     * Questa è la seconda porta della cliente: il suo Calendario, dove «Periodo (più giorni)» crea
     * lo stesso `pause_period` che ferma i menu. Senza il controllo qui la regola dei quindici
     * giorni si aggira scrivendo la vacanza da un'altra schermata — ed è già successo con l'altra
     * differenza fra queste due porte (questa non allunga la scadenza del piano, quella sì).
     */
    if (input.mode === 'pause_period') {
      // ⛔ Nemmeno da qui si mette una pausa nel passato: non ferma niente e sposta la scadenza di
      // giorni che la cliente ha già mangiato (25/8, revisione). Oggi è permesso.
      if (giornoDelDato(startDate).getTime() < aGiorno(new Date()).getTime()) {
        throw new BadRequestException(
          'Quel periodo è già passato: un periodo senza dieta si segna da oggi in avanti. 💚',
        );
      }
      /**
       * ⛔ **NIENTE SOVRAPPOSIZIONI, e da qui non si guardavano affatto** — 25/8, richiesta di
       * Simone. È la stessa aggiunta fatta a `pause.service.requestPause`, e per la stessa ragione:
       * la tregua cerca solo le vacanze **finite prima** della nuova, quindi una sospensione in
       * corso o già programmata era invisibile. Da questa porta il piano non si allunga — ma i menu
       * si fermano lo stesso, e due periodi sovrapposti sono due «bentornata» e due rientri.
       *
       * ⚠️ Il conto è quello di `primo-giorno-utile.ts`, lo stesso delle altre due porte: tre
       * schermate che dicono alla stessa persona tre date diverse sarebbero peggio del difetto.
       */
      const periodi = (await this.prisma.event.findMany({
        where: { clientId, mode: 'pause_period' as never } as never,
        select: { startDate: true, endDate: true, label: true },
      })) as PeriodoOccupato[];
      const collisioni = sovrapposti({ startDate, endDate }, periodi);
      if (collisioni.length) {
        // ⛔ La tregua VERA, non zero: chi propone la data e chi la rifiuta devono fare lo stesso
        // conto, se no si costruisce un vicolo cieco (revisione 25/8).
        const tregua = await giorniDiTregua((k, d) => this.configParams.getNumber(k, d));
        throw new BadRequestException(
          fraseNonSiSovrappone(
            primoGiornoUtile(aGiorno(new Date()), periodi, tregua),
            'cliente',
            collisioni[0],
          ),
        );
      }

      const tregua = await treguaFraVacanze(
        this.prisma,
        (k, d) => this.configParams.getNumber(k, d),
        clientId,
        startDate,
      );
      if (tregua.mancano > 0) throw new BadRequestException(fraseDellaTregua(tregua));

      // ⛔ E anche verso la prossima: guardando solo indietro la tregua si aggirava mettendo la
      // nuova PRIMA di una già programmata (25/8, revisione).
      const avanti = await treguaVersoLaProssima(
        this.prisma, (k, d) => this.configParams.getNumber(k, d), clientId,
        giornoDiRientro({ startDate, endDate }),
      );
      if (avanti.mancano > 0) throw new BadRequestException(fraseTreguaInAvanti(avanti));
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

  /**
   * ⛔ **UNA SOSPENSIONE APPENA FINITA** — e perché serve saperlo (23/8, in revisione).
   *
   * Il cancello della pesata del rientro stava solo dentro «c'è una pausa attiva?». Ma il giorno
   * del rientro la pausa **non è più attiva** (`endDate` è ieri): chi il giorno prima ignorava la
   * richiesta trovava il menu comunque, tarato sulla pesata di metà vacanza che la sorveglianza le
   * aveva chiesto. Cioè il difetto che la consegna esiste per chiudere si riapriva da sé in
   * ventiquattr'ore, e la richiesta diventava un consiglio.
   *
   * La finestra è corta di proposito — un ciclo di erogazione — perché dopo quella il cancello
   * ordinario (`cycleNeedsMeasure`) prende il suo posto e chiede la pesata comunque: due cancelli
   * che si sovrappongono per sempre sarebbero due ragioni diverse per lo stesso blocco.
   */
  async pausaAppenaFinita(clientId: string, entroGiorni: number) {
    const today = toDateOnly();
    const da = new Date(today.getTime() - Math.max(1, entroGiorni) * 86_400_000);
    return this.prisma.event.findFirst({
      where: {
        clientId,
        mode: 'pause_period',
        endDate: { gte: da, lt: today },
      },
      orderBy: { endDate: 'desc' },
    });
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
