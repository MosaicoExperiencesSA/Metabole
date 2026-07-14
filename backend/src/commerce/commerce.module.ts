import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import {
  AdminPaymentsController,
  AdminPurchasesController,
  AdminShopController,
  CatalogCommerceController,
  CrmController,
  FinanceController,
  MyCommerceController,
  StripeWebhookController,
} from './commerce.controller';
import { CommerceService } from './commerce.service';
import { CrmService } from './crm.service';
import { AdminDiscountsController, MyDiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { FinanceService } from './finance.service';
import { LeadAssignmentController } from './lead-assignment.controller';
import { LeadAssignmentService } from './lead-assignment.service';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PublicLeadController } from './public-lead.controller';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [NotificationsModule, ReferralModule],
  controllers: [
    CatalogCommerceController,
    MyCommerceController,
    AdminPaymentsController,
    AdminPurchasesController,
    AdminShopController,
    StripeWebhookController,
    CrmController,
    PipelineController,
    RemindersController,
    FinanceController,
    AdminDiscountsController,
    MyDiscountsController,
    LeadAssignmentController,
    PublicLeadController,
    AccountingController,
  ],
  providers: [CommerceService, CrmService, FinanceService, PipelineService, RemindersService, StripeService, DiscountsService, LeadAssignmentService, AccountingService],
  exports: [CommerceService, CrmService, FinanceService, StripeService, DiscountsService, LeadAssignmentService],
})
export class CommerceModule {}
