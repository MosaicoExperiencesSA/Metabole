import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

class UpdateStatusDto {
  @IsIn(['open', 'in_progress', 'resolved'])
  status!: string;
}

/** Segnalazioni (escalation) generate da screening onboarding, coach o motore. */
@Controller('admin/escalations')
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
    const updated = await this.prisma.escalation.update({
      where: { id },
      data: { status: dto.status as never },
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
