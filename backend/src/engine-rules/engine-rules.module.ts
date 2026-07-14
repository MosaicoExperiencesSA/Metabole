import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EngineRulesController } from './engine-rules.controller';
import { EngineRulesService } from './engine-rules.service';

@Module({
  imports: [AiModule],
  controllers: [EngineRulesController],
  providers: [EngineRulesService],
  exports: [EngineRulesService],
})
export class EngineRulesModule {}
