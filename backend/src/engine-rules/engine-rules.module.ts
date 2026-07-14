import { Module } from '@nestjs/common';
import { EngineRulesController } from './engine-rules.controller';
import { EngineRulesService } from './engine-rules.service';

@Module({
  controllers: [EngineRulesController],
  providers: [EngineRulesService],
  exports: [EngineRulesService],
})
export class EngineRulesModule {}
