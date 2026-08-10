import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/audit-logs')
@Roles('admin')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    /**
     * Tetto alzato da 200 a 1000 l'11/8: da quando la pagina «Log attività» filtra e ordina
     * lato client, il tetto non è più «quante righe stanno in una schermata» ma «su quante
     * righe si può cercare». Con 200 una ricerca per nome non trovava niente semplicemente
     * perché quella riga era la 240ª, e il risultato vuoto sembrava un'assenza di fatti.
     * La pagina dichiara quante ne ha caricate su quante esistono, così il limite si vede.
     */
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const where = {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(actorId ? { actorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { actor: { select: { email: true, firstName: true, lastName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: parseInt(page, 10) || 1, limit: take };
  }
}
