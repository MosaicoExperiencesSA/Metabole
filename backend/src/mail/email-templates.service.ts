import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async update(
    key: string,
    input: { subject?: string; bodyHtml?: string; active?: boolean },
    actorId: string,
  ) {
    const t = await this.prisma.emailTemplate.findUnique({ where: { key } });
    if (!t) throw new NotFoundException('Modello email non trovato.');
    const updated = await this.prisma.emailTemplate.update({
      where: { key },
      data: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedById: actorId,
      },
    });
    await this.audit.log({ action: 'email.template.update', actorId, entityType: 'email_template', entityId: key });
    return updated;
  }

  logs(limit = 300) {
    // Lista leggera: NON include il corpo HTML (può essere grande).
    return this.prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        to: true,
        templateKey: true,
        subject: true,
        status: true,
        error: true,
        createdAt: true,
      },
    });
  }

  /** Dettaglio di una singola email registrata, incluso il corpo HTML per l'anteprima. */
  async logDetail(id: string) {
    const row = await this.prisma.emailLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Email non trovata nel log.');
    return row;
  }
}
