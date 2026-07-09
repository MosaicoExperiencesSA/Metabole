import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  MyThreadsController,
  StaffThreadsController,
  ThreadsController,
} from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MyThreadsController, StaffThreadsController, ThreadsController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
