import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { DietAgentModule } from '../diet-agent/diet-agent.module';
import { DayComboService } from './day-combo.service';
import { KcalNeedService } from './kcal-need.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [CalendarModule, DietAgentModule],
  controllers: [MenuController],
  providers: [MenuService, DayComboService, KcalNeedService],
  exports: [MenuService, KcalNeedService],
})
export class MenuModule {}
