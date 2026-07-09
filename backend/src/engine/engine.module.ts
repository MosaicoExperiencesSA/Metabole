import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { SignalsModule } from '../signals/signals.module';
import { EngineController, ProtocolsController } from './engine.controller';
import { EngineService } from './engine.service';
import { SignalsCollectorService } from './signals-collector.service';

@Module({
  imports: [SignalsModule, CalendarModule],
  controllers: [EngineController, ProtocolsController],
  providers: [EngineService, SignalsCollectorService],
  exports: [EngineService],
})
export class EngineModule {}
