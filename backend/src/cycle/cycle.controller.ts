import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CycleService } from './cycle.service';

/**
 * R10 — Ciclo bigiornaliero attivo.
 * - la cliente vede il proprio ciclo corrente (cosa mangia ora + le 2 cotture);
 * - coach/nutrizionista possono vederlo per una cliente.
 */
@Controller()
export class CycleController {
  constructor(private readonly cycle: CycleService) {}

  @Get('me/cycle')
  @Roles('client')
  mine(@CurrentUser() user: AuthUser) {
    return this.cycle.getActiveCycle(user.sub);
  }

  @Get('clients/:id/cycle')
  @Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'admin')
  forClient(@Param('id') clientId: string) {
    return this.cycle.getActiveCycle(clientId);
  }
}
