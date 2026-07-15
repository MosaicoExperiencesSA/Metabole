import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingWebhookController } from './marketing-webhook.controller';
import { MarketingService } from './marketing.service';

@Module({
  controllers: [MarketingController, MarketingWebhookController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
