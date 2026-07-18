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
