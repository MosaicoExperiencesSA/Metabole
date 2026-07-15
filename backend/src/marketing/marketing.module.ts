import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingWebhookController } from './marketing-webhook.controller';
import { MarketingService } from './marketing.service';
import { LifecycleService } from './lifecycle.service';

@Module({
  controllers: [MarketingController, MarketingWebhookController],
  providers: [MarketingService, LifecycleService],
  exports: [MarketingService, LifecycleService],
})
export class MarketingModule {}
