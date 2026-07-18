import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { CoachTasksModule } from '../coach-tasks/coach-tasks.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AlertsModule } from '../alerts/alerts.module';
import { ChatModule } from '../chat/chat.module';
import { CommerceModule } from '../commerce/commerce.module';
import { EngineModule } from '../engine/engine.module';
import { HealthAreaModule } from '../health-area/health-area.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { SignalsModule } from '../signals/signals.module';
import { CronController } from './cron.controller';

@Module({
  imports: [EngineModule, NotificationsModule, CommerceModule, ReportsModule, AlertsModule, ChatModule, SignalsModule, HealthAreaModule, AgentsModule, CoachTasksModule, MonitoringModule],
  controllers: [CronController],
})
export class CronModule {}
