import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

class UpdateStatusDto {
  @IsIn(['open', 'in_progress', 'resolved'])
  status!: string;
}

/**
 * Segnalazioni (escalation) generate da screening onboarding, coach o motore.
 *
 * ⛔ **LA CASELLA `escalations` ADESSO DECIDE DAVVERO** (7/9). Era una delle chiavi «dichiarate e non
 * lette da nessuno»: governava la voce di menu e non la porta.
 *
 * ⚠️ **E non è una guardia inerte**, che è la differenza con le dieci agganciate il 5/9: lì sotto
 * c'era `@Roles('admin')` e l'admin salta la guardia prima di leggere la matrice, quindi non cambiava
 * niente per nessuno. Qui i ruoli sono tre, e per due di loro la casella comincia a contare.
 *
 * ⚠️ **Costo zero, verificato**: `nutritionist` e `head_nutritionist` hanno `escalations` in
 * `{view, manage}` nei default, quindi nessuno perde niente oggi. Cambia il giorno che Simone spegne
 * la casella a qualcuno — ed è esattamente quello che deve poter fare senza un rilascio.
 *
 * ⚠️ `@Roles` **resta**: senza, `PageGuard` diventerebbe l'unico cancello e il suo fail-open non
 * avrebbe più nessuna rete sotto.
 */
@Controller('admin/escalations')
@RequirePage('escalations')
@Roles('admin', 'head_nutritionist', 'nutritionist')
export class EscalationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('status') status?: string, @Query('category') category?: string) {
    return this.prisma.escalation.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(category ? { category: category as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { displayName: true } },
      },
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: AuthUser) {
    /**
     * `resolvedAt` si scrive QUI, alla chiusura, e non si deduce da `updatedAt` (11/8): quello si
     * muove a ogni modifica, e riassegnare la segnalazione a un'altra nutrizionista farebbe
     * ripartire da zero la tregua durante la quale non si riapre. Se qualcuno la riapre a mano la
     * data si azzera, altrimenti resterebbe la chiusura di prima a tenerla zitta.
     */
    const chiude = dto.status === 'resolved';
    const updated = await this.prisma.escalation.update({
      where: { id },
      data: { status: dto.status as never, resolvedAt: chiude ? new Date() : null } as never,
    });
    await this.audit.log({
      action: 'escalation.status',
      actorId: user.sub,
      entityType: 'escalation',
      entityId: id,
      metadata: { status: dto.status },
    });
    return updated;
  }
}
