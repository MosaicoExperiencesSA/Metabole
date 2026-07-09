import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronController } from './cron.controller';

@Module({
  imports: [EngineModule, NotificationsModule],
  controllers: [CronController],
})
export class CronModule {}
