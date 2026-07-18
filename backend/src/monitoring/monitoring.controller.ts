import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MonitoringService } from './monitoring.service';

/** Monitoraggio post-percorso (cliente): stato e attivazione del mese gratuito. */
@Controller('me/monitoring')
@Roles('client')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.monitoring.myStatus(user.sub);
  }

  @HttpCode(201)
  @Post('start')
  start(@CurrentUser() user: AuthUser) {
    return this.monitoring.start(user.sub);
  }
}

/**
 * Strumenti admin per il Monitoraggio: forza il giro giornaliero (scadenze,
 * trigger di rientro, congelamenti, richieste misure) senza aspettare il cron —
 * utile per collaudo e per sbloccare subito una situazione. Con audit.
 */
@Controller('admin/monitoring')
@Roles('admin')
export class AdminMonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @HttpCode(200)
  @Post('tick')
  async tick(@CurrentUser() user: AuthUser) {
    const result = await this.monitoring.dailyTick();
    await this.monitoring.auditTick(user.sub, result);
    return result;
  }
}
