import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string; // es. "auth.login", "admin.user.create", "health_data.read"
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Audit log: ogni accesso/azione su dati sensibili e ogni evento di sicurezza
 * viene registrato. La scrittura non deve MAI far fallire l'operazione
 * principale: gli errori vengono loggati e assorbiti.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as never,
          ipAddress: entry.ipAddress,
        },
      });
    } catch (err) {
      this.logger.error(
        `Scrittura audit log fallita per action=${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
