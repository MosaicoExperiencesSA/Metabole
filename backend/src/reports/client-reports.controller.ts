import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PlanReportService } from './plan-report.service';

/**
 * Report di fine piano, lato CLIENTE (handoff punto 4): consegna IN APP.
 * Ogni cliente vede SOLO i propri report: il contenuto non viaggia mai
 * via email/WhatsApp (dati sanitari), la notifica contiene solo l'avviso.
 */
@Controller('me/reports')
@Roles('client')
export class ClientReportsController {
  constructor(private readonly planReports: PlanReportService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.planReports.listMine(user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.planReports.getMine(user.sub, id);
  }
}
