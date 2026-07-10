import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminPaymentsController,
  CatalogCommerceController,
  CrmController,
  FinanceController,
  MyCommerceController,
  StripeWebhookController,
} from './commerce.controller';
import { CommerceService } from './commerce.service';
import { CrmService } from './crm.service';
import { FinanceService } from './finance.service';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    CatalogCommerceController,
    MyCommerceController,
    AdminPaymentsController,
    StripeWebhookController,
    CrmController,
    PipelineController,
    FinanceController,
  ],
  providers: [CommerceService, CrmService, FinanceService, PipelineService, StripeService],
  exports: [CommerceService, CrmService, FinanceService, StripeService],
})
export class CommerceModule {}
