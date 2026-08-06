import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * CREA un modello email nuovo. Stessa storia dei parametri: finora la lista era solo quella
   * del seed, e un modello dimenticato lì non era modificabile da nessuna parte — l'email
   * partiva col testo scritto nel codice, e chi voleva cambiarlo non trovava la riga.
   */
  async create(
    input: { key: string; name: string; subject: string; bodyHtml: string },
    actorId: string,
  ) {
    const key = (input.key ?? '').trim();
    if (!/^[a-z][a-z0-9_]{2,59}$/.test(key)) {
      throw new BadRequestException('Chiave non valida: minuscole, numeri e underscore, da 3 a 60 caratteri (es. lead_credentials).');
    }
    if (!input.name?.trim() || !input.subject?.trim() || !input.bodyHtml?.trim()) {
      throw new BadRequestException('Nome, oggetto e corpo sono obbligatori.');
    }
    const exists = await this.prisma.emailTemplate.findUnique({ where: { key }, select: { key: true } });
    if (exists) throw new ConflictException(`Il modello "${key}" esiste già: aprilo dall'elenco.`);
    const created = await this.prisma.emailTemplate.create({
      data: { key, name: input.name.trim(), subject: input.subject.trim(), bodyHtml: input.bodyHtml, updatedById: actorId } as never,
    });
    await this.audit.log({ action: 'email.template.create', actorId, entityType: 'email_template', entityId: key });
    return created;
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
