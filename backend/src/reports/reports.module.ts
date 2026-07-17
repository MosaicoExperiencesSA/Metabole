import { Module } from '@nestjs/common';
import { ClientReportsController } from './client-reports.controller';
import { PlanReportService } from './plan-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, ClientReportsController],
  providers: [ReportsService, PlanReportService],
  exports: [ReportsService, PlanReportService],
})
export class ReportsModule {}
