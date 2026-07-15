import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ChatModule } from '../chat/chat.module';
import { CommerceModule } from '../commerce/commerce.module';
import { EngineModule } from '../engine/engine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { SignalsModule } from '../signals/signals.module';
import { CronController } from './cron.controller';

@Module({
  imports: [EngineModule, NotificationsModule, CommerceModule, ReportsModule, AlertsModule, ChatModule, SignalsModule],
  controllers: [CronController],
})
export class CronModule {}
