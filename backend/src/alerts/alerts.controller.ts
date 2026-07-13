import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AlertsService } from './alerts.service';

class UpdateAlertDto {
  @IsIn(['handled', 'escalated', 'open'])
  status!: 'handled' | 'escalated' | 'open';
}

/** Coda alert per la coach (app coach) + azioni di gestione. */
@Controller()
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** Coda avvisi della coach (filtrabile per gruppo/priorità). */
  @Get('coach/alerts')
  list(
    @CurrentUser() user: AuthUser,
    @Query('group') group?: string,
    @Query('priority') priority?: string,
  ) {
    return this.alerts.listForCoach(user, { group, priority });
  }

  /** Segna un alert come gestito / inoltrato / riaperto. */
  @Put('alerts/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alerts.updateStatus(id, user, dto.status);
  }
}
