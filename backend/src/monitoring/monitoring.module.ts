import { Module } from '@nestjs/common';
import { ConfigParamsModule } from '../config-params/config-params.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminMonitoringController, MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [ConfigParamsModule, NotificationsModule],
  controllers: [MonitoringController, AdminMonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
