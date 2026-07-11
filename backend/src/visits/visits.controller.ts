import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Agenda visite col nutrizionista. Le note cliniche NON sono esposte qui
 * (restano riservate a nutrizionista e capo nella scheda dedicata).
 */
@Controller('admin/visits')
@Roles('admin', 'head_nutritionist', 'nutritionist')
export class VisitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.prisma.visit.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { datetime: 'asc' },
      select: {
        id: true,
        type: true,
        datetime: true,
        status: true,
        client: { select: { id: true, email: true, firstName: true, lastName: true } },
        nutritionist: { select: { displayName: true } },
      },
    });
  }
}
