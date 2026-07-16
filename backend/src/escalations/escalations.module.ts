import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalationRoutingService } from './escalation-routing.service';
import { EscalationsController } from './escalations.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [EscalationsController],
  providers: [EscalationRoutingService],
  exports: [EscalationRoutingService],
})
export class EscalationsModule {}
