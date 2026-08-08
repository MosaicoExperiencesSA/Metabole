import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
// Il ponte fra la conversazione con Gaia e il menu della giornata vive nel modulo menu
// (è lui che scrive su `MenuDay`). `MenuModule` non importa `ChatModule`: nessun ciclo.
import { MenuModule } from '../menu/menu.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  MyThreadsController,
  StaffClientChatController,
  StaffThreadsController,
  ThreadsController,
} from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';

@Module({
  imports: [NotificationsModule, AiModule, MenuModule],
  controllers: [
    MyThreadsController,
    StaffThreadsController,
    StaffClientChatController,
    ThreadsController,
  ],
  providers: [ChatService, ConversationSummaryService],
  exports: [ChatService, ConversationSummaryService],
})
export class ChatModule {}
