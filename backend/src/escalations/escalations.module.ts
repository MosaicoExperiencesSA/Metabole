import { Module } from '@nestjs/common';
import { EscalationRoutingService } from './escalation-routing.service';
import { EscalationsController } from './escalations.controller';

@Module({
  controllers: [EscalationsController],
  providers: [EscalationRoutingService],
  exports: [EscalationRoutingService],
})
export class EscalationsModule {}
