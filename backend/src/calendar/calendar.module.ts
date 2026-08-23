import { Module } from '@nestjs/common';
import { ConfigParamsModule } from '../config-params/config-params.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  // ⚠️ Foglia: serve solo a leggere la tregua fra due vacanze dai Parametri.
  imports: [ConfigParamsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class CalendarModule {}
