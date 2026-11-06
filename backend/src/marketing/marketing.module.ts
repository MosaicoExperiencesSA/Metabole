import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { ConfigParamsModule } from '../config-params/config-params.module';
import { MarketingController } from './marketing.controller';
import { MarketingWebhookController } from './marketing-webhook.controller';
import { PrefsController, UnsubscribeController } from './prefs.controller';
import { MarketingService } from './marketing.service';
import { LifecycleService } from './lifecycle.service';
import { InvitoGaiaController, InvitoGaiaPubblicoController } from './invito-gaia/invito-gaia.controller';
import { InvitoGaiaService } from './invito-gaia/invito-gaia.service';
import { PostaDeiDomini } from './invito-gaia/posta-del-dominio';

@Module({
  imports: [CommerceModule, ConfigParamsModule],
  controllers: [MarketingController, MarketingWebhookController, PrefsController, UnsubscribeController, InvitoGaiaController, InvitoGaiaPubblicoController],
  providers: [MarketingService, LifecycleService, InvitoGaiaService, PostaDeiDomini],
  exports: [MarketingService, LifecycleService, InvitoGaiaService],
})
export class MarketingModule {}
