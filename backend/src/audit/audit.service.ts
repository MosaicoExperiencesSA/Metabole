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

  /**
   * Una riga per ogni entità toccata da un'azione di massa, in una sola query.
   *
   * Nasce dall'assegnazione massiva dei lead: scriveva UN audit con l'id del primo lead, e nel log
   * degli altri duecento non compariva niente — la scheda di quel lead diceva che nessuno l'aveva
   * mai assegnato. Un ciclo di `log()` sarebbe stato duecento INSERT; `createMany` è uno.
   */
  async logMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((e) => ({
          action: e.action,
          actorId: e.actorId ?? null,
          entityType: e.entityType,
          entityId: e.entityId,
          metadata: e.metadata as never,
          ipAddress: e.ipAddress,
        })),
      });
    } catch (err) {
      this.logger.error(
        `Scrittura audit log di massa fallita (${entries.length} righe, action=${entries[0]?.action})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
