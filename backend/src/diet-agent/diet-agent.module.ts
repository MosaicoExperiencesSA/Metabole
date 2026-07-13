import { Module } from '@nestjs/common';
import { DietAgentService } from './diet-agent.service';

@Module({
  providers: [DietAgentService],
  exports: [DietAgentService],
})
export class DietAgentModule {}
