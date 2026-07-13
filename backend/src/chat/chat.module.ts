import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  MyThreadsController,
  StaffThreadsController,
  ThreadsController,
} from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';

@Module({
  imports: [NotificationsModule, AiModule],
  controllers: [MyThreadsController, StaffThreadsController, ThreadsController],
  providers: [ChatService, ConversationSummaryService],
  exports: [ChatService, ConversationSummaryService],
})
export class ChatModule {}
