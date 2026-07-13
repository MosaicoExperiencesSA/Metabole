import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { DietAgentModule } from '../diet-agent/diet-agent.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [CalendarModule, DietAgentModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
