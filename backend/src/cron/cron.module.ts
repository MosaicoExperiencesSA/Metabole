import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { EngineModule } from '../engine/engine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronController } from './cron.controller';

@Module({
  imports: [EngineModule, NotificationsModule, CommerceModule],
  controllers: [CronController],
})
export class CronModule {}
