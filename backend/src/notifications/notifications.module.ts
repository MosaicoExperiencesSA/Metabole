import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { MessageComposerService } from './message-composer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MenuModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MessageComposerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
