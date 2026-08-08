import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { DietAgentModule } from '../diet-agent/diet-agent.module';
import { PushModule } from '../notifications/push.module';
import { DayComboService } from './day-combo.service';
import { KcalNeedService } from './kcal-need.service';
import { MenuController, StaffMeasuresController } from './menu.controller';
import { MenuService } from './menu.service';
import { SostituzioneChatService } from './sostituzione-chat.service';

@Module({
  // `PushModule` e non `NotificationsModule`: quest'ultimo importa noi, e la circolarità non si
  // risolve con un forwardRef messo lì per farla tacere.
  imports: [CalendarModule, DietAgentModule, PushModule],
  controllers: [MenuController, StaffMeasuresController],
  providers: [MenuService, DayComboService, KcalNeedService, SostituzioneChatService],
  // `SostituzioneChatService` esce dal modulo perché lo usano la chat (il ponte fra la
  // conversazione con Gaia e il menu della giornata) e la scheda cliente in backoffice.
  exports: [MenuService, KcalNeedService, SostituzioneChatService],
})
export class MenuModule {}
