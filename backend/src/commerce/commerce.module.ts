import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminPaymentsController,
  AdminPurchasesController,
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
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    CatalogCommerceController,
    MyCommerceController,
    AdminPaymentsController,
    AdminPurchasesController,
    StripeWebhookController,
    CrmController,
    PipelineController,
    RemindersController,
    FinanceController,
    AdminDiscountsController,
    MyDiscountsController,
    LeadAssignmentController,
  ],
  providers: [CommerceService, CrmService, FinanceService, PipelineService, RemindersService, StripeService, DiscountsService, LeadAssignmentService],
  exports: [CommerceService, CrmService, FinanceService, StripeService, DiscountsService, LeadAssignmentService],
})
export class CommerceModule {}
