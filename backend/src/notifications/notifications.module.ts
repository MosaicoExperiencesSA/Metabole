import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { MessageComposerService } from './message-composer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AdminPushTestController, PushController } from './push.controller';
import { PushModule } from './push.module';

@Module({
  imports: [MenuModule, PushModule],
  controllers: [NotificationsController, PushController, AdminPushTestController],
  providers: [NotificationsService, MessageComposerService],
  // `PushModule` viene riesportato: chi importava questo modulo per avere `PushService` non cambia
  // una riga. Vedi il commento in `push.module.ts` per il perché dell'estrazione.
  exports: [NotificationsService, PushModule],
})
export class NotificationsModule {}
