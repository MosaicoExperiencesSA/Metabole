import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { DietAgentModule } from '../diet-agent/diet-agent.module';
import { PushModule } from '../notifications/push.module';
import { DataInizioChatService } from './data-inizio-chat.service';
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
  providers: [MenuService, DayComboService, KcalNeedService, SostituzioneChatService, DataInizioChatService],
  // `SostituzioneChatService` esce dal modulo perché lo usano la chat (il ponte fra la
  // conversazione con Gaia e il menu della giornata) e la scheda cliente in backoffice.
  // `DataInizioChatService` per lo stesso motivo: è la chat che lo chiama, ma è lui che scrive
  // `planStartDate` e rigenera i menu, quindi vive dove vive il motore.
  exports: [MenuService, KcalNeedService, SostituzioneChatService, DataInizioChatService],
})
export class MenuModule {}
