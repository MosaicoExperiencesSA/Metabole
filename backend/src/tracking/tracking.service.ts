import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

/** Oltre questa dimensione il payload `data` viene scartato (protezione anti-abuso). */
const MAX_DATA_BYTES = 16_384;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registra un evento di tracciamento (append-only).
   * - `authHeader`: se presente e valido, lega l'evento all'utente (userId dal JWT).
   * - Idempotente su `eventId`: i retry (sendBeacon) non creano duplicati.
   */
  async ingest(dto: CreateEventDto, authHeader?: string): Promise<{ ok: true; id: string }> {
    const userId = await this.userIdFromToken(authHeader);
    const eventId = dto.eventId?.trim() || randomUUID();
    const data = this.safeData(dto.data);

    const record = await this.prisma.analyticsEvent.upsert({
      where: { eventId },
      update: {}, // idempotente: se esiste già, non cambia nulla
      create: {
        eventId,
        name: dto.event,
        userId: userId ?? null,
        session: dto.session ?? null,
        refcod: dto.refcod ?? null,
        phase: dto.phase ?? null,
        screen: dto.screen ?? null,
        step: dto.step ?? null,
        // cast Json (convenzione del progetto): Record<string, unknown> → InputJsonValue
        data: (data ?? undefined) as never,
        clientTs: dto.ts != null ? BigInt(dto.ts) : null,
      },
      select: { id: true },
    });

    return { ok: true, id: record.id };
  }

  /** Decodifica best-effort del bearer token: null se assente/non valido/scope widget. */
  private async userIdFromToken(authHeader?: string): Promise<string | null> {
    const token = this.extractBearer(authHeader);
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; scope?: string }>(token);
      if (payload.scope === 'widget') return null;
      return payload.sub ?? null;
    } catch {
      // Evento pre-login o token scaduto: resta anonimo (session/refcod).
      return null;
    }
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }

  /** Scarta payload troppo grandi per non gonfiare la tabella eventi. */
  private safeData(data?: Record<string, unknown>): Record<string, unknown> | null {
    if (!data) return null;
    try {
      if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_DATA_BYTES) {
        this.logger.warn('Payload evento troppo grande: scartato');
        return null;
      }
    } catch {
      return null;
    }
    return data;
  }
}
