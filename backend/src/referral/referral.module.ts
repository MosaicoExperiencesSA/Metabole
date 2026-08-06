import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

// AuditService, ConfigParamsService e PrismaService sono forniti da moduli @Global.
// NotificationsModule serve per avvisare la referrer quando la ricompensa arriva davvero.
@Module({
  imports: [NotificationsModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
