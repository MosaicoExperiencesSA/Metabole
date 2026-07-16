import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportsService } from './reports.service';

/** Report mensile della cliente (anteprima + invio). */
@Controller('admin/reports')
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':clientId')
  async preview(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    // Coach/nutrizionista: solo i clienti assegnati a loro.
    await this.reports.assertReportAccess(user.sub, clientId);
    return this.reports.buildMonthlyReport(clientId);
  }

  @HttpCode(200)
  @Post(':clientId/send')
  async send(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    await this.reports.assertReportAccess(user.sub, clientId);
    return this.reports.sendMonthlyReport(clientId);
  }
}
