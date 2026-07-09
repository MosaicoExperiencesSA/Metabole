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
import { StripeService } from './stripe.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    CatalogCommerceController,
    MyCommerceController,
    AdminPaymentsController,
    StripeWebhookController,
    CrmController,
    FinanceController,
  ],
  providers: [CommerceService, CrmService, FinanceService, StripeService],
  exports: [CommerceService, CrmService, FinanceService, StripeService],
})
export class CommerceModule {}
