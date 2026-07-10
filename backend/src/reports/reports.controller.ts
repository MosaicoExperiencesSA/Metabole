import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

/** Report mensile della cliente (anteprima + invio). */
@Controller('admin/reports')
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':clientId')
  preview(@Param('clientId') clientId: string) {
    return this.reports.buildMonthlyReport(clientId);
  }

  @HttpCode(200)
  @Post(':clientId/send')
  send(@Param('clientId') clientId: string) {
    return this.reports.sendMonthlyReport(clientId);
  }
}
