import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [MailboxModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
