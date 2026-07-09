import { Module } from '@nestjs/common';
import { SignalsModule } from '../signals/signals.module';
import { EngineController, ProtocolsController } from './engine.controller';
import { EngineService } from './engine.service';
import { SignalsCollectorService } from './signals-collector.service';

@Module({
  imports: [SignalsModule],
  controllers: [EngineController, ProtocolsController],
  providers: [EngineService, SignalsCollectorService],
  exports: [EngineService],
})
export class EngineModule {}
