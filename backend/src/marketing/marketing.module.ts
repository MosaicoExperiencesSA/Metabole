import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { ConfigParamsModule } from '../config-params/config-params.module';
import { MarketingController } from './marketing.controller';
import { MarketingWebhookController } from './marketing-webhook.controller';
import { PrefsController } from './prefs.controller';
import { MarketingService } from './marketing.service';
import { LifecycleService } from './lifecycle.service';

@Module({
  imports: [CommerceModule, ConfigParamsModule],
  controllers: [MarketingController, MarketingWebhookController, PrefsController],
  providers: [MarketingService, LifecycleService],
  exports: [MarketingService, LifecycleService],
})
export class MarketingModule {}
