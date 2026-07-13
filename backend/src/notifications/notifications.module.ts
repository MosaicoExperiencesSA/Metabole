import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { MessageComposerService } from './message-composer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [MenuModule],
  controllers: [NotificationsController, PushController],
  providers: [NotificationsService, MessageComposerService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
